import { prisma } from "@/lib/server/db";
import type { IGessRepository, GessPaginationParams, GessPaginatedResult, DatosReservaStand } from "@/domain/ports/gess-repository";
import type { GessStandEntity } from "@/domain/models/entities";
import { ESTADOS_STAND } from "@/lib/shared/constants";

export class GessPrismaRepository implements IGessRepository {
  async findAllPaginated(eventoId: string, params: GessPaginationParams): Promise<GessPaginatedResult> {
    const where: Record<string, unknown> = { eventoId };
    if (params.estado) where.estado = params.estado;
    if (params.tipo) where.tipoStand = params.tipo;
    if (params.sinPabellon) where.bloqueId = null;
    else if (params.bloqueIds && params.bloqueIds.length > 0) where.bloqueId = { in: params.bloqueIds };
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
      data,
      total,
      page: params.page,
      perPage: params.perPage,
      totalPages: Math.ceil(total / params.perPage),
    };
  }

  async tiposDistintos(eventoId: string): Promise<string[]> {
    const rows = await prisma.gessStand.findMany({
      where: { eventoId, tipoStand: { not: null } },
      distinct: ["tipoStand"],
      select: { tipoStand: true },
      orderBy: { tipoStand: "asc" },
    });
    return rows.map((row) => row.tipoStand).filter((tipo): tipo is string => Boolean(tipo));
  }

  async findByBloque(bloqueId: string) {
    const row = await prisma.gessStand.findFirst({ where: { bloqueId }, orderBy: { updatedAt: "desc" } });
    return row;
  }

  async findByStandApiId(eventoId: string, standApiId: string) {
    const row = await prisma.gessStand.findUnique({ where: { eventoId_standApiId: { eventoId, standApiId } } });
    return row;
  }

  async findById(id: string) {
    const row = await prisma.gessStand.findUnique({ where: { id } });
    return row;
  }

  async findByEvento(eventoId: string) {
    const rows = await prisma.gessStand.findMany({ where: { eventoId }, orderBy: { standCode: "asc" } });
    return rows;
  }

  /**
   * Datos de la empresa que reservo cada stand (RF-09): solicitudes vigentes ligadas al
   * stand (simple o multiple) → cuenta (`user_role`) → empresa del Portal del Cliente.
   * El logo preferido es el del usuario; si no tiene, el de la empresa.
   */
  async datosEmpresaPorStands(standIds: string[]): Promise<Map<string, DatosReservaStand>> {
    const resultado = new Map<string, DatosReservaStand>();
    const ids = [...new Set(standIds.filter(Boolean))];
    if (ids.length === 0) return resultado;

    const solicitudes = await prisma.solicitud.findMany({
      where: {
        flgActivo: true,
        OR: [
          { gessStandId: { in: ids } },
          { stands: { some: { gessStandId: { in: ids } } } },
        ],
      },
      select: {
        gessStandId: true,
        userId: true,
        email: true,
        stands: { select: { gessStandId: true } },
      },
    });
    if (solicitudes.length === 0) return resultado;

    const userIds = [...new Set(solicitudes.map((s) => s.userId).filter((v): v is string => Boolean(v)))];
    const emails = [...new Set(solicitudes.map((s) => s.email?.toLowerCase()).filter((v): v is string => Boolean(v)))];
    const cuentas = await prisma.userRole.findMany({
      where: {
        OR: [
          ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
          ...(emails.length > 0 ? [{ email: { in: emails, mode: "insensitive" as const } }] : []),
        ],
      },
      select: {
        userId: true,
        email: true,
        nombreEmpresa: true,
        logoUrl: true,
        empresa: { select: { razonSocial: true, logoUrl: true } },
      },
    });

    const porUsuario = new Map<string, DatosReservaStand>();
    const porEmail = new Map<string, DatosReservaStand>();
    for (const c of cuentas) {
      const razonSocial = c.empresa?.razonSocial ?? c.nombreEmpresa ?? null;
      if (!razonSocial) continue;
      const datos: DatosReservaStand = { razonSocial, logoUrl: c.logoUrl ?? c.empresa?.logoUrl ?? null };
      porUsuario.set(c.userId, datos);
      porEmail.set(c.email.toLowerCase(), datos);
    }

    for (const s of solicitudes) {
      const datos = (s.userId ? porUsuario.get(s.userId) : null)
        ?? (s.email ? porEmail.get(s.email.toLowerCase()) : null);
      if (!datos) continue;
      for (const id of [s.gessStandId, ...s.stands.map((x) => x.gessStandId)]) {
        if (id && ids.includes(id)) resultado.set(id, datos);
      }
    }
    return resultado;
  }

  async create(data: Partial<GessStandEntity>) {
    const row = await prisma.gessStand.create({ data: data as never });
    return row;
  }

  async update(id: string, data: Partial<GessStandEntity>) {
    const row = await prisma.gessStand.update({ where: { id }, data: data as never });
    return row;
  }

  async crearHold(data: { standIds: string[]; eventoId: string; holdId: string; userId: string; expiresAt: Date; preReservadosPropios?: string[] }): Promise<{ ok: boolean; conflictos: string[] }> {
    const ids = [...new Set(data.standIds.filter(Boolean))];
    if (ids.length === 0) return { ok: false, conflictos: ["Sin stands"] };
    const propios = new Set(data.preReservadosPropios ?? []);
    const ahora = new Date();
    try {
      return await prisma.$transaction(async (tx) => {
        const filas = await tx.gessStand.findMany({
          where: { id: { in: ids }, eventoId: data.eventoId },
          select: { id: true, standCode: true, estado: true, holdExpiresAt: true, holdUserId: true },
        });
        const porId = new Map(filas.map((f) => [f.id, f]));
        const conflictos = ids.flatMap((id) => {
          const fila = porId.get(id);
          if (!fila) return [id];
          const estadoValido = fila.estado === ESTADOS_STAND.DISPONIBLE
            || (fila.estado === ESTADOS_STAND.PRE_RESERVADO && propios.has(id));
          if (!estadoValido) return [fila.standCode];
          if (fila.holdExpiresAt && fila.holdExpiresAt > ahora && fila.holdUserId !== data.userId) return [fila.standCode];
          return [];
        });
        if (conflictos.length > 0) return { ok: false, conflictos };

        const actualizados = await tx.gessStand.updateMany({
          where: {
            id: { in: ids },
            eventoId: data.eventoId,
            AND: [
              {
                OR: [
                  { estado: ESTADOS_STAND.DISPONIBLE },
                  { estado: ESTADOS_STAND.PRE_RESERVADO, id: { in: [...propios] } },
                ],
              },
              { OR: [{ holdExpiresAt: null }, { holdExpiresAt: { lt: ahora } }, { holdUserId: data.userId }] },
            ],
          },
          data: {
            holdId: data.holdId,
            holdUserId: data.userId,
            holdExpiresAt: data.expiresAt,
          },
        });
        if (actualizados.count !== ids.length) throw new Error("HOLD_RACE");
        return { ok: true, conflictos: [] };
      });
    } catch (error) {
      if (error instanceof Error && error.message === "HOLD_RACE") {
        return { ok: false, conflictos: ids };
      }
      throw error;
    }
  }

  async liberarHold(holdId: string, userId: string): Promise<Array<{ id: string; standCode: string; eventoId: string }>> {
    const filas = await prisma.gessStand.findMany({
      where: { holdId, holdUserId: userId },
      select: { id: true, standCode: true, eventoId: true },
    });
    if (filas.length === 0) return [];
    await prisma.gessStand.updateMany({
      where: { holdId, holdUserId: userId },
      data: { holdId: null, holdUserId: null, holdExpiresAt: null },
    });
    return filas;
  }

  async validarHold(standIds: string[], holdId: string, userId: string): Promise<boolean> {
    const ids = [...new Set(standIds.filter(Boolean))];
    if (ids.length === 0) return false;
    const total = await prisma.gessStand.count({
      where: {
        id: { in: ids },
        holdId,
        holdUserId: userId,
        holdExpiresAt: { gt: new Date() },
      },
    });
    return total === ids.length;
  }

  async countByEvento(eventoId: string) {
    return prisma.gessStand.count({ where: { eventoId } });
  }
}
