import type { DdReputacionResultado } from "@/lib/shared/constants";

/** Resolucion de un caso de revision reputacional (Comunicaciones). */
export interface DdReputacionResolverRequestDTO {
  id: string;
  resultado: DdReputacionResultado;
  comentario?: string | null;
  linkHallazgos?: string | null;
  cerrar: boolean;
  notificar: boolean;
}
