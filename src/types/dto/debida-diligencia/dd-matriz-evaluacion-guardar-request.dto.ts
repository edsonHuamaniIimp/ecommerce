/** Bloque editable de un area; los valores aceptan etiqueta de negocio o codigo. */
export interface DdMatrizBloqueRequestDTO {
  resultado?: string | null;
  observaciones?: string | null;
  conclusion?: string | null;
}

/**
 * Cuerpo de POST `/api/debida-diligencia/matriz-evaluacion/guardar`.
 * Solo se procesan las secciones presentes; cada una exige el permiso de su area.
 */
export interface DdMatrizEvaluacionGuardarRequestDTO {
  id: string;
  identidad?: {
    nombre?: string;
    tipoDocumento?: string | null;
    documento?: string | null;
    nacionalidad?: string | null;
    cargo?: string | null;
    ambito?: string;
  };
  generales?: {
    fechaInicioActividades?: string | null;
    estadoContribuyente?: string | null;
    direccionLegal?: string | null;
    historialIimp?: string | null;
    beneficioMutuo?: string | null;
  };
  listas?: Record<string, string | null>;
  sig?: DdMatrizBloqueRequestDTO;
  reputacional?: DdMatrizBloqueRequestDTO;
  compliance?: DdMatrizBloqueRequestDTO;
  resultadoFinal?: string | null;
}
