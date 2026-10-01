import type { TipoComprobante } from "@/lib/shared/constants";

/** Cuerpo de POST `/api/facturacion/adjuntar-comprobante` (bandeja de Facturacion). */
export interface AdjuntarComprobanteFiscalRequestDTO {
  /** Cuota pagada a la que corresponde el comprobante. */
  cuotaId: string;
  /** Tipo elegido por el cliente al reservar: boleta o factura. */
  tipo: TipoComprobante;
  /** Numero del comprobante (serie-numero). */
  numero: string;
  /** URL del archivo subido con `/api/upload`. */
  url: string;
}
