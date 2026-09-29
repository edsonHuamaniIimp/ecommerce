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
  /** Identificador del stand en el API externo (para integraciones M2M). */
  standApiId?: string | null;
  tipoStand: string | null;
  medidas: string | null;
  empresa: string | null;
  email: string | null;
  userId: string | null;
  bloqueId: string | null;
  /** Pabellon del stand (segun API externa). */
  pabellon?: string | null;
  /** Ubicacion del stand (segun API externa). */
  ubicacion?: string | null;
  /** Categoria por documento del stand: { "<url>": "<categoria>" }. */
  documentosCategorias?: Record<string, string>;
  /** Empresa montajista asignada al stand (SIE) y su nombre. */
  empresaMontajistaId?: string | null;
  empresaMontajistaNombre?: string | null;
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
  docsAdjuntos: Array<{ id: string; url: string; nombre: string; userId: string | null; uploadedBy: string | null; categoria: string | null; createdAt: string }>;
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
  /** Casuística de subsanación declarada por el admin (null = no declarada). */
  sgcSubsanacionMotivo: string | null;
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
