import { prisma } from "@/lib/server/db";
import type { Prisma } from "@prisma/client";
import type {
  ActualizarSgcDocumentoData,
  ActualizarSgcExpedienteData,
  CrearSgcDocumentoData,
  CrearSgcExpedienteData,
  ISgcRepository,
  SgcSubsanacionEntity,
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
  subsanacionMotivo: string | null;
  subsanacionModo: string | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
  bypassAprobado: boolean;
  devolucionRequiereCambio: boolean | null;
  devolucionMotivo: string | null;
  devolucionDestinoStepId: string | null;
  devolucionEstrategia: string | null;
  observaciones: unknown;
  contratoRegeneradoObservationId: string | null;
  contratoRegeneradoAt: Date | null;
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
    subsanacionMotivo: row.subsanacionMotivo ?? null,
    subsanacionModo: row.subsanacionModo ?? null,
    lastSyncedAt: row.lastSyncedAt ?? null,
    lastError: row.lastError ?? null,
    bypassAprobado: row.bypassAprobado ?? false,
    devolucionRequiereCambio: row.devolucionRequiereCambio ?? null,
    devolucionMotivo: row.devolucionMotivo ?? null,
    devolucionDestinoStepId: row.devolucionDestinoStepId ?? null,
    devolucionEstrategia: row.devolucionEstrategia ?? null,
    observaciones: (row.observaciones as SgcExpedienteEntity["observaciones"]) ?? null,
    contratoRegeneradoObservationId: row.contratoRegeneradoObservationId ?? null,
    contratoRegeneradoAt: row.contratoRegeneradoAt ?? null,
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

  async listarConEstadoEnvio(estado: SgcEstadoEnvio): Promise<SgcExpedienteEntity[]> {
    const rows = await prisma.sgcExpediente.findMany({ where: { estadoEnvio: estado } });
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
    const { observaciones, ...resto } = data;
    const row = await prisma.sgcExpediente.update({
      where: { id },
      data: {
        ...resto,
        ...(observaciones !== undefined ? { observaciones: observaciones as unknown as Prisma.InputJsonValue } : {}),
      },
    });
    return mapExpediente(row);
  }

  async crearDocumento(data: CrearSgcDocumentoData): Promise<SgcDocumentoEntity> {
    /* El SGC puede devolver un documentId ya conocido al reintentar una reserva
     * idempotente. La tabla local tiene document_id unico: se actualiza la
     * correlacion existente en lugar de fallar con P2002. */
    const row = await prisma.sgcDocumento.upsert({
      where: { documentId: data.documentId },
      create: data,
      update: {
        sgcExpedienteId: data.sgcExpedienteId,
        category: data.category,
        title: data.title,
        fileName: data.fileName,
        checksumSha256: data.checksumSha256,
        sizeBytes: data.sizeBytes,
      },
    });
    return mapDocumento(row);
  }

  async actualizarDocumento(documentId: string, data: ActualizarSgcDocumentoData): Promise<void> {
    await prisma.sgcDocumento.update({ where: { documentId }, data });
  }

  async crearSubsanacion(data: {
    sgcExpedienteId: string;
    ronda: number;
    motivo: string;
    modo?: string | null;
    declaradoPor: string;
  }): Promise<SgcSubsanacionEntity> {
    const row = await prisma.sgcSubsanacion.create({ data });
    return mapSubsanacion(row);
  }

  async listarSubsanaciones(sgcExpedienteId: string): Promise<SgcSubsanacionEntity[]> {
    const rows = await prisma.sgcSubsanacion.findMany({
      where: { sgcExpedienteId },
      orderBy: { ronda: "asc" },
    });
    return rows.map(mapSubsanacion);
  }

  async marcarSubsanacionReenviada(
    id: string,
    data: { reenviadoPor: string; documentId: string | null; versionId: string | null },
  ): Promise<void> {
    await prisma.sgcSubsanacion.update({
      where: { id },
      data: { estado: "reenviado", reenviadoAt: new Date(), ...data },
    });
  }
}

function mapSubsanacion(row: {
  id: string;
  sgcExpedienteId: string;
  ronda: number;
  motivo: string;
  modo: string | null;
  estado: string;
  declaradoPor: string;
  declaradoAt: Date;
  reenviadoPor: string | null;
  reenviadoAt: Date | null;
  documentId: string | null;
  versionId: string | null;
}): SgcSubsanacionEntity {
  return { ...row };
}

export const sgcRepo = new SgcPrismaRepository();
