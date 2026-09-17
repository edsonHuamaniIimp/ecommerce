import 'server-only';

import { prisma } from "@/lib/server/db";
import type { IStandsIntegracionRepository } from "@/domain/ports/stands-integracion-repository";
import type { StandExhibidoraDTO, ContratoStandDTO } from "@/types/dto/stands/stands-integracion.dto";
import { mapearEstadoContrato } from "@/lib/shared/utils/estado-contrato";
import { ESTADOS_SOLICITUD } from "@/lib/shared/constants";

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

  async resolverMapaPorBloque(): Promise<Map<string, string>> {
    const mapa = new Map<string, string>();
    const bloques = await prisma.planoBloque.findMany({
      where: { flgActivo: true },
      select: { bloqueId: true, plano: { select: { codigo: true } } },
    });
    for (const b of bloques) mapa.set(b.bloqueId, b.plano.codigo);
    return mapa;
  }

  async listarStandsExhibidora(empresaId: string, tipoEvento?: number, codigoEvento?: number): Promise<StandExhibidoraDTO[]> {
    const eventoId = await this.resolverEventoId(tipoEvento, codigoEvento);
    const mapaPorBloque = await this.resolverMapaPorBloque();

    const gessStands = await prisma.gessStand.findMany({
      where: eventoId ? { eventoId } : undefined,
      select: { id: true, standApiId: true, standCode: true, tipoStand: true, estado: true, pabellon: true, empresa: true, bloqueId: true, eventoId: true, rawData: true },
    });

    const eventoIds = [...new Set(gessStands.map((g) => g.eventoId).filter(Boolean) as string[])];
    const eventosMap = await this.resolverEventosPorId(eventoIds);

    const solicitudes = await prisma.solicitud.findMany({
      where: { flgActivo: true },
      select: { id: true, userId: true, gessStandId: true, stands: { select: { gessStandId: true } } },
    });
    const userIds = [...new Set(solicitudes.map((s) => s.userId).filter(Boolean) as string[])];
    const usuarios = userIds.length > 0
      ? await prisma.userRole.findMany({ where: { userId: { in: userIds } }, select: { userId: true, idEmpresa: true } })
      : [];
    const userIdsDeExhibidora = new Set(usuarios.filter((u) => u.idEmpresa?.trim() === empresaId).map((u) => u.userId));

    const gessIdsDeSolicitudes = new Set<string>();
    for (const s of solicitudes) {
      if (s.userId && userIdsDeExhibidora.has(s.userId)) {
        if (s.gessStandId) gessIdsDeSolicitudes.add(s.gessStandId);
        for (const st of s.stands) gessIdsDeSolicitudes.add(st.gessStandId);
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
        return {
          stand_api_id: g.standApiId || g.id,
          stand_numero: g.standCode,
          tipo_stand: g.tipoStand ?? null,
          estado: g.estado ?? null,
          pabellon: g.pabellon ?? null,
          empresa: g.empresa ?? null,
          evento_id: g.eventoId,
          tipo_evento: ev?.tipoEvento ?? 0,
          codigo_evento: ev?.codigoEvento ?? 0,
          mapa: g.bloqueId ? (mapaPorBloque.get(g.bloqueId) ?? null) : null,
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
