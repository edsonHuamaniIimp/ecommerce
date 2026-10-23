import type { DdMatrizBloqueDTO } from "./dd-matriz-evaluacion-detalle.dto";

/** Datos de la empresa del expediente que se repiten en cada fila de la matriz oficial. */
export interface DdMatrizExportEmpresaDTO {
  razonSocial: string;
  ruc: string;
  ambito: string;
  pais: string | null;
  fechaInicioActividades: string | null;
  estadoContribuyente: string | null;
  direccionLegal: string | null;
  actividadEconomica: string | null;
  motivo: string | null;
  eventoProyecto: string | null;
  historialIimp: string | null;
  beneficioMutuo: string | null;
  /** Respuestas de las listas de la fila de la empresa (codigo -> si/no/na). */
  listas: Record<string, string>;
}

/** Vinculo evaluado (la empresa o una persona ligada a ella). */
export interface DdMatrizExportVinculoDTO {
  tipo: string;
  nombre: string;
  tipoDocumento: string | null;
  documento: string | null;
  nacionalidad: string | null;
  cargo: string | null;
  ambito: string;
  pais: string | null;
  listas: Record<string, string>;
  sig: DdMatrizBloqueDTO;
  reputacional: DdMatrizBloqueDTO;
  compliance: DdMatrizBloqueDTO;
  resultadoFinal: string | null;
}

/** Una fila de la exportacion en el formato de la matriz oficial de Asociados. */
export interface DdMatrizEvaluacionExportFilaDTO {
  expedienteCodigo: string;
  fechaIngreso: string;
  fechaRevisionExpediente: string | null;
  revisadoPor: string | null;
  empresa: DdMatrizExportEmpresaDTO;
  vinculo: DdMatrizExportVinculoDTO;
}

export interface DdMatrizEvaluacionExportarResponseDTO {
  data: DdMatrizEvaluacionExportFilaDTO[];
  total: number;
}
