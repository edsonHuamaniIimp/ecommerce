import { ANEXOS_BLOQUEANTES, ANEXOS_REQUERIDOS, ESTADOS_DOCUMENTO_SOLICITUD, ESTADOS_REEVALUACION, ESTADOS_SOLICITUD, SGC_DOCUMENT_CATEGORIES, SGC_FALTANTE_TIPOS, SGC_LIFECYCLE_STATUSES, SGC_OBSERVACION_ESTADOS, SGC_SUBSANACION_MODOS, SGC_SUBSANACION_SUGERENCIAS, TIPOS_DOCUMENTO_SOLICITUD, type SgcFaltanteTipo } from "@/lib/shared/constants";
import { legalDelegadaAlSgc } from "./revision-areas";
import { dateUtils } from "./date";

interface RevisionLike {
  area: string;
}

interface ReevaluacionLike {
  estado: string;
}

/** Documento adjunto (subconjunto minimo para evaluar el gate del cliente). */
interface DocumentoLike {
  id?: string | null;
  nombre?: string | null;
  categoria?: string | null;
  userId?: string | null;
  requisito?: string | null;
  sgcObservationId?: string | null;
  sgcDocumentId?: string | null;
  sgcTitle?: string | null;
  sgcPieceId?: string | null;
  createdAt?: string | Date | null;
  /** Estado logico (ESTADOS_DOCUMENTO_SOLICITUD); ausente/activo = vigente. */
  estado?: string | null;
}

/** Observacion por documento de la ultima devolucion del SGC. */
export interface SgcObservacionLike {
  observationId?: string | null;
  documentId?: string | null;
  documentoLocalId?: string | null;
  versionNumber?: number | null;
  categoria?: string | null;
  requisito?: string | null;
  nombre?: string | null;
  title?: string | null;
  message?: string | null;
  status?: string | null;
  createdAt?: string | null;
  requiresDocumentChange?: boolean | null;
  requiresNewDocument?: boolean | null;
  /** Cantidad de archivos que cubren la observacion (default 1). */
  expectedDocuments?: number | null;
  expectedDocumentTitles?: string[] | null;
  pieces?: Array<{ id: string; title: string; acceptedDocumentId?: string | null }> | null;
  documentsMissing?: number | null;
  documentIds?: string[] | null;
  resolvedAt?: string | null;
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
  /** El revisor habilito la firma del contrato del cliente. */
  contratoHabilitado?: boolean;
  /** Revisiones por area de la solicitud. */
  revisiones: RevisionLike[];
  /** Observaciones por documento de la ultima devolucion del SGC (opcional). */
  sgcObservaciones?: SgcObservacionLike[] | null;
}

/** Fecha (ms) de un documento; 0 si no es parseable. */
function fechaDoc(doc: DocumentoLike): number {
  return dateUtils.toMs(doc.createdAt) ?? 0;
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

/** Observaciones del SGC aun vigentes (no resueltas) con mensaje. */
export function sgcObservacionesAbiertas(s: SolicitudDocumentosGate): SgcObservacionLike[] {
  return (s.sgcObservaciones ?? []).filter(
    (o) => o.status !== SGC_OBSERVACION_ESTADOS.RESOLVED && (o.message ?? "").trim().length > 0,
  );
}

/** La observacion apunta al contrato (principal o firmado por el cliente) y no a un anexo. */
export function esObservacionSgcContrato(o: SgcObservacionLike): boolean {
  return (
    o.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO ||
    o.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO ||
    o.categoria === SGC_DOCUMENT_CATEGORIES.CONTRACT
  );
}

/** La observacion apunta a un anexo/documento del cliente. */
export function esObservacionSgcAnexo(o: SgcObservacionLike): boolean {
  return !esObservacionSgcContrato(o);
}

export function tieneObservacionSgcContrato(s: SolicitudDocumentosGate): boolean {
  return sgcObservacionesAbiertas(s).some(esObservacionSgcContrato);
}

export function tieneObservacionSgcAnexos(s: SolicitudDocumentosGate): boolean {
  return sgcObservacionesAbiertas(s).some(esObservacionSgcAnexo);
}

export interface FaltanteCorreccionSgc {
  observationId?: string | null;
  title: string;
  tipo: SgcFaltanteTipo;
  pieceId?: string | null;
}

export interface EstadoCorreccionSgc {
  requeridos: number;
  cubiertos: number;
  faltantes: FaltanteCorreccionSgc[];
}

/**
 * Calcula cuantas correcciones pide el SGC y cuantas estan cubiertas.
 * Regla v7: una observacion abierta = un archivo (version o archivo nuevo).
 * Las observaciones administrativas (`requiresDocumentChange: false`) no cuentan.
 */
export function estadoCorreccionSgc(s: SolicitudDocumentosGate): EstadoCorreccionSgc {
  const observaciones = sgcObservacionesAbiertas(s).filter((o) => o.requiresDocumentChange !== false);
  if (observaciones.length === 0) return { requeridos: 0, cubiertos: 0, faltantes: [] };

  const docs = (s.docsAdjuntos ?? []).filter(
    (d) => !d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
  );
  const esCliente = (d: DocumentoLike) => (d.userId ?? null) === (s.userId ?? null);
  const claveDoc = (d: DocumentoLike, index: number) =>
    d.id ?? `${d.categoria ?? ""}:${d.requisito ?? ""}:${d.createdAt ?? ""}:${index}`;
  const usados = new Set<string>();
  /* Si hay archivos nuevos con vinculo SGC, ese vinculo manda. Sin ningun vinculo
   * (datos previos a esta version) se conserva el matching legacy por fecha. */
  const hayVinculosSgc = docs.some((d) => Boolean(d.sgcObservationId));
  const faltantes: FaltanteCorreccionSgc[] = [];
  let requeridos = 0;
  let cubiertos = 0;

  for (const o of observaciones) {
    const obsMs = dateUtils.toMs(o.createdAt ?? null);
    const esNuevo = !o.documentId || o.requiresNewDocument === true;
    const piezas = o.pieces?.filter((piece) => Boolean(piece?.id && piece?.title)) ?? null;
    if (piezas && piezas.length > 0) {
      requeridos += piezas.length;
      for (const piece of piezas) {
        if (piece.acceptedDocumentId) {
          cubiertos += 1;
          continue;
        }
        const local = docs.find((d, i) => {
          if (d.sgcPieceId !== piece.id || !esCliente(d) || usados.has(claveDoc(d, i))) return false;
          return obsMs === null || (dateUtils.toMs(d.createdAt ?? null) ?? 0) > obsMs;
        });
        if (local) {
          usados.add(claveDoc(local, docs.indexOf(local)));
          cubiertos += 1;
        } else {
          faltantes.push({
            observationId: o.observationId ?? null,
            title: piece.title,
            tipo: SGC_FALTANTE_TIPOS.NUEVO,
            pieceId: piece.id,
          });
        }
      }
      continue;
    }
    const esperados = Math.max(1, Math.trunc(o.expectedDocuments ?? 1));
    const identificado = (d: DocumentoLike) =>
      Boolean(o.observationId && d.sgcObservationId === o.observationId) ||
      Boolean(o.documentId && d.sgcDocumentId === o.documentId) ||
      Boolean(o.documentoLocalId && d.id === o.documentoLocalId) ||
      Boolean(o.requisito && d.requisito === o.requisito) ||
      Boolean(o.nombre && d.nombre === o.nombre) ||
      Boolean(o.title && (d.sgcTitle === o.title || d.nombre === o.title));
    const sinIdentificador =
      !o.observationId && !o.documentId && !o.documentoLocalId && !o.requisito && !o.nombre && !o.title;

    const seleccionados: number[] = [];
    if (obsMs !== null) {
      for (let i = 0; i < docs.length && seleccionados.length < esperados; i += 1) {
        const d = docs[i]!;
        const clave = claveDoc(d, i);
        if (usados.has(clave) || !esCliente(d)) continue;
        if ((dateUtils.toMs(d.createdAt ?? null) ?? 0) <= obsMs) continue;
        if (esObservacionSgcContrato(o)) {
          if (d.categoria !== TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO) continue;
          if (o.observationId && d.sgcObservationId) {
            if (d.sgcObservationId !== o.observationId) continue;
          }
        } else {
          if (d.categoria !== TIPOS_DOCUMENTO_SOLICITUD.ANEXO) continue;
          /* Un vinculo explicito manda: evita que un anexo cualquiera cubra una
           * observacion arbitraria solo por ser posterior a la devolucion. */
          if (o.observationId) {
            if (d.sgcObservationId) {
              if (d.sgcObservationId !== o.observationId) continue;
            } else if (hayVinculosSgc && !identificado(d)) {
              /* Compatibilidad con correcciones previas sin vinculo: solo cuenta
               * si coincide exactamente por requisito/nombre/titulo. */
              continue;
            }
          } else if (o.documentId && d.sgcDocumentId) {
            if (d.sgcDocumentId !== o.documentId) continue;
          } else if (!esNuevo && !sinIdentificador && !identificado(d)) {
            continue;
          }
        }
        seleccionados.push(i);
      }
    }

    for (const i of seleccionados) usados.add(claveDoc(docs[i]!, i));
    requeridos += esperados;
    cubiertos += seleccionados.length;
    if (seleccionados.length < esperados) {
      faltantes.push({
        observationId: o.observationId ?? null,
        title: o.title ?? o.nombre ?? "Documento",
        tipo: esNuevo ? SGC_FALTANTE_TIPOS.NUEVO : SGC_FALTANTE_TIPOS.VERSION,
      });
    }
  }

  return { requeridos, cubiertos, faltantes };
}

/**
 * True si cada observacion vigente del SGC ya tiene una correccion del cliente
 * posterior a la observacion (una por observacion).
 */
export function observacionesSgcSubsanadas(s: SolicitudDocumentosGate): boolean {
  return estadoCorreccionSgc(s).faltantes.length === 0;
}

/**
 * True solo si la observacion del contrato sigue pendiente. No se deja arrastrar
 * por una observacion de anexo que aun no se corrigio.
 */
export function observacionContratoSgcPendiente(s: SolicitudDocumentosGate): boolean {
  const observaciones = sgcObservacionesAbiertas(s).filter(esObservacionSgcContrato);
  if (observaciones.length === 0) return false;
  const faltantes = estadoCorreccionSgc(s).faltantes;
  return observaciones.some((o) =>
    faltantes.some((f) =>
      o.observationId
        ? f.observationId === o.observationId
        : f.title === (o.title ?? o.nombre ?? "Documento"),
    ),
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

  return dateUtils.isAfter(contratoAdmin.createdAt, firmado.createdAt);
}

/**
 * True si el cliente ya volvio a firmar **despues** del contrato corregido del administrador
 * (subsanacion con modo `nuevo_contrato`): el firmado anterior a la correccion quedo
 * observado por el SGC y no cuenta para reenviar.
 */
export function hayFirmadoPosteriorAlContratoCorregido(s: SolicitudDocumentosGate): boolean {
  const docs = s.docsAdjuntos ?? [];
  const contratoAdmin = docs
    .filter(
      (d) =>
        d.userId === null &&
        (d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO || d.categoria === null || d.categoria === undefined),
    )
    .sort(porFechaDesc)[0];
  if (!contratoAdmin) return false;

  const firmados = docs
    .filter((d) => d.userId === s.userId && d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO)
    .sort(porFechaDesc);
  const firmado = firmados[0];
  const firmadoAnterior = firmados[1];
  if (!firmado) return false;

  /* La correccion debe ser posterior al firmado ANTERIOR: si el contrato del admin mas
   * nuevo es anterior al unico firmado, es el contrato original — todavia no hay una
   * version corregida que el cliente pueda volver a firmar. */
  if (!firmadoAnterior || !dateUtils.isAfter(contratoAdmin.createdAt, firmadoAnterior.createdAt)) return false;

  return dateUtils.isAfter(firmado.createdAt, contratoAdmin.createdAt);
}

/**
 * Ventana de **contrato de reserva**: el admin ya subio el contrato
 * (documento con `userId` null) y la solicitud sigue pendiente. El cliente
 * descarga el contrato y sube su version firmada + anexos (envio inicial del
 * wizard o reemplazo antes de la revision Legal).
 */
export function enVentanaContratoReserva(s: SolicitudDocumentosGate): boolean {
  // El contrato del admin se identifica por `userId === null` (no por comparar con el
  // dueño de la solicitud, que falla cuando el propio admin es el titular).
  return s.estadoSolicitud === ESTADOS_SOLICITUD.PENDIENTE && s.docsAdminCount > 0;
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
 * Ventana de documentos del cliente tras un rechazo/devolucion del SGC.
 * Es independiente de si el contrato esta esperando correccion: el cliente
 * puede reemplazar anexos/documentos aunque el contrato siga pendiente.
 */
export function enVentanaDocumentosSgc(s: SolicitudDocumentosGate): boolean {
  return s.sgcEnabled && legalDelegadaAlSgc(s.revisiones) && sgcDevuelto(s);
}

/** Subida de anexos del cliente durante una devolucion del SGC. */
export function puedeClienteSubirAnexosSgc(s: SolicitudDocumentosGate): boolean {
  return enVentanaDocumentosSgc(s);
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
 * Anexos requeridos que aun no tienen un archivo adjunto (se identifica por el
 * `requisito` de cada documento). Devuelve las claves faltantes de `ANEXOS_REQUERIDOS`.
 */
/**
 * True si el documento cuenta como vigente (sin estado = legacy/activo; los
 * observados/reemplazados/dados de baja no cubren el requisito).
 */
function documentoVigente(d: DocumentoLike): boolean {
  return !d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO;
}

export function anexosRequeridosFaltantes(
  docs: DocumentoLike[] | null | undefined,
  requeridos: { key: string }[] = ANEXOS_REQUERIDOS,
): string[] {
  const presentes = new Set(
    (docs ?? [])
      .filter((d) => d.userId !== null && d.categoria !== TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO && documentoVigente(d))
      .map((d) => d.requisito)
      .filter((r): r is string => Boolean(r)),
  );
  return requeridos.map((r) => r.key).filter((k) => !presentes.has(k));
}

/** Claves de los anexos **bloqueantes** (Vigencia de Poderes / DNI) que aun faltan. */
export function anexosBloqueantesFaltantes(docs: DocumentoLike[] | null | undefined): string[] {
  const bloqueantes = ANEXOS_REQUERIDOS.filter((a) => ANEXOS_BLOQUEANTES.includes(a.key));
  return anexosRequeridosFaltantes(docs, bloqueantes);
}

/**
 * True si falta algun anexo **bloqueante** (Vigencia de Poderes o DNI del
 * representante legal): sin ellos no se puede enviar a revision Legal (RF-13).
 */
export function faltanAnexosBloqueantes(docs: DocumentoLike[] | null | undefined): boolean {
  return anexosBloqueantesFaltantes(docs).length > 0;
}

/**
 * Ventana de **observacion local**: el revisor Asociado observo documentos; el
 * cliente puede subir nuevas versiones de los documentos observados.
 */
export function enVentanaObservacionLocal(s: SolicitudDocumentosGate): boolean {
  return s.estadoSolicitud === ESTADOS_SOLICITUD.OBSERVADO;
}

/**
 * Ventana de anexos iniciales: la reserva ya existe en estado pendiente y aun no
 * hay contrato del administrador. Aplica a eventos configurados con contrato posterior.
 */
export function enVentanaAnexosReserva(s: SolicitudDocumentosGate): boolean {
  return s.estadoSolicitud === ESTADOS_SOLICITUD.PENDIENTE && s.docsAdminCount === 0;
}

/**
 * Regla unica (server + cliente) para que un usuario **cliente** adjunte documentos:
 *  - contrato de reserva (el admin ya subio el contrato), o
 *  - anexos iniciales de una reserva con contrato posterior, o
 *  - ventana Legal (SGC) mientras no se enviaron documentos al SGC, o
 *  - preparando una re-evaluacion, o
 *  - solicitud observada por el Asociado (reemplazo de documentos).
 */
export function puedeClienteSubirDocumentos(s: SolicitudDocumentosGate): boolean {
  return (
    enVentanaContratoReserva(s) ||
    enVentanaLegalSgc(s) ||
    enVentanaSubsanacionSgc(s) ||
    requiereDocsReevaluacion(s) ||
    enVentanaObservacionLocal(s)
  );
}

/**
 * True si el contrato firmado observado sigue pendiente de reemplazo: no existe
 * una firma activa posterior del mismo cliente. Evita que un firmado viejo
 * observado bloquee la subsanacion despues de que el cliente ya volvio a firmar.
 */
export function contratoFirmadoPendienteReemplazo(s: SolicitudDocumentosGate): boolean {
  const docs = s.docsAdjuntos ?? [];
  const firmados = docs.filter((d) => d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO);
  return firmados.some((obs) => {
    if (obs.estado !== ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO) return false;
    return !firmados.some((d) =>
      (!d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO) &&
      (d.userId ?? null) === (obs.userId ?? null) &&
      dateUtils.isAfter(d.createdAt, obs.createdAt),
    );
  });
}

/**
 * El revisor habilito la firma y el cliente aun no firmo. El contrato se
 * genera recien al firmar desde Mis solicitudes.
 */
export function contratoHabilitadoPendienteFirma(s: SolicitudDocumentosGate): boolean {
  if (
    s.contratoHabilitado !== true ||
    s.estadoSolicitud !== ESTADOS_SOLICITUD.PENDIENTE
  ) {
    return false;
  }
  const docs = s.docsAdjuntos ?? [];
  const vigente = (d: DocumentoLike) =>
    !d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO;
  const contratoAdmin = docs
    .filter(
      (d) =>
        vigente(d) &&
        d.userId === null &&
        (d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO ||
          d.categoria === null ||
          d.categoria === undefined),
    )
    .sort(porFechaDesc)[0];
  const firmado = docs
    .filter(
      (d) =>
        vigente(d) &&
        d.userId === s.userId &&
        d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
    )
    .sort(porFechaDesc)[0];
  if (!contratoAdmin) return !firmado;
  if (!firmado) return true;
  return (dateUtils.toMs(firmado.createdAt) ?? 0) < (dateUtils.toMs(contratoAdmin.createdAt) ?? 0);
}

/** El cliente solo puede firmar cuando el revisor habilito la firma. */
export function contratoClientePendienteFirma(s: SolicitudDocumentosGate): boolean {
  return contratoHabilitadoPendienteFirma(s);
}