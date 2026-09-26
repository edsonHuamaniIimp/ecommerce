import type { SgcDocumentoEntity, SgcExpedienteEntity } from "@/domain/models/sgc";
import type {
  SgcDocumentCategory,
  SgcDocumentoEstado,
  SgcEstadoEnvio,
  SgcLifecycleStatus,
  SgcStage,
} from "@/lib/shared/constants";

/** Ronda de subsanación (auditoría: rechazo → motivo → corrección → reenvío). */
export interface SgcSubsanacionEntity {
  id: string;
  sgcExpedienteId: string;
  ronda: number;
  motivo: string;
  estado: string;
  declaradoPor: string;
  declaradoAt: Date;
  reenviadoPor: string | null;
  reenviadoAt: Date | null;
  documentId: string | null;
  versionId: string | null;
}

export interface CrearSgcExpedienteData {
  solicitudId: string;
  code: string;
  areaCode: string;
  contractTypeCode: string;
}

export interface ActualizarSgcExpedienteData {
  contractId?: string | null;
  estadoEnvio?: SgcEstadoEnvio;
  stage?: SgcStage | null;
  lifecycleStatus?: SgcLifecycleStatus | null;
  version?: number | null;
  /** CasuÃ­stica de subsanaciÃ³n declarada por el admin (null = limpiar). */
  subsanacionMotivo?: string | null;
  lastSyncedAt?: Date | null;
  lastError?: string | null;
}

export interface CrearSgcDocumentoData {
  sgcExpedienteId: string;
  documentId: string;
  category: SgcDocumentCategory;
  title: string;
  fileName: string;
  checksumSha256: string;
  sizeBytes: number;
}

export interface ActualizarSgcDocumentoData {
  currentVersionId?: string | null;
  estado?: SgcDocumentoEstado;
}

export interface ISgcRepository {
  findExpedientePorSolicitud(solicitudId: string): Promise<SgcExpedienteEntity | null>;
  findExpedientePorContractId(contractId: string): Promise<SgcExpedienteEntity | null>;
  listarConContractId(): Promise<SgcExpedienteEntity[]>;
  listarConEstadoEnvio(estado: SgcEstadoEnvio): Promise<SgcExpedienteEntity[]>;
  crearExpediente(data: CrearSgcExpedienteData): Promise<SgcExpedienteEntity>;
  actualizarExpediente(id: string, data: ActualizarSgcExpedienteData): Promise<SgcExpedienteEntity>;
  /** Bitácora auditable de subsanaciones (una fila por ronda de devolución). */
  crearSubsanacion(data: {
    sgcExpedienteId: string;
    ronda: number;
    motivo: string;
    declaradoPor: string;
  }): Promise<SgcSubsanacionEntity>;
  listarSubsanaciones(sgcExpedienteId: string): Promise<SgcSubsanacionEntity[]>;
  marcarSubsanacionReenviada(
    id: string,
    data: { reenviadoPor: string; documentId: string | null; versionId: string | null },
  ): Promise<void>;

  crearDocumento(data: CrearSgcDocumentoData): Promise<SgcDocumentoEntity>;
  actualizarDocumento(documentId: string, data: ActualizarSgcDocumentoData): Promise<void>;
}
