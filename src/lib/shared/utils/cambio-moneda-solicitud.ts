import { ESTADOS_SOLICITUD } from "@/lib/shared/constants";
import { sgcAprobado } from "./sgc-estado";

type SolicitudParaMoneda = {
  flgActivo?: boolean;
  tieneFacturacion?: boolean;
  facturacionId?: string | null;
  iimpContrato?: string | null;
  estadoSolicitud: string;
  sgcLifecycleStatus?: string | null;
};

/**
 * El cambio de moneda solo procede antes de que exista cobranza real.
 * El contrato local y las firmas se invalidan/reemplazan en el servidor.
 */
export function puedeCambiarMonedaSolicitud(row: SolicitudParaMoneda): boolean {
  if (row.flgActivo === false) return false;
  if (row.tieneFacturacion || row.facturacionId) return false;
  if (row.iimpContrato) return false;
  if (sgcAprobado(row.sgcLifecycleStatus ?? null)) return false;
  return row.estadoSolicitud !== ESTADOS_SOLICITUD.PENDIENTE_PAGO
    && row.estadoSolicitud !== ESTADOS_SOLICITUD.PAGADO;
}
