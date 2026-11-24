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
import { DomainError } from "@/domain/errors/domain-error";
import {
  API_ERROR_CODES,
  SGC_INTENTO_RESULTADOS,
  SGC_APPROVAL_RESULT,
  SGC_DOCUMENT_CATEGORIES,
  SGC_DOCUMENTO_ESTADO,
  SGC_CONTRACT_TYPE_BY_SOLICITUD,
  SGC_ESTADO_ENVIO,
  SGC_IDEMPOTENCY_RESEND_PREFIX,
  SGC_IDEMPOTENCY_RETRY_PREFIX,
  SGC_MOTIVO_CARGA_INICIAL,
  SGC_OBSERVACION_ESTADOS,
  SGC_RECONCILIAR_MAX_POR_CORRIDA,
  SGC_RECONCILIAR_TIME_BUDGET_MS,
  SGC_SUBSANACION_MOTIVO,
  SGC_TITULOS_DOCUMENTO,
  SGC_STAGES,
  SGC_LIFECYCLE_STATUSES,
  SGC_OBSERVACION_IMPLICITA_MENSAJE,
  SGC_OBSERVACION_IMPLICITA_PREFIX,
  CATEGORIAS_DOCUMENTO,
  ESTADOS_DOCUMENTO_SOLICITUD,
  TIPOS_DOCUMENTO_SOLICITUD,
} from "@/lib/shared/constants";
import type { SgcDocumentCategory, SgcIntentoOrigen } from "@/lib/shared/constants";
import { construirIdempotencyKey, debeNotificarDevolucionSgc, extensionArchivo, extraerDocumentosLegacy, nombreArchivoSgc, normalizarObservacionesSgc, ordenarParaReconciliar, sha256Hex, tituloSgcDocumento } from "@/lib/shared/utils/sgc";
import type { DocumentoUrl } from "@/lib/shared/utils/sgc";
import type { SolicitudRow } from "@/domain/models/entities";
import { mapSolicitudToExpediente } from "@/lib/shared/mappers/sgc";
import { habilitarOrdenPagoAutomatica } from "./orden-pago-automatica";
import { notificarDevolucionSgc } from "./notificar-devolucion";
import { notificarContratoObservadoSgc, procesarContratoObservadoSgc } from "./contrato-observado";
import { esAprobadoSgc } from "@/lib/shared/utils/estado-stand";
import { dateUtils } from "@/lib/shared/utils/date";
import { esObservacionSgcContrato, estadoCorreccionSgc } from "@/lib/shared/utils/solicitud-documentos";

export interface SgcIntegracionConfig {
  enabled: boolean;
  areaCode: string;
  contractTypeCode: string;
}

const MAX_ERROR_LENGTH = 500;

/** Normaliza un titulo para emparejar documentos locales con piezas del SGC. */
function normalizarTituloSgc(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

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

  /**
   * Contrato ya firmado por el cliente y por Gerencia (cargado por el Asociado):
   * no se envia al SGC. Deja la correlacion local como aprobada (Vigente) para
   * conservar la trazabilidad de la revision Legal y genera la orden de pago.
   * No usa el cliente HTTP del SGC.
   */
  async aprobarPorContratoFirmadoCompleto(solicitudId: string, autor: string): Promise<boolean> {
    if (!this.config.enabled) return false;
    let expediente = await this.repo.findExpedientePorSolicitud(solicitudId);
    if (!expediente) {
      const detalle = await this.solicitudRepo.detalle(solicitudId);
      if (!detalle) return false;
      const areaCode = this.config.areaCode;
      const contractTypeCode =
        SGC_CONTRACT_TYPE_BY_SOLICITUD[detalle.tipo ?? ""] ?? this.config.contractTypeCode;
      const input = mapSolicitudToExpediente(detalle, { areaCode, contractTypeCode });
      expediente = await this.crearRegistroConCodigoUnico(solicitudId, input.code, areaCode, contractTypeCode);
    }
    await this.repo.actualizarExpediente(expediente.id, {
      lifecycleStatus: SGC_LIFECYCLE_STATUSES.ACTIVE,
      bypassAprobado: true,
      lastSyncedAt: new Date(),
    });
    console.warn("[sgc] Contrato firmado por cliente y Gerencia: aprobado sin envio al SGC", { solicitudId, autor });
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

      const areaCode = this.config.areaCode;
      const contractTypeCode =
        SGC_CONTRACT_TYPE_BY_SOLICITUD[detalle.tipo ?? ""] ?? this.config.contractTypeCode;
      const input = await this.conCamposDelTipo(
        mapSolicitudToExpediente(detalle, { areaCode, contractTypeCode }),
        detalle.standCodes.join(", "),
        contractTypeCode,
      );
      const registro = existente ?? (await this.crearRegistroConCodigoUnico(
        solicitudId,
        input.code,
        areaCode,
        contractTypeCode,
      ));
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
          areaCode,
          contractTypeCode,
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
      [
        "reenvio",
        async () => {
          const actual = await this.client.consultarExpediente(expediente.contractId!);
          /* Un expediente recien creado queda en draft/drafting y no tiene ronda.
           * Ese estado SI necesita el resend inicial; el early-return de
           * reenviarCorreccionAlSgc solo aplica a una revision ya abierta. */
          const esDraft =
            actual.lifecycleStatus === SGC_LIFECYCLE_STATUSES.DRAFT &&
            actual.stage === SGC_STAGES.DRAFTING;
          if (esDraft) {
            await this.client.reabrirExpediente(
              expediente.contractId!,
              `${SGC_IDEMPOTENCY_RESEND_PREFIX}/${solicitudId}/inicial-v${actual.version ?? 1}`,
            );
            await this.consultarExpediente(solicitudId).catch(() => null);
            return;
          }
          await this.reenviarCorreccionAlSgc(solicitudId, reenviadoPor);
        },
      ],
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
  private async crearRegistroConCodigoUnico(
    solicitudId: string,
    code: string,
    areaCode: string,
    contractTypeCode: string,
  ): Promise<SgcExpedienteEntity> {
    const crear = (codigo: string) =>
      this.repo.crearExpediente({
        solicitudId,
        code: codigo,
        areaCode,
        contractTypeCode,
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
  private async conCamposDelTipo(
    input: SgcCrearExpedienteInput,
    numeroStand: string,
    contractTypeCode: string,
  ): Promise<SgcCrearExpedienteInput> {
    try {
      const catalogo = await this.client.listarTiposContrato();
      const tipo = catalogo.items.find((t) => t.code === contractTypeCode);
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
  async consultarExpediente(
    solicitudId: string,
    opciones?: { regenerarContrato?: boolean },
  ): Promise<SgcExpedienteDetalle | null> {
    if (!this.config.enabled) return null;
    const regenerarContrato = opciones?.regenerarContrato !== false;

    const expediente = await this.repo.findExpedientePorSolicitud(solicitudId);
    if (!expediente?.contractId) return null;

    try {
      const detalle = await this.client.consultarExpediente(expediente.contractId);
      // Con bypass admin, el estado local (Vigente) no se revierte al leer del SGC.
      const preservar = expediente.bypassAprobado;
      const observaciones = this.observacionesDesdeDetalle(detalle, expediente.observaciones, expediente.devolucionRequiereCambio);
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
      const requiereCambio =
        observacionesAbiertas.length === 0 ||
        observacionesAbiertas.some((o) => o.requiresDocumentChange !== false);
      const notificar = debeNotificarDevolucionSgc({
        preservar: Boolean(preservar),
        esDevolucion,
        estabaDevuelto,
        observacionesAbiertas,
        observacionesPrevias: expediente.observaciones,
      });
      /* La regeneracion se reintenta en cada sync aunque la notificacion ya se haya
       * enviado: si fallo en la primera pasada, el cliente nunca veria el boton de firma. */
      const resultadoContrato =
        regenerarContrato && !preservar && esDevolucion && requiereCambio
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
    const expedientes = ordenarParaReconciliar(await this.repo.listarConContractId(), Date.now())
      .slice(0, SGC_RECONCILIAR_MAX_POR_CORRIDA);
    let sincronizados = 0;
    const inicio = Date.now();
    for (const expediente of expedientes) {
      if (Date.now() - inicio >= SGC_RECONCILIAR_TIME_BUDGET_MS) break;
      if (!expediente.contractId) continue;
      try {
        const detalle = await this.client.consultarExpediente(expediente.contractId);
        /* Recupera expedientes que quedaron creados pero nunca iniciaron ronda
         * (regresion de `2bb2459`): crear/subir no inicia el workflow; hace falta
         * el resend inicial. */
        if (
          expediente.estadoEnvio === SGC_ESTADO_ENVIO.CREADO &&
          detalle.lifecycleStatus === SGC_LIFECYCLE_STATUSES.DRAFT &&
          detalle.stage === SGC_STAGES.DRAFTING
        ) {
          await this.enviarExpedienteAlSgc(expediente.solicitudId, "cron");
          sincronizados += 1;
          continue;
        }
        const observaciones = this.observacionesDesdeDetalle(detalle, expediente.observaciones, expediente.devolucionRequiereCambio);
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
        const requiereCambio =
          observacionesAbiertas.length === 0 ||
          observacionesAbiertas.some((o) => o.requiresDocumentChange !== false);
        const notificar = debeNotificarDevolucionSgc({
          preservar: Boolean(expediente.bypassAprobado),
          esDevolucion,
          estabaDevuelto,
          observacionesAbiertas,
          observacionesPrevias: expediente.observaciones,
        });
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
        /* `lastSyncedAt` tambien avanza en el error: si no, el expediente fallido
         * (p. ej. un 404 de un contrato inexistente) quedaba primero en cada corrida
         * y consumia todo el presupuesto del cron. */
        await this.repo
          .actualizarExpediente(expediente.id, { lastError: mensaje.slice(0, MAX_ERROR_LENGTH), lastSyncedAt: new Date() })
          .catch(() => undefined);
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
    /* Un contrato aprobado/vigente/cerrado es inmutable: no se suben nuevas
     * versiones ni documentos al expediente. */
    if (
      expediente.lifecycleStatus === SGC_LIFECYCLE_STATUSES.ACTIVE ||
      expediente.lifecycleStatus === SGC_LIFECYCLE_STATUSES.FINALIZED
    ) {
      return null;
    }

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
      /* v11: observationId/pieceId se envian juntos para una pieza de un
       * grupo. En una observacion agrupada sin pieces (expectedDocuments)
       * se envia solo observationId; una observacion individual se corrige
       * por documentId y no debe enviar observationId suelto. */
      ...(pieza.observationId && pieza.pieceId
        ? { observationId: pieza.observationId, pieceId: pieza.pieceId }
        : pieza.observationId && pieza.esGrupoSinPiezas
          ? { observationId: pieza.observationId }
          : {}),
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
      observationId?: string | null;
      pieceId?: string | null;
      /** true = grupo sin `pieces`; se envia observationId sin pieceId. */
      esGrupoSinPiezas?: boolean;
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
      observationId: params.observationId,
      pieceId: params.pieceId,
      esGrupoSinPiezas: params.esGrupoSinPiezas,
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
   * Registra un intento de solicitar nueva revision al SGC (exito o error) con el estado
   * del expediente y lo que faltaba. Best-effort: nunca rompe el flujo del usuario.
   * `error` ausente = exito; `DomainError` = bloqueo local; `SgcApiError` = error del SGC.
   */
  async registrarIntentoSubsanacion(params: {
    solicitudId: string;
    origen: SgcIntentoOrigen;
    actor: string | null;
    error?: unknown;
    extra?: Record<string, unknown>;
  }): Promise<void> {
    if (typeof this.repo.registrarIntentoSubsanacion !== "function") return;
    try {
      const err = params.error;
      const resultado = err === undefined
        ? SGC_INTENTO_RESULTADOS.EXITO
        : err instanceof DomainError
          ? SGC_INTENTO_RESULTADOS.VALIDACION
          : err instanceof SgcApiError
            ? SGC_INTENTO_RESULTADOS.ERROR_SGC
            : SGC_INTENTO_RESULTADOS.ERROR;
      const httpStatus = err instanceof DomainError || err instanceof SgcApiError ? err.status : null;
      const mensaje = err === undefined ? null : err instanceof Error ? err.message : String(err);
      const [detalle, expediente] = await Promise.all([
        this.solicitudRepo.detalle(params.solicitudId).catch(() => null),
        this.repo.findExpedientePorSolicitud(params.solicitudId).catch(() => null),
      ]);
      const correccion = detalle ? estadoCorreccionSgc(detalle) : null;
      const abiertas = (expediente?.observaciones ?? [])
        .filter((o) => o.status !== SGC_OBSERVACION_ESTADOS.RESOLVED)
        .map((o) => ({
          observationId: o.observationId ?? null,
          category: o.category ?? null,
          title: o.title ?? null,
          documentId: o.documentId ?? null,
          piezas: o.pieces?.length ?? 0,
        }));
      await this.repo.registrarIntentoSubsanacion({
        solicitudId: params.solicitudId,
        origen: params.origen,
        actor: params.actor,
        resultado,
        httpStatus,
        mensaje,
        sgcLifecycle: expediente?.lifecycleStatus ?? null,
        sgcStage: expediente?.stage ?? null,
        requeridos: correccion?.requeridos ?? null,
        cubiertos: correccion?.cubiertos ?? null,
        detalle: {
          faltantes: correccion?.faltantes ?? [],
          observacionesAbiertas: abiertas,
          contractId: expediente?.contractId ?? null,
          ...(params.extra ?? {}),
        },
      });
    } catch (registroError) {
      console.warn("[sgc] No se pudo registrar el intento de subsanacion", {
        solicitudId: params.solicitudId,
        mensaje: registroError instanceof Error ? registroError.message : String(registroError),
      });
    }
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
    /* No se reenvía ni corrige un expediente con aprobación final. */
    if (
      expediente.lifecycleStatus === SGC_LIFECYCLE_STATUSES.ACTIVE ||
      expediente.lifecycleStatus === SGC_LIFECYCLE_STATUSES.FINALIZED
    ) {
      return sinDocumento;
    }

    const actual = await this.client.consultarExpediente(expediente.contractId);
    const sgcDevuelto =
      actual.lifecycleStatus === SGC_LIFECYCLE_STATUSES.OBSERVED ||
      actual.lifecycleStatus === SGC_LIFECYCLE_STATUSES.REJECTED;
    /* La UI puede conservar una observacion local ya resuelta. No se deben
     * reenviar piezas cuando el SGC ya abrio una nueva ronda: responde 409. */
    if (!sgcDevuelto) {
      const observacionesActuales = this.observacionesDesdeDetalle(actual, expediente.observaciones, expediente.devolucionRequiereCambio);
      await this.repo.actualizarExpediente(expediente.id, {
        stage: actual.stage,
        lifecycleStatus: actual.lifecycleStatus,
        version: actual.version,
        lastSyncedAt: new Date(),
        lastError: null,
        ...(observacionesActuales !== null ? { observaciones: observacionesActuales } : {}),
      }).catch(() => undefined);
      return { reenviado: true, documento: null };
    }

    /* Guia §8/§8.2 y escenarios E/F: el contrato puede quedar igual SOLO si la devolucion
     * trae observaciones por documento y ninguna apunta al contrato. Una devolucion con
     * cambio documental sin `observations[]` abiertas, o un rechazo, exige una version
     * nueva del documento principal antes de `/resend` (si no, el SGC responde 422).
     * Se usan las observaciones frescas del SGC: la copia local puede traer solo
     * observaciones ya resueltas de rondas anteriores. */
    const observacionesFrescas =
      this.observacionesDesdeDetalle(actual, expediente.observaciones, expediente.devolucionRequiereCambio) ?? detalle.sgcObservaciones ?? [];
    const abiertas = observacionesFrescas.filter(
      (o) => o.status !== SGC_OBSERVACION_ESTADOS.RESOLVED && (o.message ?? "").trim().length > 0,
    );
    const requiereContrato =
      actual.lifecycleStatus === SGC_LIFECYCLE_STATUSES.REJECTED ||
      abiertas.length === 0 ||
      abiertas.some(esObservacionSgcContrato);

    /* Contrato a versionar (si aplica). Se resuelve y valida ANTES de subir anexos: si el
     * reenvio va a fallar porque el contrato no cambio, no se dejan versiones sueltas en
     * el SGC (caso COMISUB: anexo versionado y luego 422 en /resend). */
    let pieza: { url: string; nombre: string } | null = null;
    const contratoSgc = actual.documents.find((d) => d.category === SGC_DOCUMENT_CATEGORIES.CONTRACT) ?? null;
    if (requiereContrato) {
      /* Contrato firmado mas reciente (activo) del cliente, o el contrato disponible. */
      const firmado = this.ultimoDocumento(detalle.docsAdjuntos, (d) =>
        this.documentoVigente(d) && d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO);
      pieza = firmado
        ? { url: firmado.url, nombre: firmado.nombre }
        : this.seleccionarContrato(detalle);
      if (!pieza || !contratoSgc) return sinDocumento;
      const previo = await this.repo.buscarDocumento?.(contratoSgc.documentId).catch(() => null);
      if (previo?.checksumSha256) {
        const contenido = await this.documentoOrigen.leer(pieza.url).catch(() => null);
        const checksum = contenido ? await sha256Hex(contenido.bytes) : null;
        if (checksum && checksum === previo.checksumSha256) {
          throw new DomainError(
            "El área legal pide una versión nueva del contrato firmado. El contrato vigente es el mismo que ya revisó: firma nuevamente el contrato y vuelve a solicitar la revisión.",
            API_ERROR_CODES.CONFLICT,
            409,
          );
        }
      }
    }

    /* Devolucion del SGC: se versionan los anexos corregidos (el SGC exige que la
     * correccion incluya las piezas actualizadas; `subirAnexosDeSolicitud` solo versiona
     * cuando el lifecycle es rejected/observed). Solo se envia lo que el SGC observo. */
    await this.subirAnexosDeSolicitud(solicitudId, { soloObservado: true });

    let documento: SgcDocumentoEntity | null = null;
    if (requiereContrato && pieza && contratoSgc) {
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
  async subirAnexosDeSolicitud(
    solicitudId: string,
    opciones: {
      /**
       * Subsanacion (reenvio tras una devolucion): sube SOLO lo que el SGC tiene observado
       * (piezas de grupos abiertos, versiones de documentos con observacion abierta y faltantes
       * abiertos). El resto de anexos no se envia: si falta algo, el SGC lo observa.
       */
      soloObservado?: boolean;
    } = {},
  ): Promise<SgcDocumentoEntity[]> {
    if (!this.config.enabled) return [];
    const detalle = await this.solicitudRepo.detalle(solicitudId);
    if (!detalle) return [];

    /* Preferir el detalle fresco del SGC: el JSON local puede haberse guardado
     * antes de que existiera observationId en los grupos de adjuntos. */
    const expedienteGrupos = await this.repo.findExpedientePorSolicitud(solicitudId);
    const sgcGrupos = expedienteGrupos?.contractId
      ? await this.client.consultarExpediente(expedienteGrupos.contractId).catch(() => null)
      : null;
    const observacionesGrupo = sgcGrupos?.missingDocuments?.length
      ? sgcGrupos.missingDocuments
      : detalle.sgcObservaciones;
    const observacionesResueltas = new Set<string>();
    for (const o of observacionesGrupo ?? []) {
      if (!o.observationId) continue;
      const esperados = Math.max(1, o.expectedDocuments ?? o.expectedDocumentTitles?.length ?? 1);
      if (
        o.status === SGC_OBSERVACION_ESTADOS.RESOLVED ||
        (o.documentsMissing === 0 && (o.documentIds?.length ?? 0) >= esperados)
      ) {
        observacionesResueltas.add(o.observationId);
      }
    }
    /* Las observaciones individuales (por documento) tambien cuentan: `observacionesGrupo`
     * solo trae los faltantes/grupos cuando el SGC los informa. */
    for (const doc of sgcGrupos?.documents ?? []) {
      for (const o of doc.observations ?? []) {
        if (o.observationId && o.status === SGC_OBSERVACION_ESTADOS.RESOLVED) observacionesResueltas.add(o.observationId);
      }
    }
    /* Observaciones abiertas segun el SGC (fresco) o, si la consulta fallo, segun la copia local. */
    const observacionesAbiertasIds = new Set<string>();
    const documentosObservadosIds = new Set<string>();
    if (sgcGrupos) {
      for (const doc of sgcGrupos.documents ?? []) {
        for (const o of doc.observations ?? []) {
          if (o.observationId && o.status !== SGC_OBSERVACION_ESTADOS.RESOLVED) {
            observacionesAbiertasIds.add(o.observationId);
            documentosObservadosIds.add(o.documentId ?? doc.documentId);
          }
        }
      }
      for (const m of sgcGrupos.missingDocuments ?? []) {
        if (m.observationId && m.status !== SGC_OBSERVACION_ESTADOS.RESOLVED && !observacionesResueltas.has(m.observationId)) {
          observacionesAbiertasIds.add(m.observationId);
        }
      }
    } else {
      for (const o of expedienteGrupos?.observaciones ?? []) {
        if (o.observationId && o.status !== SGC_OBSERVACION_ESTADOS.RESOLVED) {
          observacionesAbiertasIds.add(o.observationId);
          if (o.documentId) documentosObservadosIds.add(o.documentId);
        }
      }
    }
    /* Devolucion sin observaciones (caso ESAN): el SGC no marco documentos y el motivo solo
     * viaja en su aviso. Cuenta como "observado" lo que el cliente subio despues de la devolucion. */
    const implicitaAbierta = (expedienteGrupos?.observaciones ?? []).find(
      (o) => o.observationId?.startsWith(SGC_OBSERVACION_IMPLICITA_PREFIX) && o.status !== SGC_OBSERVACION_ESTADOS.RESOLVED,
    );
    const devueltoSinDetalle =
      Boolean(sgcGrupos) &&
      observacionesAbiertasIds.size === 0 &&
      (sgcGrupos?.lifecycleStatus === SGC_LIFECYCLE_STATUSES.OBSERVED ||
        sgcGrupos?.lifecycleStatus === SGC_LIFECYCLE_STATUSES.REJECTED);
    const fechaDevolucionSinDetalle = implicitaAbierta
      ? dateUtils.toMs(implicitaAbierta.createdAt ?? null)
      : devueltoSinDetalle
        ? dateUtils.toMs(sgcGrupos?.updatedAt ?? null)
        : null;
    const gruposPorObservacion = new Map<string, { piezas: Set<string>; sinPiezas: boolean }>();
    const piezasPorTitulo = new Map<string, { observationId: string; pieceId: string }>();
    for (const o of observacionesGrupo ?? []) {
      if (!o.observationId) continue;
      const piezas = new Set((o.pieces ?? []).map((piece) => piece.id).filter(Boolean));
      const esGrupo =
        piezas.size > 0 ||
        (o.expectedDocuments ?? 0) > 1 ||
        (o.expectedDocumentTitles?.length ?? 0) > 1;
      if (!esGrupo) continue;
      gruposPorObservacion.set(o.observationId, { piezas, sinPiezas: piezas.size === 0 });
      for (const piece of o.pieces ?? []) {
        const titulo = normalizarTituloSgc(piece.title);
        if (titulo) piezasPorTitulo.set(titulo, { observationId: o.observationId, pieceId: piece.id });
      }
    }
    const contrato = this.seleccionarContrato(detalle);
    const contratoUrl = contrato?.url;
    const contratoClave = contrato?.nombre || contratoUrl;
    const datosGrupoDocumento = (d: SolicitudRow["docsAdjuntos"][number]) => {
      const titulo = normalizarTituloSgc(d.sgcTitle ?? d.nombre);
      const inferida = piezasPorTitulo.get(titulo);
      const observationId = d.sgcObservationId ?? inferida?.observationId ?? null;
      const pieceId = d.sgcPieceId ??
        (inferida?.observationId === observationId ? inferida.pieceId : null);
      return {
        observationId,
        pieceId,
        grupo: observationId ? gruposPorObservacion.get(observationId) : undefined,
      };
    };
    const candidatos: DocumentoUrl[] = [
      ...detalle.docsAdjuntos
        .filter((d) => {
          if (!this.documentoVigente(d) || d.userId === null || d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO) return false;
          /* En un grupo v11 solo se envian las piezas nuevas; los archivos
           * historicos sin pieceId no deben consumir una pieza del SGC. */
          const { observationId, pieceId, grupo } = datosGrupoDocumento(d);
          /* Una observacion resuelta no se reenvia, pero su archivo se conserva como candidato
           * "ya cubierto": ver `observacionResuelta`. */
          if (observationId && observacionesResueltas.has(observationId)) return true;
          if (!grupo || grupo.sinPiezas) return true;
          return Boolean(pieceId && grupo.piezas.has(pieceId));
        })
        .map((d) => {
          const { observationId, pieceId } = datosGrupoDocumento(d);
          return {
            url: d.url,
            nombre: d.nombre,
            requisito: d.requisito,
            sgcObservationId: observationId,
            sgcDocumentId: d.sgcDocumentId ?? null,
            sgcTitle: d.sgcTitle ?? null,
            sgcPieceId: pieceId,
            observacionResuelta: Boolean(observationId && observacionesResueltas.has(observationId)),
          };
        }),
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
    /* Si el mismo titulo aparece como version existente y como faltante, la
     * version existente manda: el SGC valida por documentId y no acepta un
     * archivo aparte como reemplazo. */
    const observacionesVersion = (expediente?.observaciones ?? []).filter(
      (o) =>
        Boolean(o.documentId) &&
        o.status !== SGC_OBSERVACION_ESTADOS.RESOLVED &&
        o.requiresDocumentChange !== false,
    );
    const documentIdPorTituloObservado = new Map<string, string>();
    for (const o of observacionesVersion) {
      const title = o.title?.trim();
      if (title && o.documentId && !documentIdPorTituloObservado.has(title)) {
        documentIdPorTituloObservado.set(title, o.documentId);
      }
    }
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
    const enviadosPorGrupo = new Set<string>();
    const resultados: SgcDocumentoEntity[] = [];
    for (const doc of candidatos) {
      /* Version ya aceptada por el SGC (observacion resuelta): nunca se reenvia, pero reserva
       * su documento. Los candidatos van del mas nuevo al mas viejo, asi un original que sigue
       * "activo" localmente no se sube como version nueva encima de la correccion (caso SCANIA:
       * la vigencia y el DNI corregidos volvieron a ser los originales). */
      if (doc.observacionResuelta) {
        const objetivoResuelto =
          doc.sgcDocumentId ?? (doc.sgcTitle ? documentIdPorTitulo.get(doc.sgcTitle.trim()) : undefined);
        if (objetivoResuelto) documentIdsUsados.add(objetivoResuelto);
        continue;
      }
      const clave = doc.nombre || doc.url;
      const claveGrupo = doc.sgcObservationId
        ? `${doc.sgcObservationId}:${doc.sgcPieceId ?? normalizarTituloSgc(doc.sgcTitle ?? doc.nombre)}`
        : null;
      if (claveGrupo && enviadosPorGrupo.has(claveGrupo)) continue;
      if (claveGrupo) enviadosPorGrupo.add(claveGrupo);
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
      const esVersionPorTitulo = observacionesVersion.some(
        (o) => o.title?.trim() === titulo,
      );
      const grupoDocumento = doc.sgcObservationId
        ? gruposPorObservacion.get(doc.sgcObservationId)
        : undefined;
      const esDocumentoAgrupado = Boolean(grupoDocumento);
      const documentIdObjetivo =
        doc.sgcDocumentId ??
        documentIdPorTitulo.get(titulo) ??
        documentIdPorTituloObservado.get(titulo) ??
        (doc.requisito ? documentIdPorRequisito.get(doc.requisito) : undefined);
      const yaEnSgc =
        (!doc.sgcObservationId &&
          !esVersionPorTitulo &&
          (doc.requisito ? titulosEnSgc.has(doc.nombre) : titulosEnSgc.has(doc.nombre) || titulosEnSgc.has(titulo))) ||
        (!esDocumentoAgrupado &&
          (nombresEnSgc.has(doc.nombre) ||
            nombresEnSgc.has(fileNameLegacy) ||
            nombresEnSgc.has(fileName)));
      /* Un archivo ya presente como version vigente reserva su documento: los mas viejos que
       * apuntan al mismo documento no deben reenviarse como version nueva (regresion). */
      if (yaEnSgc && documentIdObjetivo) documentIdsUsados.add(documentIdObjetivo);
      if (
        vistos.has(clave) ||
        Boolean(documentIdObjetivo && documentIdsUsados.has(documentIdObjetivo)) ||
        doc.url === contratoUrl ||
        clave === contratoClave ||
        yaEnSgc
      ) {
        continue;
      }
      vistos.add(clave);
      const coincideFaltante = (o: SgcObservacionDocumento): boolean => {
        /* Vinculo explicito del archivo con la observacion: manda sobre fechas/titulos. */
        if (doc.sgcObservationId && o.observationId) {
          return doc.sgcObservationId === o.observationId;
        }
        const obsMs = dateUtils.toMs(o.createdAt ?? null);
        const docMs = dateUtils.toMs(fechaPorUrl.get(doc.url) ?? null);
        if (obsMs === null || docMs === null || docMs <= obsMs) return false;
        if (o.title && (titulo === o.title || doc.nombre === o.title)) return true;
        return !o.title;
      };
      const esFaltante = observacionesFaltantes.some(coincideFaltante);
      /* Subsanacion: solo se envia lo que el SGC observo; si falta algo mas, el SGC lo observa
       * en la siguiente ronda. Un documento es "observado" si esta vinculado a una observacion
       * abierta, versiona un documento con observacion abierta o responde a un faltante abierto. */
      if (opciones.soloObservado) {
        const vinculadoAbierta = Boolean(doc.sgcObservationId && observacionesAbiertasIds.has(doc.sgcObservationId));
        const versionaObservado = Boolean(documentIdObjetivo && documentosObservadosIds.has(documentIdObjetivo));
        const respondeFaltanteAbierto = observacionesFaltantes
          .filter((o) => o.status !== SGC_OBSERVACION_ESTADOS.RESOLVED && (!o.observationId || observacionesAbiertasIds.has(o.observationId)))
          .some(coincideFaltante);
        const docMsDevolucion = dateUtils.toMs(fechaPorUrl.get(doc.url) ?? null);
        const respondeDevolucionSinDetalle =
          fechaDevolucionSinDetalle !== null && docMsDevolucion !== null && docMsDevolucion > fechaDevolucionSinDetalle;
        if (!vinculadoAbierta && !versionaObservado && !respondeFaltanteAbierto && !respondeDevolucionSinDetalle) continue;
      }
      const documentIdCandidato = (!esFaltante || esVersionPorTitulo) && puedeVersionarAnexos
        ? documentIdObjetivo
        : undefined;
      const documentIdExistente = documentIdCandidato && !documentIdsUsados.has(documentIdCandidato) ? documentIdCandidato : undefined;
      if (documentIdExistente) documentIdsUsados.add(documentIdExistente);
      const grupo = grupoDocumento;
      const piezaAgrupada = Boolean(
        doc.sgcObservationId &&
          doc.sgcPieceId &&
          grupo?.piezas.has(doc.sgcPieceId),
      );
      const grupoSinPiezas = Boolean(grupo?.sinPiezas && doc.sgcObservationId);
      const subido = await this.subirDocumentoDesdeUrl(solicitudId, {
        category: SGC_DOCUMENT_CATEGORIES.ANNEX,
        title: titulo,
        fileName,
        url: doc.url,
        documentId: documentIdExistente ?? null,
        observationId: piezaAgrupada || grupoSinPiezas ? doc.sgcObservationId : null,
        pieceId: piezaAgrupada ? doc.sgcPieceId : null,
        esGrupoSinPiezas: grupoSinPiezas,
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
  private observacionesDesdeDetalle(
    detalle: SgcExpedienteDetalle,
    previas?: SgcObservacionDocumento[] | null,
    devolucionRequiereCambio?: boolean | null,
  ): SgcObservacionDocumento[] | null {
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
          message: "El SGC observo este documento.",
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
      const esperados = Math.max(1, doc.expectedDocuments ?? doc.expectedDocumentTitles?.length ?? 1);
      const resuelta =
        doc.status === SGC_OBSERVACION_ESTADOS.RESOLVED ||
        (doc.documentsMissing === 0 && (doc.documentIds?.length ?? 0) >= esperados);
      lista.push({
        observationId: doc.observationId ?? null,
        documentId: null,
        category: doc.category ?? SGC_DOCUMENT_CATEGORIES.ANNEX,
        title: doc.title,
        message: `Falta adjuntar: ${doc.title || "documento solicitado"}.`,
        status: resuelta ? SGC_OBSERVACION_ESTADOS.RESOLVED : SGC_OBSERVACION_ESTADOS.OPEN,
        requiresDocumentChange: true,
        requiresNewDocument: true,
        expectedDocuments: doc.expectedDocuments ?? null,
        expectedDocumentTitles: doc.expectedDocumentTitles ?? null,
        documentsMissing: doc.documentsMissing ?? null,
        documentIds: doc.documentIds ?? null,
        pieces: doc.pieces ?? null,
        createdAt:
          (previas ?? []).find(
            (o) => !o.documentId && (o.title ?? '').trim() === (doc.title ?? '').trim(),
          )?.createdAt ?? detalle.updatedAt,
      });
    }
    const implicita = this.observacionContratoImplicita(detalle, lista, previas, devolucionRequiereCambio);
    if (implicita) {
      informado = true;
      lista.push(implicita);
    }
    return informado ? lista : null;
  }

  /**
   * Devolucion o rechazo del SGC sin observaciones abiertas (caso ESAN/COMISUB/BOART): el SGC
   * exige una version nueva del contrato antes de `/resend` (guia §8/§8.2), pero sin una
   * observacion el cliente no tenia como firmar de nuevo. Se sintetiza una observacion del
   * contrato (id local con prefijo) que activa el flujo existente: regenerar, firmar y reenviar.
   * No aplica si el SGC indico que la devolucion no exige cambio documental.
   */
  private observacionContratoImplicita(
    detalle: SgcExpedienteDetalle,
    lista: SgcObservacionDocumento[],
    previas: SgcObservacionDocumento[] | null | undefined,
    devolucionRequiereCambio: boolean | null | undefined,
  ): SgcObservacionDocumento | null {
    const devuelto =
      detalle.lifecycleStatus === SGC_LIFECYCLE_STATUSES.OBSERVED ||
      detalle.lifecycleStatus === SGC_LIFECYCLE_STATUSES.REJECTED;
    if (!devuelto || devolucionRequiereCambio === false) return null;
    if (lista.some((o) => o.status !== SGC_OBSERVACION_ESTADOS.RESOLVED)) return null;
    const contrato = (detalle.documents ?? []).find((d) => d.category === SGC_DOCUMENT_CATEGORIES.CONTRACT);
    if (!contrato) return null;
    /* Estable mientras dure la devolucion: se reutiliza la implicita previa abierta (id y fecha). */
    const previa = (previas ?? []).find(
      (o) => o.observationId?.startsWith(SGC_OBSERVACION_IMPLICITA_PREFIX) && o.status !== SGC_OBSERVACION_ESTADOS.RESOLVED,
    );
    return {
      observationId: previa?.observationId ?? `${SGC_OBSERVACION_IMPLICITA_PREFIX}-v${detalle.version ?? 0}`,
      documentId: contrato.documentId,
      category: SGC_DOCUMENT_CATEGORIES.CONTRACT,
      title: contrato.title,
      message: SGC_OBSERVACION_IMPLICITA_MENSAJE,
      severity: "blocking",
      requiresDocumentChange: true,
      status: SGC_OBSERVACION_ESTADOS.OPEN,
      createdAt: previa?.createdAt ?? detalle.updatedAt,
    };
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
