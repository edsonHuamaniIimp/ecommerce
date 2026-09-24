import { ESTADOS_REEVALUACION, ESTADOS_SOLICITUD } from "@/lib/shared/constants";
import { legalDelegadaAlSgc } from "./revision-areas";

interface RevisionLike {
  area: string;
}

interface ReevaluacionLike {
  estado: string;
}

/** Campos de la solicitud necesarios para decidir si el cliente puede subir documentos. */
export interface SolicitudDocumentosGate {
  estadoSolicitud: string;
  standCodes: string[];
  /** Documentos del administrador/contrato (`userId` null). */
  docsAdminCount: number;
  /** Documentos subidos por el cliente. */
  clienteDocsAdjuntosCount: number;
  reevaluaciones: ReevaluacionLike[];
  /** Integracion SGC habilitada en el servidor. */
  sgcEnabled: boolean;
  /** Estado del envio al SGC (`null` = aun sin expediente). */
  sgcEstadoEnvio: string | null;
  /** True si ya se enviaron documentos (contrato/anexos) al expediente SGC. */
  sgcDocumentosEnviados: boolean;
  /** Revisiones por area de la solicitud. */
  revisiones: RevisionLike[];
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
  return enVentanaContratoMultistand(s) || enVentanaLegalSgc(s) || requiereDocsReevaluacion(s);
}
