import { prisma } from "@/lib/server/db";
import type { EncolarSgcOutboxData, ISgcOutboxRepository } from "@/domain/ports/sgc-outbox-repository";
import type { SgcOutboxEntity } from "@/domain/models/sgc";
import { SGC_OUTBOX_ESTADO, SGC_OUTBOX_MAX_INTENTOS } from "@/lib/shared/constants";
import type { SgcOutboxEstado } from "@/lib/shared/constants";

interface SgcOutboxRow {
  id: string;
  operacion: string;
  idempotencyKey: string | null;
  payload: unknown;
  estado: string;
  intentos: number;
  ultimoError: string | null;
  programadoAt: Date;
}

function mapOutbox(row: SgcOutboxRow): SgcOutboxEntity {
  return {
    id: row.id,
    operacion: row.operacion,
    idempotencyKey: row.idempotencyKey ?? null,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    estado: row.estado as SgcOutboxEstado,
    intentos: row.intentos,
    ultimoError: row.ultimoError ?? null,
    programadoAt: row.programadoAt,
  };
}

export class SgcOutboxPrismaRepository implements ISgcOutboxRepository {
  async encolar(data: EncolarSgcOutboxData): Promise<SgcOutboxEntity> {
    const row = await prisma.sgcOutbox.create({
      data: {
        operacion: data.operacion,
        idempotencyKey: data.idempotencyKey ?? null,
        payload: data.payload as never,
      },
    });
    return mapOutbox(row);
  }

  async listarPendientes(limite: number, ahora: Date): Promise<SgcOutboxEntity[]> {
    const rows = await prisma.sgcOutbox.findMany({
      where: { estado: SGC_OUTBOX_ESTADO.PENDIENTE, programadoAt: { lte: ahora } },
      orderBy: { programadoAt: "asc" },
      take: limite,
    });
    return rows.map((row) => mapOutbox(row));
  }

  async marcarEnviado(id: string): Promise<void> {
    await prisma.sgcOutbox.update({ where: { id }, data: { estado: SGC_OUTBOX_ESTADO.ENVIADO } });
  }

  async marcarError(id: string, error: string, programadoAt: Date, intentos: number): Promise<void> {
    const estado = intentos >= SGC_OUTBOX_MAX_INTENTOS ? SGC_OUTBOX_ESTADO.ERROR : SGC_OUTBOX_ESTADO.PENDIENTE;
    await prisma.sgcOutbox.update({ where: { id }, data: { estado, ultimoError: error, programadoAt, intentos } });
  }
}

export const sgcOutboxRepo = new SgcOutboxPrismaRepository();
