import { BADGE_STYLES, ESTADOS_SOLICITUD, ESTADOS_STAND, ESTADOS_STAND_LEGACY } from "@/lib/shared/constants";
import type { EstadoStand } from "@/lib/shared/constants";

export interface EstadoStandBadge {
  texto: string;
  clase: string;
}

const BADGES: Record<string, EstadoStandBadge> = {
  [ESTADOS_STAND.DISPONIBLE]: { texto: "Disponible", clase: BADGE_STYLES.SUCCESS },
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
