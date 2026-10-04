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
  /** Stands de la solicitud con su bloque y pabellon de plano (ubicacion agrupada). */
  standsDetalle?: Array<{ standCode: string; bloqueId: string | null; planoId: string | null; planoCodigo: string | null; planoNombre: string | null }>;
  /** Identificador del stand en el API externo (para integraciones M2M). */
  standApiId?: string | null;
  tipoStand: string | null;
  medidas: string | null;
  /** Precio de la reserva en USD (del stand simple o suma de la reserva multiple). */
  precio: number;
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
  /** RF-08: URL de la imagen del recorte del pabellon (se adjunta al contrato). */
  recortePlanoUrl?: string | null;
  documentos: string[];
  imagenes: string[];
  updatedAt: string;
  docsAdjuntosCount: number;
  clienteDocsAdjuntosCount: number;
  /** Documentos del administrador/contrato (`userId` null). */
  docsAdminCount: number;
  docsAdjuntos: Array<{ id: string; url: string; nombre: string; userId: string | null; uploadedBy: string | null; categoria: string | null; requisito: string | null; createdAt: string }>;
  revisiones: RevisionDTO[];
  reevaluaciones: ReevaluacionDTO[];
  revisionAsociado: RevisionDTO | null;
  revisionLegal: RevisionDTO | null;
  tieneFacturacion: boolean;
  tipoFacturacion: string | null;
  facturacionId: string | null;
  /** Estado del expediente en el SGC (null = no aplica / aun sin expediente). */
  sgcEstadoEnvio: string | null;
  sgcLifecycleStatus: string | null;
  sgcStage: string | null;
  /** Casuística de subsanación declarada por el admin (null = no declarada). */
  sgcSubsanacionMotivo: string | null;
  /** Modo de la subsanación vigente: `nuevo_contrato` | `mismo_contrato` (null = libre/legacy). */
  sgcSubsanacionModo: string | null;
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
