import type { DdAsistenteMetodoTexto, DdAsistenteModo } from "@/lib/shared/constants";

export interface DdMatrizAsistenteEvidenciaDTO {
  id: string;
  nombre: string;
  /** Como se leyo el texto; null si el archivo se envio completo a la IA. */
  metodo: DdAsistenteMetodoTexto | null;
  paginas: number | null;
}

/** Respuesta de POST `/api/debida-diligencia/matriz-evaluacion/asistente`. No se guarda nada. */
export interface DdMatrizAsistenteResponseDTO {
  texto: string;
  modo: DdAsistenteModo;
  evidencias: DdMatrizAsistenteEvidenciaDTO[];
  /** El texto extraido supero el maximo y se envio recortado a la IA. */
  textoTruncado: boolean;
  /** La respuesta supero el limite de la observacion del criterio y se recorto. */
  recortado: boolean;
}
