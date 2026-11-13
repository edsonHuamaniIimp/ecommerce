import {
  ANEXOS_REQUERIDOS,
  SGC_IDEMPOTENCY_PREFIX,
  SGC_MIME_TYPES,
  SGC_MIME_TYPE_DEFAULT,
  SGC_WEBHOOK_TOLERANCE_SECONDS,
} from "@/lib/shared/constants";
import type { SgcObservacionDocumento } from "@/domain/models/sgc";

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
      status: texto(o.status, 20),
      resolvedAt: texto(o.resolvedAt, 40),
      createdBy: creadoPor,
      createdAt: texto(o.createdAt, 40),
    });
  }
  return salida;
}
