import { REVISION_AREA_ORDER, REVISION_AREAS } from "@/lib/shared/constants";
import type { RevisionArea } from "@/lib/shared/constants";

interface RevisionLike {
  area: string;
}

/**
 * Devuelve las áreas de revisión **local** a considerar/lograr para una solicitud.
 *
 * Criterio de compatibilidad:
 *  - Si la solicitud tiene una revisión Legal persistida (legacy), se exige.
 *  - Si el SGC está deshabilitado, Legal se revisa localmente (fallback QA/dev).
 *  - Con SGC habilitado, Legal se delega al SGC.
 */
export function areasRevisionLocal(
  revisiones: RevisionLike[],
  opciones?: { sgcEnabled?: boolean },
): RevisionArea[] {
  const incluirLegal = tieneLegalLocal(revisiones) || opciones?.sgcEnabled === false;
  return incluirLegal
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
