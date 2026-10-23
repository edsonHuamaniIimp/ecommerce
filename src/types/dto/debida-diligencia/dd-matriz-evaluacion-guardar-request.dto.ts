/** Bloque editable de un area; los valores aceptan etiqueta de negocio o codigo. */
export interface DdMatrizBloqueRequestDTO {
  /** Fecha de evaluacion (YYYY-MM-DD); si no se envia se registra la de hoy. */
  fecha?: string | null;
  /** Responsable; si no se envia se registra el usuario que guarda. */
  responsable?: string | null;
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
    /** Pais (ISO, nombre o gentilicio); vacio vuelve al valor automatico. */
    pais?: string | null;
  };
  generales?: {
    fechaInicioActividades?: string | null;
    estadoContribuyente?: string | null;
    direccionLegal?: string | null;
    actividadEconomica?: string | null;
    motivo?: string | null;
    eventoProyecto?: string | null;
    historialIimp?: string | null;
    beneficioMutuo?: string | null;
  };
  listas?: Record<string, string | null>;
  sig?: DdMatrizBloqueRequestDTO;
  reputacional?: DdMatrizBloqueRequestDTO;
  compliance?: DdMatrizBloqueRequestDTO;
  resultadoFinal?: string | null;
  /** Fecha del resultado final (YYYY-MM-DD); si no se envia se registra la de hoy. */
  finalFecha?: string | null;
  /** Quien registra el resultado final; si no se envia se registra el usuario que guarda. */
  finalPor?: string | null;
}
