import {
  ANEXOS_REQUERIDOS,
  SGC_IDEMPOTENCY_PREFIX,
  SGC_LIFECYCLE_STATUSES,
  SGC_MIME_TYPES,
  SGC_MIME_TYPE_DEFAULT,
  SGC_OBSERVACION_ESTADOS,
  SGC_RECONCILIAR_TERMINALES_CADA_MS,
  SGC_WEBHOOK_TOLERANCE_SECONDS,
} from "@/lib/shared/constants";
import type { SgcObservacionDocumento } from "@/domain/models/sgc";

/** Expediente con aprobacion final (vigente o finalizado). */
export function esLifecycleTerminalSgc(lifecycle: string | null | undefined): boolean {
  return lifecycle === SGC_LIFECYCLE_STATUSES.ACTIVE || lifecycle === SGC_LIFECYCLE_STATUSES.FINALIZED;
}

/**
 * Orden de consulta del cron de reconciliacion:
 * 1. expedientes en curso, del menos recientemente sincronizado al mas reciente;
 * 2. terminales, solo si llevan mas de 24 h sin consultar.
 * Un expediente que fallo tambien actualiza `lastSyncedAt`, asi que no se queda
 * primero en la cola para siempre.
 */
export function ordenarParaReconciliar<T extends { lifecycleStatus?: string | null; lastSyncedAt?: Date | null }>(
  expedientes: readonly T[],
  ahora: number,
): T[] {
  const ms = (e: T) => e.lastSyncedAt?.getTime() ?? 0;
  const enCurso = expedientes.filter((e) => !esLifecycleTerminalSgc(e.lifecycleStatus));
  const terminales = expedientes.filter(
    (e) => esLifecycleTerminalSgc(e.lifecycleStatus) && ahora - ms(e) >= SGC_RECONCILIAR_TERMINALES_CADA_MS,
  );
  return [...enCurso.sort((a, b) => ms(a) - ms(b)), ...terminales.sort((a, b) => ms(a) - ms(b))];
}

/**
 * Decide si una sincronizacion (lectura/cron) debe avisar al cliente de una devolucion.
 * Solo avisa al entrar en devolucion o cuando aparecen observaciones abiertas nuevas
 * (por `observationId`). Nunca compara textos: el motivo del webhook (`reason`) y el
 * mensaje de la observacion son distintos y la comparacion reenviaba el aviso en cada
 * sincronizacion.
 */
export function debeNotificarDevolucionSgc(params: {
  preservar: boolean;
  esDevolucion: boolean;
  estabaDevuelto: boolean;
  observacionesAbiertas: readonly SgcObservacionDocumento[];
  observacionesPrevias: readonly SgcObservacionDocumento[] | null | undefined;
}): boolean {
  if (params.preservar) return false;
  const abiertas = params.observacionesAbiertas;
  const requiereCambio = abiertas.length === 0 || abiertas.some((o) => o.requiresDocumentChange !== false);
  if (!requiereCambio) return false;
  const clave = (o: SgcObservacionDocumento) => o.observationId ?? `${o.title ?? ""}|${o.message}`;
  /* Una observacion que antes estaba abierta no es nueva; una que estaba resuelta y
   * vuelve a abrirse con el mismo id tampoco se reavisa (el SGC crea ids nuevos por ronda). */
  const previas = new Set((params.observacionesPrevias ?? []).map(clave));
  const nuevas = abiertas.filter((o) => o.status !== SGC_OBSERVACION_ESTADOS.RESOLVED && !previas.has(clave(o)));
  if (params.esDevolucion && !params.estabaDevuelto) return true;
  return nuevas.length > 0;
}

/**
 * Construye la Idempotency-Key determinista para crear un expediente en el SGC
 * a partir del id de la solicitud de stand local. Un mismo id produce siempre
 * la misma clave, evitando expedientes duplicados ante reintentos de red.
 */
export function construirIdempotencyKey(solicitudId: string): string {
  const id = solicitudId.trim();
  if (!id) throw new Error("solicitudId requerido para la Idempotency-Key del SGC");
  return `${SGC_IDEMPOTENCY_PREFIX}/${id}`;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hash SHA-256 en hexadecimal minuscula, requerido por el SGC antes de subir. */
export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new Uint8Array(data));
  return toHex(new Uint8Array(digest));
}

/** HMAC-SHA256 en hexadecimal minuscula (firma de webhooks del SGC). */
export async function hmacSha256Hex(secret: string, mensaje: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const firma = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(mensaje));
  return toHex(new Uint8Array(firma));
}

/** Comparacion de strings en tiempo constante (evita ataques por temporizacion). */
export function comparacionTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferencia === 0;
}

export interface SgcFirmaParseada {
  timestamp: number;
  firma: string;
}

/** Parsea el header `x-sgc-signature` con formato `t=<unix>,v1=<hmac>`. */
export function parsearFirmaSgc(header: string): SgcFirmaParseada | null {
  let timestamp: number | null = null;
  let firma: string | null = null;
  for (const parte of header.split(",")) {
    const [clave, valor] = parte.split("=");
    const k = clave?.trim();
    if (k === "t") timestamp = Number(valor);
    else if (k === "v1") firma = valor?.trim() || null;
  }
  if (timestamp === null || !Number.isFinite(timestamp) || !firma) return null;
  return { timestamp, firma };
}

/** Verifica firma HMAC y ventana de tolerancia de un webhook del SGC. */
export async function verificarFirmaSgc(params: {
  secret: string;
  header: string | null;
  payload: string;
  ahoraSegundos: number;
}): Promise<boolean> {
  if (!params.secret || !params.header) return false;
  const parsed = parsearFirmaSgc(params.header);
  if (!parsed) return false;
  if (Math.abs(params.ahoraSegundos - parsed.timestamp) > SGC_WEBHOOK_TOLERANCE_SECONDS) return false;
  const esperada = await hmacSha256Hex(params.secret, `${parsed.timestamp}.${params.payload}`);
  return comparacionTiempoConstante(esperada, parsed.firma.toLowerCase());
}

/** Motivo por el que un webhook del SGC no pasa la verificacion (diagnostico sin secretos). */
export type MotivoFirmaSgcInvalida = "sin_secreto" | "sin_header" | "header_invalido" | "fuera_de_ventana" | "firma_no_coincide";

/** Igual que `verificarFirmaSgc`, pero informa el motivo del rechazo (null = valida). */
export async function diagnosticarFirmaSgc(params: {
  secret: string;
  header: string | null;
  payload: string;
  ahoraSegundos: number;
}): Promise<MotivoFirmaSgcInvalida | null> {
  if (!params.secret) return "sin_secreto";
  if (!params.header) return "sin_header";
  const parsed = parsearFirmaSgc(params.header);
  if (!parsed) return "header_invalido";
  if (Math.abs(params.ahoraSegundos - parsed.timestamp) > SGC_WEBHOOK_TOLERANCE_SECONDS) return "fuera_de_ventana";
  return (await verificarFirmaSgc(params)) ? null : "firma_no_coincide";
}

/** Mime declarado exacto segun la extension del archivo (formatos admitidos por el SGC). */
export function extensionArchivo(nombre: string): string {
  const ext = (nombre.split(".").pop() ?? "pdf").toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext || "pdf";
}

export function mimeDesdeNombre(nombre: string): string {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  return SGC_MIME_TYPES[ext] ?? SGC_MIME_TYPE_DEFAULT;
}

export interface DocumentoUrl {
  url: string;
  nombre: string;
  /** Requisito del anexo (clave de ANEXOS_REQUERIDOS) para derivar el titulo legible. */
  requisito?: string | null;
  sgcObservationId?: string | null;
  sgcDocumentId?: string | null;
  sgcTitle?: string | null;
  sgcPieceId?: string | null;
  /**
   * El archivo corrige una observacion que el SGC ya marco resuelta: no se reenvia, pero
   * sigue siendo "la version mas nueva" de su documento y evita que un archivo anterior
   * (p. ej. el original, aun activo) se suba encima como version nueva.
   */
  observacionResuelta?: boolean;
}

/**
 * Extrae documentos de la columna legacy `documentos` (JSON del stand/solicitud),
 * que puede venir como `string[]` de URLs o como objetos `{ url, nombre }`.
 * El flujo SGC debe considerar **ambas** fuentes (tabla y JSON legacy).
 */
export function extraerDocumentosLegacy(documentos: unknown): DocumentoUrl[] {
  if (!Array.isArray(documentos)) return [];
  const items: DocumentoUrl[] = [];
  for (const item of documentos) {
    if (typeof item === "string" && item.trim()) {
      items.push({ url: item, nombre: item.split("/").pop() ?? item });
    } else if (item && typeof item === "object" && typeof (item as { url?: unknown }).url === "string") {
      const url = (item as { url: string }).url;
      const nombre = (item as { nombre?: string }).nombre ?? url.split("/").pop() ?? url;
      items.push({ url, nombre });
    }
  }
  return items;
}

/** Titulo legible que se envia al SGC para un anexo. */
export function tituloSgcDocumento(nombreOriginal: string, requisito?: string | null): string {
  const etiqueta = ANEXOS_REQUERIDOS.find((a) => a.key === requisito)?.label;
  if (etiqueta) return etiqueta;
  const sinExtension = nombreOriginal.replace(/\.[^.]+$/, "").trim();
  return sinExtension || "Documento adicional";
}

/** Nombre fisico unico y legible que se envia al SGC para un anexo. */
export function nombreArchivoSgc(params: {
  titulo: string;
  nombreOriginal: string;
  requisito?: string | null;
  identificador?: string | null;
  hash: string;
}): string {
  const slug = (texto: string): string => texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  const extension = (params.nombreOriginal.split(".").pop() ?? "pdf")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") || "pdf";
  const base = slug(params.requisito || params.titulo) || "documento";
  const identificador = slug(params.identificador ?? "");
  return [base, identificador, params.hash].filter(Boolean).join("-") + "." + extension;
}

/** Secuencias UTF-8 leídas como Latin-1/Windows-1252 (p. ej. "separaciÃ³n"). */
const MOJIBAKE_UTF8: ReadonlyArray<readonly [string, string]> = [
  ["Ã¡", "á"], ["Ã©", "é"], ["Ã­", "í"], ["Ã³", "ó"], ["Ãº", "ú"], ["Ã±", "ñ"], ["Ã¼", "ü"],
  ["Ã\u0081", "Á"], ["Ã‰", "É"], ["Ã\u008d", "Í"], ["Ã“", "Ó"], ["Ãš", "Ú"], ["Ã‘", "Ñ"],
  ["Â°", "°"], ["Âº", "º"], ["Âª", "ª"], ["Â·", "·"], ["â€”", "—"], ["â€“", "–"], ["â€œ", "“"], ["â€\u009d", "”"], ["â€™", "’"],
];

/**
 * Palabras que el SGC suele devolver con la tilde perdida (U+FFFD, "separaci\uFFFDn"): el título del
 * contrato se registró con codificación errónea en algunos expedientes y el SGC lo repite en cada
 * observación. Solo se reparan palabras conocidas para no adivinar la letra perdida.
 */
const PALABRAS_CON_TILDE = [
  "separación", "revisión", "subsanación", "documentación", "observación", "información", "corrección",
  "versión", "razón", "dirección", "inscripción", "exhibición", "participación", "representación",
  "también", "después", "aún", "todavía", "público", "jurídica", "jurídico", "trámite", "páginas", "página",
  "válido", "válida", "número", "teléfono", "electrónico", "perú", "minería", "ingeniería", "sección",
  "cláusula", "año",
];

const CARACTER_REEMPLAZO = "\uFFFD";

const PATRONES_TILDE_PERDIDA: ReadonlyArray<readonly [RegExp, string]> = PALABRAS_CON_TILDE.map((palabra) => {
  const patron = Array.from(palabra)
    .map((c) => (/[^\x00-\x7F]/.test(c) ? CARACTER_REEMPLAZO : c))
    .join("");
  return [new RegExp(`(?<!\\p{L})${patron}(?!\\p{L})`, "giu"), palabra] as const;
});

/** Conserva la capitalización del texto hallado (MAYÚSCULAS, Inicial o minúsculas). */
function conCapitalizacion(hallado: string, palabra: string): string {
  if (hallado === hallado.toUpperCase()) return palabra.toUpperCase();
  const inicial = hallado.charAt(0);
  if (inicial === inicial.toUpperCase()) return palabra.charAt(0).toUpperCase() + palabra.slice(1);
  return palabra;
}

/**
 * Repara texto del SGC con codificación rota **solo para mostrarlo** (mensajes de observación,
 * títulos). No usar sobre títulos/ids que se comparan con el SGC: allí el valor debe quedar tal
 * cual lo guarda el SGC para que el emparejamiento siga funcionando.
 */
export function repararTextoSgc(valor: string): string;
export function repararTextoSgc(valor: string | null | undefined): string | null | undefined;
export function repararTextoSgc(valor: string | null | undefined): string | null | undefined {
  if (!valor) return valor;
  let salida = valor;
  if (salida.includes("Ã") || salida.includes("Â") || salida.includes("â€")) {
    for (const [roto, bueno] of MOJIBAKE_UTF8) salida = salida.split(roto).join(bueno);
  }
  if (salida.includes(CARACTER_REEMPLAZO)) {
    for (const [patron, palabra] of PATRONES_TILDE_PERDIDA) {
      salida = salida.replace(patron, (hallado) => conCapitalizacion(hallado, palabra));
    }
  }
  return salida;
}

/** Textos automaticos del SGC por observacion (§8.3): no son el comentario del revisor. */
const MENSAJE_AUTOMATICO_SGC = /^(Corrige el (contrato|adjunto)\b|Falta enviar\b)/i;

export function esMensajeAutomaticoSgc(texto: string | null | undefined): boolean {
  return MENSAJE_AUTOMATICO_SGC.test((texto ?? "").trim());
}

const FIN_DE_FRASE = /[.!?)»"”]$/;

/**
 * Motivo de la devolucion **vigente** leido de `history[]` del `GET /contracts/{id}`.
 *
 * El comentario del revisor viaja completo solo en `data.reason` del webhook; el detalle
 * trae ademas una entrada `source: "observation"` con el mismo texto («Adjuntos a corregir:
 * … Comentario: …») que el SGC **recorta** (~250 caracteres). Sirve de respaldo cuando el
 * webhook no llega. Solo cuenta la observacion posterior al ultimo inicio/reenvio de ronda.
 * Si el texto parece recortado (sin cierre de frase) se marca con «…».
 */
export function motivoDevolucionDesdeHistorial(
  history: ReadonlyArray<{ source?: string | null; title?: string | null; detail?: string | null; occurredAt?: string | null }> | null | undefined,
): string | null {
  if (!Array.isArray(history) || history.length === 0) return null;
  const ordenado = history
    .map((h, i) => ({ h, i, t: Date.parse(String(h.occurredAt ?? "")) }))
    .sort((a, b) => (Number.isFinite(b.t) && Number.isFinite(a.t) && b.t !== a.t ? b.t - a.t : a.i - b.i));
  for (const { h } of ordenado) {
    const titulo = h.title ?? "";
    if (/iniciad|reenviad|enviado a revisi/i.test(titulo) && h.source !== "observation") return null;
    if (h.source !== "observation") continue;
    const detalle = repararTextoSgc((h.detail ?? "").trim());
    if (!detalle) continue;
    return FIN_DE_FRASE.test(detalle) ? detalle : `${detalle}…`;
  }
  return null;
}

/**
 * Decide si el motivo del historial reemplaza al guardado: siempre que el guardado falte,
 * sea un texto automatico del SGC o sea de otra ronda. No pisa el `reason` completo del
 * webhook de la misma ronda (el del historial es su prefijo recortado).
 */
export function debeActualizarMotivoDevolucion(actual: string | null | undefined, desdeHistorial: string | null): boolean {
  if (!desdeHistorial) return false;
  const guardado = (actual ?? "").trim();
  if (!guardado || esMensajeAutomaticoSgc(guardado)) return guardado !== desdeHistorial;
  const prefijo = desdeHistorial.replace(/…$/, "").trim();
  return !repararTextoSgc(guardado).startsWith(prefijo);
}

/**
 * Comentario del revisor para mostrar al cliente: la parte posterior a «Comentario:» si
 * existe; si no, el motivo completo salvo que sea un texto automatico del SGC.
 */
export function comentarioDevolucionSgc(motivo: string | null | undefined): string | null {
  const texto = repararTextoSgc((motivo ?? "").trim());
  if (!texto) return null;
  const marca = texto.search(/Comentario:/i);
  if (marca >= 0) {
    const comentario = texto.slice(marca + "Comentario:".length).trim();
    return comentario && comentario !== "…" ? comentario : null;
  }
  return esMensajeAutomaticoSgc(texto) ? null : texto;
}

const MAX_OBSERVACIONES = 20;
const MAX_MENSAJE_OBSERVACION = 500;
const MAX_TEXTO_OBSERVACION = 200;

/**
 * Normaliza `data.observations` del SGC. Es un campo **OPCIONAL** (las versiones previas de
 * la integracion no lo envian): devuelve `null` cuando no viene como arreglo para que los
 * llamadores puedan distinguir "no informado" de "sin observaciones" (arreglo vacio).
 */
/** Error del SGC cuando el expediente esta en revision (v8): no se debe subir ni reintentar. */
export function esErrorRevisionEnCurso(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  const message = err instanceof Error ? err.message : "";
  return status === 409 && /revisi[oó]n est[aá] en curso|review.*in progress/i.test(message);
}
export function normalizarObservacionesSgc(raw: unknown): SgcObservacionDocumento[] | null {
  if (!Array.isArray(raw)) return null;
  const texto = (valor: unknown, max = MAX_TEXTO_OBSERVACION): string | null =>
    typeof valor === "string" && valor.trim() ? valor.trim().slice(0, max) : null;
  const salida: SgcObservacionDocumento[] = [];
  for (const item of raw.slice(0, MAX_OBSERVACIONES)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const mensaje = typeof o.message === "string" ? o.message.trim().slice(0, MAX_MENSAJE_OBSERVACION) : "";
    if (!mensaje) continue;
    /* `createdBy` puede venir como texto o como { name, email }. */
    const autor = o.createdBy;
    const creadoPor =
      typeof autor === "string"
        ? texto(autor)
        : autor && typeof autor === "object" && typeof (autor as { name?: unknown }).name === "string"
          ? texto((autor as { name: string }).name)
          : null;
    const expectedRaw =
      typeof o.expectedDocuments === "number" ? o.expectedDocuments : o.expectedDocumentCount;
    const expectedDocuments =
      typeof expectedRaw === "number" && Number.isFinite(expectedRaw) && expectedRaw >= 1
        ? Math.min(MAX_OBSERVACIONES, Math.trunc(expectedRaw))
        : null;
    const expectedDocumentTitles = Array.isArray(o.expectedDocumentTitles)
      ? o.expectedDocumentTitles
          .slice(0, MAX_OBSERVACIONES)
          .map((title) => texto(title))
          .filter((title): title is string => Boolean(title))
      : null;
    const pieces = Array.isArray(o.pieces)
      ? o.pieces
          .slice(0, MAX_OBSERVACIONES)
          .map((rawPiece) => {
            if (!rawPiece || typeof rawPiece !== "object") return null;
            const piece = rawPiece as Record<string, unknown>;
            const id = texto(piece.id ?? piece.pieceId, 64);
            const title = texto(piece.title);
            if (!id || !title) return null;
            return {
              id,
              title,
              acceptedDocumentId: texto(piece.acceptedDocumentId, 64),
            };
          })
          .filter((piece): piece is NonNullable<typeof piece> => piece !== null)
      : null;
    const documentsMissing =
      typeof o.documentsMissing === "number" && Number.isFinite(o.documentsMissing)
        ? Math.max(0, Math.trunc(o.documentsMissing))
        : null;
    const documentIds = Array.isArray(o.documentIds)
      ? o.documentIds
          .slice(0, MAX_OBSERVACIONES)
          .map((id) => texto(id, 64))
          .filter((id): id is string => Boolean(id))
      : null;
    salida.push({
      observationId: texto(o.observationId, 64),
      documentId: texto(o.documentId, 64),
      versionId: texto(o.versionId, 64),
      versionNumber:
        typeof o.versionNumber === "number" && Number.isFinite(o.versionNumber)
          ? Math.trunc(o.versionNumber)
          : null,
      category: texto(o.category, 30),
      title: texto(o.title),
      severity: texto(o.severity, 20),
      message: mensaje,
      requiresDocumentChange: typeof o.requiresDocumentChange === "boolean" ? o.requiresDocumentChange : null,
      requiresNewDocument: typeof o.requiresNewDocument === "boolean" ? o.requiresNewDocument : null,
      ...(expectedDocuments !== null ? { expectedDocuments } : {}),
      ...(expectedDocumentTitles !== null ? { expectedDocumentTitles } : {}),
      ...(pieces !== null ? { pieces } : {}),
      ...(documentsMissing !== null ? { documentsMissing } : {}),
      ...(documentIds !== null ? { documentIds } : {}),
      status: texto(o.status, 20),
      resolvedAt: texto(o.resolvedAt, 40),
      createdBy: creadoPor,
      createdAt: texto(o.createdAt, 40),
    });
  }
  return salida;
}
