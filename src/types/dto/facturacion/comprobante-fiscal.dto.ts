/** Comprobante fiscal (boleta/factura) adjuntado por Facturacion a una cuota pagada. */
export interface ComprobanteFiscalDTO {
  /** Tipo del comprobante: "boleta" | "factura" (ver TIPOS_COMPROBANTE). */
  tipo: string;
  /** Numero del comprobante (serie-numero). */
  numero: string;
  /** URL del archivo del comprobante (PDF o imagen). */
  url: string;
  /** Fecha/hora en que se adjunto (ISO 8601). */
  at: string;
  /** Usuario que lo adjunto. */
  by: string | null;
}
