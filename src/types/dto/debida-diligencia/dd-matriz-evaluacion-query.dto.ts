/** Filtros de la lista de la Matriz de evaluacion DD. */
export interface DdMatrizEvaluacionQueryDTO {
  eventoId?: string;
  /** Filtra una sola DD; usado por el resumen por vínculo del modal de revisión. */
  expedienteId?: string;
  page?: number;
  perPage?: number;
  search?: string;
  tipo?: string;
  ambito?: string;
  /** Pais ISO alpha-2; varios separados por coma (ej. "PE,US"). */
  pais?: string;
  /** Fecha de ingreso (envio de la DD) desde, AAAA-MM-DD hora de Peru, inclusive. */
  fechaDesde?: string;
  /** Fecha de ingreso hasta, AAAA-MM-DD hora de Peru, inclusive. */
  fechaHasta?: string;
  /** Solo vinculos sin pais conocido. */
  sinPais?: boolean;
  resultadoFinal?: string;
  sinEvaluar?: boolean;
  /** Pagina por expediente/empresa y devuelve todos sus sujetos evaluados. */
  porEmpresa?: boolean;
}
