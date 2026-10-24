import "server-only";

import type { IimpDocumentoRow } from "@/domain/ports/facturacion-repository";

/**
 * Construye la URL publica de una factura del IIMP a partir de los datos
 * fiscales que devuelve la reserva. La plantilla es configurable porque el
 * robot puede publicar en S3 o en otro dominio/prefijo.
 */
export function urlFacturaIimp(documento: IimpDocumentoRow): string | null {
  const template = process.env.FACTURAS_PDF_URL_TEMPLATE?.trim();
  if (!template) return null;

  const ruc = process.env.FACTURAS_EMISOR_RUC?.trim() ?? "";
  if (template.includes("{ruc}") && !ruc) return null;

  const valores: Record<string, string> = {
    ruc,
    tipo: documento.tipoDocumento,
    serie: documento.serie,
    numero: String(documento.numero),
  };
  const url = template.replace(/\{(ruc|tipo|serie|numero)\}/g, (_, clave: string) =>
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

/** Nombre visible/descarga de una factura del IIMP. */
export function nombreFacturaIimp(documento: IimpDocumentoRow): string {
  return `${documento.serie}-${documento.numero}.pdf`;
}
