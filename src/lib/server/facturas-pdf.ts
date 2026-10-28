import "server-only";

import type { IimpDocumentoRow } from "@/domain/ports/facturacion-repository";

/** Aplica la plantilla configurada (S3 u otro dominio) y valida que sea una URL http(s). */
function construirUrl(valores: Record<string, string>): string | null {
  const template = process.env.FACTURAS_PDF_URL_TEMPLATE?.trim();
  if (!template) return null;

  if (template.includes("{ruc}") && !valores.ruc) return null;

  const url = template.replace(/\{(ruc|tipo|serie|numero|documento)\}/g, (_, clave: string) =>
    encodeURIComponent(valores[clave] ?? ""),
  );
  if (url.includes("{") || url.includes("}")) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Construye la URL publica de una factura del IIMP a partir de los datos
 * fiscales que devuelve la reserva. La plantilla es configurable porque el
 * robot puede publicar en S3 o en otro dominio/prefijo.
 */
export function urlFacturaIimp(documento: IimpDocumentoRow): string | null {
  return construirUrl({
    ruc: process.env.FACTURAS_EMISOR_RUC?.trim() ?? "",
    tipo: documento.tipoDocumento,
    serie: documento.serie,
    numero: String(documento.numero),
  });
}

/**
 * Construye la URL del documento notificado por el sistema de facturacion
 * (nombre `RUC-TIPO-SERIE-NUMERO.pdf`). Soporta plantillas con `{documento}`
 * o con los campos parseados del nombre.
 */
export function urlDocumentoSie(nombreDocumento: string): string | null {
  const nombre = nombreDocumento.trim();
  if (!/^[\w][\w.-]*\.pdf$/i.test(nombre) || nombre.includes("..")) return null;

  const template = process.env.FACTURAS_PDF_URL_TEMPLATE?.trim() ?? "";
  const partes = nombre.match(/^(\d+)-(\d+)-([A-Za-z0-9]+)-(\d+)\.pdf$/i);
  if (!partes && !template.includes("{documento}")) return null;

  return construirUrl({
    documento: nombre,
    ruc: process.env.FACTURAS_EMISOR_RUC?.trim() ?? "",
    tipo: partes?.[2] ?? "",
    serie: (partes?.[3] ?? "").toUpperCase(),
    numero: partes?.[4] ?? "",
  });
}

/** Nombre visible/descarga de una factura del IIMP. */
export function nombreFacturaIimp(documento: IimpDocumentoRow): string {
  return `${documento.serie}-${documento.numero}.pdf`;
}
