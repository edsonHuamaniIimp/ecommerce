import type { ISgcRepository } from "@/domain/ports/sgc-repository";
import type { ISgcClient } from "@/domain/ports/sgc-client";
import type { IDocumentoOrigen } from "@/domain/ports/documento-origen";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { ContratoApplicationService } from "@/application/contratos/contrato-service";
import type { ConfiguracionApplicationService } from "@/application/configuracion/configuracion-service";
import type {
  SgcCampoTipo,
  SgcCrearExpedienteInput,
  SgcDocumentoEntity,
  SgcExpedienteDetalle,
  SgcExpedienteEntity,
  SgcObservacionDocumento,
  SgcPiezaDocumental,
  SgcReservarSubidaInput,
  SgcUrlDescarga,
} from "@/domain/models/sgc";
import { SgcApiError } from "@/domain/models/sgc";
import {
  SGC_APPROVAL_RESULT,
  SGC_DOCUMENT_CATEGORIES,
  SGC_DOCUMENTO_ESTADO,
  SGC_ESTADO_ENVIO,
  SGC_IDEMPOTENCY_RESEND_PREFIX,
  SGC_IDEMPOTENCY_RETRY_PREFIX,
  SGC_MOTIVO_CARGA_INICIAL,
  SGC_OBSERVACION_ESTADOS,
  SGC_RECONCILIAR_MAX_POR_CORRIDA,
  SGC_SUBSANACION_MOTIVO,
  SGC_TITULOS_DOCUMENTO,
  SGC_LIFECYCLE_STATUSES,
  CATEGORIAS_DOCUMENTO,
  ESTADOS_DOCUMENTO_SOLICITUD,
  TIPOS_DOCUMENTO_SOLICITUD,
} from "@/lib/shared/constants";
import type { SgcDocumentCategory } from "@/lib/shared/constants";
import { construirIdempotencyKey, extensionArchivo, extraerDocumentosLegacy, nombreArchivoSgc, normalizarObservacionesSgc, sha256Hex, tituloSgcDocumento } from "@/lib/shared/utils/sgc";
import type { DocumentoUrl } from "@/lib/shared/utils/sgc";
import type { SolicitudRow } from "@/domain/models/entities";
import { mapSolicitudToExpediente } from "@/lib/shared/mappers/sgc";
import { habilitarOrdenPagoAutomatica } from "./orden-pago-automatica";
import { notificarDevolucionSgc } from "./notificar-devolucion";
import { notificarContratoObservadoSgc, procesarContratoObservadoSgc } from "./contrato-observado";
import { esAprobadoSgc } from "@/lib/shared/utils/estado-stand";
import { dateUtils } from "@/lib/shared/utils/date";
import { esObservacionSgcContrato } from "@/lib/shared/utils/solicitud-documentos";

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
function esTicketSubidaExpirado(err: unknown): boolean {
  return err instanceof SgcApiError && err.status === 403 && /expired|expirad/i.test(err.message);
}

export class SgcIntegracionApplicationService {
  constructor(
    private readonly solicitudRepo: ISolicitudesRepository,
    private readonly repo: ISgcRepository,
    private readonly client: ISgcClient,
    private readonly documentoOrigen: IDocumentoOrigen,
    private readonly config: SgcIntegracionConfig,
    private readonly contrato?: ContratoApplicationService,
    private readonly configuracion?: ConfiguracionApplicationService,
  ) {}

  /** True si la integracion SGC esta activada en el servidor (`SGC_ENABLED=1`). */
  estaHabilitado(): boolean {
    return this.config.enabled;
  }

  /**
   * BYPASS SOLO ADMIN: marca el expediente como aprobado (contrato Vigente) sin
   * esperar la aprobacion real del SGC, para habilitar la orden de pago.
   * Deja rastro en el log del servidor (no altera el historial del SGC).
   */
  async aprobarBypass(solicitudId: string, autor: string): Promise<boolean> {
    const expediente = await this.repo.findExpedientePorSolicitud(solicitudId);
    if (!expediente) return false;
    await this.repo.actualizarExpediente(expediente.id, {
      lifecycleStatus: SGC_LIFECYCLE_STATUSES.ACTIVE,
      bypassAprobado: true,
      lastSyncedAt: new Date(),
    });
    console.warn("[sgc] Bypass admin: expediente aprobado (Vigente)", { solicitudId, autor });
    /* Igual que el webhook real: aprobado el contrato, la orden de pago se genera sola. */
    await habilitarOrdenPagoAutomatica(this.solicitudRepo, solicitudId);
    return true;
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

      const input = await this.conCamposDelTipo(mapSolicitudToExpediente(detalle, this.config), detalle.standCodes.join(", "));
      const registro = existente ?? (await this.crearRegistroConCodigoUnico(solicitudId, input.code));
      /* Formato de codigo vigente (guia v5): si el registro local quedo con un codigo de una
       * version anterior (p.ej. solo el numero de stand), se regenera preservando la unicidad
       * local (P2002 -> sufijo con el id de la solicitud). */
      let codigo = registro.code;
      if (codigo !== input.code) {
        for (const candidato of [input.code, `${input.code.slice(0, 31)}-${solicitudId.slice(0, 8)}`]) {
          try {
            await this.repo.actualizarExpediente(registro.id, { code: candidato });
            codigo = candidato;
            break;
          } catch (err) {
            if ((err as { code?: string }).code !== "P2002") break;
          }
        }
      }

      try {
        /* Intencion = solicitud + hash del contenido: un reintento identico reusa la misma
         * clave; un payload distinto (p.ej. tipo corregido) es una intencion nueva â€” evita el
         * 409 "La clave idempotente ya fue usada con otro contenido". */
        const claveDe = async (p: SgcCrearExpedienteInput) =>
          `${construirIdempotencyKey(solicitudId)}/${(await sha256Hex(new TextEncoder().encode(JSON.stringify(p)))).slice(0, 16)}`;
        let payload: SgcCrearExpedienteInput = { ...input, code: codigo };
        let resultado: Awaited<ReturnType<ISgcClient["crearExpediente"]>>;
        try {
          resultado = await this.client.crearExpediente(payload, await claveDe(payload));
        } catch (err) {
          /* Guia v5: un 409 tambien significa "el code ya pertenece a otro expediente" en el SGC
           * -> reintento unico con sufijo (clave nueva, porque el payload cambia). */
          const esCodigoDuplicado = err instanceof SgcApiError && err.status === 409 && /c[oÃ³]digo|code/i.test(err.message);
          if (!esCodigoDuplicado) throw err;
          payload = { ...input, code: `${codigo.slice(0, 31)}-${solicitudId.slice(0, 8)}` };
          resultado = await this.client.crearExpediente(payload, await claveDe(payload));
          await this.repo.actualizarExpediente(registro.id, { code: payload.code }).catch(() => undefined);
        }
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
   * Envio automatico completo al SGC (al aprobar Asociado): contrato + anexos + resend a
   * revision. Best-effort TOTAL: cada paso se captura por separado, un fallo nunca rompe la
   * aprobacion y el cron (`reintentarErrores`) reintenta lo pendiente. Idempotente: el dedup
   * por titulo de las piezas evita duplicados si el admin vuelve a pulsar "Enviar al SGC".
   */
  async enviarExpedienteAlSgc(solicitudId: string, reenviadoPor: string): Promise<void> {
    if (!this.config.enabled) return;
    const expediente = await this.repo.findExpedientePorSolicitud(solicitudId).catch(() => null);
    if (!expediente?.contractId) return; // la creacion fallo: lo cubre el reintento del cron

    const pasos: Array<[string, () => Promise<unknown>]> = [
      ["contrato", () => this.subirContratoDeSolicitud(solicitudId)],
      ["anexos", () => this.subirAnexosDeSolicitud(solicitudId)],
      ["reenvio", () => this.reenviarCorreccionAlSgc(solicitudId, reenviadoPor)],
    ];
    for (const [paso, ejecutar] of pasos) {
      try {
        await ejecutar();
      } catch (err) {
        console.error(
          `[SGC] enviarExpedienteAlSgc(${solicitudId}) paso ${paso} fallo:`,
          err instanceof Error ? (err.stack ?? err.message) : err,
        );
      }
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
   * Completa `fields` con los campos obligatorios que declare el tipo (guia v3, Â§3.2):
   * `GET /contract-types` -> `items[].fields` (required + apiSupported). Best-effort: si no se
   * puede consultar el catalogo, se crea sin `fields` (el SGC respondera si falta alguno).
   */
  private async conCamposDelTipo(input: SgcCrearExpedienteInput, numeroStand: string): Promise<SgcCrearExpedienteInput> {
    try {
      const catalogo = await this.client.listarTiposContrato();
      const tipo = catalogo.items.find((t) => t.code === this.config.contractTypeCode);
      const requeridos = (tipo?.fields ?? []).filter((f) => f.required && f.apiSupported);
      if (requeridos.length === 0) return input;
      const fields: Record<string, string | number | boolean> = {};
      for (const campo of requeridos) fields[campo.key] = valorPorDefectoCampo(campo, input, numeroStand);
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
      // Con bypass admin, el estado local (Vigente) no se revierte al leer del SGC.
      const preservar = expediente.bypassAprobado;
      const observaciones = this.observacionesDesdeDetalle(detalle, expediente.observaciones);
      const devuelto =
        detalle.lifecycleStatus === SGC_LIFECYCLE_STATUSES.OBSERVED ||
        detalle.lifecycleStatus === SGC_LIFECYCLE_STATUSES.REJECTED;
      /* Campo OPCIONAL: `observaciones === null` = el SGC no lo informa (no se toca).
       * Si dejo de estar devuelto, se limpia. Respaldo del motivo si faltÃ³ el webhook. */
      const observacionesAbiertas = (observaciones ?? []).filter(
        (o) => o.status !== SGC_OBSERVACION_ESTADOS.RESOLVED && (o.message ?? "").trim().length > 0,
      );
      const hayObservacionesAbiertas = observacionesAbiertas.length > 0;
      /* Observacion suelta: el SGC puede informar observations[] sin devolver el flujo.
       * Se conserva para alertar al cliente; no se fuerza el lifecycle local. */
      const cambiosObservaciones = devuelto
        ? (observaciones !== null ? { observaciones } : {})
        : hayObservacionesAbiertas
          ? { observaciones }
          : { observaciones: [] as SgcObservacionDocumento[] };
      const motivoRespaldo =
        !preservar && devuelto && !expediente.devolucionMotivo && observaciones && observaciones.length > 0
          ? { devolucionMotivo: (observaciones[0]?.message ?? "").slice(0, MAX_ERROR_LENGTH) }
          : {};
      await this.repo.actualizarExpediente(expediente.id, {
        stage: detalle.stage,
        lifecycleStatus: preservar ? expediente.lifecycleStatus : detalle.lifecycleStatus,
        version: detalle.version,
        lastSyncedAt: new Date(),
        lastError: null,
        ...cambiosObservaciones,
        ...motivoRespaldo,
        ...(devuelto
          ? {}
          : { contratoRegeneradoObservationId: null, contratoRegeneradoAt: null }),
      });
      /* Aprobado en el SGC (Vigente o cerrado): la solicitud pasa a pendiente_pago con su
       * orden (idempotente). Cubre los casos sin webhook (QA esta en sink / webhook perdido). */
      if (!preservar && esAprobadoSgc(detalle.lifecycleStatus) && !esAprobadoSgc(expediente.lifecycleStatus)) {
        await habilitarOrdenPagoAutomatica(this.solicitudRepo, solicitudId);
      }
      /* Devolucion/rechazo o una observacion suelta detectada por sync: notifica al
       * cliente una vez por transicion/nuevo conjunto de observaciones. */
      const esDevolucion =
        detalle.lifecycleStatus === SGC_LIFECYCLE_STATUSES.OBSERVED ||
        detalle.lifecycleStatus === SGC_LIFECYCLE_STATUSES.REJECTED;
      const estabaDevuelto =
        expediente.lifecycleStatus === SGC_LIFECYCLE_STATUSES.OBSERVED ||
        expediente.lifecycleStatus === SGC_LIFECYCLE_STATUSES.REJECTED;
      const motivoNuevo = observacionesAbiertas[0]?.message ?? null;
      const clavesPrevias = new Set(
        (expediente.observaciones ?? []).map((o) => o.observationId ?? `${o.title ?? ""}|${o.message}`),
      );
      const nuevas = observacionesAbiertas.filter(
        (o) => !clavesPrevias.has(o.observationId ?? `${o.title ?? ""}|${o.message}`),
      );
      const requiereCambio =
        observacionesAbiertas.length === 0 ||
        observacionesAbiertas.some((o) => o.requiresDocumentChange !== false);
      const notificar =
        !preservar &&
        requiereCambio &&
        ((esDevolucion && (!estabaDevuelto || (motivoNuevo !== null && motivoNuevo !== expediente.devolucionMotivo))) ||
          (!esDevolucion && nuevas.length > 0));
      /* La regeneracion se reintenta en cada sync aunque la notificacion ya se haya
       * enviado: si fallo en la primera pasada, el cliente nunca veria el boton de firma. */
      const resultadoContrato =
        !preservar && esDevolucion && requiereCambio
          ? await procesarContratoObservadoSgc({
              solicitudId,
              observaciones: observacionesAbiertas,
              solicitudes: this.solicitudRepo,
              contrato: this.contrato,
              sgc: this.repo,
            })
          : null;
      if (notificar) {
        const documentos = observacionesAbiertas
          .map((o) => o.title?.trim() || o.message.slice(0, 120))
          .filter((t) => t.length > 0);
        await notificarDevolucionSgc(
          this.solicitudRepo,
          solicitudId,
          motivoNuevo ?? expediente.devolucionMotivo ?? null,
          documentos,
        );
        if (resultadoContrato) {
          await notificarContratoObservadoSgc({
            solicitudId,
            resultado: resultadoContrato,
            solicitudes: this.solicitudRepo,
            configuracion: this.configuracion,
          });
        }
      }
      return preservar ? { ...detalle, lifecycleStatus: expediente.lifecycleStatus } : detalle;
    } catch {
      // Lectura best-effort: si el SGC no responde, el panel muestra el estado local.
      return null;
    }
  }

  /** Reconciliacion (polling): refresca el estado de los expedientes ya creados. */
  async reconciliar(): Promise<number> {
    if (!this.config.enabled) return 0;

    /* Acotado por corrida (limite del SGC: 120 solicitudes/min por clave, guia Â§1.1);
     * rotacion por `lastSyncedAt` ascendente (nunca sincronizados primero). */
    const expedientes = [...(await this.repo.listarConContractId())]
      .sort((a, b) => (a.lastSyncedAt?.getTime() ?? 0) - (b.lastSyncedAt?.getTime() ?? 0))
      .slice(0, SGC_RECONCILIAR_MAX_POR_CORRIDA);
    let sincronizados = 0;
    for (const expediente of expedientes) {
      if (!expediente.contractId) continue;
      try {
        const detalle = await this.client.consultarExpediente(expediente.contractId);
        const observaciones = this.observacionesDesdeDetalle(detalle, expediente.observaciones);
        const devuelto =
          detalle.lifecycleStatus === SGC_LIFECYCLE_STATUSES.OBSERVED ||
          detalle.lifecycleStatus === SGC_LIFECYCLE_STATUSES.REJECTED;
        const observacionesAbiertas = (observaciones ?? []).filter(
          (o) => o.status !== SGC_OBSERVACION_ESTADOS.RESOLVED && (o.message ?? "").trim().length > 0,
        );
        const hayObservacionesAbiertas = observacionesAbiertas.length > 0;
        /* Observacion suelta: el SGC puede informar observations[] sin devolver el flujo. */
        const cambiosObservaciones = devuelto
          ? (observaciones !== null ? { observaciones } : {})
          : hayObservacionesAbiertas
            ? { observaciones }
            : { observaciones: [] as SgcObservacionDocumento[] };
        const motivoRespaldo =
          !expediente.bypassAprobado && devuelto && !expediente.devolucionMotivo && observaciones && observaciones.length > 0
            ? { devolucionMotivo: (observaciones[0]?.message ?? "").slice(0, MAX_ERROR_LENGTH) }
            : {};
        await this.repo.actualizarExpediente(expediente.id, {
          stage: detalle.stage,
          lifecycleStatus: expediente.bypassAprobado ? expediente.lifecycleStatus : detalle.lifecycleStatus,
          version: detalle.version,
          lastSyncedAt: new Date(),
          lastError: null,
          ...cambiosObservaciones,
          ...motivoRespaldo,
        });
        /* Cron (polling): aprobado sin webhook -> habilita la orden de pago (idempotente). */
        if (!expediente.bypassAprobado && esAprobadoSgc(detalle.lifecycleStatus) && !esAprobadoSgc(expediente.lifecycleStatus)) {
          await habilitarOrdenPagoAutomatica(this.solicitudRepo, expediente.solicitudId);
        }
        /* Devolucion/rechazo o una observacion suelta detectada por polling. */
        const esDevolucion =
          detalle.lifecycleStatus === SGC_LIFECYCLE_STATUSES.OBSERVED ||
          detalle.lifecycleStatus === SGC_LIFECYCLE_STATUSES.REJECTED;
        const estabaDevuelto =
          expediente.lifecycleStatus === SGC_LIFECYCLE_STATUSES.OBSERVED ||
          expediente.lifecycleStatus === SGC_LIFECYCLE_STATUSES.REJECTED;
        const motivoNuevo = observacionesAbiertas[0]?.message ?? null;
        const clavesPrevias = new Set(
          (expediente.observaciones ?? []).map((o) => o.observationId ?? `${o.title ?? ""}|${o.message}`),
        );
        const nuevas = observacionesAbiertas.filter(
          (o) => !clavesPrevias.has(o.observationId ?? `${o.title ?? ""}|${o.message}`),
        );
        const requiereCambio =
          observacionesAbiertas.length === 0 ||
          observacionesAbiertas.some((o) => o.requiresDocumentChange !== false);
        const notificar =
          !expediente.bypassAprobado &&
          requiereCambio &&
          ((esDevolucion && (!estabaDevuelto || (motivoNuevo !== null && motivoNuevo !== expediente.devolucionMotivo))) ||
            (!esDevolucion && nuevas.length > 0));
        /* Reintento idempotente: cubre un fallo de regeneracion en el webhook/lectura previa. */
        const resultadoContrato =
          !expediente.bypassAprobado && esDevolucion && requiereCambio
            ? await procesarContratoObservadoSgc({
                solicitudId: expediente.solicitudId,
                observaciones: observacionesAbiertas,
                solicitudes: this.solicitudRepo,
                contrato: this.contrato,
                sgc: this.repo,
              })
            : null;
        if (notificar) {
          const documentos = observacionesAbiertas
            .map((o) => o.title?.trim() || o.message.slice(0, 120))
            .filter((t) => t.length > 0);
          await notificarDevolucionSgc(
            this.solicitudRepo,
            expediente.solicitudId,
            motivoNuevo ?? expediente.devolucionMotivo ?? null,
            documentos,
          );
          if (resultadoContrato) {
            await notificarContratoObservadoSgc({
              solicitudId: expediente.solicitudId,
              resultado: resultadoContrato,
              solicitudes: this.solicitudRepo,
              configuracion: this.configuracion,
            });
          }
        }
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

  /** Empuja una pieza documental al SGC (reservar â†’ transferir â†’ confirmar). */
  async subirPiezaDocumental(solicitudId: string, pieza: SgcPiezaDocumental): Promise<SgcDocumentoEntity | null> {
    if (!this.config.enabled) return null;

    const expediente = await this.repo.findExpedientePorSolicitud(solicitudId);
    if (!expediente?.contractId) return null;

    const checksumSha256 = await sha256Hex(pieza.bytes);
    const reservaInput: SgcReservarSubidaInput = {
      category: pieza.category,
      title: pieza.title,
      fileName: pieza.fileName,
      sizeBytes: pieza.bytes.byteLength,
      checksumSha256,
      declaredMimeType: pieza.mimeType,
      replacementReason: pieza.replacementReason || SGC_MOTIVO_CARGA_INICIAL,
      documentId: pieza.documentId ?? null,
    };
    let reserva = await this.client.reservarSubida(expediente.contractId, reservaInput);

    let documento: SgcDocumentoEntity;
    if (pieza.documentId) {
      await this.repo.actualizarDocumento(pieza.documentId, {
        currentVersionId: reserva.versionId,
        estado: SGC_DOCUMENTO_ESTADO.RESERVADO,
        /* Al versionar se refresca la pieza vigente: el mapeo de observaciones por
         * `documentId` queda apuntando a la ultima version subida. */
        title: pieza.title,
        fileName: pieza.fileName,
        checksumSha256,
        sizeBytes: pieza.bytes.byteLength,
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

    try {
      await this.client.transferirArchivo(reserva.uploadUrl, reserva.headers, pieza.bytes);
    } catch (err) {
      /* La Idempotency-Key devuelve el mismo ticket: si su URL expiro (5 min), hay que
       * reservar de nuevo. Se versiona la MISMA pieza (documentId del primer ticket) para
       * no duplicar el documento. */
      if (!esTicketSubidaExpirado(err)) throw err;
      reserva = await this.client.reservarSubida(
        expediente.contractId,
        { ...reservaInput, documentId: reserva.documentId },
        { idempotencySuffix: `${SGC_IDEMPOTENCY_RETRY_PREFIX}/${Date.now()}` },
      );
      await this.repo.actualizarDocumento(documento.documentId, {
        currentVersionId: reserva.versionId,
        estado: SGC_DOCUMENTO_ESTADO.RESERVADO,
      });
      await this.client.transferirArchivo(reserva.uploadUrl, reserva.headers, pieza.bytes);
    }
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
      /** Nombre fisico legible; si falta, se usa el nombre del archivo de origen. */
      fileName?: string;
      documentId?: string | null;
      replacementReason?: string;
    },
  ): Promise<SgcDocumentoEntity | null> {
    if (!this.config.enabled) return null;
    const contenido = await this.documentoOrigen.leer(params.url);
    return this.subirPiezaDocumental(solicitudId, {
      category: params.category,
      title: params.title,
      fileName: params.fileName ?? contenido.fileName,
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
     * una sola vez por ronda (doc Â§8.1). Si no, el expediente no vuelve a avanzar.
     */
    const expediente = await this.repo.findExpedientePorSolicitud(solicitudId);
    if (expediente?.contractId) {
      await this.client.reabrirExpediente(
        expediente.contractId,
        `${SGC_IDEMPOTENCY_RESEND_PREFIX}/${solicitudId}/${documento.currentVersionId ?? "manual"}`,
      );
    }
    await this.consultarExpediente(solicitudId).catch(() => null);
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
            fileName: existente.currentFileName ?? existente.title,
            checksumSha256: null,
            sizeBytes: null,
            estado: SGC_DOCUMENTO_ESTADO.CONFIRMADO,
          };
        }
      } catch {
        /* Si la consulta falla, se intenta la subida igual. */
      }
    }

    const stands = detalle.standCode || detalle.standCodes.join("-") || solicitudId.slice(0, 8);
    return this.subirDocumentoDesdeUrl(solicitudId, {
      category: SGC_DOCUMENT_CATEGORIES.CONTRACT,
      title: SGC_TITULOS_DOCUMENTO.CONTRATO,
      fileName: `contrato-${this.slugArchivo(stands)}.${extensionArchivo(contrato.nombre)}`,
      url: contrato.url,
    });
  }

  /** Declara la casuÃ­stica de subsanaciÃ³n (la elige el administrador cuando el SGC rechaza). */
  async declararMotivoSubsanacion(
    solicitudId: string,
    motivo: string | null,
    declaradoPor: string,
    modo: string | null = null,
  ): Promise<SgcExpedienteEntity | null> {
    const expediente = await this.repo.findExpedientePorSolicitud(solicitudId);
    if (!expediente) return null;

    /* AuditorÃ­a: cada declaraciÃ³n abre una ronda nueva (1, 2, 3â€¦). */
    if (motivo) {
      const previas = await this.repo.listarSubsanaciones(expediente.id).catch(() => []);
      const ronda = previas.reduce((max, r) => Math.max(max, r.ronda), 0) + 1;
      await this.repo
        .crearSubsanacion({ sgcExpedienteId: expediente.id, ronda, motivo, modo, declaradoPor })
        .catch(() => undefined);
    }

    return this.repo.actualizarExpediente(expediente.id, {
      subsanacionMotivo: motivo,
      subsanacionModo: motivo ? modo : null,
    });
  }

  /**
   * Reenvía el trámite al SGC tras una devolución: sube el contrato firmado **solo si la
   * observación es del contrato** (v7: si solo observaron anexos, no hace falta otra versión
   * del principal), versiona los anexos corregidos y reabre la ronda con `/resend`.
   */
  async reenviarCorreccionAlSgc(
    solicitudId: string,
    reenviadoPor: string,
  ): Promise<{ reenviado: boolean; documento: SgcDocumentoEntity | null }> {
    const sinDocumento = { reenviado: false, documento: null } as const;
    if (!this.config.enabled) return sinDocumento;
    const detalle = await this.solicitudRepo.detalle(solicitudId);
    if (!detalle) return sinDocumento;
    const expediente = await this.repo.findExpedientePorSolicitud(solicitudId);
    if (!expediente?.contractId) return sinDocumento;

    /* Devolucion del SGC: primero se versionan los anexos corregidos (el SGC exige que la
     * correccion incluya las piezas actualizadas; `subirAnexosDeSolicitud` solo versiona
     * cuando el lifecycle es rejected/observed). */
    await this.subirAnexosDeSolicitud(solicitudId);

    const observaciones = detalle.sgcObservaciones ?? [];
    const requiereContrato =
      observaciones.length === 0 ||
      observaciones.some(
        (o) => o.status !== SGC_OBSERVACION_ESTADOS.RESOLVED && esObservacionSgcContrato(o),
      );

    const actual = await this.client.consultarExpediente(expediente.contractId);
    let documento: SgcDocumentoEntity | null = null;
    if (requiereContrato) {
      /* Contrato firmado mas reciente (activo) del cliente, o el contrato disponible. */
      const firmado = this.ultimoDocumento(detalle.docsAdjuntos, (d) =>
        this.documentoVigente(d) && d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO);
      const pieza = firmado
        ? { url: firmado.url, nombre: firmado.nombre }
        : this.seleccionarContrato(detalle);
      if (!pieza) return sinDocumento;
      const contratoSgc = actual.documents.find((d) => d.category === SGC_DOCUMENT_CATEGORIES.CONTRACT);
      if (!contratoSgc) return sinDocumento;
      const stands = detalle.standCode || detalle.standCodes.join("-") || solicitudId.slice(0, 8);
      documento = await this.subirDocumentoDesdeUrl(solicitudId, {
        category: SGC_DOCUMENT_CATEGORIES.CONTRACT,
        title: SGC_TITULOS_DOCUMENTO.CONTRATO_FIRMADO,
        fileName: `contrato-firmado-${this.slugArchivo(stands)}.${extensionArchivo(pieza.nombre)}`,
        url: pieza.url,
        documentId: contratoSgc.documentId,
        replacementReason: SGC_SUBSANACION_MOTIVO,
      });
      if (!documento) return sinDocumento;
    }

    /* Una sola llamada por ronda; la clave incluye la version del expediente en el SGC. */
    try {
      await this.client.reabrirExpediente(
        expediente.contractId,
        `${SGC_IDEMPOTENCY_RESEND_PREFIX}/${solicitudId}/${documento?.currentVersionId ?? `v${actual.version ?? 1}`}`,
      );
    } catch (err) {
      /* Si ya existe un flujo activo, el reenvio ya se hizo antes: se considera exitoso. */
      const yaActivo =
        err instanceof SgcApiError &&
        err.status === 422 &&
        /flujo activo|already active|already in progress/i.test(err.message);
      if (!yaActivo) throw err;
    }
    /* Auditoría: cierra la ronda vigente con quién/cuándo reenvió y la versión corregida. */
    const subsanaciones = await this.repo.listarSubsanaciones(expediente.id).catch(() => []);
    const pendiente = subsanaciones.filter((r) => r.estado !== "reenviado").pop();
    /* Si el admin no declaro una ronda (correccion iniciada por el cliente), se registra
     * igualmente para que la UI sepa que la revision ya fue solicitada. */
    const aMarcar = pendiente ?? await this.repo.crearSubsanacion({
      sgcExpedienteId: expediente.id,
      ronda: subsanaciones.reduce((max, r) => Math.max(max, r.ronda), 0) + 1,
      motivo: (expediente.devolucionMotivo ?? "Corrección del cliente").slice(0, 500),
      modo: expediente.subsanacionModo ?? null,
      declaradoPor: reenviadoPor,
    }).catch(() => null);
    if (aMarcar) {
      await this.repo
        .marcarSubsanacionReenviada(aMarcar.id, {
          reenviadoPor,
          documentId: documento?.documentId ?? null,
          versionId: documento?.currentVersionId ?? null,
        })
        .catch(() => undefined);
    }

    await this.repo
      .actualizarExpediente(expediente.id, { subsanacionMotivo: null, subsanacionModo: null, lastError: null })
      .catch(() => undefined);
    /* Refresca el estado local tras reabrir la ronda: evita que el cliente siga
     * viendo "observado" si el SGC ya paso a revision. Best-effort. */
    await this.consultarExpediente(solicitudId).catch(() => null);
    return { reenviado: true, documento };
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
        .filter((d) => this.documentoVigente(d) && d.userId !== null && d.categoria !== TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO)
        .map((d) => ({
          url: d.url,
          nombre: d.nombre,
          requisito: d.requisito,
          sgcObservationId: d.sgcObservationId ?? null,
          sgcDocumentId: d.sgcDocumentId ?? null,
          sgcTitle: d.sgcTitle ?? null,
        })),
      ...extraerDocumentosLegacy(detalle.documentos),
    ];

    /* Idempotencia: no reenviar anexos que ya esten en el SGC. Se compara el nombre fisico
     * (`currentFileName`, que fijamos nosotros) y, por compatibilidad con cargas previas, el
     * nombre local del archivo (eran los titulos antiguos). */
    const titulosEnSgc = new Set<string>();
    const nombresEnSgc = new Set<string>();
    const documentIdPorTitulo = new Map<string, string>();
    const documentIdPorNombre = new Map<string, string>();
    const documentIdPorRequisito = new Map<string, string>();
    const documentIdsUsados = new Set<string>();
    const expediente = await this.repo.findExpedientePorSolicitud(solicitudId);
    /* Solo se versiona un anexo existente cuando el SGC pidio correccion. */
    const puedeVersionarAnexos =
      expediente?.lifecycleStatus === SGC_LIFECYCLE_STATUSES.REJECTED ||
      expediente?.lifecycleStatus === SGC_LIFECYCLE_STATUSES.OBSERVED;
    /* v7: un faltante (`documentId: null` / requiresNewDocument) exige un archivo NUEVO,
     * no una version del adjunto existente aunque comparta requisito. */
    const observacionesFaltantes = (expediente?.observaciones ?? []).filter(
      (o) => !o.documentId || o.requiresNewDocument === true,
    );
    const fechaPorUrl = new Map(detalle.docsAdjuntos.map((d) => [d.url, d.createdAt]));
    /* La correccion mas reciente va primero: si una observacion tiene version anterior
     * y corregida, solo la corregida debe consumir el documentId del SGC. */
    candidatos.sort(
      (a, b) =>
        (dateUtils.toMs(fechaPorUrl.get(b.url) ?? null) ?? 0) -
        (dateUtils.toMs(fechaPorUrl.get(a.url) ?? null) ?? 0),
    );
    if (expediente?.contractId) {
      try {
        const actual = await this.client.consultarExpediente(expediente.contractId);
        for (const d of actual.documents.filter((x) => x.category === SGC_DOCUMENT_CATEGORIES.ANNEX)) {
          titulosEnSgc.add(d.title);
          if (!documentIdPorTitulo.has(d.title)) documentIdPorTitulo.set(d.title, d.documentId);
          if (!documentIdPorNombre.has(d.title)) documentIdPorNombre.set(d.title, d.documentId);
          if (d.currentFileName) {
            nombresEnSgc.add(d.currentFileName);
            if (!documentIdPorNombre.has(d.currentFileName)) documentIdPorNombre.set(d.currentFileName, d.documentId);
          }
        }
      } catch {
        /* Si la consulta falla, se intenta la subida igual. */
      }
    }
    /* Los documentos legacy tenian nombres aleatorios: se mapean por su nombre local anterior. */
    for (const d of detalle.docsAdjuntos) {
      if (!d.requisito || documentIdPorRequisito.has(d.requisito)) continue;
      const documentId = documentIdPorNombre.get(d.nombre);
      if (documentId) documentIdPorRequisito.set(d.requisito, documentId);
    }

    const identificador = detalle.standCode || detalle.standCodes.join("-") || solicitudId.slice(0, 8);
    const vistos = new Set<string>();
    const resultados: SgcDocumentoEntity[] = [];
    for (const doc of candidatos) {
      const clave = doc.nombre || doc.url;
      /* Titulo legible por requisito (Ficha RUC, Vigencia de Poder, DNI...). El nombre fisico
       * lleva un hash corto de la URL: la misma pieza produce el mismo nombre (no duplica) y un
       * archivo reemplazado produce uno nuevo (se reenvia como version). */
      const titulo = doc.sgcTitle?.trim() || tituloSgcDocumento(doc.nombre, doc.requisito);
      const hash = (await sha256Hex(new TextEncoder().encode(doc.url))).slice(0, 6);
      const fileName = nombreArchivoSgc({
        titulo,
        nombreOriginal: doc.nombre,
        requisito: doc.requisito,
        identificador,
        hash,
      });
      /* Compatibilidad: versiones previas no incluian el identificador del stand. */
      const fileNameLegacy = nombreArchivoSgc({
        titulo,
        nombreOriginal: doc.nombre,
        requisito: doc.requisito,
        identificador: null,
        hash,
      });
      const documentIdObjetivo =
        doc.sgcDocumentId ??
        documentIdPorTitulo.get(titulo) ??
        (doc.requisito ? documentIdPorRequisito.get(doc.requisito) : undefined);
      if (
        vistos.has(clave) ||
        Boolean(documentIdObjetivo && documentIdsUsados.has(documentIdObjetivo)) ||
        doc.url === contratoUrl ||
        clave === contratoClave ||
        (!doc.sgcObservationId &&
          (doc.requisito ? titulosEnSgc.has(doc.nombre) : titulosEnSgc.has(doc.nombre) || titulosEnSgc.has(titulo))) ||
        nombresEnSgc.has(doc.nombre) ||
        nombresEnSgc.has(fileNameLegacy) ||
        nombresEnSgc.has(fileName)
      ) {
        continue;
      }
      vistos.add(clave);
      const esFaltante = observacionesFaltantes.some((o) => {
        /* Vinculo explicito del archivo con la observacion: manda sobre fechas/titulos. */
        if (doc.sgcObservationId && o.observationId) {
          return doc.sgcObservationId === o.observationId;
        }
        const obsMs = dateUtils.toMs(o.createdAt ?? null);
        const docMs = dateUtils.toMs(fechaPorUrl.get(doc.url) ?? null);
        if (obsMs === null || docMs === null || docMs <= obsMs) return false;
        if (o.title && (titulo === o.title || doc.nombre === o.title)) return true;
        return !o.title;
      });
      const documentIdCandidato = !esFaltante && puedeVersionarAnexos
        ? documentIdObjetivo
        : undefined;
      const documentIdExistente = documentIdCandidato && !documentIdsUsados.has(documentIdCandidato) ? documentIdCandidato : undefined;
      if (documentIdExistente) documentIdsUsados.add(documentIdExistente);
      const subido = await this.subirDocumentoDesdeUrl(solicitudId, {
        category: SGC_DOCUMENT_CATEGORIES.ANNEX,
        title: titulo,
        fileName,
        url: doc.url,
        documentId: documentIdExistente ?? null,
        replacementReason: documentIdExistente ? SGC_SUBSANACION_MOTIVO : undefined,
      });
      if (subido) resultados.push(subido);
    }
    return resultados;
  }

  /** Documento vigente: sin estado (legacy) o `activo`; excluye observados/reemplazados. */
  private documentoVigente(d: SolicitudRow["docsAdjuntos"][number]): boolean {
    return !d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO;
  }

  /** Ultima version (por fecha de subida) que cumple el predicado. */
  private ultimoDocumento<T extends SolicitudRow["docsAdjuntos"][number]>(
    docs: T[],
    predicate: (d: T) => boolean,
  ): T | undefined {
    return [...docs]
      .filter(predicate)
      .sort((a, b) => (dateUtils.toMs(b.createdAt) ?? 0) - (dateUtils.toMs(a.createdAt) ?? 0))[0];
  }

  /**
   * Observaciones por documento del detalle del SGC. Campo **OPCIONAL**: devuelve `null`
   * cuando el SGC no las informa (para NO borrar lo que ya se guardo por webhook).
   * Si llega el `status` del documento como observed/rejected sin detalle, se sintetiza
   * una observacion generica apuntando a ese documento.
   */
  private observacionesDesdeDetalle(detalle: SgcExpedienteDetalle, previas?: SgcObservacionDocumento[] | null): SgcObservacionDocumento[] | null {
    const lista: SgcObservacionDocumento[] = [];
    let informado = false;
    for (const doc of detalle.documents ?? []) {
      if (Array.isArray(doc.observations)) {
        informado = true;
        for (const obs of normalizarObservacionesSgc(doc.observations) ?? []) {
          const previa = (previas ?? []).find(
            (p) =>
              (obs.observationId && p.observationId === obs.observationId) ||
              (!obs.observationId && obs.documentId && p.documentId === obs.documentId),
          );
          /* Solo se reutiliza la fecha si es la MISMA observacion. Una observacion
           * nueva sin `createdAt` no debe heredar la fecha de una ronda anterior:
           * eso haria creer al auto-regenerador que el contrato ya fue corregido. */
          const mismaObservacion =
            Boolean(obs.observationId && previa?.observationId === obs.observationId) ||
            Boolean(
              !obs.observationId &&
                previa &&
                obs.documentId &&
                previa.documentId === obs.documentId &&
                previa.message === obs.message,
            );
          lista.push({
            ...obs,
            documentId: obs.documentId ?? doc.documentId,
            category: obs.category ?? doc.category,
            title: obs.title ?? doc.title,
            createdAt: obs.createdAt ?? (mismaObservacion ? previa?.createdAt : null) ?? detalle.updatedAt,
          });
        }
      } else if (doc.status === "observed" || doc.status === "rejected") {
        informado = true;
        lista.push({
          documentId: doc.documentId,
          category: doc.category,
          title: doc.title,
          message: "El SGC observ�� este documento.",
          status: SGC_OBSERVACION_ESTADOS.OPEN,
          createdAt: detalle.updatedAt,
        });
      }
    }
    /* Documentos que el SGC espera y no existen: cada uno exige un archivo nuevo. */
    for (const doc of detalle.missingDocuments ?? []) {
      const yaInformado = lista.some(
        (o) => !o.documentId && (o.title ?? "").trim() === (doc.title ?? "").trim(),
      );
      if (yaInformado) continue;
      informado = true;
      lista.push({
        documentId: null,
        category: doc.category ?? SGC_DOCUMENT_CATEGORIES.ANNEX,
        title: doc.title,
        message: `Falta adjuntar: ${doc.title || "documento solicitado"}.`,
        status: SGC_OBSERVACION_ESTADOS.OPEN,
        requiresDocumentChange: true,
        requiresNewDocument: true,
        createdAt:
          (previas ?? []).find(
            (o) => !o.documentId && (o.title ?? '').trim() === (doc.title ?? '').trim(),
          )?.createdAt ?? detalle.updatedAt,
      });
    }
    return informado ? lista : null;
  }

  /** Slug seguro para nombres de archivo enviados al SGC. */
  private slugArchivo(texto: string): string {
    const base = texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    return base || "documento";
  }

  /**
   * Documento que representa el contrato para el SGC, por prioridad:
   *  1. Ultimo contrato firmado vigente del cliente (`categoria = contrato_firmado`).
   *  2. Ultimo contrato vigente del administrador (`userId === null`).
   *  3. Columna legacy `documentos` (compatibilidad).
   * Solo se envian versiones vigentes; las observadas/reemplazadas son historial.
   */
  private seleccionarContrato(detalle: SolicitudRow): DocumentoUrl | null {
    const firmado = this.ultimoDocumento(detalle.docsAdjuntos, (doc) =>
      this.documentoVigente(doc) && doc.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO);
    if (firmado) return { url: firmado.url, nombre: firmado.nombre };
    const admin = this.ultimoDocumento(detalle.docsAdjuntos, (doc) =>
      this.documentoVigente(doc) && doc.userId === null);
    if (admin) return { url: admin.url, nombre: admin.nombre };
    // Legacy: si el admin categorizo un documento como "contrato", se usa ese;
    // si no, se mantiene el primero (comportamiento previo).
    const legacy = extraerDocumentosLegacy(detalle.documentos);
    const legacyContrato = legacy.find((doc) => detalle.documentosCategorias?.[doc.url] === CATEGORIAS_DOCUMENTO.CONTRATO);
    return legacyContrato ?? legacy[0] ?? null;
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
 * Valor por defecto para un campo obligatorio del tipo (guia v3, Â§3.2). Los textos usan el
 * nombre descriptivo del expediente ("Separacion de stand - <codigo>"); el resto, valores
 * neutros. Si el tipo exige datos de negocio especificos, revisar este mapeo.
 */
function valorPorDefectoCampo(campo: SgcCampoTipo, input: SgcCrearExpedienteInput, numeroStand: string): string | number | boolean {
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
    case "short-text":
      /* Guia v5: `input_demo` del tipo = numero de stand (p. ej. "A-042"). */
      return (numeroStand || input.name).slice(0, 100);
    default:
      /* long-text: descripcion del stand */
      return input.name.slice(0, 4000);
  }
}
