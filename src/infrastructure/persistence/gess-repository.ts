import { prisma } from "@/lib/db";
import type { IGessRepository } from "@/domain/ports/gess-repository";
import type { GessStandEntity } from "@/domain/models/entities";

export class GessPrismaRepository implements IGessRepository {
  async findByEvento(eventoId: string) {
    const rows = await prisma.gessStand.findMany({ where: { eventoId }, orderBy: { standCode: "asc" } });
    return rows as unknown as GessStandEntity[];
  }

  async findByBloque(bloqueId: string) {
    const row = await prisma.gessStand.findFirst({ where: { bloqueId }, orderBy: { updatedAt: "desc" } });
    return (row as unknown as GessStandEntity) ?? null;
  }

  async upsert(eventoId: string, standApiId: string, data: Partial<GessStandEntity>) {
    const existing = await prisma.gessStand.findUnique({ where: { eventoId_standApiId: { eventoId, standApiId } } });
    const gessData = { eventoId, standApiId, ...data } as Record<string, unknown>;
    if (existing) {
      const row = await prisma.gessStand.update({ where: { id: existing.id }, data: gessData as never });
      return row as unknown as GessStandEntity;
    }
    const row = await prisma.gessStand.create({ data: gessData as never });
    return row as unknown as GessStandEntity;
  }

  async vincular(id: string, bloqueId: string | null) {
    const row = await prisma.gessStand.update({ where: { id }, data: { bloqueId } });
    return row as unknown as GessStandEntity;
  }
}
