import type { DdMatrizEvaluacionFilaDTO } from "./dd-matriz-evaluacion-fila.dto";

/** Respuesta paginada de la lista de la Matriz de evaluacion DD. */
export interface DdMatrizEvaluacionResponseDTO {
  data: DdMatrizEvaluacionFilaDTO[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  /** Filas automaticas creadas al sincronizar con los expedientes en esta consulta. */
  nuevas: number;
}
