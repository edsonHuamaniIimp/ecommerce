/** Archivo que se envia tal cual a la IA (PDF o imagen). */
export interface DdAsistenteArchivoIa {
  nombre: string;
  mimeType: string;
  bytes: Uint8Array;
}

/** Texto ya extraido de una evidencia (OCR, texto del PDF o del Word). */
export interface DdAsistenteTextoIa {
  nombre: string;
  texto: string;
}

export interface DdAsistenteSolicitudIa {
  /** Reglas fijas del sistema (criterio, vinculo, formato y limite de la respuesta). */
  instrucciones: string;
  /** Indicacion escrita por el usuario. */
  prompt: string;
  archivos: DdAsistenteArchivoIa[];
  textos: DdAsistenteTextoIa[];
  timeoutMs: number;
}

export interface DdAsistenteRespuestaIa {
  texto: string;
  /** Proveedor y modelo que respondio (para la auditoria). */
  modelo: string;
}

/** Modelo de lenguaje que redacta la observacion del criterio a partir de la evidencia. */
export interface IDdAsistenteIaClient {
  disponible(): boolean;
  /**
   * Texto generado, o null si la IA no devolvio texto. Si el proveedor esta saturado o no responde
   * a tiempo (tambien con los modelos de respaldo), lanza un error de dominio 503.
   */
  generar(solicitud: DdAsistenteSolicitudIa): Promise<DdAsistenteRespuestaIa | null>;
}
