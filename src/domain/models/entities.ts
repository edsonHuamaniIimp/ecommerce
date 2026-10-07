import type { Rol } from "@/lib/shared/constants";

/** Solicitud de cuenta de nuevo exhibidor enviada desde el portal publico. */
export interface SolicitudCuentaEntity {
  id: string;
  email: string;
  nombre: string;
  apellidos: string;
  telefono: string | null;
  razonSocial: string;
  ruc: string | null;
  cargo: string | null;
  mensaje: string | null;
  estado: string;
  motivoRechazo: string | null;
  revisadoPor: string | null;
  revisadoEn: Date | null;
  usuarioId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventoPadreEntity {
  id: string;
  codigo: string;
  vertical: string;
  nombre: string;
}

/** Item del modal informativo de /mapa (config por version de evento). */
export interface ModalInfoItem {
  titulo: string;
  descripcion: string;
}

/** Bloque de ayuda del modal informativo (link a Mesa de Ayuda, etc.). */
export interface ModalInfoAyuda {
  titulo: string;
  descripcion: string;
  texto_boton: string;
  url: string;
}

/** Contenido configurable del modal informativo que se muestra al entrar a /mapa. */
export interface ModalInfoConfig {
  activo: boolean;
  titulo: string;
  subtitulo?: string | null;
  items: ModalInfoItem[];
  ayuda?: ModalInfoAyuda | null;
}

export interface EventoEntity {
  id: string;
  eventoPadreId: string;
  tipoEvento: number;
  codigoEvento: number;
  anio: string;
  estado: string;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  imagen: string | null;
  flgActivo: boolean;
  flgVisible: boolean;
  plano: string;
  eventoPadre?: EventoPadreEntity;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GessStandEntity {
  id: string;
  eventoId: string;
  standApiId: string;
  standCode: string;
  tipoStand: string | null;
  medidas: string | null;
  estado: string | null;
  empresa: string | null;
  /** Logo de la empresa/usuario que reservo el stand (solo en la respuesta de listar). */
  empresaLogo?: string | null;
  /** Imagen referencial del tipo de stand (solo en la respuesta de listar). */
  tipoImagen?: string | null;
  bloqueId: string | null;
  email: string | null;
  userId: string | null;
  rawData: unknown;
  /** Pre-reserva (bloqueo con empresa o titulo, sin solicitud): snapshot y autor. */
  preReservaRazonSocial?: string | null;
  preReservaTitulo?: string | null;
  preReservaRuc?: string | null;
  preReservaSie?: string | null;
  preReservaLogoUrl?: string | null;
  preReservaNota?: string | null;
  preReservaPor?: string | null;
  preReservaAt?: Date | null;
}

export interface RoleEntity {
  id: string;
  nombre: string;
  descripcion: string | null;
  permisos: string[];
  usuarios: UserRoleEntity[];
}

export interface UserRoleEntity {
  id: string;
  userId: string;
  email: string;
  roleId: string;
  /** Ultimo evento seleccionado por el usuario (se reusa al iniciar sesion). */
  eventoId?: string | null;
  /** Nombre visible del ultimo evento elegido (presala); se reusa al iniciar sesion. */
  eventoNombre?: string | null;
  eventoPadreNombre?: string | null;
  /** Empresa del Portal del Cliente vinculada (alta por backoffice). */
  empresaId?: string | null;
  /** Credencial temporal: debe cambiar la contrasena en el primer ingreso. */
  debeCambiarPassword?: boolean;
}

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  roles: Rol[];
  permissions: string[];
  eventoId?: string;
  eventoPadreId?: string;
}

export interface RevisionEntity {
  id: string;
  solicitudId: string;
  area: string;
  estado: string;
  comentario: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  fuePrimeraRevision: boolean;
}

export interface ReevaluacionEntity {
  id: string;
  solicitudId: string;
  estado: string;
  motivo: string | null;
  documentos: unknown;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RevisionHistorialEntity {
  id: string;
  solicitudId: string;
  area: string;
  estadoAnterior: string;
  comentarioAnterior: string | null;
  motivo: string;
  createdBy: string | null;
  createdAt: Date;
}

export interface SolicitudRow {
  id: string;
  gessStandId: string | null;
  standCode: string;
  standCodes: string[];
  /** Stands de la solicitud con su bloque y pabellon de plano (para ubicacion agrupada). */
  standsDetalle?: Array<{ standCode: string; bloqueId: string | null; planoId: string | null; planoCodigo: string | null; planoNombre: string | null }>;
  /** Identificador del stand en el API externo (para integraciones M2M). */
  standApiId?: string | null;
  tipoStand: string | null;
  medidas: string | null;
  /** Precio de la reserva en USD (del stand simple o suma de la reserva multiple). */
  precio?: number;
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
  /** RF-08: URL de la imagen del recorte del pabellon (para el contrato). */
  recortePlanoUrl?: string | null;
  /** Plan de cuotas configurado al reservar (snapshot para regenerar el contrato). */
  planCuotas?: PlanCuotasSolicitud | null;
  /** Reserva oficial en el IIMP: contrato, cuenta corriente, cliente y respuesta completa. */
  iimpContrato?: string | null;
  iimpCuentaCorriente?: string | null;
  iimpClienteCodigo?: string | null;
  iimpReserva?: unknown;
  iimpReservaAt?: Date | null;
  documentos: unknown;
  imagenes: unknown;
  docsAdjuntosCount: number;
  clienteDocsAdjuntosCount: number;
  /** Documentos del administrador/contrato (`userId` null). */
  docsAdminCount: number;
  docsAdjuntos: Array<{ id: string; url: string; nombre: string; userId: string | null; uploadedBy: string | null; categoria: string | null; requisito: string | null; createdAt: Date }>;
  updatedAt: Date;
  revisiones: RevisionEntity[];
  reevaluaciones: ReevaluacionEntity[];
  revisionAsociado: RevisionEntity | null;
  revisionLegal: RevisionEntity | null;
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
  sgcSubsanacionModo?: string | null;
  /** True si ya se enviaron documentos al expediente SGC (contrato y/o anexos). */
  sgcDocumentosEnviados: boolean;
  /** True si la integracion SGC esta habilitada (SGC_ENABLED=1) en el servidor. */
  sgcEnabled: boolean;
}

/** Cuota del plan configurado por el cliente (snapshot persistido en la solicitud). */
export interface PlanCuotasItem {
  numero: number;
  porcentaje: number;
  monto: number;
  /** Fecha de vencimiento ISO (yyyy-mm-dd) o null. */
  fechaVencimiento: string | null;
}

/** Plan de cuotas configurado al reservar: fuente de verdad para el contrato y Facturacion. */
export interface PlanCuotasSolicitud {
  /** `completo` | `cuotas` | `personalizado` (ver MODOS_PAGO). */
  modalidad: string;
  cuotas: PlanCuotasItem[];
}

/**
 * Snapshot de los datos comerciales/fiscales que el cliente llena en el paso 1
 * del wizard de reserva; fuente del payload de `POST /stands/reserva` del IIMP.
 */
export interface DatosFacturacionSolicitud {
  /** `factura` | `boleta` (TIPOS_COMPROBANTE). */
  tipoComprobante: string | null;
  /** `RUC` | `DNI` (TIPOS_DOCUMENTO). */
  tipoDocumento: string;
  numeroDocumento: string;
  razonSocial: string;
  direccion: string | null;
  telefono: string | null;
  contacto: string | null;
  email: string;
}

/** Datos del exhibidor que van al cuerpo del contrato (paso Cuotas del wizard). */
export interface DatosContrato {
  /** Nombre o razon social del exhibidor. */
  razonSocial?: string;
  /** RUC/RUT/TaxID o equivalente. */
  ruc?: string;
  /** Domicilio del exhibidor. */
  direccion?: string;
  /** Representante legal (nombre completo). */
  representante?: string;
  /** DNI/ID Card/Pasaporte del representante. */
  representanteDni?: string;
  /** Partida electronica de poderes (opcional). */
  partidaElectronica?: string;
}
