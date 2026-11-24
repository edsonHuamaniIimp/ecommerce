import {
  ESTADOS_DOCUMENTO_SOLICITUD,
  ESTADOS_PAGO_SOLICITUD,
  ESTADOS_SOLICITUD,
  MANUAL_CASOS,
  MANUAL_CASOS_ORDEN,
  SGC_ESTADO_ENVIO,
  SGC_LIFECYCLE_STATUSES,
  TIPOS_DOCUMENTO_SOLICITUD,
  type ManualCaso,
} from "@/lib/shared/constants";
import {
  contratoClientePendienteFirma,
  devolucionSgcSinDetalle,
  enVentanaDocumentosSgc,
  esObservacionSgcAnexo,
  estadoCorreccionSgc,
  observacionContratoSgcPendiente,
  observacionesSgcSubsanadas,
  sgcObservacionesAbiertas,
  type SolicitudDocumentosGate,
} from "./solicitud-documentos";

/** Datos de la solicitud que decide que manual mostrar (subconjunto de la fila de la bandeja). */
export interface SolicitudManualGate extends SolicitudDocumentosGate {
  estadoPago?: string | null;
}

/** Estados del SGC en los que el expediente esta siendo revisado (no hay nada que corregir). */
const SGC_FUERA_DE_REVISION: readonly (string | null)[] = [
  null,
  SGC_LIFECYCLE_STATUSES.DRAFT,
  SGC_LIFECYCLE_STATUSES.OBSERVED,
  SGC_LIFECYCLE_STATUSES.REJECTED,
  SGC_LIFECYCLE_STATUSES.ACTIVE,
  SGC_LIFECYCLE_STATUSES.FINALIZED,
];

/**
 * Casos del manual que aplican a una solicitud, en orden de prioridad. Puede devolver varios
 * (p. ej. contrato observado + documentos de un grupo). Vacio = no hay accion pendiente: el
 * modal muestra el indice de todos los manuales.
 */
export function casosManualSolicitud(s: SolicitudManualGate): ManualCaso[] {
  const casos = new Set<ManualCaso>();

  if (enVentanaDocumentosSgc(s)) {
    if (devolucionSgcSinDetalle(s)) {
      casos.add(MANUAL_CASOS.SGC_SIN_DETALLE);
    } else {
      if (observacionContratoSgcPendiente(s)) casos.add(MANUAL_CASOS.SGC_CONTRATO);
      /* Solo las observaciones que aun tienen algo por corregir. */
      const faltantes = estadoCorreccionSgc(s).faltantes;
      const anexos = sgcObservacionesAbiertas(s)
        .filter(esObservacionSgcAnexo)
        .filter((o) => faltantes.some((f) => (o.observationId ? f.observationId === o.observationId : f.title === (o.title ?? o.nombre ?? "Documento"))));
      if (anexos.some((o) => (o.pieces?.length ?? 0) > 0)) casos.add(MANUAL_CASOS.SGC_GRUPO);
      if (anexos.some((o) => !(o.pieces?.length))) casos.add(MANUAL_CASOS.SGC_DOCUMENTOS);
    }
    if (sgcObservacionesAbiertas(s).length > 0 && observacionesSgcSubsanadas(s)) {
      casos.add(MANUAL_CASOS.SGC_REENVIAR);
    }
  } else if (s.estadoSolicitud === ESTADOS_SOLICITUD.OBSERVADO) {
    const observados = (s.docsAdjuntos ?? []).filter((d) => d.estado === ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO);
    if (observados.some((d) => d.categoria === TIPOS_DOCUMENTO_SOLICITUD.ANEXO)) {
      casos.add(MANUAL_CASOS.ASOCIADO_DOCUMENTOS);
    }
    if (observados.some((d) =>
      d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO || d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO)) {
      casos.add(MANUAL_CASOS.ASOCIADO_CONTRATO);
    }
  }

  if (contratoClientePendienteFirma(s)) casos.add(MANUAL_CASOS.FIRMAR_CONTRATO);

  const pendientePago =
    s.estadoPago === ESTADOS_PAGO_SOLICITUD.PENDIENTE_PAGO ||
    s.estadoSolicitud === ESTADOS_SOLICITUD.PENDIENTE_PAGO;
  if (pendientePago) casos.add(MANUAL_CASOS.PAGO);

  const enRevisionSgc =
    s.sgcEstadoEnvio === SGC_ESTADO_ENVIO.CREADO &&
    !SGC_FUERA_DE_REVISION.includes(s.sgcLifecycleStatus);
  if (casos.size === 0 && enRevisionSgc) casos.add(MANUAL_CASOS.EN_REVISION);

  return MANUAL_CASOS_ORDEN.filter((c) => casos.has(c));
}
