import type { SolicitudRow, RevisionEntity, RevisionHistorialEntity, ReevaluacionEntity } from "../models/entities";

export interface SolicitudesListParams {
  eventoId: string;
  page: number;
  perPage: number;
  search?: string;
  userId?: string;
}

export interface SolicitudesPaginatedResult {
  data: SolicitudRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface ISolicitudesRepository {
  listar(params: SolicitudesListParams): Promise<SolicitudesPaginatedResult>;
  detalle(solicitudId: string): Promise<SolicitudRow | null>;
  crearOActualizarRevision(data: {
    solicitudId: string;
    area: string;
    estado: string;
    comentario?: string;
    reviewerEmail: string;
  }): Promise<RevisionEntity>;
  crearRevisionInicial(solicitudId: string, area: string): Promise<RevisionEntity>;
  crearSolicitud(standIds: string[], userId?: string, email?: string): Promise<string>;
  crearAlertaReserva(data: { userId: string; tipo: string; titulo: string; mensaje: string; url?: string }): Promise<void>;
  crearReevaluacion(solicitudId: string, estado: string, motivo: string | null, documentos: unknown, createdBy: string): Promise<ReevaluacionEntity>;
  tieneReevaluacionPendiente(solicitudId: string): Promise<boolean>;
  atenderReevaluacionAprobacion(reevaluacionId: string, reviewerEmail: string): Promise<void>;
  atenderReevaluacionRechazo(reevaluacionId: string, reviewerEmail: string): Promise<void>;
  darDeBajaSolicitud(solicitudId: string): Promise<void>;
  marcarOrdenPago(solicitudId: string): Promise<void>;
  obtenerHistorial(solicitudId: string): Promise<{ revisiones: RevisionEntity[]; historial: RevisionHistorialEntity[] }>;
  crearDocumentoAdjunto(solicitudId: string, url: string, nombre: string, userId: string | null, email: string, categoria?: string | null): Promise<Record<string, unknown>>;
  findDocumento(docId: string): Promise<{ id: string; userId: string | null } | null>;
  eliminarDocumento(docId: string): Promise<void>;
  crearAlertaRevision(data: { rol: string; solicitudId: string; titulo: string; mensaje: string; standCodes: string }): Promise<void>;
  crearAlertaRol(data: { rol: string; tipo: string; titulo: string; mensaje: string; url: string }): Promise<void>;
}
