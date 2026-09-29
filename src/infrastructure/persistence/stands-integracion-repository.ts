import 'server-only';

import { prisma } from "@/lib/server/db";
import type { IStandsIntegracionRepository } from "@/domain/ports/stands-integracion-repository";
import type { StandExhibidoraDTO, ContratoStandDTO } from "@/types/dto/stands/stands-integracion.dto";
import { mapearEstadoContrato } from "@/lib/shared/utils/estado-contrato";
import { estadoComercialStand } from "@/lib/shared/utils/estado-stand";
import { ESTADOS_SOLICITUD } from "@/lib/shared/constants";

/** Prioridad entre estados de solicitud para elegir el mas avanzado por stand. */
const PRIORIDAD_ESTADO: Record<string, number> = {
  [ESTADOS_SOLICITUD.RECHAZADO]: 0,
  [ESTADOS_SOLICITUD.PENDIENTE]: 1,
  [ESTADOS_SOLICITUD.EN_PROCESO]: 2,
  [ESTADOS_SOLICITUD.APROBADO]: 3,
  [ESTADOS_SOLICITUD.PENDIENTE_PAGO]: 4,
  [ESTADOS_SOLICITUD.PAGADO]: 5,
};

/** Parsea "x,y" del campo pabellon (coordenadas del API externa). */
function parsearCoordenadas(pabellon: string | null): { x: number | null; y: number | null } {
  if (!pabellon) return { x: null, y: null };
  const partes = pabellon.split(",");
  const x = Number(partes[0]);
  const y = Number(partes[1]);
  return { x: Number.isFinite(x) ? x : null, y: Number.isFinite(y) ? y : null };
}

export class StandsIntegracionPrismaRepository implements IStandsIntegracionRepository {
  private async resolverEventoId(tipoEvento?: number, codigoEvento?: number): Promise<string | undefined> {
    if (tipoEvento === undefined && codigoEvento === undefined) return undefined;
    const evento = await prisma.evento.findFirst({
      where: {
        ...(tipoEvento !== undefined ? { tipoEvento } : {}),
        ...(codigoEvento !== undefined ? { codigoEvento } : {}),
      },
      select: { id: true },
    });
    return evento?.id;
  }

  // En un evento macro los bloques viven en los planos hijos (pabellones), no en el macro
  private async resolverEventosPorId(eventoIds: string[]): Promise<Map<string, { tipoEvento: number; codigoEvento: number }>> {
    const mapa = new Map<string, { tipoEvento: number; codigoEvento: number }>();
    if (eventoIds.length === 0) return mapa;
    const eventos = await prisma.evento.findMany({ where: { id: { in: eventoIds } }, select: { id: true, tipoEvento: true, codigoEvento: true } });
    for (const e of eventos) mapa.set(e.id, { tipoEvento: e.tipoEvento, codigoEvento: e.codigoEvento });
    return mapa;
  }

  /** bloqueId -> { id, codigo } del plano al que pertenece. */
  async resolverPlanoPorBloque(): Promise<Map<string, { id: string; codigo: string }>> {
    const mapa = new Map<string, { id: string; codigo: string }>();
    const bloques = await prisma.planoBloque.findMany({
      where: { flgActivo: true },
      select: { bloqueId: true, plano: { select: { id: true, codigo: true } } },
    });
    for (const b of bloques) mapa.set(b.bloqueId, { id: b.plano.id, codigo: b.plano.codigo });
    return mapa;
  }

  /** plano hijo -> nombre del pabellon (seccion del macro que lo enlaza). */
  async resolverPabellonPorPlano(): Promise<Map<string, string>> {
    const mapa = new Map<string, string>();
    const secciones = await prisma.planoSeccion.findMany({
      where: { planoHijoId: { not: null } },
      select: { planoHijoId: true, nombre: true },
    });
    for (const s of secciones) {
      if (s.planoHijoId && !mapa.has(s.planoHijoId)) mapa.set(s.planoHijoId, s.nombre);
    }
    return mapa;
  }

  async listarStandsExhibidora(empresaId: string, tipoEvento?: number, codigoEvento?: number): Promise<StandExhibidoraDTO[]> {
    const eventoId = await this.resolverEventoId(tipoEvento, codigoEvento);
    const planoPorBloque = await this.resolverPlanoPorBloque();
    const pabellonPorPlano = await this.resolverPabellonPorPlano();

    const gessStands = await prisma.gessStand.findMany({
      where: eventoId ? { eventoId } : undefined,
      select: { id: true, standApiId: true, standCode: true, tipoStand: true, estado: true, pabellon: true, empresa: true, bloqueId: true, eventoId: true, rawData: true },
    });

    const eventoIds = [...new Set(gessStands.map((g) => g.eventoId).filter(Boolean) as string[])];
    const eventosMap = await this.resolverEventosPorId(eventoIds);

    const solicitudes = await prisma.solicitud.findMany({
      where: { flgActivo: true },
      select: { id: true, userId: true, estado: true, gessStandId: true, stands: { select: { gessStandId: true } } },
    });
    const userIds = [...new Set(solicitudes.map((s) => s.userId).filter(Boolean) as string[])];
    const usuarios = userIds.length > 0
      ? await prisma.userRole.findMany({ where: { userId: { in: userIds } }, select: { userId: true, idEmpresa: true } })
      : [];
    const userIdsDeExhibidora = new Set(usuarios.filter((u) => u.idEmpresa?.trim() === empresaId).map((u) => u.userId));

    const gessIdsDeSolicitudes = new Set<string>();
    // Estado comercial por stand: el mas avanzado entre sus solicitudes activas.
    const estadoPorGess = new Map<string, string>();
    for (const s of solicitudes) {
      const ids = [s.gessStandId, ...s.stands.map((x) => x.gessStandId)].filter(Boolean) as string[];
      if (s.userId && userIdsDeExhibidora.has(s.userId)) {
        for (const id of ids) gessIdsDeSolicitudes.add(id);
      }
      if (!s.estado) continue;
      for (const id of ids) {
        const prev = estadoPorGess.get(id);
        if (!prev || (PRIORIDAD_ESTADO[s.estado] ?? -1) > (PRIORIDAD_ESTADO[prev] ?? -1)) {
          estadoPorGess.set(id, s.estado);
        }
      }
    }

    return gessStands
      .filter((g) => {
        const raw = g.rawData as { id_empresa?: string; idEmpresa?: string } | null;
        const id = (raw?.id_empresa ?? raw?.idEmpresa ?? "").trim();
        return id === empresaId || gessIdsDeSolicitudes.has(g.id);
      })
      .map((g) => {
        const ev = g.eventoId ? (eventosMap.get(g.eventoId) ?? null) : null;
        const plano = g.bloqueId ? planoPorBloque.get(g.bloqueId) : undefined;
        return {
          stand_api_id: g.standApiId || g.id,
          stand_numero: g.standCode,
          tipo_stand: g.tipoStand ?? null,
          // Estado comercial real (reserva/solicitud), no el tecnico del plano.
          estado: estadoComercialStand(estadoPorGess.get(g.id) ?? null, g.estado),
          estado_solicitud: estadoPorGess.get(g.id) ?? null,
          // Pabellon = nombre de la seccion del macro que enlaza al plano del stand.
          // Si el plano no cuelga de un macro, no es pabellon (null). Coordenadas en x/y.
          pabellon: plano ? (pabellonPorPlano.get(plano.id) ?? null) : null,
          zona: null,
          ...parsearCoordenadas(g.pabellon),
          empresa: g.empresa ?? null,
          evento_id: g.eventoId,
          tipo_evento: ev?.tipoEvento ?? 0,
          codigo_evento: ev?.codigoEvento ?? 0,
          mapa: plano?.codigo ?? null,
        };
      });
  }

  async listarContratos(tipoEvento?: number, codigoEvento?: number): Promise<ContratoStandDTO[]> {
    const eventoId = await this.resolverEventoId(tipoEvento, codigoEvento);

    const gessStands = await prisma.gessStand.findMany({
      where: eventoId ? { eventoId } : undefined,
      select: { id: true, standApiId: true, standCode: true, solicitudes: { select: { id: true, estado: true, updatedAt: true } } },
    });

    return gessStands.map((g) => {
      const solicitudActiva = g.solicitudes.find((s) => s.estado !== null) ?? null;
      const estadoSolicitud = solicitudActiva?.estado ?? ESTADOS_SOLICITUD.PENDIENTE;
      return {
        stand_api_id: g.standApiId || g.id,
        estado_solicitud: estadoSolicitud,
        estado_contrato: mapearEstadoContrato(estadoSolicitud),
        fecha_aprobacion: solicitudActiva?.updatedAt.toISOString() ?? null,
        id_contrato: solicitudActiva?.id ?? null,
      };
    });
  }
}

export const standsIntegracionRepo = new StandsIntegracionPrismaRepository();
