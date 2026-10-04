import type { ISgcRepository, ActualizarSgcExpedienteData } from "@/domain/ports/sgc-repository";
import type { ISgcWebhookRepository } from "@/domain/ports/sgc-webhook-repository";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { SgcWebhookPayload } from "@/domain/models/sgc";
import { SGC_EVENT_TYPES, SGC_FINALIZATION, SGC_LIFECYCLE_STATUSES, SGC_STAGES } from "@/lib/shared/constants";
import type { SgcStage } from "@/lib/shared/constants";
import type { SgcIntegracionConfig } from "@/application/sgc-integracion/sgc-integracion-service";
import { resolverIdiomaDestinatario } from "@/application/idioma/resolver-idioma";
import { enviarEmailPlantilla } from "@/lib/server/email";

const MAX_ERROR_LENGTH = 500;

export interface SgcWebhookResultado {
  recibido: boolean;
  duplicado: boolean;
}

/**
 * Procesa webhooks del SGC: idempotencia por eventId (inbox) y actualizacion de
 * la correlacion local del expediente. No lanza ante fallos de negocio: los
 * registra en el inbox para diagnostico.
 */
export class SgcWebhookApplicationService {
  constructor(
    private readonly repo: ISgcWebhookRepository,
    private readonly sgcRepo: ISgcRepository,
    private readonly config: SgcIntegracionConfig,
    /* Opcionales: notifican al cliente cuando el SGC aprueba (best-effort). */
    private readonly solicitudes?: ISolicitudesRepository,
    private readonly auth?: IAuthRepository,
  ) {}

  async procesar(payload: SgcWebhookPayload): Promise<SgcWebhookResultado> {
    if (!this.config.enabled) return { recibido: true, duplicado: false };
    if (!payload?.eventId || !payload.eventType) return { recibido: false, duplicado: false };

    const existente = await this.repo.findEvento(payload.eventId);
    if (existente) return { recibido: true, duplicado: true };

    await this.repo.registrarEvento({
      eventId: payload.eventId,
      eventType: payload.eventType,
      resourceId: payload.resource?.id ?? null,
      resourceCode: payload.resource?.code ?? null,
      payload,
    });

    try {
      await this.aplicar(payload);
      await this.repo.marcarProcesado(payload.eventId, null);
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "Error desconocido al procesar el webhook";
      await this.repo.marcarProcesado(payload.eventId, mensaje.slice(0, MAX_ERROR_LENGTH));
    }
    return { recibido: true, duplicado: false };
  }

  private async aplicar(payload: SgcWebhookPayload): Promise<void> {
    const contractId = payload.resource?.id;
    if (!contractId) return;

    const expediente = await this.sgcRepo.findExpedientePorContractId(contractId);
    if (!expediente) return;

    const cambios: ActualizarSgcExpedienteData = { lastSyncedAt: new Date(), lastError: null };
    const data = payload.data ?? {};

    switch (payload.eventType) {
      case SGC_EVENT_TYPES.WORKFLOW_ADVANCED: {
        const destino = data.to;
        if (typeof destino === "string" && Object.values(SGC_STAGES).includes(destino as SgcStage)) {
          cambios.stage = destino as SgcStage;
        }
        break;
      }
      case SGC_EVENT_TYPES.WORKFLOW_RETURNED:
        cambios.lifecycleStatus = SGC_LIFECYCLE_STATUSES.OBSERVED;
        break;
      case SGC_EVENT_TYPES.WORKFLOW_APPROVED:
        cambios.lifecycleStatus =
          data.finalization === SGC_FINALIZATION.ACTIVE
            ? SGC_LIFECYCLE_STATUSES.ACTIVE
            : SGC_LIFECYCLE_STATUSES.FINALIZED;
        break;
      case SGC_EVENT_TYPES.WORKFLOW_REJECTED:
        cambios.lifecycleStatus = SGC_LIFECYCLE_STATUSES.REJECTED;
        break;
      case SGC_EVENT_TYPES.CONTRACT_CLOSED:
        cambios.lifecycleStatus = SGC_LIFECYCLE_STATUSES.FINALIZED;
        break;
      default:
        break;
    }

    /* Notificacion automatica al cliente: la primera vez que el SGC aprueba (Vigente). */
    const aprobadoAhora =
      cambios.lifecycleStatus === SGC_LIFECYCLE_STATUSES.ACTIVE &&
      expediente.lifecycleStatus !== SGC_LIFECYCLE_STATUSES.ACTIVE &&
      expediente.lifecycleStatus !== SGC_LIFECYCLE_STATUSES.FINALIZED;

    await this.sgcRepo.actualizarExpediente(expediente.id, cambios);
    if (aprobadoAhora) await this.notificarAprobacion(expediente.solicitudId);
  }

  /** Correo "resultado de revision" al cliente cuando Legal (SGC) aprueba. Best-effort. */
  private async notificarAprobacion(solicitudId: string): Promise<void> {
    if (!this.solicitudes || !this.auth) return;
    try {
      const detalle = await this.solicitudes.detalle(solicitudId);
      if (!detalle?.email) return;
      const idioma = await resolverIdiomaDestinatario(this.auth, detalle.email);
      const nombre = detalle.userId ? (await this.solicitudes.findNombreUsuario(detalle.userId)) ?? "Estimad@" : "Estimad@";
      await enviarEmailPlantilla({
        to: detalle.email,
        plantilla: "revision-resultado",
        idioma,
        datos: {
          standCode: detalle.standCode,
          empresa: detalle.empresa ?? "-",
          nombre,
          email: detalle.email,
          gessStandId: detalle.id,
          modo: "automatico",
          revisiones: detalle.revisiones.map((r) => ({ area: r.area, estado: r.estado, comentario: r.comentario })),
        },
      });
    } catch {
      /* best-effort: un fallo de correo no revierte la aprobacion del SGC */
    }
  }
}
