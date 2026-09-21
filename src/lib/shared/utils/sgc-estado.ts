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
 * Criterio para habilitar la orden de pago. Si la revisión **Legal está delegada al SGC**
 * (`legalDelegada = true`), la orden espera a que el SGC apruebe (contrato Vigente),
 * exista o no expediente. En flujo legacy (Legal local), basta con las áreas locales.
 */
export function puedeGenerarOrdenPago(legalDelegada: boolean, lifecycleStatus: string | null): boolean {
  return !legalDelegada || sgcAprobado(lifecycleStatus);
}
