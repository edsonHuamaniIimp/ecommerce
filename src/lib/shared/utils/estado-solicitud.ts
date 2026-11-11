import { ESTADOS_REVISION, ESTADOS_SOLICITUD, SGC_LIFECYCLE_STATUSES } from "@/lib/shared/constants";
import { areasRevisionLocal } from "@/lib/shared/utils/revision-areas";

export interface RevisionEstado {
  area: string;
  estado: string;
}

export interface SgcEstadoSolicitud {
  lifecycleStatus: string | null;
  devolucionRequiereCambio: boolean | null;
}

/**
 * Estado visible de una solicitud a partir de sus revisiones locales y del SGC.
 * `solicitud.estado` solo persiste estados de pago; el resto es calculado.
 */
export function computeEstadoSolicitud(
  revisiones: RevisionEstado[],
  sgc: SgcEstadoSolicitud | null | undefined,
  sgcEnabled: boolean,
): string {
  if (
    (sgc?.lifecycleStatus === SGC_LIFECYCLE_STATUSES.OBSERVED ||
      sgc?.lifecycleStatus === SGC_LIFECYCLE_STATUSES.REJECTED) &&
    sgc.devolucionRequiereCambio !== false
  ) {
    return ESTADOS_SOLICITUD.OBSERVADO;
  }
  if (revisiones.length === 0) return ESTADOS_SOLICITUD.PENDIENTE;
  const todasPendientes = revisiones.every((r) => r.estado === ESTADOS_REVISION.PENDIENTE);
  if (todasPendientes) return ESTADOS_SOLICITUD.PENDIENTE;
  if (revisiones.some((r) => r.estado === ESTADOS_REVISION.OBSERVADO)) return ESTADOS_SOLICITUD.OBSERVADO;

  const algunaRespondio = revisiones.some((r) => r.estado !== ESTADOS_REVISION.PENDIENTE);
  const todasRespondieron = areasRevisionLocal(revisiones, { sgcEnabled }).every((area) => {
    const rev = revisiones.find((r) => r.area === area);
    return rev && rev.estado !== ESTADOS_REVISION.PENDIENTE;
  });
  if (!todasRespondieron && algunaRespondio) return ESTADOS_SOLICITUD.EN_PROCESO;
  if (todasRespondieron) {
    const algunaRechazada = revisiones.some((r) => r.estado === ESTADOS_REVISION.RECHAZADO);
    return algunaRechazada ? ESTADOS_SOLICITUD.RECHAZADO : ESTADOS_SOLICITUD.APROBADO;
  }
  return ESTADOS_SOLICITUD.PENDIENTE;
}

/** Estado persistido de pago manda; si no existe, se usa el estado calculado. */
export function estadoSolicitudConSgc(
  estadoPersistido: string | null,
  revisiones: RevisionEstado[],
  sgc: SgcEstadoSolicitud | null | undefined,
  sgcEnabled: boolean,
): string {
  const calculado = computeEstadoSolicitud(revisiones, sgc, sgcEnabled);

  /* No revertir un estado terminal de pago por una respuesta tardia del SGC. */
  if (
    calculado === ESTADOS_SOLICITUD.OBSERVADO &&
    estadoPersistido !== ESTADOS_SOLICITUD.PENDIENTE_PAGO &&
    estadoPersistido !== ESTADOS_SOLICITUD.PAGADO
  ) {
    return calculado;
  }
  return estadoPersistido || calculado;
}
