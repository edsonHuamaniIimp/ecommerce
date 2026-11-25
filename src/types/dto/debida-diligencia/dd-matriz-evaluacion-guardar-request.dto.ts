import type { DdObservacionVinculoTipo } from "@/lib/shared/constants";

/** Vínculo marcado para subsanación desde la conclusión final. */
export interface DdVinculoObservadoRequestDTO {
  tipo: DdObservacionVinculoTipo;
  beneficiarioId?: string | null;
  /** Comentario específico del vínculo; si falta se usa el comentario general. */
  comentario?: string | null;
}

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
  /**
   * Guardado borrador: solo persiste respuestas de criterios, observaciones por criterio y el texto
   * de observaciones de SIG. No registra resultado ni conclusion, no sella fecha/responsable y no
   * exige las validaciones de una evaluacion concluida.
   */
  borrador?: boolean;
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
  /** Observacion por criterio ({ codigo: texto }); vacio o null la limpia. */
  listasObservaciones?: Record<string, string | null>;
  sig?: DdMatrizBloqueRequestDTO;
  reputacional?: DdMatrizBloqueRequestDTO;
  compliance?: DdMatrizBloqueRequestDTO;
  resultadoFinal?: string | null;
  /**
   * Bypass: declara APTO aunque Comunicaciones no tenga veredicto sin hallazgos en todos los vinculos.
   * Solo aplica con resultadoFinal APTO; queda registrado en la auditoria con los vinculos pendientes.
   */
  omitirValidacionComunicaciones?: boolean;
  /** Fecha del resultado final (YYYY-MM-DD); si no se envia se registra la de hoy. */
  finalFecha?: string | null;
  /** Quien registra el resultado final; si no se envia se registra el usuario que guarda. */
  finalPor?: string | null;
  /** Comentario interno de la conclusion final; no se muestra al cliente. */
  finalComentario?: string | null;
  /** Comentario que recibe el cliente cuando la conclusión es DOCUMENTACIÓN OBSERVADA. */
  clienteComentario?: string | null;
  /** Documentos que el cliente debe subsanar. */
  documentosObservados?: string[];
  /** Representante o beneficiarios que el cliente debe corregir. */
  vinculosObservados?: DdVinculoObservadoRequestDTO[];
}
