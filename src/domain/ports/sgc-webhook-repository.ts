import type { SgcWebhookEventoEntity } from "@/domain/models/sgc";

export interface RegistrarSgcWebhookData {
  eventId: string;
  eventType: string;
  resourceId: string | null;
  resourceCode: string | null;
  /** Id de entrega (`x-sgc-delivery`); null si el SGC no lo envio. */
  deliveryId?: string | null;
  payload: unknown;
}

export interface ISgcWebhookRepository {
  findEvento(eventId: string): Promise<SgcWebhookEventoEntity | null>;
  /** Dedup por entrega (`x-sgc-delivery`): identifica cada intento de entrega del SGC. */
  findEventoPorDelivery(deliveryId: string): Promise<SgcWebhookEventoEntity | null>;
  registrarEvento(data: RegistrarSgcWebhookData): Promise<SgcWebhookEventoEntity>;
  marcarProcesado(eventId: string, error: string | null): Promise<void>;
}
