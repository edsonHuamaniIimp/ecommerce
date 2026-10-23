/** Cuerpo de POST `/api/debida-diligencia/matriz-evaluacion/vinculo` (agregar vinculo manual). */
export interface DdMatrizEvaluacionVinculoRequestDTO {
  expedienteId: string;
  tipo: string;
  nombre: string;
  tipoDocumento?: string | null;
  documento?: string | null;
  nacionalidad?: string | null;
  cargo?: string | null;
  /** Si no se envia se deriva de la nacionalidad / tipo de documento. */
  ambito?: string;
}
