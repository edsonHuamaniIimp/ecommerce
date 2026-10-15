/** Request de la API entrante M2M: notifica el documento y estado de pago de una cuota. */
export interface NotificacionFacturaRequestDTO {
  /** Mismo `NumeroSolicitud` que se envio en la reserva (recomendado por la v3). */
  numeroSolicitud?: string | null;
  /** Alternativa: contrato del IIMP de la reserva. */
  contrato?: string | null;
  /** Numero de cuota de la cuenta (1..3). */
  cuota: number;
  /** Nombre del documento (no el archivo): ej. "F001-1234.pdf". */
  documento: string;
  /** Codigo del estado: 0 PAGADA | 1 PENDIENTE | 2 ANULADA (ver ESTADOS_PAGO_EXTERNO). */
  estadoPago: number;
  /** Motivo de la anulacion o rechazo (max. 500 caracteres). Obligatoria cuando `estadoPago` es 2. */
  justificacion?: string | null;
}
