import type { SgcDocumentoEntity, SgcExpedienteEntity } from "@/domain/models/sgc";
import type {
  SgcDocumentCategory,
  SgcDocumentoEstado,
  SgcEstadoEnvio,
  SgcLifecycleStatus,
  SgcStage,
} from "@/lib/shared/constants";

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
  crearExpediente(data: CrearSgcExpedienteData): Promise<SgcExpedienteEntity>;
  actualizarExpediente(id: string, data: ActualizarSgcExpedienteData): Promise<SgcExpedienteEntity>;
  crearDocumento(data: CrearSgcDocumentoData): Promise<SgcDocumentoEntity>;
  actualizarDocumento(documentId: string, data: ActualizarSgcDocumentoData): Promise<void>;
}
