/** Metadatos del documento cargado por el endpoint DD. */
export interface DdDocumentoUploadResponseDTO {
  url: string;
  nombre: string;
  tipo: string;
  size: number;
  mimeType: string;
}
