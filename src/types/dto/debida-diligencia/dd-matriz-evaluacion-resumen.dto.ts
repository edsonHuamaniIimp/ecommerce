/** Conteo por valor (null = sin dato). */
export interface DdMatrizConteoDTO {
  valor: string | null;
  total: number;
}

/** Indicadores de la Matriz de evaluacion DD del evento activo. */
export interface DdMatrizEvaluacionResumenDTO {
  /** Empresas (expedientes) con al menos un sujeto evaluado en el evento. */
  empresas: number;
  total: number;
  resultadoFinal: DdMatrizConteoDTO[];
  resultadoFinalEmpresas: DdMatrizConteoDTO[];
  ambito: DdMatrizConteoDTO[];
  tipo: DdMatrizConteoDTO[];
  paises: { pais: string; total: number }[];
  sig: DdMatrizConteoDTO[];
  reputacional: DdMatrizConteoDTO[];
  compliance: DdMatrizConteoDTO[];
  requierenReforzada: number;
  pendientesCompliance: number;
  enRevision: number;
}
