import { prisma } from "@/lib/server/db";
import type {
  ActualizarSgcDocumentoData,
  ActualizarSgcExpedienteData,
  CrearSgcDocumentoData,
  CrearSgcExpedienteData,
  ISgcRepository,
} from "@/domain/ports/sgc-repository";
import type { SgcDocumentoEntity, SgcExpedienteEntity } from "@/domain/models/sgc";
import type { SgcDocumentCategory, SgcDocumentoEstado, SgcEstadoEnvio } from "@/lib/shared/constants";

interface SgcExpedienteRow {
  id: string;
  solicitudId: string;
  code: string;
  contractId: string | null;
  estadoEnvio: string;
  stage: string | null;
  lifecycleStatus: string | null;
  version: number | null;
  areaCode: string;
  contractTypeCode: string;
  lastSyncedAt: Date | null;
  lastError: string | null;
}

interface SgcDocumentoRow {
  id: string;
  sgcExpedienteId: string;
  documentId: string;
  currentVersionId: string | null;
  category: string;
  title: string;
  fileName: string;
  checksumSha256: string | null;
  sizeBytes: number | null;
  estado: string;
}

function mapExpediente(row: SgcExpedienteRow): SgcExpedienteEntity {
  return {
    id: row.id,
    solicitudId: row.solicitudId,
    code: row.code,
    contractId: row.contractId ?? null,
    estadoEnvio: row.estadoEnvio as SgcEstadoEnvio,
    stage: (row.stage as SgcExpedienteEntity["stage"]) ?? null,
    lifecycleStatus: (row.lifecycleStatus as SgcExpedienteEntity["lifecycleStatus"]) ?? null,
    version: row.version ?? null,
    areaCode: row.areaCode,
    contractTypeCode: row.contractTypeCode,
    lastSyncedAt: row.lastSyncedAt ?? null,
    lastError: row.lastError ?? null,
  };
}

function mapDocumento(row: SgcDocumentoRow): SgcDocumentoEntity {
  return {
    id: row.id,
    sgcExpedienteId: row.sgcExpedienteId,
    documentId: row.documentId,
    currentVersionId: row.currentVersionId ?? null,
    category: row.category as SgcDocumentCategory,
    title: row.title,
    fileName: row.fileName,
    checksumSha256: row.checksumSha256 ?? null,
    sizeBytes: row.sizeBytes ?? null,
    estado: row.estado as SgcDocumentoEstado,
  };
}

export class SgcPrismaRepository implements ISgcRepository {
  async findExpedientePorSolicitud(solicitudId: string): Promise<SgcExpedienteEntity | null> {
    const row = await prisma.sgcExpediente.findUnique({ where: { solicitudId } });
    return row ? mapExpediente(row) : null;
  }

  async findExpedientePorContractId(contractId: string): Promise<SgcExpedienteEntity | null> {
    const row = await prisma.sgcExpediente.findUnique({ where: { contractId } });
    return row ? mapExpediente(row) : null;
  }

  async listarConContractId(): Promise<SgcExpedienteEntity[]> {
    const rows = await prisma.sgcExpediente.findMany({ where: { contractId: { not: null } } });
    return rows.map((row) => mapExpediente(row));
  }

  async crearExpediente(data: CrearSgcExpedienteData): Promise<SgcExpedienteEntity> {
    const row = await prisma.sgcExpediente.create({
      data: {
        solicitudId: data.solicitudId,
        code: data.code,
        areaCode: data.areaCode,
        contractTypeCode: data.contractTypeCode,
      },
    });
    return mapExpediente(row);
  }

  async actualizarExpediente(id: string, data: ActualizarSgcExpedienteData): Promise<SgcExpedienteEntity> {
    const row = await prisma.sgcExpediente.update({ where: { id }, data });
    return mapExpediente(row);
  }

  async crearDocumento(data: CrearSgcDocumentoData): Promise<SgcDocumentoEntity> {
    const row = await prisma.sgcDocumento.create({ data });
    return mapDocumento(row);
  }

  async actualizarDocumento(documentId: string, data: ActualizarSgcDocumentoData): Promise<void> {
    await prisma.sgcDocumento.update({ where: { documentId }, data });
  }
}

export const sgcRepo = new SgcPrismaRepository();
