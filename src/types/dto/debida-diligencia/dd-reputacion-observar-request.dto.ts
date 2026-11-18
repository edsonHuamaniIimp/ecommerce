import type { DdReputacionResultado } from "@/lib/shared/constants";

/** Observacion de Comunicaciones; no incluye conclusion reputacional. */
export interface DdReputacionObservarRequestDTO {
  id: string;
  /** Nulo mientras el caso se guarda como borrador. */
  resultado: DdReputacionResultado | null;
  comentario?: string | null;
  linkHallazgos?: string | null;
  cerrar: boolean;
  notificar: boolean;
}
