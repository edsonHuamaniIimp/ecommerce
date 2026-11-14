import type { TipoComprobante } from "@/lib/shared/constants";

export interface ReservaAdminRequestDTO {
  eventoId: string;
  empresaRuc: string;
  standIds: string[];
  moneda?: "USD" | "PEN";
  /** Comprobante que se usara en la solicitud/contrato (factura o boleta). */
  tipoComprobante?: TipoComprobante;
  /** Descuento comercial sobre el neto (0..100, maximo 2 decimales). */
  descuentoPorcentaje?: number;
  descuentoMonto?: number;
  cuotas: Array<{ porcentaje: number; fechaVencimiento: string }>;
}

export interface ReservaAdminResponseDTO {
  ok: boolean;
  message: string;
  solicitudId: string;
  estado: string;
}
