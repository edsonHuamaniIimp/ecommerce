import "server-only";

import { prisma } from "@/lib/server/db";
import type {
  DdAuditoriaItem,
  DdConfiguracionData,
  DdConfiguracionEntity,
} from "@/domain/models/dd-configuracion";
import type { IDdConfiguracionRepository } from "@/domain/ports/dd-configuracion-repository";
import { DD_AUDITORIA_TIPO } from "@/lib/shared/constants";

const ID_CONFIG = "default";

function mapConfig(row: {
  plazoDiasHabiles: number;
  estadoCierreAutomatico: string;
  exigirEvidencia: boolean;
  permitirNaSinEvidencia: boolean;
  revalidacionDeclaracion: boolean;
  noAptoBloqueaEmpresa: boolean;
  legalSoloDerivacionSig: boolean;
  vigenciaMeses: number;
  permitirReutilizacionVinculo: boolean;
  asistenteIaHabilitado: boolean;
  manualUrl: string | null;
  reglamentoUrl: string | null;
  plantillaInformeUrl: string | null;
  linkListasUrl: string | null;
  updatedBy: string | null;
  updatedAt: Date;
}): DdConfiguracionEntity {
  return {
    plazoDiasHabiles: row.plazoDiasHabiles,
    estadoCierreAutomatico: row.estadoCierreAutomatico,
    exigirEvidencia: row.exigirEvidencia,
    permitirNaSinEvidencia: row.permitirNaSinEvidencia,
    revalidacionDeclaracion: row.revalidacionDeclaracion,
    noAptoBloqueaEmpresa: row.noAptoBloqueaEmpresa,
    legalSoloDerivacionSig: row.legalSoloDerivacionSig,
    vigenciaMeses: row.vigenciaMeses,
    permitirReutilizacionVinculo: row.permitirReutilizacionVinculo,
    asistenteIaHabilitado: row.asistenteIaHabilitado,
    manualUrl: row.manualUrl,
    reglamentoUrl: row.reglamentoUrl,
    plantillaInformeUrl: row.plantillaInformeUrl,
    linkListasUrl: row.linkListasUrl,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  };
}

export class DdConfiguracionPrismaRepository implements IDdConfiguracionRepository {
  async obtener(): Promise<DdConfiguracionEntity | null> {
    const row = await prisma.ddConfiguracion.findUnique({ where: { id: ID_CONFIG } });
    return row ? mapConfig(row) : null;
  }

  async guardar(data: DdConfiguracionData): Promise<DdConfiguracionEntity> {
    const row = await prisma.ddConfiguracion.upsert({
      where: { id: ID_CONFIG },
      create: { id: ID_CONFIG, ...data },
      update: data,
    });
    return mapConfig(row);
  }

  async listarAuditoria(limit: number): Promise<DdAuditoriaItem[]> {
    const rows = await prisma.auditLog.findMany({
      where: { tipo: DD_AUDITORIA_TIPO },
      orderBy: { createdAt: "desc" },
      take: Math.max(1, Math.min(50, limit)),
      select: { id: true, actor: true, mensaje: true, entidad: true, createdAt: true },
    });
    return rows;
  }

  async registrarAuditoria(accion: string, actor: string, mensaje: string): Promise<void> {
    await prisma.auditLog.create({
      data: {
        tipo: DD_AUDITORIA_TIPO,
        entidad: "debida_diligencia:configuracion",
        actor,
        mensaje,
        metadata: { accion },
      },
    });
  }
}
