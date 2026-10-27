import type { DdEstadoEvaluacion, DdResultado } from "@/lib/shared/constants";

/** Estado consolidado del registro externo/manual de DD. */
export interface DdEstadoExternoDTO {
  resultado: DdResultado;
  estadoEvaluacion: DdEstadoEvaluacion | null;
  vigente: boolean;
  aptoParaContratar: boolean;
  fechaVencimiento: string | null;
  origen: string;
}

/** Datos de la empresa que acompanan al expediente de debida diligencia. */
export interface DdEmpresaDTO {
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

export interface DdEventoDTO {
  id: string;
  nombre: string;
  anio: string;
}

export interface DdBeneficiarioDTO {
  id: string;
  orden: number;
  nombre: string;
  documento: string;
  nacionalidad: string;
  porcentaje: number;
}

export interface DdDocumentoVersionDTO {
  id: string;
  version: number;
  nombre: string;
  url: string;
  creadoPor: string | null;
  createdAt: string;
}

export interface DdDocumentoDTO {
  id: string;
  tipo: string;
  nombre: string;
  url: string;
  estado: string;
  observacion: string | null;
  updatedAt: string;
  versiones: DdDocumentoVersionDTO[];
}

export interface DdObservacionDTO {
  id: string;
  area: string;
  documentoTipo: string | null;
  texto: string;
  estado: string;
  creadoPor: string;
  fechaResolucion: string | null;
  createdAt: string;
}

export interface DdReputacionCasoDTO {
  id: string;
  nombreARevisar: string;
  /** Nacionalidad del representante o beneficiario; null para la empresa/sin coincidencia. */
  nacionalidad: string | null;
  sitioWeb: string | null;
  estado: string;
  resultado: string | null;
  comentario: string | null;
  linkHallazgos: string | null;
  derivadoPor: string;
  fechaDerivacion: string;
  revisor: string | null;
  fechaCierre: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Expediente completo del formulario y de la vista de estado. */
export interface DdExpedienteDTO {
  id: string;
  empresaId: string;
  eventoId: string;
  codigo: string;
  estado: string;
  origen: string;
  estadoOrigen: string | null;
  eventoProyecto: string | null;
  motivoImportacion: string | null;
  importacionId: string | null;
  tipoRelacionComercial: string[];
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
  fechaEnvio: string | null;
  fechaRevision: string | null;
  fechaAprobacion: string | null;
  fechaVencimiento: string | null;
  fechaRechazo: string | null;
  revisadoPor: string | null;
  motivoRechazo: string | null;
  fechaDerivacionLegal: string | null;
  derivadoLegalPor: string | null;
  informeLogisticaUrl: string | null;
  fechaLegal: string | null;
  legalRevisor: string | null;
  decisionLegal: string | null;
  motivoLegal: string | null;
  informeLegalNombre: string | null;
  informeLegalUrl: string | null;
  creadoPor: string;
  actualizadoPor: string | null;
  createdAt: string;
  updatedAt: string;
  empresa: DdEmpresaDTO;
  evento: DdEventoDTO;
  beneficiarios: DdBeneficiarioDTO[];
  documentos: DdDocumentoDTO[];
  /** La DD aprobada/vigente depende de validar la declaracion de vigencia. */
  requiereRevalidacion: boolean;
  /** Estado del documento declaracion_vigencia; null si aun no existe. */
  declaracionVigenciaEstado: string | null;
  observaciones: DdObservacionDTO[];
  reputacion: DdReputacionCasoDTO[];
}

/** Respuesta de "Mi debida diligencia": expediente de la empresa del usuario. */
export interface DdMiExpedienteDTO {
  expediente: DdExpedienteDTO | null;
  empresa: DdEmpresaDTO | null;
  estadoExterno: DdEstadoExternoDTO | null;
  /** La DD mostrada pertenece a otro evento distinto del evento activo. */
  esOtroEvento: boolean;
  /** Obligatoria cuando la empresa mantiene una DD importada vigente. */
  requiereDeclaracionVigencia: boolean;
  /** DD vigente de otro evento sin la declaracion de vigencia. */
  puedeRegularizarDeclaracionVigencia: boolean;
  /** Estado del documento declaracion_vigencia; null si aun no existe. */
  declaracionVigenciaEstado: string | null;
}
