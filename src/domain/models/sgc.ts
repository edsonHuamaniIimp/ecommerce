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
  /**
   * Correo del cliente (OBLIGATORIO, guia v4 §3): el SGC le envia automaticamente la copia
   * final firmada al terminar el tramite. Sin el, la creacion responde `400`.
   */
  counterpartyEmail: string;
  counterpartyTaxIdentifier: string;
  processOrigin: string;
  /**
   * Campos propios del tipo (guia v3, §3.2). Solo se envian si el tipo los declara
   * como obligatorios en `GET /contract-types` (`fields[].required`). Claves desconocidas
   * se ignoran; una clave mal formada responde 400.
   */
  fields?: Record<string, string | number | boolean>;
}

/** Paso de la ruta de revision (la resuelve el SGC al crear el expediente). */
export interface SgcRutaStep {
  position: number;
  code: string;
  name: string;
  kind: string;
  areaName: string;
  requiredRole: string | null;
  slaHours: number | null;
}

/** Ruta de revision congelada en el expediente — viene en la respuesta de creacion. */
export interface SgcRutaExpediente {
  definitionCode: string;
  definitionName: string;
  definitionVersion: number;
  source: string;
  frozen: boolean;
  steps: SgcRutaStep[];
}

/** Respuesta 201 de creacion de expediente (incluye la ruta resuelta y congelada). */
export interface SgcCrearExpedienteResult {
  contractId: string;
  contractTypeCode?: string;
  route?: SgcRutaExpediente | null;
  routeError?: string | null;
  status: string;
}

/** Respuesta de reabrir el tramite tras subsanar — POST /contracts/{id}/resend */
export interface SgcResendResult {
  contractId: string;
  status: string;
}

/** Campo propio de un tipo de contrato (guia v3, §3.2) — `fields` de GET /contract-types. */
export interface SgcCampoTipo {
  key: string;
  label: string;
  /** short-text | long-text | integer | money | date | email | boolean | select | area | person | event-edition */
  kind: string;
  required: boolean;
  options?: string[] | null;
  /** false = no soportado por API todavia (area, person, event-edition). */
  apiSupported: boolean;
}

/** Catalogo de tipos de contrato y areas — GET /contract-types */
export interface SgcContractType {
  code: string;
  name: string;
  categoryName?: string | null;
  routeError?: string | null;
  route?: SgcRutaExpediente | null;
  fields?: SgcCampoTipo[] | null;
}

export interface SgcContractTypesCatalogo {
  areas: { code: string; name: string }[];
  items: SgcContractType[];
}

/** Repositorio de templates — GET /templates[/{code}] */
export interface SgcTemplateArchivo {
  fileId: string;
  title: string;
  fileName: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  downloadPath: string;
}

export interface SgcTemplate {
  code: string;
  title: string;
  descriptionHtml: string;
  descriptionText: string;
  contractType: { code: string; name: string } | null;
  startDocuments: SgcTemplateArchivo[];
  additionalDocuments: SgcTemplateArchivo[];
  uploadPolicy: { allowedExtensions: string[]; maxBytes: number };
  updatedAt: string;
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
  /** Observacion del SGC que agrupa este archivo con otros adjuntos. */
  observationId?: string | null;
  /** Pieza del grupo de adjuntos que cubre este archivo (v11). */
  pieceId?: string | null;
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
  /** Observacion del SGC que agrupa este archivo con otros adjuntos. */
  observationId?: string | null;
  /** Pieza del grupo de adjuntos que cubre este archivo (v11). */
  pieceId?: string | null;
  /** Observacion agrupada sin `pieceId`: enviar el `observationId` suelto. */
  esGrupoSinPiezas?: boolean;
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

/** Pieza documental dentro de una observacion agrupada de anexos. */
export interface SgcObservationPiece {
  id: string;
  title: string;
  acceptedDocumentId?: string | null;
}

/** Observacion del SGC sobre un documento (campo OPCIONAL de la integracion; puede no venir). */
export interface SgcObservacionDocumento {
  observationId?: string | null;
  /** `documentId` del SGC (el que devolvio POST /contracts/{id}/documents). null = faltante. */
  documentId?: string | null;
  /** Version revisada por el SGC (opcional): util si el documento tiene varias versiones. */
  versionId?: string | null;
  versionNumber?: number | null;
  category?: string | null;
  title?: string | null;
  severity?: string | null;
  message: string;
  requiresDocumentChange?: boolean | null;
  /** true = el faltante exige un archivo nuevo (documentId null). */
  requiresNewDocument?: boolean | null;
  /** Cantidad de archivos que cubren esta observacion (default 1). Campo opcional. */
  expectedDocuments?: number | null;
  /** Titulos esperados por archivo, si el SGC los informa. */
  expectedDocumentTitles?: string[] | null;
  /** Piezas esperadas de un grupo de adjuntos (v11). */
  pieces?: SgcObservationPiece[] | null;
  /** Documentos del grupo aun pendientes. */
  documentsMissing?: number | null;
  /** Ids de documentos aceptados para el grupo. */
  documentIds?: string[] | null;
  status?: string | null;
  /** Fecha en que el SGC marco la observacion como resuelta (opcional). */
  resolvedAt?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
}

export interface SgcDocumentoResumen {
  documentId: string;
  category: string;
  title: string;
  currentVersionId: string | null;
  /** Nombre fisico del archivo en el SGC (lo fijamos nosotros via `fileName`). */
  currentFileName?: string | null;
  /** Estado del documento en el SGC (opcional): pending | approved | observed | rejected. */
  status?: string | null;
  /** Observaciones por documento (opcional; versiones previas no las envian). */
  observations?: SgcObservacionDocumento[] | null;
  /** Grupo de adjuntos faltantes (v11): piezas y progreso. */
  expectedDocuments?: number | null;
  expectedDocumentTitles?: string[] | null;
  documentsMissing?: number | null;
  documentIds?: string[] | null;
  pieces?: SgcObservationPiece[] | null;
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
  /** Documentos que el SGC espera y aun no existen (opcional). */
  missingDocuments?: SgcDocumentoResumen[] | null;
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
  /** Nombre fisico del archivo en el SGC (lo fijamos nosotros via `fileName`). */
  currentFileName?: string | null;
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
  /** Casuística de subsanación declarada por el admin (null = no declarada). */
  subsanacionMotivo: string | null;
  /** Modo de la subsanación vigente: `nuevo_contrato` | `mismo_contrato` (null = libre/legacy). */
  subsanacionModo?: string | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
  /** Bypass admin: aprobado localmente; el sync-on-read no debe revertir el estado. */
  bypassAprobado?: boolean;
  /** Ultima devolucion: `true` = exige version nueva del principal (subsanable). */
  devolucionRequiereCambio?: boolean | null;
  /** Motivo (libre) de la ultima devolucion (`data.reason` del webhook). */
  devolucionMotivo?: string | null;
  /** Etapa destino de la devolucion (`null` = origen). */
  devolucionDestinoStepId?: string | null;
  /** Estrategia: `return-to-sender` | `restart-forward`. */
  devolucionEstrategia?: string | null;
  /** Observaciones por documento de la ultima devolucion (opcional; [] = sin observaciones). */
  observaciones?: SgcObservacionDocumento[] | null;
  /** Observacion de contrato para la que ya se genero una version local corregida. */
  contratoRegeneradoObservationId?: string | null;
  contratoRegeneradoAt?: Date | null;
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
  /** Id de entrega del webhook (`x-sgc-delivery`): dedup por entrega. */
  deliveryId?: string | null;
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
