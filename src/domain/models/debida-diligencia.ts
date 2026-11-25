import type {
  DdAccionRevision,
  DdDocumentoEstado,
  DdAccionLegal,
  DdDocumentoTipo,
  DdEstado,
  DdEstadoEvaluacion,
  DdHistorialTipo,
  DdObservacionArea,
  DdObservacionVinculoTipo,
  DdReputacionEstado,
  DdReputacionOrden,
  DdReputacionResultado,
  DdResultado,
  DdTipoDocumentoEmpresa,
  DdVinculo,
} from "@/lib/shared/constants";

/** Datos minimos de la empresa que acompanan al expediente. */
export interface DdEmpresaResumen {
  id: string;
  ruc: string;
  tipoDocumento?: string | null;
  razonSocial: string;
  nombreComercial: string | null;
  sitioWeb: string | null;
  emailContacto: string | null;
  representanteLegalNombre: string | null;
  representanteLegalDni: string | null;
  representanteCorreo: string | null;
  logoUrl: string | null;
}

/** Datos minimos del evento activo. */
export interface DdEventoResumen {
  id: string;
  nombre: string;
  anio: string;
}

export interface DdBeneficiarioEntity {
  id: string;
  orden: number;
  nombre: string;
  documento: string;
  tipoDocumento: string | null;
  nacionalidad: string;
  porcentaje: number;
  tipoVinculoPersona: string | null;
}

export interface DdDocumentoVersionEntity {
  id: string;
  version: number;
  nombre: string;
  url: string;
  creadoPor: string | null;
  createdAt: Date;
}

export interface DdDocumentoEntity {
  id: string;
  tipo: DdDocumentoTipo;
  nombre: string;
  url: string;
  estado: DdDocumentoEstado;
  observacion: string | null;
  updatedAt: Date;
  versiones: DdDocumentoVersionEntity[];
}

export interface DdBandejaDocumento {
  tipo: DdDocumentoTipo;
  nombre: string;
  url: string;
  estado: DdDocumentoEstado;
  /** Ultima version cargada; null si el documento es legacy y no tiene historial. */
  version: number | null;
}

export interface DdObservacionEntity {
  id: string;
  area: DdObservacionArea;
  documentoTipo: DdDocumentoTipo | null;
  vinculoTipo: DdObservacionVinculoTipo | null;
  beneficiarioId: string | null;
  vinculoNombre: string | null;
  texto: string;
  estado: string;
  creadoPor: string;
  fechaResolucion: Date | null;
  createdAt: Date;
}

/** Vínculo marcado por Logística para que el cliente lo corrija. */
export interface DdVinculoObservadoInput {
  tipo: DdObservacionVinculoTipo;
  beneficiarioId?: string | null;
  comentario?: string | null;
}

/** Evento persistido del flujo (envios, decisiones y derivaciones). */
export interface DdHistorialEventoEntity {
  id: string;
  tipo: DdHistorialTipo;
  area: DdObservacionArea | null;
  estado: string | null;
  titulo: string;
  detalle: string | null;
  actor: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/** Datos para registrar un evento del historial. */
/** Version de evento del API usada para asignar una fila importada de DD. */
export interface DdEventoImportacionCatalogo {
  tipoEvento: number;
  codigoEvento: number;
  anio: string;
  nombre: string;
  fechaInicio: Date | null;
  fechaFin: Date | null;
}

export interface DdHistorialCreacion {
  tipo: DdHistorialTipo;
  area?: DdObservacionArea | null;
  estado?: string | null;
  titulo: string;
  detalle?: string | null;
  actor: string;
  metadata?: Record<string, unknown> | null;
}

export interface DdMisExpedientesParams {
  empresaId: string;
  page: number;
  perPage: number;
  search?: string;
  estado?: string;
  eventoId?: string;
}

export interface DdMisExpedientesResult {
  data: DdExpedienteEntity[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface DdExpedienteEntity {
  id: string;
  empresaId: string;
  eventoId: string;
  codigo: string;
  estado: DdEstado;
  origen: string;
  estadoOrigen: string | null;
  eventoProyecto: string | null;
  motivoImportacion: string | null;
  importacionId: string | null;
  tipoRelacionComercial: DdVinculo[];
  tipoRelacionComercialOtro: string | null;
  actividadEconomica: string | null;
  actividadEconomicaOtro: string | null;
  paisConstitucion: string | null;
  sitioWeb: string | null;
  emailRepresentante: string | null;
  aceptaDatos: boolean;
  aceptaVerificacion: boolean;
  declaraVerdad: boolean;
  /** SIG declaro que reviso y que estan todos los vinculos de la solicitud. */
  vinculosCompletos: boolean;
  vinculosCompletosPor: string | null;
  vinculosCompletosEn: Date | null;
  representanteNombre: string | null;
  representanteTipoDocumento: string | null;
  representanteDocumento: string | null;
  representanteNacionalidad: string | null;
  fechaEnvio: Date | null;
  fechaRevision: Date | null;
  fechaAprobacion: Date | null;
  fechaVencimiento: Date | null;
  fechaRechazo: Date | null;
  revisadoPor: string | null;
  motivoRechazo: string | null;
  fechaDerivacionLegal: Date | null;
  derivadoLegalPor: string | null;
  informeLogisticaUrl: string | null;
  fechaLegal: Date | null;
  legalRevisor: string | null;
  decisionLegal: DdAccionLegal | null;
  motivoLegal: string | null;
  informeLegalNombre: string | null;
  informeLegalUrl: string | null;
  creadoPor: string;
  actualizadoPor: string | null;
  createdAt: Date;
  updatedAt: Date;
  empresa: DdEmpresaResumen;
  evento: DdEventoResumen;
  beneficiarios: DdBeneficiarioEntity[];
  documentos: DdDocumentoEntity[];
  observaciones: DdObservacionEntity[];
  reputacion: DdReputacionCasoEntity[];
}

/** Evaluacion de DD de la empresa de una solicitud, para bloquear su revision. */
export interface DdEvaluacionEmpresa {
  empresa: DdEmpresaResumen | null;
  expediente: DdExpedienteEntity | null;
  resultado: DdResultado;
  estadoEvaluacion: DdEstadoEvaluacion | null;
  vigente: boolean;
  aptoParaContratar: boolean;
  /** DD APTA/vigente a la que le falta validar la declaracion de vigencia. */
  requiereDeclaracionVigencia: boolean;
  /** Estado del documento declaracion_vigencia; null si aun no existe. */
  declaracionVigenciaEstado: string | null;
  observacionesAbiertas: number;
  mensaje: string | null;
}

export interface DdReputacionCasoEntity {
  id: string;
  /** Vinculo de matriz; null en casos legacy derivados por expediente. */
  vinculoId: string | null;
  vinculoTipo: string | null;
  vinculoNombre: string | null;
  vinculoDocumento: string | null;
  nombreARevisar: string;
  /** Rol o cargo del nombre dentro del expediente. */
  cargo: string | null;
  /** Nacionalidad del representante o beneficiario; null para la empresa/sin coincidencia. */
  nacionalidad: string | null;
  sitioWeb: string | null;
  estado: DdReputacionEstado;
  resultado: DdReputacionResultado | null;
  comentario: string | null;
  linkHallazgos: string | null;
  derivadoPor: string;
  fechaDerivacion: Date;
  revisor: string | null;
  fechaCierre: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Fila de la bandeja de Logistica. */
export interface DdBandejaRow {
  id: string;
  codigo: string;
  estado: DdEstado;
  requiereRevalidacion: boolean;
  declaracionVigenciaEstado: string | null;
  origen: string;
  estadoOrigen: string | null;
  eventoProyecto: string | null;
  eventoNombre: string;
  motivoImportacion: string | null;
  tipoRelacionComercial: DdVinculo[];
  empresa: DdEmpresaResumen;
  beneficiarios: DdBeneficiarioEntity[];
  /** Inicio real de la solicitud: fecha fuente para importados, createdAt para regulares. */
  fechaInicio: Date | null;
  fechaCreacion: Date;
  solicitudesAlquiler: number;
  documentoCargados: number;
  documentoTotal: number;
  documentos: DdBandejaDocumento[];
  fechaEnvio: Date | null;
  fechaAprobacion: Date | null;
  fechaVencimiento: Date | null;
  revisadoPor: string | null;
  motivoRechazo: string | null;
  observacionesAbiertas: number;
  reputacionCasos: number;
  reputacionEstado: DdReputacionEstado | null;
  reputacionPendientes: number;
  reputacionSinHallazgos: number;
  reputacionConHallazgos: number;
  reputacionRequiereInformacion: number;
  decisionLegal: DdAccionLegal | null;
  motivoLegal: string | null;
  fechaLegal: Date | null;
  /** Fecha en que se derivo el expediente a Legal. */
  fechaDerivacionLegal: Date | null;
}

export interface DdBandejaParams {
  /** null/undefined = todos los eventos. */
  eventoId?: string;
  /** Evento activo de la sesion; solo contextualiza la revalidacion, no filtra. */
  eventoActivoId?: string;
  page: number;
  perPage: number;
  search?: string;
  estado?: string;
  origen?: string;
  vinculo?: string;
  documentos?: string;
  reputacion?: string;
  asignacion?: string;
  solicitudes?: string;
  multiples?: string;
  orden?: string;
}

export interface DdBandejaResumen {
  total: number;
  pendientes: number;
  /** Enviadas por el cliente; SIG aun no inicia la revision. */
  documentacionRecibida: number;
  enRevision: number;
  observadas: number;
  aprobadas: number;
  revalidacionPendiente: number;
  vencidas: number;
  rechazadas: number;
}

export interface DdBandejaResult {
  data: DdBandejaRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  resumen: DdBandejaResumen;
}

/** KPIs y agregados del panel del modulo. */
export interface DdPanelKpis {
  total: number;
  aprobadasVigentes: number;
  porVencer: number;
  enRevision: number;
  observadas: number;
  rechazadas: number;
  pendientes: number;
  empresasRegistradas: number;
}

export interface DdPanelVinculo {
  vinculo: string;
  label: string;
  total: number;
  aprobadas: number;
  observadas: number;
  pendientes: number;
}

export interface DdPanelVigencia {
  vigentes: number;
  porVencer: number;
  vencidas: number;
  total: number;
}

export interface DdMatrizRow {
  id: string;
  empresa: DdEmpresaResumen;
  codigo: string | null;
  estado: DdEstado | null;
  tipoRelacionComercial: DdVinculo[];
  fechaAprobacion: Date | null;
  fechaVencimiento: Date | null;
  revisadoPor: string | null;
}

export interface DdPanelData {
  kpis: DdPanelKpis;
  porVinculo: DdPanelVinculo[];
  vigencia: DdPanelVigencia;
}

export interface DdMatrizParams {
  eventoId: string;
  page: number;
  perPage: number;
  search?: string;
  estado?: string;
  vinculo?: string;
  multiples?: string;
}

export interface DdMatrizResult {
  data: DdMatrizRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/** Item del catalogo maestro administrable de Debida Diligencia. */
export interface DdMaestraItem {
  tipo: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
}

/** Caso de revision reputacional con datos del expediente. */
export interface DdReputacionRow {
  id: string;
  expedienteId: string;
  codigo: string;
  empresa: DdEmpresaResumen;
  /** Vinculo de matriz; null en casos legacy. */
  vinculoId: string | null;
  vinculoTipo: string | null;
  vinculoNombre: string | null;
  vinculoDocumento: string | null;
  nombreARevisar: string;
  /** Rol o cargo del nombre dentro del expediente. */
  cargo: string | null;
  /** Nacionalidad del representante o beneficiario; null para la empresa/sin coincidencia. */
  nacionalidad: string | null;
  sitioWeb: string | null;
  estado: DdReputacionEstado;
  resultado: DdReputacionResultado | null;
  comentario: string | null;
  linkHallazgos: string | null;
  derivadoPor: string;
  fechaDerivacion: Date;
  revisor: string | null;
  fechaCierre: Date | null;
  observacionesAbiertas: number;
}

export interface DdReputacionParams {
  eventoId: string;
  page: number;
  perPage: number;
  search?: string;
  estado?: string;
  /** Fecha de envio del SIG (YYYY-MM-DD), inclusive. */
  desde?: string;
  /** Fecha de envio del SIG (YYYY-MM-DD), inclusive. */
  hasta?: string;
  orden?: DdReputacionOrden;
}

export interface DdReputacionGrupo {
  expedienteId: string;
  codigo: string;
  empresa: DdEmpresaResumen;
  casos: DdReputacionRow[];
  totalCasos: number;
  pendientes: number;
  cerrados: number;
  fechaDerivacion: Date;
}

export interface DdReputacionResult {
  data: DdReputacionGrupo[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface DdClientesParams {
  eventoId: string;
  page: number;
  perPage: number;
  search?: string;
  ruc?: string;
  estado?: string;
  resultado?: DdResultado;
  estadoEvaluacion?: DdEstadoEvaluacion;
}

export interface DdClienteEvaluacion {
  expediente: DdExpedienteEntity;
  resultado: DdResultado;
  estadoEvaluacion: DdEstadoEvaluacion | null;
  vigente: boolean;
  diasVigenciaRestantes: number | null;
  aptoParaContratar: boolean;
  alcance: string | null;
  observacionesAbiertas: number;
}

export interface DdClientesResumen {
  total: number;
  pendientes: number;
  aptos: number;
  aptosConObservaciones: number;
  noAptos: number;
  vigentes: number;
  requierenNuevaEvaluacion: number;
}

export interface DdClientesRawResult {
  data: DdExpedienteEntity[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  resumen: DdClientesResumen;
}

export interface DdClientesResult {
  data: DdClienteEvaluacion[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  resumen: DdClientesResumen;
}

export interface DdEmpresaEstadoEntity {
  id: string;
  documento: string;
  razonSocial: string;
  tipoDocumento: DdTipoDocumentoEmpresa;
  motivoEvaluacion: string | null;
  eventoProyecto: string | null;
  resultado: DdResultado;
  estadoOrigen: string;
  fechaIngreso: Date | null;
  fechaRevision: Date | null;
  fechaAprobacion: Date | null;
  fechaVencimiento: Date | null;
  declaracionVigenciaEstado: string | null;
  origen: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DdEmpresaEstadoImportData {
  documento: string;
  razonSocial: string;
  tipoDocumento: DdTipoDocumentoEmpresa;
  motivoEvaluacion: string | null;
  eventoProyecto: string | null;
  resultado: DdResultado;
  estadoOrigen: string;
  fechaIngreso: Date | null;
  fechaRevision: Date | null;
  fechaAprobacion: Date | null;
  fechaVencimiento: Date | null;
  declaracionVigenciaEstado: string | null;
}

export interface DdEmpresasParams {
  page: number;
  perPage: number;
  search?: string;
  documento?: string;
  resultado?: DdResultado;
  estadoEvaluacion?: DdEstadoEvaluacion;
  evento?: string;
}

export interface DdEmpresaEstadoItem {
  empresa: DdEmpresaEstadoEntity;
  estadoEvaluacion: DdEstadoEvaluacion | null;
  vigente: boolean;
  diasVigenciaRestantes: number | null;
  puedeReservar: boolean;
  puedeAvanzar: boolean;
  mensaje: string;
}

export interface DdEmpresasResumen {
  total: number;
  aptos: number;
  aptosConObservaciones: number;
  pendientes: number;
  noAptos: number;
  vigentes: number;
  requierenNuevaEvaluacion: number;
}

export interface DdEmpresasRawResult {
  data: DdEmpresaEstadoEntity[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  resumen: DdEmpresasResumen;
}

export interface DdEmpresasResult {
  data: DdEmpresaEstadoItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  resumen: DdEmpresasResumen;
}

export interface DdGuardarData {
  tipoRelacionComercial: DdVinculo[];
  tipoRelacionComercialOtro: string | null;
  actividadEconomica: string | null;
  actividadEconomicaOtro: string | null;
  paisConstitucion: string | null;
  sitioWeb: string | null;
  emailRepresentante: string | null;
  aceptaDatos: boolean;
  aceptaVerificacion: boolean;
  declaraVerdad: boolean;
  representanteNombre: string | null;
  representanteTipoDocumento: string | null;
  representanteDocumento: string | null;
  representanteNacionalidad: string | null;
  beneficiarios: {
    orden: number;
    nombre: string;
    documento: string;
    tipoDocumento: string | null;
    nacionalidad: string;
    porcentaje: number;
      tipoVinculoPersona: string | null;
  }[];
  documentos: { tipo: DdDocumentoTipo; nombre: string; url: string; estado: DdDocumentoEstado }[];
}

export interface DdLegalResolucionData {
  expedienteId: string;
  decision: DdAccionLegal;
  motivo: string | null;
  documentosObservados?: DdDocumentoTipo[];
  informeLegalNombre: string | null;
  informeLegalUrl: string | null;
}

export interface DdRevisionData {
  expedienteId: string;
  accion: DdAccionRevision;
  motivo: string | null;
  documentosObservados: DdDocumentoTipo[];
  observaciones: { documentoTipo: DdDocumentoTipo | null; texto: string }[];
  derivarComunicaciones: boolean;
}

export interface DdObservacionCreacion {
  area: DdObservacionArea;
  documentoTipo: DdDocumentoTipo | null;
  /** Tipo de vínculo observado; null para documentos u observación general. */
  vinculoTipo?: DdObservacionVinculoTipo | null;
  /** Beneficiario observado; null para representante o documentos. */
  beneficiarioId?: string | null;
  /** Nombre del vínculo al momento de la observación. */
  vinculoNombre?: string | null;
  texto: string;
}

/** Vinculo de matriz que puede derivarse a Comunicaciones. */
export interface DdVinculoReputacionInput {
  id: string;
  nombre: string;
  tipo: string;
  tipoDocumento: string | null;
  documento: string | null;
}

/** Datos para crear un caso reputacional derivado por Logistica. */
export interface DdReputacionCreacion {
  vinculoId: string | null;
  nombreARevisar: string;
  sitioWeb: string | null;
  derivadoPor: string;
}

export interface DdReputacionActualizacion {
  estado: DdReputacionEstado;
  resultado: DdReputacionResultado | null;
  comentario: string | null;
  linkHallazgos: string | null;
  revisor: string;
  cerrar: boolean;
}

/** Observacion de Comunicaciones; no define el dictamen de la matriz. */
export interface DdReputacionObservacionActualizacion {
  estado: DdReputacionEstado;
  /** Nulo cuando Comunicaciones solo guarda un borrador. */
  resultado: DdReputacionResultado | null;
  comentario: string | null;
  linkHallazgos: string | null;
  revisor: string;
  cerrar: boolean;
}





