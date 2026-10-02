import 'server-only';

import { prisma } from "@/lib/server/db";
import type { ITipoStandImagenRepository } from "@/domain/ports/tipo-stand-imagen-repository";
import type { TipoStandImagenEntity } from "@/domain/models/tipo-stand-imagen";

export class TipoStandImagenPrismaRepository implements ITipoStandImagenRepository {
  async listar(): Promise<TipoStandImagenEntity[]> {
    return prisma.tipoStandImagen.findMany({ orderBy: { tipo: "asc" } });
  }

  async upsert(tipo: string, imagenUrl: string): Promise<TipoStandImagenEntity> {
    return prisma.tipoStandImagen.upsert({
      where: { tipo },
      create: { tipo, imagenUrl },
      update: { imagenUrl },
    });
  }

  async eliminar(tipo: string): Promise<void> {
    await prisma.tipoStandImagen.deleteMany({ where: { tipo } });
  }
}

export const tipoStandImagenRepo = new TipoStandImagenPrismaRepository();
