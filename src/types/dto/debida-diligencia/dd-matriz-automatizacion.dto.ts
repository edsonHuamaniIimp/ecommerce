/** Resultado de automatizar la evidencia de un criterio dentro de una automatizacion general. */
export interface DdMatrizAutomatizacionCriterioDTO {
  codigo: string;
  label: string;
  /** `ok` = evidencia adjuntada; `error` = fallo (ver `mensaje`). */
  estado: "pendiente" | "ok" | "error";
  mensaje: string | null;
}

/** Estado de una automatizacion general de los criterios de un vinculo. */
export interface DdMatrizAutomatizacionDTO {
  jobId: string;
  vinculoId: string;
  vinculoNombre: string;
  /** Estado global (DD_AUTOMATIZACION_ESTADOS). */
  estado: string;
  total: number;
  procesados: number;
  criterios: DdMatrizAutomatizacionCriterioDTO[];
  /** Canal Pusher privado del usuario donde se avisa el termino. */
  canal: string;
}
