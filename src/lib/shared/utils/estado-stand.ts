import { BADGE_STYLES, ESTADOS_STAND, ESTADOS_STAND_LEGACY } from "@/lib/shared/constants";

export interface EstadoStandBadge {
  texto: string;
  clase: string;
}

const BADGES: Record<string, EstadoStandBadge> = {
  [ESTADOS_STAND.DISPONIBLE]: { texto: "Disponible", clase: BADGE_STYLES.SUCCESS },
  [ESTADOS_STAND.EN_EVALUACION]: { texto: "En evaluacion", clase: BADGE_STYLES.WARNING },
  [ESTADOS_STAND.RESERVADO]: { texto: "Reservado", clase: BADGE_STYLES.NEUTRAL },
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
