import type {
  SgcApprovalMark,
  SgcApprovalResult,
  SgcDocumentCategory,
  SgcDocumentoEstado,
  SgcEstadoEnvio,
  SgcLifecycleStatus,
  SgcOutboxEstado,
  SgcStage,
  SgcStepStatus,
  SgcVersionStatus,
} from "@/lib/shared/constants";

/** Cuerpo de creacion de expediente — POST /contracts */
export interface SgcCrearExpedienteInput {
  code: string;
  areaCode: string;
  contractTypeCode: string;
  name: string;
  counterpartyLegalName: string;
  counterpartyTaxIdentifier: string;
  processOrigin: string;
}

/** Respuesta 201 de creacion de expediente */
export interface SgcCrearExpedienteResult {
  contractId: string;
  status: string;
}

/** Campos actualizables del expediente — PATCH /contracts/{contractId} */
export interface SgcActualizarExpedienteInput {
  name?: string;
  counterpartyLegalName?: string;
  counterpartyTaxIdentifier?: string;
}

/** Cuerpo de reserva de subida — POST /contracts/{contractId}/documents */
export interface SgcReservarSubidaInput {
  category: SgcDocumentCategory;
  title: string;
  fileName: string;
  sizeBytes: number;
  checksumSha256: string;
  declaredMimeType: string;
  replacementReason?: string;
  /** null/omitido = pieza nueva; id existente = nueva version (subsanacion) */
  documentId?: string | null;
}

/** Respuesta 201 de reserva de subida */
export interface SgcReservarSubidaResult {
  uploadUrl: string;
  headers: Record<string, string>;
  documentId: string;
  versionId: string;
  versionNumber: number;
  expiresInSeconds: number;
}

/** Respuesta de confirmacion de subida — POST /document-versions/{versionId}/complete */
export interface SgcConfirmarSubidaResult {
  outcome: SgcApprovalResult;
  previewStatus?: string;
  message?: string;
}

/** Pieza documental lista para empujar al SGC (binario en memoria). */
export interface SgcPiezaDocumental {
  category: SgcDocumentCategory;
  title: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  /** null/omitido = pieza nueva; id existente = nueva version (subsanacion) */
  documentId?: string | null;
  replacementReason?: string;
}

export interface SgcCompletedBy {
  actorName: string;
  areaName: string;
  completedAt: string;
  constancy: SgcApprovalMark;
}

export interface SgcStep {
  code: string;
  name: string;
  kind: string;
  position: number;
  status: SgcStepStatus;
  areaId: string | null;
  completedBy: SgcCompletedBy | null;
}

export interface SgcHistoryItem {
  id: string;
  source: string;
  title: string;
  detail: string;
  actorName: string;
  occurredAt: string;
}

export interface SgcDocumentoResumen {
  documentId: string;
  category: string;
  title: string;
  currentVersionId: string | null;
}

/** Detalle completo del expediente — GET /contracts/{contractId} */
export interface SgcExpedienteDetalle {
  contractId: string;
  code: string;
  name: string;
  stage: SgcStage;
  lifecycleStatus: SgcLifecycleStatus | null;
  areaName: string | null;
  contractTypeName: string | null;
  counterpartyName: string | null;
  counterpartyEmail: string | null;
  counterpartyTaxIdentifier: string | null;
  currency: string | null;
  totalMinorUnits: number | null;
  startDate: string | null;
  endDate: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  documents: SgcDocumentoResumen[];
  steps: SgcStep[];
  history: SgcHistoryItem[];
}

export interface SgcVersion {
  versionId: string;
  versionNumber: number;
  isCurrent: boolean;
  status: SgcVersionStatus;
  fileName: string;
  checksumSha256: string;
  createdAt: string;
  approvalMarkKind: SgcApprovalMark | null;
  rejectionReason: string | null;
  sizeBytes: number;
}

/** Detalle de documento con historial de versiones — GET /documents/{documentId} */
export interface SgcDocumentoDetalle {
  documentId: string;
  contractId: string;
  category: string;
  title: string;
  currentVersionId: string | null;
  versions: SgcVersion[];
}

/** Resolucion de version a documento/expediente — GET /document-versions/{versionId} */
export interface SgcVersionResuelta {
  versionId: string;
  documentId: string;
  contractId: string;
  category: string;
  versionNumber: number;
  status: SgcVersionStatus;
  fileName: string;
  checksumSha256: string;
  createdAt: string;
}

/** Enlace de descarga de vida corta — GET /document-versions/{versionId}/download */
export interface SgcUrlDescarga {
  url: string;
  expiresInSeconds: number;
}

export interface SgcListarFiltros {
  q?: string;
  stage?: SgcStage;
  page?: number;
  pageSize?: number;
}

export interface SgcPaginaExpedientes {
  items: SgcExpedienteDetalle[];
  page: number;
  pageSize: number;
  total: number;
}

/** Correlacion persistida entre una solicitud local y su expediente en el SGC */
export interface SgcExpedienteEntity {
  id: string;
  solicitudId: string;
  code: string;
  contractId: string | null;
  estadoEnvio: SgcEstadoEnvio;
  stage: SgcStage | null;
  lifecycleStatus: SgcLifecycleStatus | null;
  version: number | null;
  areaCode: string;
  contractTypeCode: string;
  lastSyncedAt: Date | null;
  lastError: string | null;
}

export interface SgcWebhookResource {
  id: string;
  type: string;
  code?: string | null;
}

/** Mensaje recibido de un webhook del SGC. */
export interface SgcWebhookPayload {
  apiVersion: string;
  eventId: string;
  eventType: string;
  createdAt: string;
  resource: SgcWebhookResource;
  data: Record<string, unknown>;
}

/** Registro del inbox de webhooks (idempotencia por eventId). */
export interface SgcWebhookEventoEntity {
  id: string;
  eventId: string;
  eventType: string;
  resourceId: string | null;
  resourceCode: string | null;
  procesadoAt: Date | null;
  error: string | null;
}

/** Registro de la cola de salida (outbox) hacia el SGC. */
export interface SgcOutboxEntity {
  id: string;
  operacion: string;
  idempotencyKey: string | null;
  payload: Record<string, unknown>;
  estado: SgcOutboxEstado;
  intentos: number;
  ultimoError: string | null;
  programadoAt: Date;
}

/** Correlacion persistida de cada pieza documental empujada al SGC */
export interface SgcDocumentoEntity {
  id: string;
  sgcExpedienteId: string;
  documentId: string;
  currentVersionId: string | null;
  category: SgcDocumentCategory;
  title: string;
  fileName: string;
  checksumSha256: string | null;
  sizeBytes: number | null;
  estado: SgcDocumentoEstado;
}

/** Error tipado de la API del SGC */
export class SgcApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "SgcApiError";
  }
}
