import { BADGE_STYLES, ESTADOS_EVENTO } from "@/lib/shared/constants";

export interface EstadoEventoBadge {
  texto: string;
  clase: string;
}

const BADGES: Record<string, EstadoEventoBadge> = {
  [ESTADOS_EVENTO.ACTIVE]: { texto: "Vigente", clase: BADGE_STYLES.SUCCESS },
  [ESTADOS_EVENTO.CLOSED]: { texto: "Finalizado", clase: BADGE_STYLES.NEUTRAL },
  [ESTADOS_EVENTO.DRAFT]: { texto: "Borrador", clase: BADGE_STYLES.WARNING },
  [ESTADOS_EVENTO.CANCELLED]: { texto: "Anulado", clase: BADGE_STYLES.DESTRUCTIVE },
};

/** Etiqueta y clases del badge para el estado de una version de evento. */
export function estadoEventoBadge(estado: string): EstadoEventoBadge {
  return BADGES[estado] ?? { texto: estado, clase: BADGE_STYLES.NEUTRAL };
}
