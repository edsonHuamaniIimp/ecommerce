import type { EstadoSolicitudCuenta } from "@/lib/shared/constants";

export interface RevisarSolicitudCuentaRequestDTO {
  id: string;
  estado: EstadoSolicitudCuenta;
  /** Obligatorio cuando el estado es "rechazada". */
  motivoRechazo?: string;
}
