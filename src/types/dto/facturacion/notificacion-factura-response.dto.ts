import type { EstadoPagoExterno } from "@/lib/shared/constants";

/** Response de la API entrante M2M de facturacion (cuota localizada y estado registrado). */
export interface NotificacionFacturaResponseDTO {
  cuotaId: string;
  numero: number;
  documento: string;
  estadoPago: EstadoPagoExterno;
}
