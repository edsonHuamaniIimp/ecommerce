import { DIAS_HABILITACION_SOLICITUD_FACTURA } from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";

/**
 * Dias que faltan para habilitar la solicitud de factura de una cuota.
 * `null` = la cuota no tiene fecha (se permite); `<= 0` = ya habilitada.
 */
export function diasParaHabilitarSolicitudFactura(fechaCuota: string | null | undefined): number | null {
  const dias = dateUtils.diffInDays(dateUtils.todayLimaInputValue(), fechaCuota);
  return dias === null ? null : dias - DIAS_HABILITACION_SOLICITUD_FACTURA;
}

/** true si la solicitud de factura ya puede enviarse para la cuota indicada. */
export function solicitudFacturaHabilitada(
  fechaCuota: string | null | undefined,
  numeroCuota?: number | null,
): boolean {
  /* La primera cuota se puede solicitar en cualquier momento si no hay solicitud. */
  if (numeroCuota === 1) return true;
  const dias = diasParaHabilitarSolicitudFactura(fechaCuota);
  return dias === null || dias <= 0;
}

/** Texto de disponibilidad para botones/tooltips. */
export function textoSolicitudFactura(
  fechaCuota: string | null | undefined,
  numeroCuota?: number | null,
): string {
  if (numeroCuota === 1) return "Solicitar factura";
  const dias = diasParaHabilitarSolicitudFactura(fechaCuota);
  if (dias === null || dias <= 0) return "Solicitar factura";
  return `Solicitud disponible en ${dias} día${dias === 1 ? "" : "s"} (30 días antes de la cuota)`;
}
