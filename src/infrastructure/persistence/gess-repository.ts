import { prisma } from "@/lib/server/db";
import type { IGessRepository, GessPaginationParams, GessPaginatedResult } from "@/domain/ports/gess-repository";
import type { GessStandEntity } from "@/domain/models/entities";

export class GessPrismaRepository implements IGessRepository {
  async findAllPaginated(eventoId: string, params: GessPaginationParams): Promise<GessPaginatedResult> {
    const where: Record<string, unknown> = { eventoId };
    if (params.estado) where.estado = params.estado;
    if (params.search) {
      const q = params.search.trim();
      where.OR = ["standCode", "tipoStand", "estado", "empresa", "bloqueId"].map((f) => ({ [f]: { contains: q, mode: "insensitive" } }));
    }
    const [data, total] = await Promise.all([
      prisma.gessStand.findMany({
        where: where as never,
        orderBy: { standCode: "asc" },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
      }),
      prisma.gessStand.count({ where: where as never }),
    ]);
    return {
      data: data as unknown as GessStandEntity[],
      total,
      page: params.page,
      perPage: params.perPage,
      totalPages: Math.ceil(total / params.perPage),
    };
  }

  async findByBloque(bloqueId: string) {
    const row = await prisma.gessStand.findFirst({ where: { bloqueId }, orderBy: { updatedAt: "desc" } });
    return (row as unknown as GessStandEntity) ?? null;
  }

  async findByStandApiId(eventoId: string, standApiId: string) {
    const row = await prisma.gessStand.findUnique({ where: { eventoId_standApiId: { eventoId, standApiId } } });
    return (row as unknown as GessStandEntity) ?? null;
  }

  async findById(id: string) {
    const row = await prisma.gessStand.findUnique({ where: { id } });
    return (row as unknown as GessStandEntity) ?? null;
  }

  async findByEvento(eventoId: string) {
    const rows = await prisma.gessStand.findMany({ where: { eventoId }, orderBy: { standCode: "asc" } });
    return rows as unknown as GessStandEntity[];
  }

  async create(data: Partial<GessStandEntity>) {
    const row = await prisma.gessStand.create({ data: data as never });
    return row as unknown as GessStandEntity;
  }

  async update(id: string, data: Partial<GessStandEntity>) {
    const row = await prisma.gessStand.update({ where: { id }, data: data as never });
    return row as unknown as GessStandEntity;
  }

  async countByEvento(eventoId: string) {
    return prisma.gessStand.count({ where: { eventoId } });
  }
}
