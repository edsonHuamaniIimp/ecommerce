import type { DdAsistenteMetodoTexto } from "@/lib/shared/constants";

export interface ExtractorTextoArchivo {
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
}

export interface ExtractorTextoOpciones {
  maxPaginas: number;
  timeoutMs: number;
}

export interface ExtractorTextoResultado {
  texto: string;
  paginas: number;
  metodo: DdAsistenteMetodoTexto;
}

/**
 * Extrae el texto de una evidencia: capa de texto del PDF, OCR de PDF escaneado o imagen,
 * o el texto de un Word. Todo ocurre en el servidor.
 */
export interface IExtractorTexto {
  /** true si las herramientas de OCR estan instaladas (el Word no las necesita). */
  ocrDisponible(): Promise<boolean>;
  extraer(archivo: ExtractorTextoArchivo, opciones: ExtractorTextoOpciones): Promise<ExtractorTextoResultado>;
}
