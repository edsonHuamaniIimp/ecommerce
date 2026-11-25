import type { DdAsistenteModo } from "@/lib/shared/constants";

/** Cuerpo de POST `/api/debida-diligencia/matriz-evaluacion/asistente`. */
export interface DdMatrizAsistenteRequestDTO {
  vinculoId: string;
  /** Codigo de lista del criterio (oefa, indecopi, corrupcion_empresa, corrupcion_persona u otros). */
  codigo: string;
  modo: DdAsistenteModo;
  /** Indicacion del usuario, por ejemplo "Lee el documento y dame un resumen". */
  prompt: string;
  /** Evidencias del criterio que se usan. */
  adjuntoIds: string[];
}
