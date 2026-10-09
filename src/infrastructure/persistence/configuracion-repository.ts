import { prisma } from "@/lib/server/db";
import type { ActualizarPortalConfigData, PortalConfigEntity } from "@/domain/models/configuracion";
import type { IConfiguracionRepository } from "@/domain/ports/configuracion-repository";

/** Registro unico: la configuracion del portal vive en la fila `id = "default"`. */
const ID_PORTAL = "default";

type FilaPortalConfig = {
  mesaAyudaEmail: string | null;
  contactoEmail: string | null;
  manualUrl: string | null;
  reglamentoUrl: string | null;
  updatedBy: string | null;
  updatedAt: Date;
};

function aEntidad(row: FilaPortalConfig): PortalConfigEntity {
  return {
    mesaAyudaEmail: row.mesaAyudaEmail,
    contactoEmail: row.contactoEmail,
    manualUrl: row.manualUrl,
    reglamentoUrl: row.reglamentoUrl,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  };
}

export class ConfiguracionPrismaRepository implements IConfiguracionRepository {
  async obtenerPortal(): Promise<PortalConfigEntity | null> {
    const row = await prisma.portalConfig.findUnique({ where: { id: ID_PORTAL } });
    return row ? aEntidad(row) : null;
  }

  async guardarPortal(data: ActualizarPortalConfigData): Promise<PortalConfigEntity> {
    const row = await prisma.portalConfig.upsert({
      where: { id: ID_PORTAL },
      create: { id: ID_PORTAL, ...data },
      update: data,
    });
    return aEntidad(row);
  }
}

export const configuracionRepo = new ConfiguracionPrismaRepository();
