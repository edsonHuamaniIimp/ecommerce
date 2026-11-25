/** Origen de la solicitud de factura que fallo. */
export type OrigenIntentoFactura = "cliente" | "staff" | "programada";

export interface RegistrarIntentoFacturaData {
  solicitudId: string;
  cuotaId: string;
  origen: OrigenIntentoFactura;
  actor: string | null;
  /** `error_sie` (el SIE rechazo o no respondio) | `error_posterior` (el SIE registro pero fallo el guardado local). */
  resultado: "error_sie" | "error_posterior";
  httpStatus: number | null;
  mensaje: string | null;
  identificadorSie: string | null;
  requisitos: unknown;
  archivos: unknown;
  payload: unknown;
  respuestaSie: unknown;
}

/** Bitacora de solicitudes de factura fallidas: conserva lo declarado para reenviarlo sin pedirlo de nuevo. */
export interface IFacturacionIntentoRepository {
  registrarFallo(data: RegistrarIntentoFacturaData): Promise<void>;
}
