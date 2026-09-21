import { SGC_LIFECYCLE_STATUSES } from "@/lib/shared/constants";

/** True si la solicitud ya tiene expediente en el SGC (la integración aplica a esa solicitud). */
export function sgcAplica(estadoEnvio: string | null): boolean {
  return estadoEnvio !== null;
}

/** True si el SGC ya aprobó el trámite (contrato pasó a Vigencia). */
export function sgcAprobado(lifecycleStatus: string | null): boolean {
  return lifecycleStatus === SGC_LIFECYCLE_STATUSES.ACTIVE;
}

/**
 * Criterio para habilitar la orden de pago: las áreas locales ya aprobaron y, si la
 * solicitud tiene expediente en el SGC, este debe estar aprobado. Si no aplica SGC
 * (integración deshabilitada), se permite como antes.
 */
export function puedeGenerarOrdenPago(estadoEnvio: string | null, lifecycleStatus: string | null): boolean {
  return !sgcAplica(estadoEnvio) || sgcAprobado(lifecycleStatus);
}
