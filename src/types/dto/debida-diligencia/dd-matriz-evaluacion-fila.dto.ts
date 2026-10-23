/** Fila resumida de la Matriz de evaluacion DD (un vinculo empresa/persona). */
export interface DdMatrizEvaluacionFilaDTO {
  id: string;
  expedienteId: string;
  codigo: string;
  empresaRazonSocial: string;
  empresaRuc: string;
  motivo: string | null;
  eventoProyecto: string | null;
  fechaIngreso: string;
  tipo: string;
  origen: string;
  nombre: string;
  tipoDocumento: string | null;
  documento: string | null;
  cargo: string | null;
  ambito: string;
  /** Pais ISO alpha-2; null si no se conoce. */
  pais: string | null;
  sigResultado: string | null;
  sigConclusion: string | null;
  repResultado: string | null;
  repConclusion: string | null;
  cmpResultado: string | null;
  cmpConclusion: string | null;
  resultadoFinal: string | null;
  updatedAt: string;
}
