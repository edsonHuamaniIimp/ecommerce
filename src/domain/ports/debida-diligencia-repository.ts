import type {
  DdBandejaParams,
  DdBandejaResult,
  DdClientesParams,
  DdClientesRawResult,
  DdEmpresaEstadoImportData,
  DdEmpresasParams,
  DdEmpresasRawResult,
  DdEmpresaEstadoEntity,
  DdEmpresaResumen,
  DdExpedienteEntity,
  DdGuardarData,
  DdMatrizParams,
  DdMatrizResult,
  DdObservacionCreacion,
  DdObservacionEntity,
  DdPanelKpis,
  DdPanelVinculo,
  DdReputacionActualizacion,
  DdReputacionCreacion,
  DdReputacionParams,
  DdReputacionResult,
  DdRevisionData,
} from "@/domain/models/debida-diligencia";
import type { DdDocumentoTipo, DdEstado } from "@/lib/shared/constants";

/** Estado al que se lleva un expediente luego de una revision. */
export interface DdEstadoExpedienteData {
  estado: DdEstado;
  fechaEnvio?: Date | null;
  fechaRevision?: Date | null;
  fechaAprobacion?: Date | null;
  fechaVencimiento?: Date | null;
  fechaRechazo?: Date | null;
  revisadoPor?: string | null;
  motivoRechazo?: string | null;
  fechaDerivacionLegal?: Date | null;
  derivadoLegalPor?: string | null;
  informeLogisticaUrl?: string | null;
  fechaLegal?: Date | null;
  legalRevisor?: string | null;
  decisionLegal?: string | null;
  motivoLegal?: string | null;
  informeLegalNombre?: string | null;
  informeLegalUrl?: string | null;
  actualizadoPor?: string | null;
}

export interface IDebidaDiligenciaRepository {
  /** Expediente completo de una empresa en un evento (null si aun no existe). */
  findExpedientePorEmpresaEvento(empresaId: string, eventoId: string): Promise<DdExpedienteEntity | null>;
  /** Expediente por id con empresa, evento, documentos, beneficiarios y observaciones. */
  findExpedientePorId(id: string): Promise<DdExpedienteEntity | null>;
  /** Empresa resumida para el formulario y las bandejas. */
  findEmpresaResumen(empresaId: string): Promise<DdEmpresaResumen | null>;
  /** Empresa por razon social exacta (fallback para solicitudes historicas). */
  findEmpresaIdPorRazonSocial(razonSocial: string): Promise<string | null>;
  /** Estado externo por documento o razon social (bypass de DD manual). */
  findEmpresaEstado(
    documento: string | null,
    razonSocial: string | null,
  ): Promise<DdEmpresaEstadoEntity | null>;
  /** Siguiente correlativo visible del expediente (DD-AAAA-NNNN). */
  siguienteCodigo(anio: string): Promise<string>;
  /** Crea el expediente en borrador. */
  crearExpediente(data: {
    empresaId: string;
    eventoId: string;
    codigo: string;
    creadoPor: string;
  }): Promise<DdExpedienteEntity>;
  /** Crea/actualiza un expediente importado (migracion manual). */
  importarExpediente(data: {
    empresaId: string;
    eventoId: string;
    codigo: string;
    estado: string;
    estadoOrigen: string | null;
    eventoProyecto: string | null;
    motivoImportacion: string | null;
    importacionId: string;
    creadoPor: string;
    actualizadoPor: string;
    fechaEnvio: Date | null;
    fechaRevision: Date | null;
    fechaAprobacion: Date | null;
    fechaVencimiento: Date | null;
    fechaRechazo: Date | null;
  }): Promise<{ id: string; creado: boolean }>;
  /** Crea el lote de importacion para trazabilidad. */
  crearImportacion(data: {
    archivo: string;
    hash: string;
    eventoId: string;
    usuario: string;
    total: number;
    omitidos: number;
    errores: unknown;
  }): Promise<string>;
  /** Cierra el lote con los conteos finales. */
  cerrarImportacion(id: string, importados: number, actualizados: number, omitidos: number): Promise<void>;
  /** Guarda en una sola transaccion el formulario, beneficiarios y documentos. */
  guardarFormulario(id: string, data: DdGuardarData, actualizadoPor: string): Promise<DdExpedienteEntity>;
  /** Marca los documentos seleccionados como observados y el resto como aprobados. */
  resolverDocumentos(
    expedienteId: string,
    observados: DdDocumentoTipo[],
    observacion: string | null,
  ): Promise<void>;
  /** Observaciones abiertas del expediente. */
  listarObservaciones(expedienteId: string): Promise<DdObservacionEntity[]>;
  /** Crea las observaciones de una revision. */
  crearObservaciones(
    expedienteId: string,
    observaciones: DdObservacionCreacion[],
    creadoPor: string,
  ): Promise<void>;
  /** Cierra las observaciones abiertas (el cliente corrigio y reenvio). */
  resolverObservaciones(expedienteId: string): Promise<void>;
  /** Actualiza el estado del expediente y sus fechas de workflow. */
  actualizarEstado(id: string, data: DdEstadoExpedienteData): Promise<DdExpedienteEntity>;
  /** Bandeja paginada de Logistica. */
  listarBandeja(params: DdBandejaParams): Promise<DdBandejaResult>;
  /** KPIs del panel del modulo para el evento. */
  resumenPanel(eventoId: string): Promise<{
    kpis: DdPanelKpis;
    porVinculo: DdPanelVinculo[];
    vigencia: { vigentes: number; porVencer: number; vencidas: number; total: number };
  }>;
  /** Matriz paginada de empresas (incluye empresas sin expediente). */
  listarMatriz(params: DdMatrizParams): Promise<DdMatrizResult>;
  /** Clientes con evaluacion de debida diligencia, filtrables por resultado y vigencia. */
  listarClientes(params: DdClientesParams): Promise<DdClientesRawResult>;
  listarEmpresasEstados(params: DdEmpresasParams): Promise<DdEmpresasRawResult>;
  upsertEmpresasEstados(rows: DdEmpresaEstadoImportData[]): Promise<{ importados: number; actualizados: number }>;
  /** Crea los casos reputacionales que aun no existan. */
  crearCasosReputacion(expedienteId: string, casos: DdReputacionCreacion[]): Promise<void>;
  /** Bandeja paginada de revision reputacional. */
  listarReputacion(params: DdReputacionParams): Promise<DdReputacionResult>;
  /** Actualiza un caso reputacional. */
  actualizarReputacion(id: string, data: DdReputacionActualizacion): Promise<{ derivadoPor: string }>;
  /** Revisa si el expediente ya tiene casos reputacionales. */
  tieneCasosReputacion(expedienteId: string): Promise<boolean>;
  /** Registra en auditoria una accion del modulo. */
  registrarAuditoria(accion: string, entidad: string, actor: string, mensaje: string): Promise<void>;
}

export type { DdRevisionData };
