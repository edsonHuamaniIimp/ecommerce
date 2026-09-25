import type { ISgcRepository } from "@/domain/ports/sgc-repository";
import type { ISgcClient } from "@/domain/ports/sgc-client";
import type { IDocumentoOrigen } from "@/domain/ports/documento-origen";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type {
  SgcCampoTipo,
  SgcCrearExpedienteInput,
  SgcDocumentoEntity,
  SgcExpedienteDetalle,
  SgcExpedienteEntity,
  SgcPiezaDocumental,
  SgcUrlDescarga,
} from "@/domain/models/sgc";
import {
  SGC_APPROVAL_RESULT,
  SGC_DOCUMENT_CATEGORIES,
  SGC_DOCUMENTO_ESTADO,
  SGC_ESTADO_ENVIO,
  SGC_IDEMPOTENCY_RESEND_PREFIX,
  SGC_MOTIVO_CARGA_INICIAL,
  SGC_SUBSANACION_MOTIVO,
  TIPOS_DOCUMENTO_SOLICITUD,
} from "@/lib/shared/constants";
import type { SgcDocumentCategory } from "@/lib/shared/constants";
import { construirIdempotencyKey, extraerDocumentosLegacy, sha256Hex } from "@/lib/shared/utils/sgc";
import type { DocumentoUrl } from "@/lib/shared/utils/sgc";
import type { SolicitudRow } from "@/domain/models/entities";
import { mapSolicitudToExpediente } from "@/lib/shared/mappers/sgc";

export interface SgcIntegracionConfig {
  enabled: boolean;
  areaCode: string;
  contractTypeCode: string;
}

const MAX_ERROR_LENGTH = 500;

/**
 * Orquesta la creacion del expediente en el SGC a partir de una solicitud
 * aprobada por Legal. Best-effort: ante cualquier fallo del SGC registra el
 * error en la correlacion y nunca propaga la excepcion al flujo de aprobacion.
 */
export class SgcIntegracionApplicationService {
  constructor(
    private readonly solicitudRepo: ISolicitudesRepository,
    private readonly repo: ISgcRepository,
    private readonly client: ISgcClient,
    private readonly documentoOrigen: IDocumentoOrigen,
    private readonly config: SgcIntegracionConfig,
  ) {}

  /** True si la integracion SGC esta activada en el servidor (`SGC_ENABLED=1`). */
  estaHabilitado(): boolean {
    return this.config.enabled;
  }

  /** Correlacion local del expediente (para exponer errores de envio en la UI). */
  async obtenerRegistroLocal(solicitudId: string): Promise<SgcExpedienteEntity | null> {
    return this.repo.findExpedientePorSolicitud(solicitudId);
  }

  async crearExpedienteDesdeSolicitud(solicitudId: string): Promise<SgcExpedienteEntity | null> {
    if (!this.config.enabled) return null;

    // Best-effort TOTAL: ningun fallo (BD no migrada, red, etc.) puede romper la aprobacion.
    try {
      const existente = await this.repo.findExpedientePorSolicitud(solicitudId);
      if (existente?.estadoEnvio === SGC_ESTADO_ENVIO.CREADO && existente.contractId) return existente;

      const detalle = await this.solicitudRepo.detalle(solicitudId);
      if (!detalle) return existente;

      const input = await this.conCamposDelTipo(mapSolicitudToExpediente(detalle, this.config));
      const registro = existente ?? (await this.crearRegistroConCodigoUnico(solicitudId, input.code));

      try {
        const resultado = await this.client.crearExpediente(
          { ...input, code: registro.code },
          construirIdempotencyKey(solicitudId),
        );
        return await this.repo.actualizarExpediente(registro.id, {
          contractId: resultado.contractId,
          estadoEnvio: SGC_ESTADO_ENVIO.CREADO,
          lastSyncedAt: new Date(),
          lastError: null,
        });
      } catch (err) {
        const mensaje = err instanceof Error ? err.message : "Error desconocido al crear el expediente en el SGC";
        await this.repo
          .actualizarExpediente(registro.id, {
            estadoEnvio: SGC_ESTADO_ENVIO.ERROR,
            lastError: mensaje.slice(0, MAX_ERROR_LENGTH),
          })
          .catch(() => undefined);
        return null;
      }
    } catch (err) {
      console.error(
        `[SGC] crearExpedienteDesdeSolicitud(${solicitudId}) fallo:`,
        err instanceof Error ? (err.stack ?? err.message) : err,
      );
      return null;
    }
  }

  /**
   * Crea la correlacion local. El `code` (p. ej. el `standCode`) puede repetirse si el mismo
   * stand se alquila en otra solicitud; ante la colision (P2002) se usa un sufijo con el id de
   * la solicitud para garantizar unicidad, y ese mismo `code` se envia al SGC.
   */
  private async crearRegistroConCodigoUnico(solicitudId: string, code: string): Promise<SgcExpedienteEntity> {
    const crear = (codigo: string) =>
      this.repo.crearExpediente({
        solicitudId,
        code: codigo,
        areaCode: this.config.areaCode,
        contractTypeCode: this.config.contractTypeCode,
      });
    try {
      return await crear(code);
    } catch (err) {
      if ((err as { code?: string }).code !== "P2002") throw err;
      return crear(`${code}-${solicitudId.slice(0, 8)}`);
    }
  }

  /**
   * Completa `fields` con los campos obligatorios que declare el tipo (guia v3, §3.2):
   * `GET /contract-types` -> `items[].fields` (required + apiSupported). Best-effort: si no se
   * puede consultar el catalogo, se crea sin `fields` (el SGC respondera si falta alguno).
   */
  private async conCamposDelTipo(input: SgcCrearExpedienteInput): Promise<SgcCrearExpedienteInput> {
    try {
      const catalogo = await this.client.listarTiposContrato();
      const tipo = catalogo.items.find((t) => t.code === this.config.contractTypeCode);
      const requeridos = (tipo?.fields ?? []).filter((f) => f.required && f.apiSupported);
      if (requeridos.length === 0) return input;
      const fields: Record<string, string | number | boolean> = {};
      for (const campo of requeridos) fields[campo.key] = valorPorDefectoCampo(campo, input);
      return { ...input, fields };
    } catch {
      return input;
    }
  }

  /** Consulta el detalle del expediente en el SGC y sincroniza la correlacion local. */
  async consultarExpediente(solicitudId: string): Promise<SgcExpedienteDetalle | null> {
    if (!this.config.enabled) return null;

    const expediente = await this.repo.findExpedientePorSolicitud(solicitudId);
    if (!expediente?.contractId) return null;

    try {
      const detalle = await this.client.consultarExpediente(expediente.contractId);
      await this.repo.actualizarExpediente(expediente.id, {
        stage: detalle.stage,
        lifecycleStatus: detalle.lifecycleStatus,
        version: detalle.version,
        lastSyncedAt: new Date(),
        lastError: null,
      });
      return detalle;
    } catch {
      // Lectura best-effort: si el SGC no responde, el panel muestra el estado local.
      return null;
    }
  }

  /** Reconciliacion (polling): refresca el estado de los expedientes ya creados. */
  async reconciliar(): Promise<number> {
    if (!this.config.enabled) return 0;

    const expedientes = await this.repo.listarConContractId();
    let sincronizados = 0;
    for (const expediente of expedientes) {
      if (!expediente.contractId) continue;
      try {
        const detalle = await this.client.consultarExpediente(expediente.contractId);
        await this.repo.actualizarExpediente(expediente.id, {
          stage: detalle.stage,
          lifecycleStatus: detalle.lifecycleStatus,
          version: detalle.version,
          lastSyncedAt: new Date(),
          lastError: null,
        });
        sincronizados += 1;
      } catch (err) {
        const mensaje = err instanceof Error ? err.message : "Error desconocido al reconciliar";
        await this.repo.actualizarExpediente(expediente.id, { lastError: mensaje.slice(0, MAX_ERROR_LENGTH) });
      }
    }
    return sincronizados;
  }

  /** Reintenta los expedientes que quedaron en `error` (best-effort, sin bloquear). */
  async reintentarErrores(): Promise<number> {
    if (!this.config.enabled) return 0;

    const pendientes = await this.repo.listarConEstadoEnvio(SGC_ESTADO_ENVIO.ERROR);
    let reintentados = 0;
    for (const expediente of pendientes) {
      const resultado = await this.crearExpedienteDesdeSolicitud(expediente.solicitudId);
      if (resultado?.estadoEnvio === SGC_ESTADO_ENVIO.CREADO) reintentados += 1;
    }
    return reintentados;
  }

  /** Rutina programada (cron): refresca estados y reintenta envios fallidos. */
  async sincronizarCron(): Promise<{ sincronizados: number; reintentados: number }> {
    const sincronizados = await this.reconciliar();
    const reintentados = await this.reintentarErrores();
    return { sincronizados, reintentados };
  }

  /** Empuja una pieza documental al SGC (reservar → transferir → confirmar). */
  async subirPiezaDocumental(solicitudId: string, pieza: SgcPiezaDocumental): Promise<SgcDocumentoEntity | null> {
    if (!this.config.enabled) return null;

    const expediente = await this.repo.findExpedientePorSolicitud(solicitudId);
    if (!expediente?.contractId) return null;

    const checksumSha256 = await sha256Hex(pieza.bytes);
    const reserva = await this.client.reservarSubida(expediente.contractId, {
      category: pieza.category,
      title: pieza.title,
      fileName: pieza.fileName,
      sizeBytes: pieza.bytes.byteLength,
      checksumSha256,
      declaredMimeType: pieza.mimeType,
      replacementReason: pieza.replacementReason || SGC_MOTIVO_CARGA_INICIAL,
      documentId: pieza.documentId ?? null,
    });

    let documento: SgcDocumentoEntity;
    if (pieza.documentId) {
      await this.repo.actualizarDocumento(pieza.documentId, {
        currentVersionId: reserva.versionId,
        estado: SGC_DOCUMENTO_ESTADO.RESERVADO,
      });
      documento = this.construirDocumento(
        expediente.id,
        reserva.documentId,
        pieza,
        checksumSha256,
        SGC_DOCUMENTO_ESTADO.RESERVADO,
        reserva.versionId,
      );
    } else {
      documento = await this.repo.crearDocumento({
        sgcExpedienteId: expediente.id,
        documentId: reserva.documentId,
        category: pieza.category,
        title: pieza.title,
        fileName: pieza.fileName,
        checksumSha256,
        sizeBytes: pieza.bytes.byteLength,
      });
    }

    await this.client.transferirArchivo(reserva.uploadUrl, reserva.headers, pieza.bytes);
    const confirmacion = await this.client.confirmarSubida(reserva.versionId);
    const estado =
      confirmacion.outcome === SGC_APPROVAL_RESULT.REJECTED
        ? SGC_DOCUMENTO_ESTADO.RECHAZADO
        : SGC_DOCUMENTO_ESTADO.CONFIRMADO;

    await this.repo.actualizarDocumento(documento.documentId, {
      currentVersionId: reserva.versionId,
      estado,
    });
    return { ...documento, currentVersionId: reserva.versionId, estado };
  }

  /** Lee un documento desde su URL y lo empuja al SGC. */
  async subirDocumentoDesdeUrl(
    solicitudId: string,
    params: {
      category: SgcDocumentCategory;
      title: string;
      url: string;
      documentId?: string | null;
      replacementReason?: string;
    },
  ): Promise<SgcDocumentoEntity | null> {
    if (!this.config.enabled) return null;
    const contenido = await this.documentoOrigen.leer(params.url);
    return this.subirPiezaDocumental(solicitudId, {
      category: params.category,
      title: params.title,
      fileName: contenido.fileName,
      mimeType: contenido.mimeType,
      bytes: contenido.bytes,
      documentId: params.documentId,
      replacementReason: params.replacementReason,
    });
  }

  /** Devuelve un enlace de descarga (vida corta) del contrato vigente firmado. */
  async obtenerDescargaContrato(solicitudId: string): Promise<SgcUrlDescarga | null> {
    if (!this.config.enabled) return null;

    const expediente = await this.repo.findExpedientePorSolicitud(solicitudId);
    if (!expediente?.contractId) return null;

    const detalle = await this.client.consultarExpediente(expediente.contractId);
    const contrato = detalle.documents.find((doc) => doc.category === SGC_DOCUMENT_CATEGORIES.CONTRACT);
    if (!contrato?.currentVersionId) return null;

    return this.client.obtenerUrlDescarga(contrato.currentVersionId);
  }

  /** Empuja una version corregida del contrato (subsanacion) sobre el mismo documentId. */
  async subsanarContrato(
    solicitudId: string,
    params: { url: string; title: string; documentId: string },
  ): Promise<SgcDocumentoEntity | null> {
    const documento = await this.subirDocumentoDesdeUrl(solicitudId, {
      category: SGC_DOCUMENT_CATEGORIES.CONTRACT,
      title: params.title,
      url: params.url,
      documentId: params.documentId,
      replacementReason: SGC_SUBSANACION_MOTIVO,
    });
    if (!documento) return null;

    /*
     * Tras subir la version corregida hay que reabrir el tramite (POST /resend),
     * una sola vez por ronda (doc §8.1). Si no, el expediente no vuelve a avanzar.
     */
    const expediente = await this.repo.findExpedientePorSolicitud(solicitudId);
    if (expediente?.contractId) {
      await this.client.reabrirExpediente(
        expediente.contractId,
        `${SGC_IDEMPOTENCY_RESEND_PREFIX}/${solicitudId}`,
      );
    }
    return documento;
  }

  /**
   * Empuja el contrato v1: el documento **del administrador** de la solicitud
   * (`SolicitudDocumento.userId === null`; el cliente sube evidencia, no contrato).
   */
  async subirContratoDeSolicitud(solicitudId: string): Promise<SgcDocumentoEntity | null> {
    if (!this.config.enabled) return null;
    const detalle = await this.solicitudRepo.detalle(solicitudId);
    if (!detalle) return null;

    const contrato = this.seleccionarContrato(detalle);
    if (!contrato) return null;

    // Idempotencia: si el SGC ya tiene el contrato, no crear otra pieza documental.
    const expediente = await this.repo.findExpedientePorSolicitud(solicitudId);
    if (expediente?.contractId) {
      try {
        const actual = await this.client.consultarExpediente(expediente.contractId);
        const existente = actual.documents.find((d) => d.category === SGC_DOCUMENT_CATEGORIES.CONTRACT);
        if (existente) {
          return {
            id: existente.documentId,
            sgcExpedienteId: expediente.id,
            documentId: existente.documentId,
            currentVersionId: existente.currentVersionId,
            category: SGC_DOCUMENT_CATEGORIES.CONTRACT,
            title: existente.title,
            fileName: existente.title,
            checksumSha256: null,
            sizeBytes: null,
            estado: SGC_DOCUMENTO_ESTADO.CONFIRMADO,
          };
        }
      } catch {
        /* Si la consulta falla, se intenta la subida igual. */
      }
    }

    return this.subirDocumentoDesdeUrl(solicitudId, {
      category: SGC_DOCUMENT_CATEGORIES.CONTRACT,
      title: contrato.nombre,
      url: contrato.url,
    });
  }

  /** Empuja los documentos **del cliente** (`userId` no nulo) como anexos del SGC. */
  async subirAnexosDeSolicitud(solicitudId: string): Promise<SgcDocumentoEntity[]> {
    if (!this.config.enabled) return [];
    const detalle = await this.solicitudRepo.detalle(solicitudId);
    if (!detalle) return [];

    /*
     * Los documentos del cliente viven en dos lugares: la tabla `solicitud_documento`
     * (`docsAdjuntos`, con `userId`) y la columna JSON legacy `documentos` del stand.
     * Se consideran ambos, deduplicando por URL y excluyendo el que ya se usa como
     * contrato (evita subir el mismo archivo como contrato y como anexo).
     */
    const contrato = this.seleccionarContrato(detalle);
    const contratoUrl = contrato?.url;
    const contratoClave = contrato?.nombre || contratoUrl;
    const candidatos: DocumentoUrl[] = [
      ...detalle.docsAdjuntos
        .filter((d) => d.userId !== null && d.categoria !== TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO)
        .map((d) => ({ url: d.url, nombre: d.nombre })),
      ...extraerDocumentosLegacy(detalle.documentos),
    ];

    // Idempotencia: no reenviar anexos que ya esten en el SGC (por titulo/nombre).
    const titulosEnSgc = new Set<string>();
    const expediente = await this.repo.findExpedientePorSolicitud(solicitudId);
    if (expediente?.contractId) {
      try {
        const actual = await this.client.consultarExpediente(expediente.contractId);
        for (const d of actual.documents.filter((x) => x.category === SGC_DOCUMENT_CATEGORIES.ANNEX)) {
          titulosEnSgc.add(d.title);
        }
      } catch {
        /* Si la consulta falla, se intenta la subida igual. */
      }
    }

    const vistos = new Set<string>();
    const resultados: SgcDocumentoEntity[] = [];
    for (const doc of candidatos) {
      const clave = doc.nombre || doc.url;
      if (
        vistos.has(clave) ||
        doc.url === contratoUrl ||
        clave === contratoClave ||
        titulosEnSgc.has(doc.nombre)
      ) {
        continue;
      }
      vistos.add(clave);
      const subido = await this.subirDocumentoDesdeUrl(solicitudId, {
        category: SGC_DOCUMENT_CATEGORIES.ANNEX,
        title: doc.nombre,
        url: doc.url,
      });
      if (subido) resultados.push(subido);
    }
    return resultados;
  }

  /**
   * Documento que representa el contrato para el SGC, por prioridad:
   *  1. Contrato firmado por el cliente (`categoria = contrato_firmado`).
   *  2. Contrato v1 del administrador (`userId === null`).
   *  3. Columna legacy `documentos` (compatibilidad).
   * Si no hay ninguno, no se envia contrato.
   */
  private seleccionarContrato(detalle: SolicitudRow): DocumentoUrl | null {
    const firmado = detalle.docsAdjuntos.find((doc) => doc.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO);
    if (firmado) return { url: firmado.url, nombre: firmado.nombre };
    const admin = detalle.docsAdjuntos.find((doc) => doc.userId === null);
    if (admin) return { url: admin.url, nombre: admin.nombre };
    return extraerDocumentosLegacy(detalle.documentos)[0] ?? null;
  }

  private construirDocumento(
    sgcExpedienteId: string,
    documentId: string,
    pieza: SgcPiezaDocumental,
    checksumSha256: string,
    estado: SgcDocumentoEntity["estado"],
    currentVersionId: string | null,
  ): SgcDocumentoEntity {
    return {
      id: "",
      sgcExpedienteId,
      documentId,
      currentVersionId,
      category: pieza.category,
      title: pieza.title,
      fileName: pieza.fileName,
      checksumSha256,
      sizeBytes: pieza.bytes.byteLength,
      estado,
    };
  }
}

/**
 * Valor por defecto para un campo obligatorio del tipo (guia v3, §3.2). Los textos usan el
 * nombre descriptivo del expediente ("Separacion de stand - <codigo>"); el resto, valores
 * neutros. Si el tipo exige datos de negocio especificos, revisar este mapeo.
 */
function valorPorDefectoCampo(campo: SgcCampoTipo, input: SgcCrearExpedienteInput): string | number | boolean {
  switch (campo.kind) {
    case "integer":
      return 1;
    case "money":
      return "1.00";
    case "boolean":
      return true;
    case "date":
      return new Date().toISOString().slice(0, 10);
    case "email":
      return "noreply@iimp.org.pe";
    case "select":
      return campo.options?.[0] ?? "";
    default:
      /* short-text / long-text: descripcion del stand */
      return input.name.slice(0, 4000);
  }
}
