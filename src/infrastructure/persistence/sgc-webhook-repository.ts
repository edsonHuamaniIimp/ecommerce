import { prisma } from "@/lib/server/db";
import type { ISgcWebhookRepository, RegistrarSgcWebhookData } from "@/domain/ports/sgc-webhook-repository";
import type { SgcWebhookEventoEntity } from "@/domain/models/sgc";

interface SgcWebhookEventoRow {
  id: string;
  eventId: string;
  eventType: string;
  resourceId: string | null;
  resourceCode: string | null;
  procesadoAt: Date | null;
  error: string | null;
}

function mapEvento(row: SgcWebhookEventoRow): SgcWebhookEventoEntity {
  return {
    id: row.id,
    eventId: row.eventId,
    eventType: row.eventType,
    resourceId: row.resourceId ?? null,
    resourceCode: row.resourceCode ?? null,
    procesadoAt: row.procesadoAt ?? null,
    error: row.error ?? null,
  };
}

export class SgcWebhookPrismaRepository implements ISgcWebhookRepository {
  async findEvento(eventId: string): Promise<SgcWebhookEventoEntity | null> {
    const row = await prisma.sgcWebhookEvento.findUnique({ where: { eventId } });
    return row ? mapEvento(row) : null;
  }

  async registrarEvento(data: RegistrarSgcWebhookData): Promise<SgcWebhookEventoEntity> {
    const row = await prisma.sgcWebhookEvento.create({
      data: {
        eventId: data.eventId,
        eventType: data.eventType,
        resourceId: data.resourceId,
        resourceCode: data.resourceCode,
        payload: data.payload as never,
      },
    });
    return mapEvento(row);
  }

  async marcarProcesado(eventId: string, error: string | null): Promise<void> {
    await prisma.sgcWebhookEvento.update({
      where: { eventId },
      data: { procesadoAt: new Date(), error },
    });
  }
}

export const sgcWebhookRepo = new SgcWebhookPrismaRepository();
