/** Cuerpo de POST `/api/debida-diligencia/matriz-evaluacion/adjunto/observacion`. */
export interface DdMatrizEvaluacionAdjuntoObservacionRequestDTO {
  id: string;
  /** Texto de la observacion; vacio o null la limpia. */
  observacion: string | null;
}
