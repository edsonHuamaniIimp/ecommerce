import { prisma } from "@/lib/server/db";
import type { IEventoRepository, EventoCriteria, EventoMetadata } from "@/domain/ports/evento-repository";
import type { EventoEntity } from "@/domain/models/entities";

export class EventoPrismaRepository implements IEventoRepository {
  async findAllMetadata(): Promise<EventoMetadata[]> {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT tipo_evento, codigo_evento, imagen, plano, flg_visible FROM evento_metadata`
    );
    return rows.map((r) => ({
      tipoEvento: r.tipo_evento as number,
      codigoEvento: r.codigo_evento as number,
      imagen: r.imagen as string | null,
      plano: r.plano as string | null,
      flgVisible: (r.flg_visible as boolean) ?? false,
      anio: "",
      estado: "active",
    }));
  }

  async findPadresConVersiones(criteria?: EventoCriteria) {
    const whereEvento: Record<string, unknown> = {};
    if (criteria?.estado) whereEvento.estado = criteria.estado;
    if (criteria?.flgActivo !== undefined) whereEvento.flgActivo = criteria.flgActivo;
    if (criteria?.flgVisible !== undefined) whereEvento.flgVisible = criteria.flgVisible;
    if (criteria?.fechaVigente) {
      whereEvento.OR = [
        { fechaInicio: null },
        { fechaFin: null },
        { fechaInicio: { lte: criteria.fechaVigente }, fechaFin: { gte: criteria.fechaVigente } },
      ];
    }
    const rows = await prisma.eventoPadre.findMany({
      include: { eventos: { orderBy: { anio: "asc" }, where: whereEvento as never } },
      orderBy: { nombre: "asc" },
    });
    return rows.map((r) => ({ ...r, versiones: r.eventos }));
  }

  async findAll(activos?: boolean) {
    const where: Record<string, unknown> = {};
    if (activos) where.flgActivo = true;
    const rows = await prisma.evento.findMany({
      where, include: { eventoPadre: { select: { id: true, nombre: true, codigo: true, vertical: true } }, _count: { select: { stands: true, gessStands: true, reservas: true } } },
      orderBy: [{ eventoPadre: { nombre: "asc" } }, { anio: "desc" }],
    });
    return rows;
  }

  async findById(id: string) {
    const row = await prisma.evento.findUnique({ where: { id }, include: { eventoPadre: { select: { id: true, nombre: true, vertical: true, codigo: true } } } });
    return row ?? null;
  }

  async create(data: { eventoPadreId: string; anio: string; tipoEvento?: number; codigoEvento?: number; fechaInicio?: Date; fechaFin?: Date }) {
    const maxCodigo = await prisma.evento.findFirst({ where: { eventoPadreId: data.eventoPadreId }, orderBy: { codigoEvento: "desc" }, select: { codigoEvento: true } });
    const row = await prisma.evento.create({ data: { ...data, tipoEvento: data.tipoEvento ?? 0, codigoEvento: (maxCodigo?.codigoEvento ?? 0) + 1, estado: "draft" }, include: { eventoPadre: { select: { id: true, nombre: true, vertical: true, codigo: true } } } });
    return row;
  }

  async update(id: string, data: Partial<Pick<EventoEntity, "estado" | "anio" | "fechaInicio" | "fechaFin" | "imagen" | "flgActivo" | "flgVisible" | "plano">>) {
    const updateData: Record<string, unknown> = {};
    if (data.estado !== undefined) updateData.estado = data.estado;
    if (data.anio !== undefined) updateData.anio = data.anio;
    if (data.fechaInicio !== undefined) updateData.fechaInicio = data.fechaInicio;
    if (data.fechaFin !== undefined) updateData.fechaFin = data.fechaFin;
    if (data.imagen !== undefined) updateData.imagen = data.imagen;
    if (data.flgActivo !== undefined) updateData.flgActivo = data.flgActivo;
    if (data.flgVisible !== undefined) updateData.flgVisible = data.flgVisible;
    if (data.plano !== undefined) updateData.plano = data.plano === "" ? null : data.plano;
    const row = await prisma.evento.update({ where: { id }, data: updateData });
    return row;
  }

  async upsertByTipoCodigo(tipoEvento: number, codigoEvento: number, data: Partial<Pick<EventoEntity, "estado" | "anio" | "fechaInicio" | "fechaFin" | "imagen" | "flgActivo" | "flgVisible" | "plano">>) {
    const upsertData: Record<string, unknown> = {};
    if (data.imagen !== undefined) upsertData.imagen = data.imagen;
    if (data.flgActivo !== undefined) upsertData.flgActivo = data.flgActivo;
    if (data.flgVisible !== undefined) upsertData.flgVisible = data.flgVisible;
    if (data.plano !== undefined) upsertData.plano = data.plano;

    try {
      await prisma.$queryRawUnsafe(
        `INSERT INTO evento_metadata (tipo_evento, codigo_evento, plano, flg_visible, imagen, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (tipo_evento, codigo_evento)
         DO UPDATE SET
           plano = CASE WHEN EXCLUDED.plano = '' THEN NULL ELSE COALESCE(EXCLUDED.plano, evento_metadata.plano) END,
           flg_visible = EXCLUDED.flg_visible,
           imagen = COALESCE(EXCLUDED.imagen, evento_metadata.imagen),
           updated_at = NOW()`,
        tipoEvento,
        codigoEvento,
        upsertData.plano ?? null,
        upsertData.flgVisible ?? false,
        upsertData.imagen ?? null,
      );
    } catch (err) {
      console.error("[upsertByTipoCodigo] Error:", err);
      throw err;
    }

    return { id: `${tipoEvento}-${codigoEvento}` } as EventoEntity;
  }

  async findEventoPorPlano(planoCodigo: string, exceptTipoEvento?: number, exceptCodigoEvento?: number): Promise<{ tipoEvento: number; codigoEvento: number } | null> {
    const meta = await prisma.eventoMetadata.findFirst({
      where: {
        plano: planoCodigo,
        ...(exceptTipoEvento !== undefined && exceptCodigoEvento !== undefined
          ? { NOT: { tipoEvento: exceptTipoEvento, codigoEvento: exceptCodigoEvento } }
          : {}),
      },
      select: { tipoEvento: true, codigoEvento: true },
    });
    return meta ? { tipoEvento: meta.tipoEvento, codigoEvento: meta.codigoEvento } : null;
  }
}
