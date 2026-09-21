import type { ISgcOutboxRepository } from "@/domain/ports/sgc-outbox-repository";
import type { SgcOutboxEntity } from "@/domain/models/sgc";
import type { SgcIntegracionApplicationService, SgcIntegracionConfig } from "@/application/sgc-integracion/sgc-integracion-service";
import { SGC_OUTBOX_OPERACION } from "@/lib/shared/constants";
import { calcularBackoffMs } from "@/lib/shared/utils/sgc-outbox";

const MAX_ERROR_LENGTH = 500;

export interface SgcOutboxResultado {
  enviados: number;
  fallidos: number;
}

/**
 * Cola de salida (outbox) para operaciones hacia el SGC: encola ante fallo y
 * reintenta con backoff exponencial cuando corre el cron. Evita perder subidas
 * de contrato/anexos o subsanaciones por fallos transitorios.
 */
export class SgcOutboxApplicationService {
  constructor(
    private readonly repo: ISgcOutboxRepository,
    private readonly sgc: SgcIntegracionApplicationService,
    private readonly config: SgcIntegracionConfig,
  ) {}

  async encolar(operacion: string, payload: Record<string, unknown>, idempotencyKey?: string): Promise<void> {
    if (!this.config.enabled) return;
    await this.repo
      .encolar({ operacion, payload, idempotencyKey: idempotencyKey ?? null })
      .catch(() => undefined);
  }

  async despachar(limite = 10): Promise<SgcOutboxResultado> {
    if (!this.config.enabled) return { enviados: 0, fallidos: 0 };

    const pendientes = await this.repo.listarPendientes(limite, new Date());
    let enviados = 0;
    let fallidos = 0;
    for (const item of pendientes) {
      try {
        await this.ejecutar(item);
        await this.repo.marcarEnviado(item.id);
        enviados += 1;
      } catch (err) {
        const intentos = item.intentos + 1;
        const programadoAt = new Date(Date.now() + calcularBackoffMs(item.intentos));
        const mensaje = err instanceof Error ? err.message : "Error desconocido en el outbox";
        await this.repo.marcarError(item.id, mensaje.slice(0, MAX_ERROR_LENGTH), programadoAt, intentos);
        fallidos += 1;
      }
    }
    return { enviados, fallidos };
  }

  private async ejecutar(item: SgcOutboxEntity): Promise<void> {
    const solicitudId = String(item.payload.solicitudId ?? "");
    if (!solicitudId) throw new Error("Payload del outbox sin solicitudId");

    switch (item.operacion) {
      case SGC_OUTBOX_OPERACION.SUBIR_CONTRATO: {
        const documento = await this.sgc.subirContratoDeSolicitud(solicitudId);
        if (!documento) throw new Error("El SGC no confirmo el contrato");
        break;
      }
      case SGC_OUTBOX_OPERACION.SUBIR_ANEXOS: {
        await this.sgc.subirAnexosDeSolicitud(solicitudId);
        break;
      }
      case SGC_OUTBOX_OPERACION.SUBSANAR: {
        const documento = await this.sgc.subsanarContrato(solicitudId, {
          url: String(item.payload.url ?? ""),
          title: String(item.payload.title ?? "Contrato corregido"),
          documentId: String(item.payload.documentId ?? ""),
        });
        if (!documento) throw new Error("El SGC no confirmo la subsanacion");
        break;
      }
      default:
        throw new Error(`Operacion de outbox desconocida: ${item.operacion}`);
    }
  }
}
