import type { SgcWebhookEventoEntity } from "@/domain/models/sgc";

export interface RegistrarSgcWebhookData {
  eventId: string;
  eventType: string;
  resourceId: string | null;
  resourceCode: string | null;
  payload: unknown;
}

export interface ISgcWebhookRepository {
  findEvento(eventId: string): Promise<SgcWebhookEventoEntity | null>;
  registrarEvento(data: RegistrarSgcWebhookData): Promise<SgcWebhookEventoEntity>;
  marcarProcesado(eventId: string, error: string | null): Promise<void>;
}
