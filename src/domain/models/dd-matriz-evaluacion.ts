import type {
  DdMatrizAdjuntoCategoria,
  DdMatrizAmbito,
  DdMatrizOrigen,
  DdMatrizTipoVinculo,
} from "@/lib/shared/constants";

/** Respuesta por lista restrictiva: { codigo de lista: "si" | "no" | "na" }. */
export type DdMatrizListasValor = Record<string, string>;

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
  historialIimp: string | null;
  beneficioMutuo: string | null;
}

/** Contexto del expediente que acompana a cada vinculo (solo lectura). */
export interface DdMatrizExpedienteContexto {
  expedienteId: string;
  codigo: string;
  estado: string;
  empresaRazonSocial: string;
  empresaRuc: string;
  empresaDireccionFiscal: string | null;
  paisConstitucion: string | null;
  actividadEconomica: string | null;
  tipoRelacionComercial: string | null;
  motivo: string | null;
  eventoProyecto: string | null;
  fechaIngreso: Date;
  revisadoPor: string | null;
  fechaRevision: Date | null;
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
  listas: DdMatrizListasValor;
  sig: DdMatrizBloque;
  reputacional: DdMatrizBloque;
  compliance: DdMatrizBloque;
  resultadoFinal: string | null;
  finalFecha: Date | null;
  finalPor: string | null;
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
  cargo: string | null;
  sigResultado: string | null;
  sigConclusion: string | null;
  repResultado: string | null;
  repConclusion: string | null;
  cmpResultado: string | null;
  cmpConclusion: string | null;
  resultadoFinal: string | null;
  updatedAt: Date;
  expediente: Pick<
    DdMatrizExpedienteContexto,
    "expedienteId" | "codigo" | "empresaRazonSocial" | "empresaRuc" | "motivo" | "eventoProyecto" | "fechaIngreso"
  >;
}

export interface DdMatrizListarParams {
  eventoId: string;
  page: number;
  perPage: number;
  search?: string;
  tipo?: DdMatrizTipoVinculo;
  ambito?: DdMatrizAmbito;
  resultadoFinal?: string;
  /** Solo filas sin ningun resultado final registrado. */
  sinEvaluar?: boolean;
}

export interface DdMatrizListarResult {
  data: DdMatrizFilaEntity[];
  total: number;
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
  generales?: Partial<DdMatrizGenerales>;
  listas?: DdMatrizListasValor;
  sig?: Partial<DdMatrizBloque>;
  reputacional?: Partial<DdMatrizBloque>;
  compliance?: Partial<DdMatrizBloque>;
  resultadoFinal?: string | null;
  finalFecha?: Date | null;
  finalPor?: string | null;
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
