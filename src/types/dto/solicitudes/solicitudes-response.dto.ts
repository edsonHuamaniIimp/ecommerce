import type { ApiResponse } from "@/lib/server/api-response";

interface ReevaluacionDTO {
  id: string;
  solicitudId: string;
  estado: string;
  motivo: string | null;
  documentos: unknown;
  createdBy: string | null;
  createdAt: string;
}

interface RevisionDTO {
  id: string;
  solicitudId: string;
  area: string;
  estado: string;
  comentario: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SolicitudDTO {
  id: string;
  gessStandId: string | null;
  standCode: string;
  standCodes: string[];
  tipoStand: string | null;
  medidas: string | null;
  empresa: string | null;
  email: string | null;
  userId: string | null;
  bloqueId: string | null;
  estado: string | null;
  estadoSolicitud: string;
  flgActivo: boolean;
  documentos: string[];
  imagenes: string[];
  updatedAt: string;
  docsAdjuntosCount: number;
  clienteDocsAdjuntosCount: number;
  /** Documentos del administrador/contrato (`userId` null). */
  docsAdminCount: number;
  docsAdjuntos: Array<{ id: string; url: string; nombre: string; userId: string | null; uploadedBy: string | null; createdAt: string }>;
  revisiones: RevisionDTO[];
  reevaluaciones: ReevaluacionDTO[];
  revisionComunicacion: RevisionDTO | null;
  revisionLegal: RevisionDTO | null;
  revisionLogistica: RevisionDTO | null;
  tieneFacturacion: boolean;
  tipoFacturacion: string | null;
  facturacionId: string | null;
  /** Estado del expediente en el SGC (null = no aplica / aun sin expediente). */
  sgcEstadoEnvio: string | null;
  sgcLifecycleStatus: string | null;
  sgcStage: string | null;
  /** True si ya se enviaron documentos al expediente SGC (contrato y/o anexos). */
  sgcDocumentosEnviados: boolean;
  /** True si la integracion SGC esta habilitada (SGC_ENABLED=1) en el servidor. */
  sgcEnabled: boolean;
}

export interface SolicitudesPaginatedDTO {
  data: SolicitudDTO[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export type SolicitudesListResponse = ApiResponse<SolicitudesPaginatedDTO>;
export type SolicitudDetalleResponse = ApiResponse<SolicitudDTO>;
export type SolicitudNotificarResponse = ApiResponse<{ ok: boolean }>;
