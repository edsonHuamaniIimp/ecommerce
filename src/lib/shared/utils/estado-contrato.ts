import { ESTADOS_SOLICITUD } from "../constants";

export type EstadoContrato = "FIRMADO_Y_VIGENTE" | "EN_REVISION" | "OBSERVADO" | "PENDIENTE_FIRMA" | "RESCINDIDO";

/** Mapea el estado de solicitud del SGC al estado de contrato del Sistema de Montaje. */
export function mapearEstadoContrato(estadoSolicitud: string): EstadoContrato {
  if (estadoSolicitud === ESTADOS_SOLICITUD.APROBADO || estadoSolicitud === ESTADOS_SOLICITUD.PAGADO) {
    return "FIRMADO_Y_VIGENTE";
  }
  if (estadoSolicitud === ESTADOS_SOLICITUD.RECHAZADO) {
    return "RESCINDIDO";
  }
  if (estadoSolicitud === ESTADOS_SOLICITUD.PENDIENTE_PAGO) {
    return "PENDIENTE_FIRMA";
  }
  return "EN_REVISION";
}
