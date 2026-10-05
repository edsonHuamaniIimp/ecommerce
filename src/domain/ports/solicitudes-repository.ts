import type { SolicitudRow, RevisionEntity, RevisionHistorialEntity, ReevaluacionEntity, PlanCuotasSolicitud, DatosFacturacionSolicitud } from "../models/entities";
import type { AlertaClave, AlertaDatos } from "@/lib/shared/alert-templates";

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
    crearSolicitud(standIds: string[], userId?: string, email?: string, datosFacturacion?: DatosFacturacionSolicitud | null): Promise<string>;
  crearAlertaReserva(data: { userId: string; tipo: string; clave: AlertaClave; datos: AlertaDatos; url?: string }): Promise<void>;
  crearReevaluacion(solicitudId: string, estado: string, motivo: string | null, documentos: unknown, createdBy: string): Promise<ReevaluacionEntity>;
  tieneReevaluacionPendiente(solicitudId: string): Promise<boolean>;
  atenderReevaluacionAprobacion(reevaluacionId: string, reviewerEmail: string): Promise<void>;
  atenderReevaluacionRechazo(reevaluacionId: string, reviewerEmail: string): Promise<void>;
  darDeBajaSolicitud(solicitudId: string): Promise<void>;
  marcarOrdenPago(solicitudId: string): Promise<void>;
  obtenerHistorial(solicitudId: string): Promise<{ revisiones: RevisionEntity[]; historial: RevisionHistorialEntity[] }>;
  crearDocumentoAdjunto(solicitudId: string, url: string, nombre: string, userId: string | null, email: string, categoria?: string | null, requisito?: string | null): Promise<Record<string, unknown>>;
  findDocumento(docId: string): Promise<{ id: string; userId: string | null } | null>;
  eliminarDocumento(docId: string): Promise<void>;
  crearAlertaRevision(data: { rol: string; solicitudId: string; clave: AlertaClave; datos: AlertaDatos }): Promise<void>;
  crearAlertaRol(data: { rol: string; tipo: string; clave: AlertaClave; datos: AlertaDatos; url: string }): Promise<void>;
  /** Nombre completo del usuario titular de una solicitud (para correos). */
  findNombreUsuario(userId: string): Promise<string | null>;
  /** RF-08: guarda la URL de la imagen del recorte del pabellon de una solicitud. */
  guardarRecortePlano(solicitudId: string, url: string): Promise<void>;
  /** RF-10/11: persiste el plan de cuotas configurado por el cliente (snapshot). */
  guardarPlanCuotas(solicitudId: string, plan: PlanCuotasSolicitud): Promise<void>;
  /**
   * RF-11: crea o actualiza el contrato generado por el sistema (categoria `contrato`,
   * `uploadedBy = "sistema"`), garantizando un unico contrato vigente por solicitud.
   */
  upsertContratoSistema(solicitudId: string, url: string, nombre: string): Promise<void>;
  /** Reserva oficial en el IIMP: guarda contrato, cuenta corriente, cliente y la respuesta completa. */
  guardarReservaIImp(solicitudId: string, data: {
    contrato: string;
    cuentaCorriente: string;
    clienteCodigo: string | null;
    reserva: unknown;
    at: Date;
  }): Promise<void>;
  /** Datos para armar el payload de `POST /stands/reserva` del IIMP. */
  datosReservaIImp(solicitudId: string): Promise<{
    iimpContrato: string | null;
    email: string | null;
    tipoEvento: number | null;
    codigoEvento: number | null;
    stands: string[];
    planCuotas: PlanCuotasSolicitud | null;
    /** Datos comerciales/fiscales del paso 1 del wizard (solicitudes nuevas). */
    datosFacturacion: DatosFacturacionSolicitud | null;
  } | null>;
}
