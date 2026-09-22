import {
  SGC_IDEMPOTENCY_PREFIX,
  SGC_MIME_TYPES,
  SGC_MIME_TYPE_DEFAULT,
  SGC_WEBHOOK_TOLERANCE_SECONDS,
} from "@/lib/shared/constants";

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
export function mimeDesdeNombre(nombre: string): string {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  return SGC_MIME_TYPES[ext] ?? SGC_MIME_TYPE_DEFAULT;
}

export interface DocumentoUrl {
  url: string;
  nombre: string;
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
