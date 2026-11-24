import type {
  DdMatrizAdjuntoCategoria,
  DdMatrizAmbito,
  DdMatrizOrigen,
  DdMatrizTipoVinculo,
} from "@/lib/shared/constants";

/** Respuesta por lista restrictiva: { codigo de lista: "si" | "no" | "na" }. */
export type DdMatrizListasValor = Record<string, string>;
/** Observacion del analista por criterio: { codigo de lista: texto }. */
export type DdMatrizListasObservacion = Record<string, string>;

/** Bloque de conclusiones de un area (SIG, Reputacional o Compliance). */
export interface DdMatrizBloque {
  fecha: Date | null;
  responsable: string | null;
  resultado: string | null;
  observaciones: string | null;
  conclusion: string | null;
}

export interface DdMatrizAdjuntoEntity {
  id: string;
  vinculoId: string;
  categoria: DdMatrizAdjuntoCategoria;
  nombre: string;
  url: string;
  mimeType: string;
  tamano: number;
  creadoPor: string;
  createdAt: Date;
}

/** Datos generales de la empresa que se capturan a mano (solo vinculo de tipo empresa). */
export interface DdMatrizGenerales {
  fechaInicioActividades: Date | null;
  estadoContribuyente: string | null;
  direccionLegal: string | null;
  actividadEconomica: string | null;
  motivo: string | null;
  eventoProyecto: string | null;
  historialIimp: string | null;
  beneficioMutuo: string | null;
}

/** Contexto del expediente que acompana a cada vinculo (solo lectura). */
export interface DdMatrizExpedienteContexto {
  expedienteId: string;
  eventoId: string;
  eventoLabel: string;
  codigo: string;
  estado: string;
  empresaRazonSocial: string;
  empresaRuc: string;
  empresaDireccionFiscal: string | null;
  /** Pais ISO de la empresa (Empresa.pais). */
  empresaPais: string;
  paisConstitucion: string | null;
  actividadEconomica: string | null;
  tipoRelacionComercial: string[];
  motivo: string | null;
  eventoProyecto: string | null;
  fechaIngreso: Date;
  revisadoPor: string | null;
  fechaRevision: Date | null;
  /** Decision de Legal sobre el expediente (aprobar / observar / rechazar), si ya dictamino. */
  decisionLegal?: string | null;
}

export interface DdMatrizVinculoEntity extends DdMatrizGenerales {
  id: string;
  tipo: DdMatrizTipoVinculo;
  refKey: string;
  origen: DdMatrizOrigen;
  nombre: string;
  tipoDocumento: string | null;
  documento: string | null;
  nacionalidad: string | null;
  cargo: string | null;
  ambito: DdMatrizAmbito;
  ambitoEditado: boolean;
  /** Pais ISO alpha-2; null si no se conoce. */
  pais: string | null;
  paisEditado: boolean;
  /** true si SIG completo/corrigio la identidad de una fila automatica. */
  identidadEditada: boolean;
  listas: DdMatrizListasValor;
  listasObservaciones: DdMatrizListasObservacion;
  sig: DdMatrizBloque;
  reputacional: DdMatrizBloque;
  compliance: DdMatrizBloque;
  resultadoFinal: string | null;
  finalFecha: Date | null;
  finalPor: string | null;
  finalComentario: string | null;
  creadoPor: string;
  actualizadoPor: string | null;
  createdAt: Date;
  updatedAt: Date;
  expediente: DdMatrizExpedienteContexto;
}

/** Fila resumida de la lista de la matriz. */
export interface DdMatrizFilaEntity {
  id: string;
  tipo: DdMatrizTipoVinculo;
  origen: DdMatrizOrigen;
  nombre: string;
  tipoDocumento: string | null;
  documento: string | null;
  ambito: DdMatrizAmbito;
  pais: string | null;
  cargo: string | null;
  sigResultado: string | null;
  sigConclusion: string | null;
  sigFecha: Date | null;
  repResultado: string | null;
  repConclusion: string | null;
  repFecha: Date | null;
  cmpResultado: string | null;
  cmpConclusion: string | null;
  cmpFecha: Date | null;
  resultadoFinal: string | null;
  finalFecha: Date | null;
  reputacionCasos: number;
  reputacionPendientes: number;
  reputacionEnAnalisis: number;
  reputacionConHallazgos: number;
  updatedAt: Date;
  expediente: Pick<
    DdMatrizExpedienteContexto,
    | "expedienteId"
    | "eventoId"
    | "eventoLabel"
    | "codigo"
    | "estado"
    | "empresaRazonSocial"
    | "empresaRuc"
    | "motivo"
    | "eventoProyecto"
    | "fechaIngreso"
  >;
}

export interface DdMatrizListarParams {
  eventoId?: string;
  /** Filtra una sola DD; se usa en el resumen por vínculo del modal de revisión. */
  expedienteId?: string;
  page: number;
  perPage: number;
  search?: string;
  tipo?: DdMatrizTipoVinculo;
  ambito?: DdMatrizAmbito;
  /** Pais ISO alpha-2; varios separados por coma. */
  pais?: string;
  /** Fecha de ingreso desde/hasta (AAAA-MM-DD, hora de Peru, ambos inclusive). */
  fechaDesde?: string;
  fechaHasta?: string;
  /** Solo vinculos sin pais conocido. */
  sinPais?: boolean;
  resultadoFinal?: string;
  /** Solo filas sin ningun resultado final registrado. */
  sinEvaluar?: boolean;
  /** Si es true, la pagina cuenta expedientes/empresas y devuelve todos sus sujetos. */
  porEmpresa?: boolean;
}

/** Pais con vinculos en el evento y cuantos (opciones del filtro de pais). */
export interface DdMatrizPaisFacet {
  pais: string;
  total: number;
}

export interface DdMatrizListarResult {
  data: DdMatrizFilaEntity[];
  total: number;
  /** Paises presentes en el evento (sin aplicar los filtros), de mas a menos vinculos. */
  paises: DdMatrizPaisFacet[];
}

/** Conteo por valor (null = sin dato). */
export interface DdMatrizConteo {
  valor: string | null;
  total: number;
}

/** Indicadores de la matriz del evento activo (todos los vinculos enviados). */
export interface DdMatrizResumenEntity {
  empresas: number;
  total: number;
  resultadoFinal: DdMatrizConteo[];
  /** Resultado final de la DD por empresa (expediente): el del vinculo titular. */
  resultadoFinalEmpresas: DdMatrizConteo[];
  ambito: DdMatrizConteo[];
  tipo: DdMatrizConteo[];
  paises: DdMatrizPaisFacet[];
  /** Resultado de la evaluacion por area (aceptado / observado / no_aplica / null = pendiente). */
  sig: DdMatrizConteo[];
  reputacional: DdMatrizConteo[];
  compliance: DdMatrizConteo[];
  /** SIG concluyo REQUIERE DEBIDA DILIGENCIA REFORZADA. */
  requierenReforzada: number;
  /** De esos, los que Compliance aun no evaluo. */
  pendientesCompliance: number;
  /** Final, SIG o reputacional en EN REVISION. */
  enRevision: number;
}

/** Filtros de la exportacion: ids elegidos o los mismos filtros de la lista. */
export interface DdMatrizExportarParams extends Omit<DdMatrizListarParams, "page" | "perPage"> {
  /** Si viene, se exportan solo estos vinculos (y se ignoran los demas filtros). */
  ids?: string[];
}

/** Vinculo completo y la fila de su empresa (aporta los datos generales). */
export interface DdMatrizExportItem {
  vinculo: DdMatrizVinculoEntity;
  empresa: DdMatrizVinculoEntity | null;
}

/** Cambios parciales sobre un vinculo; solo se persisten los campos presentes. */
export interface DdMatrizVinculoCambios {
  nombre?: string;
  tipoDocumento?: string | null;
  documento?: string | null;
  nacionalidad?: string | null;
  cargo?: string | null;
  ambito?: DdMatrizAmbito;
  ambitoEditado?: boolean;
  pais?: string | null;
  paisEditado?: boolean;
  identidadEditada?: boolean;
  generales?: Partial<DdMatrizGenerales>;
  listas?: DdMatrizListasValor;
  listasObservaciones?: DdMatrizListasObservacion;
  sig?: Partial<DdMatrizBloque>;
  reputacional?: Partial<DdMatrizBloque>;
  compliance?: Partial<DdMatrizBloque>;
  resultadoFinal?: string | null;
  finalFecha?: Date | null;
  finalPor?: string | null;
  finalComentario?: string | null;
  actualizadoPor: string;
}

export interface DdMatrizVinculoManual {
  expedienteId: string;
  tipo: DdMatrizTipoVinculo;
  nombre: string;
  tipoDocumento: string | null;
  documento: string | null;
  nacionalidad: string | null;
  cargo: string | null;
  ambito: DdMatrizAmbito;
  pais: string | null;
  paisEditado: boolean;
  creadoPor: string;
}

export interface DdMatrizAdjuntoCreacion {
  vinculoId: string;
  categoria: DdMatrizAdjuntoCategoria;
  nombre: string;
  url: string;
  mimeType: string;
  tamano: number;
  creadoPor: string;
}
