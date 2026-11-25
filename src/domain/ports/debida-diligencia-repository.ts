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
  DdHistorialCreacion,
  DdHistorialEventoEntity,
  DdMaestraItem,
  DdMatrizParams,
  DdMatrizResult,
  DdMisExpedientesParams,
  DdMisExpedientesResult,
  DdObservacionCreacion,
  DdObservacionEntity,
  DdPanelKpis,
  DdPanelVinculo,
  DdReputacionActualizacion,
  DdReputacionCreacion,
  DdReputacionObservacionActualizacion,
  DdReputacionParams,
  DdReputacionResult,
  DdRevisionData,
  DdVinculoReputacionInput,
} from "@/domain/models/debida-diligencia";
import type { DdDocumentoEstado, DdDocumentoTipo, DdEstado } from "@/lib/shared/constants";

/** Conclusion final de la matriz (fila de empresa) que evalua el cierre automatico. */
export interface DdConclusionMatrizCierre {
  expedienteId: string;
  /** Guardada en la matriz; null = la matriz la deriva del estado del expediente. */
  resultadoFinal: string | null;
  finalFecha: Date | null;
  estadoExpediente: string;
  fechaRevision: Date | null;
  /**
   * Observaciones registradas en el sistema (SIG o Legal). 0 = nunca se observo en la plataforma
   * (p. ej. importado del Excel como DOCUMENTACION OBSERVADA): el cliente no fue notificado.
   */
  observacionesRegistradas: number;
}

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
  /** Ultimo expediente de una empresa en un evento (null si aun no existe). */
  findExpedientePorEmpresaEvento(empresaId: string, eventoId: string): Promise<DdExpedienteEntity | null>;
  /** Ultima DD aprobada y vigente de una empresa, sin importar el evento. */
  findExpedienteAprobadoVigentePorEmpresa(
    empresaId: string,
    ahora: Date,
  ): Promise<DdExpedienteEntity | null>;
  /** Indica si la empresa tiene una DD importada aprobada y vigente. */
  tieneExpedienteImportadoAprobadoVigente(empresaId: string, ahora: Date): Promise<boolean>;
  /** Ultima DD aprobada y vigente de una empresa en un evento, para contratacion. */
  findExpedienteAprobadoVigentePorEmpresaEvento(
    empresaId: string,
    eventoId: string,
    ahora: Date,
  ): Promise<DdExpedienteEntity | null>;
  /** Expediente por id con empresa, evento, documentos, beneficiarios y observaciones. */
  findExpedientePorId(id: string): Promise<DdExpedienteEntity | null>;
  /** Historial paginado de DD de una empresa, con filtros de estado/evento. */
  listarMisExpedientes(params: DdMisExpedientesParams): Promise<DdMisExpedientesResult>;
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
  /** Actualiza solo la declaracion de vigencia, sin tocar el estado de la DD. */
  marcarDeclaracionVigencia(
    expedienteId: string,
    estado: DdDocumentoEstado,
    observacion: string | null,
  ): Promise<void>;
  /** Resuelve las observaciones abiertas de un tipo de documento. */
  resolverObservacionesDocumento(
    expedienteId: string,
    documentoTipo: DdDocumentoTipo,
  ): Promise<void>;
  /** Observaciones abiertas del expediente. */
  listarObservaciones(expedienteId: string): Promise<DdObservacionEntity[]>;
  /** Crea las observaciones de una revision. */
  crearObservaciones(
    expedienteId: string,
    observaciones: DdObservacionCreacion[],
    creadoPor: string,
  ): Promise<void>;
  /** Crea o actualiza la observacion abierta de un documento. */
  guardarObservacionDocumento(
    expedienteId: string,
    documentoTipo: DdDocumentoTipo,
    texto: string,
    creadoPor: string,
  ): Promise<void>;
  /** Cierra las observaciones abiertas (el cliente corrigio y reenvio). */
  resolverObservaciones(expedienteId: string): Promise<void>;
  /** Registra un evento del historial visible del expediente. */
  registrarHistorial(expedienteId: string, data: DdHistorialCreacion): Promise<void>;
  /** Eventos persistidos del historial, en orden cronologico ascendente. */
  listarHistorial(expedienteId: string): Promise<DdHistorialEventoEntity[]>;
  /** Actualiza el estado del expediente y sus fechas de workflow. */
  actualizarEstado(id: string, data: DdEstadoExpedienteData): Promise<DdExpedienteEntity>;
  /**
   * Conclusion final de la fila de empresa de la matriz de expedientes abiertos que pueden estar
   * en DOCUMENTACION OBSERVADA y con al menos una observacion registrada en el sistema
   * (prefiltro; el servicio confirma con resultadoFinalEfectivo).
   * Con `limite`, solo las que llevan desde esa fecha o antes; con `expedienteIds`, solo esos.
   */
  listarConclusionesMatrizCierre(params: {
    limite?: Date;
    expedienteIds?: string[];
    max: number;
  }): Promise<DdConclusionMatrizCierre[]>;
  /** Registra la conclusion final en la fila de empresa de la matriz (cierre automatico). */
  registrarResultadoFinalMatriz(
    expedienteId: string,
    data: { resultadoFinal: string; comentario: string | null; actor: string; fecha: Date },
  ): Promise<void>;
  /** Refleja la decisión legal en la fila de empresa de la matriz. */
  actualizarLegalMatriz(
    expedienteId: string,
    data: {
      resultado: string;
      conclusion: string;
      observaciones: string | null;
      responsable: string;
      fecha: Date;
      cierreFinal?: {
        resultadoFinal: string;
        comentario: string | null;
      };
    },
  ): Promise<void>;
  /** Registra si SIG declaro revisados y completos todos los vinculos. */
  marcarVinculosCompletos(expedienteId: string, completos: boolean, usuario: string): Promise<void>;
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
  /** Catalogo maestro DD, opcionalmente filtrado por tipo. */
  listarMaestraDd(tipos?: string[]): Promise<DdMaestraItem[]>;
  /** Vinculos de matriz del expediente que pueden tener dictamen reputacional. */
  listarVinculosReputacion(expedienteId: string): Promise<DdVinculoReputacionInput[]>;
  /** IDs de vinculos que ya tienen un caso reputacional. */
  listarVinculosConCasoReputacion(expedienteId: string): Promise<string[]>;
  /** Bandeja paginada de revision reputacional. */
  listarReputacion(params: DdReputacionParams): Promise<DdReputacionResult>;
  /** Marca un caso reputacional como en revision si aun no tiene dictamen. */
  iniciarReputacion(
    id: string,
    revisor: string,
  ): Promise<{ estado: string; vinculoId: string | null } | null>;
  /** Guarda la observacion de Comunicaciones sin escribir el dictamen de matriz. */
  actualizarObservacionReputacion(
    id: string,
    data: DdReputacionObservacionActualizacion,
  ): Promise<{ derivadoPor: string; vinculoId: string | null }>;
  /** Actualiza un caso reputacional. */
  actualizarReputacion(id: string, data: DdReputacionActualizacion): Promise<{ derivadoPor: string; vinculoId: string | null }>;
  /**
   * Refleja las observaciones de Comunicaciones en la fila de matriz. Si el resultado es aceptado y SIG
   * aun no definio la conclusion reputacional, la deja en "sin observaciones" por defecto.
   */
  actualizarObservacionMatriz(
    vinculoId: string,
    data: { resultado: string; observaciones: string | null; responsable: string; fecha: Date },
  ): Promise<void>;
  /** Refleja el dictamen de Comunicaciones en la fila de matriz. */
  actualizarDictamenMatriz(
    vinculoId: string,
    data: {
      resultado: string;
      conclusion: string;
      observaciones: string | null;
      responsable: string;
      fecha: Date;
    },
  ): Promise<void>;
  /** Indica si la empresa tiene al menos un vinculo con resultado final NO APTO. */
  tieneVinculoNoApto(empresaId: string): Promise<boolean>;
  /** Igual que tieneVinculoNoApto, buscando por RUC/documento de la empresa. */
  tieneVinculoNoAptoPorDocumento(documento: string): Promise<boolean>;
  /** Nombres de todos los vinculos de la matriz del expediente. */
  listarNombresMatriz(expedienteId: string): Promise<string[]>;
  /** Nombres que ya tienen un caso reputacional en el expediente. */
  listarNombresReputacion(expedienteId: string): Promise<string[]>;
  /** Revisa si el expediente ya tiene casos reputacionales. */
  tieneCasosReputacion(expedienteId: string): Promise<boolean>;
  /** Registra en auditoria una accion del modulo. */
  /**
   * Pasa la DD de "Documentacion recibida" a "En revision" (SIG empezo a trabajarla).
   * No hace nada si ya esta en revision o mas adelante: nunca retrocede. true si hubo cambio.
   */
  iniciarRevisionSiRecibida(expedienteId: string, actor: string, motivo: string): Promise<boolean>;
  registrarAuditoria(accion: string, entidad: string, actor: string, mensaje: string): Promise<void>;
}

export type { DdRevisionData };

