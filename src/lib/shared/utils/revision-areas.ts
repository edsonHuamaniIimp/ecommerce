import { REVISION_AREA_ORDER, REVISION_AREAS } from "@/lib/shared/constants";
import type { RevisionArea } from "@/lib/shared/constants";

interface RevisionLike {
  area: string;
}

/**
 * Devuelve las áreas de revisión **local** a considerar/lograr para una solicitud.
 *
 * Criterio de compatibilidad: se parte del orden vigente (`logistica → comunicacion`,
 * porque Legal se delegó al SGC) y se agrega **Legal** solo si la solicitud tiene una
 * revisión Legal persistida (datos legacy del flujo anterior). Así:
 *  - Solicitudes nuevas: `[logistica, comunicacion]` → Legal la cubre el SGC.
 *  - Solicitudes antiguas con Legal: `[logistica, comunicacion, legal]` → se sigue exigiendo.
 */
export function areasRevisionLocal(revisiones: RevisionLike[]): RevisionArea[] {
  return tieneLegalLocal(revisiones)
    ? [...REVISION_AREA_ORDER, REVISION_AREAS.LEGAL]
    : [...REVISION_AREA_ORDER];
}

/** True si esta solicitud aún conserva la revisión Legal como paso local (legacy). */
export function tieneLegalLocal(revisiones: RevisionLike[]): boolean {
  return revisiones.some((r) => r.area === REVISION_AREAS.LEGAL);
}

/** True si la revisión Legal de esta solicitud ya la asume el SGC (flujo nuevo). */
export function legalDelegadaAlSgc(revisiones: RevisionLike[]): boolean {
  return !tieneLegalLocal(revisiones);
}
