/** Resultado de un envio masivo de recordatorios de facturacion. */
export interface EnviarRecordatoriosResultDTO {
  enviados: number;
  fallidos: number;
  detalle: Array<{
    facturacionId: string;
    ok: boolean;
    /** Motivo del fallo (sin correo, criterio incumplido, error del proveedor de correo). */
    error?: string;
  }>;
}
