/**
 * Cuerpo de POST `/api/debida-diligencia/matriz-evaluacion/exportar`.
 * Con `ids` se exportan solo esos vinculos; sin `ids` se aplican los mismos filtros de la lista.
 */
export interface DdMatrizEvaluacionExportarRequestDTO {
  ids?: string[];
  search?: string;
  tipo?: string;
  ambito?: string;
  pais?: string;
  sinPais?: boolean;
  resultadoFinal?: string;
  sinEvaluar?: boolean;
}
