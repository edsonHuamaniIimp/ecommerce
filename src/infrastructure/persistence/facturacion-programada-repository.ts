import 'server-only';

import { prisma } from "@/lib/server/db";
import { ESTADOS_FACTURACION_PROGRAMADA, type EstadoFacturacionProgramada } from "@/lib/shared/constants";
import type {
  FacturacionProgramadaEntity,
  IFacturacionProgramadaRepository,
  ProgramarFacturaData,
} from "@/domain/ports/facturacion-programada-repository";

const E = ESTADOS_FACTURACION_PROGRAMADA;
const VIGENTES = [E.PENDIENTE, E.PROCESANDO, E.ERROR];

interface Fila {
  id: string;
  solicitudId: string;
  cuotaId: string;
  fechaProgramada: Date;
  requisitos: unknown;
  archivos: unknown;
  estado: string;
  ultimoError: string | null;
  createdBy: string | null;
}

function mapear(row: Fila): FacturacionProgramadaEntity {
  return {
    id: row.id,
    solicitudId: row.solicitudId,
    cuotaId: row.cuotaId,
    fechaProgramada: row.fechaProgramada.toISOString(),
    requisitos: row.requisitos,
    archivos: row.archivos,
    estado: row.estado as EstadoFacturacionProgramada,
    ultimoError: row.ultimoError,
    createdBy: row.createdBy,
  };
}

function recortar(mensaje: string): string {
  return mensaje.length > 500 ? `${mensaje.slice(0, 497)}...` : mensaje;
}

export class FacturacionProgramadaPrismaRepository implements IFacturacionProgramadaRepository {
  async programar(data: ProgramarFacturaData): Promise<FacturacionProgramadaEntity> {
    const row = await prisma.$transaction(async (tx) => {
      await tx.facturacionProgramada.updateMany({
        where: { solicitudId: data.solicitudId, estado: { in: [E.PENDIENTE, E.ERROR] } },
        data: { estado: E.CANCELADA },
      });
      return tx.facturacionProgramada.create({
        data: {
          solicitudId: data.solicitudId,
          cuotaId: data.cuotaId,
          fechaProgramada: data.fechaProgramada,
          requisitos: data.requisitos as object,
          archivos: (data.archivos ?? []) as object,
          createdBy: data.createdBy,
        },
      });
    });
    return mapear(row);
  }

  async vigentesPorSolicitudes(solicitudIds: string[]): Promise<FacturacionProgramadaEntity[]> {
    if (solicitudIds.length === 0) return [];
    const rows = await prisma.facturacionProgramada.findMany({
      where: { solicitudId: { in: solicitudIds }, estado: { in: VIGENTES } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapear);
  }

  async cancelar(solicitudId: string): Promise<number> {
    const r = await prisma.facturacionProgramada.updateMany({
      where: { solicitudId, estado: { in: [E.PENDIENTE, E.ERROR] } },
      data: { estado: E.CANCELADA },
    });
    return r.count;
  }

  async listarVencidas(ahora: Date, limite: number): Promise<FacturacionProgramadaEntity[]> {
    const rows = await prisma.facturacionProgramada.findMany({
      where: { estado: E.PENDIENTE, fechaProgramada: { lte: ahora } },
      orderBy: { fechaProgramada: "asc" },
      take: limite,
    });
    return rows.map(mapear);
  }

  async tomar(id: string): Promise<boolean> {
    const r = await prisma.facturacionProgramada.updateMany({
      where: { id, estado: E.PENDIENTE },
      data: { estado: E.PROCESANDO },
    });
    return r.count === 1;
  }

  async marcarEjecutada(id: string): Promise<void> {
    await prisma.facturacionProgramada.update({
      where: { id },
      data: { estado: E.EJECUTADA, ejecutadaAt: new Date(), ultimoError: null },
    });
  }

  async marcarError(id: string, mensaje: string): Promise<void> {
    await prisma.facturacionProgramada.update({
      where: { id },
      data: { estado: E.ERROR, ultimoError: recortar(mensaje) },
    });
  }
}
