import type { ISgcRepository } from "@/domain/ports/sgc-repository";
import type { ISgcClient } from "@/domain/ports/sgc-client";
import type { IDocumentoOrigen } from "@/domain/ports/documento-origen";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type {
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
  SGC_SUBSANACION_MOTIVO,
} from "@/lib/shared/constants";
import type { SgcDocumentCategory } from "@/lib/shared/constants";
import { construirIdempotencyKey, sha256Hex } from "@/lib/shared/utils/sgc";
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

  async crearExpedienteDesdeSolicitud(solicitudId: string): Promise<SgcExpedienteEntity | null> {
    if (!this.config.enabled) return null;

    // Best-effort TOTAL: ningun fallo (BD no migrada, red, etc.) puede romper la aprobacion.
    try {
      const existente = await this.repo.findExpedientePorSolicitud(solicitudId);
      if (existente?.estadoEnvio === SGC_ESTADO_ENVIO.CREADO && existente.contractId) return existente;

      const detalle = await this.solicitudRepo.detalle(solicitudId);
      if (!detalle) return existente;

      const input = mapSolicitudToExpediente(detalle, this.config);
      const registro =
        existente ??
        (await this.repo.crearExpediente({
          solicitudId,
          code: input.code,
          areaCode: this.config.areaCode,
          contractTypeCode: this.config.contractTypeCode,
        }));

      try {
        const resultado = await this.client.crearExpediente(input, construirIdempotencyKey(solicitudId));
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
    } catch {
      return null;
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
      replacementReason: pieza.replacementReason,
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
    return this.subirDocumentoDesdeUrl(solicitudId, {
      category: SGC_DOCUMENT_CATEGORIES.CONTRACT,
      title: params.title,
      url: params.url,
      documentId: params.documentId,
      replacementReason: SGC_SUBSANACION_MOTIVO,
    });
  }

  /**
   * Empuja el contrato v1: el documento **del administrador** de la solicitud
   * (`SolicitudDocumento.userId === null`; el cliente sube evidencia, no contrato).
   */
  async subirContratoDeSolicitud(solicitudId: string): Promise<SgcDocumentoEntity | null> {
    if (!this.config.enabled) return null;
    const detalle = await this.solicitudRepo.detalle(solicitudId);
    if (!detalle) return null;

    const contrato = detalle.docsAdjuntos.find((doc) => doc.userId === null) ?? detalle.docsAdjuntos[0];
    if (!contrato) return null;

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

    const resultados: SgcDocumentoEntity[] = [];
    for (const doc of detalle.docsAdjuntos.filter((d) => d.userId !== null)) {
      const subido = await this.subirDocumentoDesdeUrl(solicitudId, {
        category: SGC_DOCUMENT_CATEGORIES.ANNEX,
        title: doc.nombre,
        url: doc.url,
      });
      if (subido) resultados.push(subido);
    }
    return resultados;
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
