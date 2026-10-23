/** Filtros de la lista de la Matriz de evaluacion DD. */
export interface DdMatrizEvaluacionQueryDTO {
  page?: number;
  perPage?: number;
  search?: string;
  tipo?: string;
  ambito?: string;
  /** Pais ISO alpha-2 exacto. */
  pais?: string;
  /** Solo vinculos sin pais conocido. */
  sinPais?: boolean;
  resultadoFinal?: string;
  sinEvaluar?: boolean;
}
