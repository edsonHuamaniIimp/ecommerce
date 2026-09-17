export interface DocumentoOrigenContenido {
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
}

/** Lee el binario de un documento almacenado localmente (o por URL publica). */
export interface IDocumentoOrigen {
  leer(url: string): Promise<DocumentoOrigenContenido>;
}
