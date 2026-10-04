import 'server-only';

import { prisma } from "@/lib/server/db";
import type { ITipoStandImagenRepository } from "@/domain/ports/tipo-stand-imagen-repository";
import type { TipoStandImagenEntity } from "@/domain/models/tipo-stand-imagen";

export class TipoStandImagenPrismaRepository implements ITipoStandImagenRepository {
  async listar(): Promise<TipoStandImagenEntity[]> {
    return prisma.tipoStandImagen.findMany({ orderBy: { tipo: "asc" } });
  }

  async upsert(tipo: string, imagenUrl: string, eventoId: string | null): Promise<TipoStandImagenEntity> {
    const existente = await prisma.tipoStandImagen.findFirst({ where: { tipo, eventoId } });
    if (existente) {
      return prisma.tipoStandImagen.update({ where: { id: existente.id }, data: { imagenUrl } });
    }
    return prisma.tipoStandImagen.create({ data: { tipo, imagenUrl, eventoId } });
  }

  async eliminar(tipo: string, eventoId: string | null): Promise<void> {
    await prisma.tipoStandImagen.deleteMany({ where: { tipo, eventoId } });
  }
}

export const tipoStandImagenRepo = new TipoStandImagenPrismaRepository();
