import { BADGE_STYLES, ESTADOS_SOLICITUD, ESTADOS_STAND, ESTADOS_STAND_LEGACY, SGC_LIFECYCLE_STATUSES } from "@/lib/shared/constants";
import type { EstadoStand } from "@/lib/shared/constants";

export interface EstadoStandBadge {
  texto: string;
  clase: string;
}

const BADGES: Record<string, EstadoStandBadge> = {
  [ESTADOS_STAND.DISPONIBLE]: { texto: "Disponible", clase: BADGE_STYLES.SUCCESS },
  [ESTADOS_STAND.EN_PROCESO]: { texto: "En proceso", clase: BADGE_STYLES.WARNING },
  [ESTADOS_STAND.EN_EVALUACION]: { texto: "En evaluacion", clase: BADGE_STYLES.WARNING },
  [ESTADOS_STAND.RESERVADO]: { texto: "Reservado", clase: BADGE_STYLES.NEUTRAL },
  /* Mismo comportamiento visual que reservado; la vista de Pre-reservas los lista aparte. */
  [ESTADOS_STAND.PRE_RESERVADO]: { texto: "Reservado", clase: BADGE_STYLES.NEUTRAL },
  [ESTADOS_STAND_LEGACY.AVAILABLE]: { texto: "Disponible", clase: BADGE_STYLES.SUCCESS },
  [ESTADOS_STAND_LEGACY.RESERVED]: { texto: "Reservado", clase: BADGE_STYLES.NEUTRAL },
  [ESTADOS_STAND_LEGACY.RESERVADO]: { texto: "Reservado", clase: BADGE_STYLES.NEUTRAL },
  [ESTADOS_STAND_LEGACY.EN_EVALUACION]: { texto: "En evaluacion", clase: BADGE_STYLES.WARNING },
};

/**
 * Etiqueta y clases del badge para el estado de un stand que devuelve GESS/KB.
 * Devuelve null si el estado no es reconocido (no se muestra badge).
 */
export function estadoStandBadge(estado: string | null | undefined): EstadoStandBadge | null {
  if (!estado) return null;
  return BADGES[estado] ?? null;
}

/**
 * Estado **comercial** de un stand para integraciones M2M: se deriva del estado real
 * de la reserva/solicitud (no del estado tecnico del plano).
 *  - sin solicitud activa o rechazada -> `disponible`
 *  - en revision (`pendiente`/`en_proceso`) -> `en_evaluacion`
 *  - aprobada, pendiente de pago o pagada -> `reservado`
 */
export function estadoComercialStand(
  estadoSolicitud: string | null | undefined,
  estadoStand: string | null | undefined,
): EstadoStand {
  if (estadoSolicitud) {
    if (estadoSolicitud === ESTADOS_SOLICITUD.RECHAZADO) return ESTADOS_STAND.DISPONIBLE;
    if (estadoSolicitud === ESTADOS_SOLICITUD.PENDIENTE || estadoSolicitud === ESTADOS_SOLICITUD.EN_PROCESO) {
      return ESTADOS_STAND.EN_EVALUACION;
    }
    // aprobado | pendiente_pago | pagado
    return ESTADOS_STAND.RESERVADO;
  }
  if (
    estadoStand === ESTADOS_STAND.RESERVADO ||
    estadoStand === ESTADOS_STAND.PRE_RESERVADO ||
    estadoStand === ESTADOS_STAND_LEGACY.RESERVADO ||
    estadoStand === ESTADOS_STAND_LEGACY.RESERVED
  ) {
    return ESTADOS_STAND.RESERVADO;
  }
  return ESTADOS_STAND.DISPONIBLE;
}

/** Identidad minima de la empresa que mira un stand (para pre-reservas). */
export interface EmpresaViewer {
  ruc?: string | null;
  sieCode?: string | null;
  razonSocial?: string | null;
}

/** Normaliza texto para comparar (mayusculas, sin tildes, espacios simples). */
function normalizarTexto(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * True si la empresa espectadora es la **dueña de la pre-reserva** del stand:
 * coincide por RUC (primario), SIE o razón social normalizada. Solo compara el
 * snapshot; el llamador decide según el estado del stand.
 */
export function esEmpresaDuenaPreReserva(
  stand: { preReservaRuc?: string | null; preReservaSie?: string | null; preReservaRazonSocial?: string | null },
  viewer: EmpresaViewer,
): boolean {
  const rucStand = normalizarTexto(stand.preReservaRuc);
  const rucViewer = normalizarTexto(viewer.ruc);
  if (rucStand && rucViewer && rucStand === rucViewer) return true;

  const sieStand = normalizarTexto(stand.preReservaSie);
  const sieViewer = normalizarTexto(viewer.sieCode);
  if (sieStand && sieViewer && sieStand === sieViewer) return true;

  const rsStand = normalizarTexto(stand.preReservaRazonSocial);
  const rsViewer = normalizarTexto(viewer.razonSocial);
  return Boolean(rsStand && rsViewer && rsStand === rsViewer);
}

/**
 * True si el ciclo del SGC equivale a **aprobado** para habilitar la orden de pago:
 * `active` (Vigente) o `finalized` (cerrado sin activar el contrato) — en el flujo de
 * stands la aprobación de Legal/Gerencia es cobrable en ambos casos.
 */
export function esAprobadoSgc(lifecycleStatus: string | null | undefined): boolean {
  return (
    lifecycleStatus === SGC_LIFECYCLE_STATUSES.ACTIVE ||
    lifecycleStatus === SGC_LIFECYCLE_STATUSES.FINALIZED
  );
}
