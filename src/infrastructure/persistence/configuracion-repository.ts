import { prisma } from "@/lib/server/db";
import type { ActualizarPortalConfigData, PortalConfigEntity } from "@/domain/models/configuracion";
import type { IConfiguracionRepository } from "@/domain/ports/configuracion-repository";

/** Registro unico: la configuracion del portal vive en la fila `id = "default"`. */
const ID_PORTAL = "default";

type FilaPortalConfig = {
  mesaAyudaEmail: string | null;
  contactoEmail: string | null;
  facturacionEmails: unknown;
  facturacionTelefonos: unknown;
  notificacionesSolicitudesEmails: unknown;
  manualUrl: string | null;
  reglamentoUrl: string | null;
  holdReservaMinutos: number;
  maxStandsReserva: number;
  mantenimientoActivo: boolean;
  mantenimientoInicio: Date | null;
  mantenimientoFin: Date | null;
  mantenimientoPermiteCerrar: boolean;
  updatedBy: string | null;
  updatedAt: Date;
};

/** Lista de textos guardada como JSON (ignora valores invalidos y vacios). */
function listaTextos(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function aEntidad(row: FilaPortalConfig): PortalConfigEntity {
  return {
    mesaAyudaEmail: row.mesaAyudaEmail,
    contactoEmail: row.contactoEmail,
    facturacionEmails: listaTextos(row.facturacionEmails),
    facturacionTelefonos: listaTextos(row.facturacionTelefonos),
    notificacionesSolicitudesEmails: listaTextos(row.notificacionesSolicitudesEmails),
    manualUrl: row.manualUrl,
    reglamentoUrl: row.reglamentoUrl,
    holdReservaMinutos: row.holdReservaMinutos,
    maxStandsReserva: row.maxStandsReserva,
    mantenimientoActivo: row.mantenimientoActivo,
    mantenimientoInicio: row.mantenimientoInicio,
    mantenimientoFin: row.mantenimientoFin,
    mantenimientoPermiteCerrar: row.mantenimientoPermiteCerrar,
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

  async obtenerNotificacionesSolicitudes(): Promise<string[]> {
    const row = await prisma.portalConfig.findUnique({
      where: { id: ID_PORTAL },
      select: { notificacionesSolicitudesEmails: true },
    });
    return listaTextos(row?.notificacionesSolicitudesEmails);
  }

  async guardarNotificacionesSolicitudes(emails: string[], updatedBy: string | null): Promise<string[]> {
    const row = await prisma.portalConfig.upsert({
      where: { id: ID_PORTAL },
      create: { id: ID_PORTAL, notificacionesSolicitudesEmails: emails, updatedBy },
      update: { notificacionesSolicitudesEmails: emails, updatedBy },
      select: { notificacionesSolicitudesEmails: true },
    });
    return listaTextos(row.notificacionesSolicitudesEmails);
  }
}

export const configuracionRepo = new ConfiguracionPrismaRepository();
