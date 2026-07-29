import { prisma } from "@/lib/db";
import type { IEventoRepository, EventoCriteria } from "@/domain/ports/evento-repository";
import type { EventoEntity, EventoPadreEntity } from "@/domain/models/entities";

export class EventoPrismaRepository implements IEventoRepository {
  async findPadresConVersiones(criteria?: EventoCriteria) {
    const whereEvento: Record<string, unknown> = {};
    if (criteria?.estado) whereEvento.estado = criteria.estado;
    if (criteria?.flgActivo !== undefined) whereEvento.flgActivo = criteria.flgActivo;
    if (criteria?.fechaVigente) {
      whereEvento.OR = [
        { fechaInicio: null },
        { fechaFin: null },
        { fechaInicio: { lte: criteria.fechaVigente }, fechaFin: { gte: criteria.fechaVigente } },
      ];
    }

    const rows = await prisma.eventoPadre.findMany({
      include: {
        eventos: { where: whereEvento, orderBy: { anio: "asc" } },
      },
      orderBy: { nombre: "asc" },
    });

    return rows as unknown as (EventoPadreEntity & { versiones: EventoEntity[] })[];
  }

  async findAll() {
    const rows = await prisma.evento.findMany({
      include: { eventoPadre: { select: { id: true, nombre: true, codigo: true } }, _count: { select: { stands: true, gessStands: true, reservas: true } } },
      orderBy: [{ eventoPadre: { nombre: "asc" } }, { anio: "desc" }],
    });
    return rows as unknown as EventoEntity[];
  }

  async findById(id: string) {
    const row = await prisma.evento.findUnique({
      where: { id },
      include: { eventoPadre: { select: { id: true, nombre: true, vertical: true } } },
    });
    return (row as unknown as EventoEntity) ?? null;
  }

  async create(data: { eventoPadreId: string; anio: string; tipoEvento?: number; codigoEvento?: number; fechaInicio?: Date; fechaFin?: Date }) {
    const maxCodigo = await prisma.evento.findFirst({ where: { eventoPadreId: data.eventoPadreId }, orderBy: { codigoEvento: "desc" }, select: { codigoEvento: true } });
    const row = await prisma.evento.create({
      data: { ...data, tipoEvento: data.tipoEvento ?? 0, codigoEvento: (maxCodigo?.codigoEvento ?? 0) + 1, estado: "draft" },
      include: { eventoPadre: { select: { nombre: true } } },
    });
    return row as unknown as EventoEntity;
  }

  async update(id: string, data: Partial<Pick<EventoEntity, "estado" | "anio" | "fechaInicio" | "fechaFin" | "imagen" | "flgActivo">>) {
    const row = await prisma.evento.update({ where: { id }, data: data as Record<string, unknown> as never });
    return row as unknown as EventoEntity;
  }
}
