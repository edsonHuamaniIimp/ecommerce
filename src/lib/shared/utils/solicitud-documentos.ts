import { ESTADOS_REEVALUACION, ESTADOS_SOLICITUD, SGC_LIFECYCLE_STATUSES, SGC_SUBSANACION_MODOS, SGC_SUBSANACION_SUGERENCIAS, TIPOS_DOCUMENTO_SOLICITUD } from "@/lib/shared/constants";
import { legalDelegadaAlSgc } from "./revision-areas";

interface RevisionLike {
  area: string;
}

interface ReevaluacionLike {
  estado: string;
}

/** Documento adjunto (subconjunto minimo para evaluar el gate del cliente). */
interface DocumentoLike {
  categoria?: string | null;
  userId?: string | null;
  createdAt?: string | Date | null;
}

/** Campos de la solicitud necesarios para decidir si el cliente puede subir documentos. */
export interface SolicitudDocumentosGate {
  estadoSolicitud: string;
  standCodes: string[];
  /** Titular de la solicitud (para distinguir documentos del cliente vs del admin). */
  userId?: string | null;
  /** Documentos del administrador/contrato (`userId` null). */
  docsAdminCount: number;
  /** Documentos subidos por el cliente. */
  clienteDocsAdjuntosCount: number;
  reevaluaciones: ReevaluacionLike[];
  /** Integracion SGC habilitada en el servidor. */
  sgcEnabled: boolean;
  /** Estado del envio al SGC (`null` = aun sin expediente). */
  sgcEstadoEnvio: string | null;
  /** Estado del ciclo de vida en el SGC (`active`, `rejected`, ...). */
  sgcLifecycleStatus: string | null;
  /** True si ya se enviaron documentos (contrato/anexos) al expediente SGC. */
  sgcDocumentosEnviados: boolean;
  /** Modo de la subsanacion vigente: `nuevo_contrato` | `mismo_contrato` (null = libre/legacy). */
  sgcSubsanacionModo?: string | null;
  /** Motivo declarado por el admin (permite inferir el modo en declaraciones previas). */
  sgcSubsanacionMotivo?: string | null;
  /** Documentos adjuntos (para detectar si el admin ya subio un contrato corregido). */
  docsAdjuntos?: DocumentoLike[] | null;
  /** Revisiones por area de la solicitud. */
  revisiones: RevisionLike[];
}

/** Fecha (ms) de un documento; 0 si no es parseable. */
function fechaDoc(doc: DocumentoLike): number {
  const ms = doc.createdAt ? new Date(doc.createdAt).getTime() : 0;
  return Number.isNaN(ms) ? 0 : ms;
}

/** Mas reciente primero. */
function porFechaDesc(a: DocumentoLike, b: DocumentoLike): number {
  return fechaDoc(b) - fechaDoc(a);
}

/** True si el SGC devolvio (observed) o rechazo (rejected) el tramite. */
function sgcDevuelto(s: SolicitudDocumentosGate): boolean {
  return (
    s.sgcLifecycleStatus === SGC_LIFECYCLE_STATUSES.REJECTED ||
    s.sgcLifecycleStatus === SGC_LIFECYCLE_STATUSES.OBSERVED
  );
}

/**
 * Modo de subsanacion efectivo. Si la declaracion es previa a la columna `modo`
 * (null), se infiere del texto sugerido elegido por el admin (sin ediciones).
 */
export function modoSubsanacionEfectivo(s: SolicitudDocumentosGate): string | null {
  if (s.sgcSubsanacionModo) return s.sgcSubsanacionModo;
  const sugerencia = SGC_SUBSANACION_SUGERENCIAS.find((x) => x.texto === s.sgcSubsanacionMotivo);
  return sugerencia?.modo ?? null;
}

/**
 * True si el administrador subio un contrato **posterior** al ultimo contrato firmado por
 * el cliente (o si el cliente aun no firmo ninguno). En ese caso el cliente debe descargar
 * esa version nueva y volver a firmarla.
 */
export function hayContratoAdminNuevoParaFirmar(s: SolicitudDocumentosGate): boolean {
  const docs = s.docsAdjuntos ?? [];
  const firmado = docs
    .filter((d) => d.userId === s.userId && d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO)
    .sort(porFechaDesc)[0];
  /* Sin contrato firmado previo no hay nada que esperar. */
  if (!firmado) return true;

  const contratoAdmin = docs
    .filter(
      (d) =>
        d.userId === null &&
        (d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO || d.categoria === null || d.categoria === undefined),
    )
    .sort(porFechaDesc)[0];
  if (!contratoAdmin) return false;

  return fechaDoc(contratoAdmin) > fechaDoc(firmado);
}

/**
 * Ventana de **contrato de reserva multiple**: el admin ya subio el contrato
 * (existe al menos un documento que no es del cliente) y la solicitud sigue
 * pendiente. El cliente descarga el contrato y sube el suyo firmado.
 */
export function enVentanaContratoMultistand(s: SolicitudDocumentosGate): boolean {
  // El contrato del admin se identifica por `userId === null` (no por comparar con el
  // dueño de la solicitud, que falla cuando el propio admin es el titular).
  return s.standCodes.length > 1 && s.estadoSolicitud === ESTADOS_SOLICITUD.PENDIENTE && s.docsAdminCount > 0;
}

/**
 * Ventana de subida del cliente: la solicitud esta en el paso **Legal (SGC)** y
 * **aun no se enviaron documentos al SGC**:
 *  - Revision Legal delegada al SGC (`legalDelegadaAlSgc`).
 *  - Expediente SGC existente (`sgcEstadoEnvio` no nulo).
 *  - Sin documentos enviados (`sgcDocumentosEnviados = false`).
 */
export function enVentanaLegalSgc(s: SolicitudDocumentosGate): boolean {
  return (
    s.sgcEnabled &&
    s.sgcEstadoEnvio !== null &&
    !s.sgcDocumentosEnviados &&
    legalDelegadaAlSgc(s.revisiones)
  );
}

/**
 * Ventana de **subsanacion SGC**: el SGC devolvio (rechazo) el tramite y el cliente debe
 * descargar el contrato y subir su version firmada para que el administrador lo reenvie.
 *
 * Si el administrador declaro el modo `nuevo_contrato`, la ventana se mantiene cerrada
 * hasta que **el admin suba la version corregida** (contrato posterior al ultimo firmado
 * del cliente): asi el cliente no re-firma el contrato viejo por error.
 */
export function enVentanaSubsanacionSgc(s: SolicitudDocumentosGate): boolean {
  return (
    s.sgcEnabled &&
    legalDelegadaAlSgc(s.revisiones) &&
    sgcDevuelto(s) &&
    !esperandoContratoCorregidoSgc(s)
  );
}

/**
 * El admin declaro que subira un **contrato nuevo** y aun no lo adjunto: el cliente debe
 * esperar (no puede firmar el contrato vigente, que quedo observado por el SGC).
 */
export function esperandoContratoCorregidoSgc(s: SolicitudDocumentosGate): boolean {
  return (
    s.sgcEnabled &&
    legalDelegadaAlSgc(s.revisiones) &&
    sgcDevuelto(s) &&
    modoSubsanacionEfectivo(s) === SGC_SUBSANACION_MODOS.NUEVO_CONTRATO &&
    !hayContratoAdminNuevoParaFirmar(s)
  );
}

/**
 * Documentos requeridos para re-evaluacion: reserva multiple rechazada, sin documentos
 * del cliente y sin una re-evaluacion pendiente.
 */
export function requiereDocsReevaluacion(s: SolicitudDocumentosGate): boolean {
  const esMultiple = s.standCodes.length > 1;
  const reevaluacionPendiente = s.reevaluaciones.some((r) => r.estado === ESTADOS_REEVALUACION.PENDIENTE);
  return (
    esMultiple &&
    s.estadoSolicitud === ESTADOS_SOLICITUD.RECHAZADO &&
    s.clienteDocsAdjuntosCount === 0 &&
    !reevaluacionPendiente
  );
}

/**
 * Regla unica (server + cliente) para que un usuario **cliente** adjunte documentos:
 *  - contrato de reserva multiple (el admin ya subio el contrato), o
 *  - ventana Legal (SGC) mientras no se enviaron documentos al SGC, o
 *  - preparando una re-evaluacion.
 */
export function puedeClienteSubirDocumentos(s: SolicitudDocumentosGate): boolean {
  return (
    enVentanaContratoMultistand(s) ||
    enVentanaLegalSgc(s) ||
    enVentanaSubsanacionSgc(s) ||
    requiereDocsReevaluacion(s)
  );
}
