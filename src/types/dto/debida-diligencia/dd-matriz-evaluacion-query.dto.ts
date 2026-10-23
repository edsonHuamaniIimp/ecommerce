/** Filtros de la lista de la Matriz de evaluacion DD. */
export interface DdMatrizEvaluacionQueryDTO {
  page?: number;
  perPage?: number;
  search?: string;
  tipo?: string;
  ambito?: string;
  resultadoFinal?: string;
  sinEvaluar?: boolean;
}
