import { RESULTADOS_APROBACION, REVISION_AREA_ORDER, REVISION_AREAS, SGC_LIFECYCLE_STATUSES } from "@/lib/shared/constants";
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

/** Origen de una observacion: revision local o devolucion del SGC. */
export type OrigenObservacion = "asociado" | "legal" | "sgc";

interface ObservacionLike {
  revisiones: Array<{ area: string; estado?: string | null }>;
  sgcLifecycleStatus?: string | null;
  sgcDevolucionRequiereCambio?: boolean | null;
}

/** Areas que dejaron la solicitud en OBSERVADO; no altera estados ni ids. */
export function origenesObservacion(s: ObservacionLike): OrigenObservacion[] {
  const origenes: OrigenObservacion[] = [];
  const revisiones = s.revisiones ?? [];
  if (revisiones.some((r) => r.area === REVISION_AREAS.ASOCIADO && r.estado === RESULTADOS_APROBACION.OBSERVADO)) {
    origenes.push("asociado");
  }
  if (revisiones.some((r) => r.area === REVISION_AREAS.LEGAL && r.estado === RESULTADOS_APROBACION.OBSERVADO)) {
    origenes.push("legal");
  }
  const sgcDevuelto =
    (s.sgcLifecycleStatus === SGC_LIFECYCLE_STATUSES.OBSERVED ||
      s.sgcLifecycleStatus === SGC_LIFECYCLE_STATUSES.REJECTED) &&
    s.sgcDevolucionRequiereCambio === true;
  if (sgcDevuelto) origenes.push("sgc");
  return origenes;
}

/** True si la observacion proviene del area indicada (Legal incluye SGC). */
export function observadaPorArea(s: ObservacionLike, origen: "asociado" | "legal"): boolean {
  const origenes = origenesObservacion(s);
  return origen === "asociado" ? origenes.includes("asociado") : origenes.includes("legal") || origenes.includes("sgc");
}
