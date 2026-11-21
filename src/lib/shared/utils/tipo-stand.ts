import { TIPOS_STAND_CATALOGO } from "@/lib/shared/constants";
import { repararTextoCp437 } from "@/lib/shared/utils/texto-externo";

/**
 * Repara los caracteres CP437 que aparecen cuando una vocal acentuada llega
 * desde una fuente Latin-1/CP437 ("EST┴NDAR" / "EXHIBICIËN" -> "ESTÁNDAR" / "EXHIBICIÓN").
 */
export function normalizarTipoStand(tipo: string | null | undefined): string | null {
  const normalizado = repararTextoCp437(String(tipo ?? "")).trim();
  return normalizado || null;
}

/**
 * Clave canonica del tipo de stand: normaliza mayusculas/espacios y resuelve los
 * alias del catalogo (p. ej. "Isla Grande" no aplica; "ISLA" -> "ISLAS").
 * Devuelve null si el tipo viene vacio.
 */
export function claveTipoStand(tipo: string | null | undefined): string | null {
  const normalizado = normalizarTipoStand(tipo)?.toUpperCase().replace(/\s+/g, "");
  if (!normalizado) return null;
  const grupo = TIPOS_STAND_CATALOGO.find((t) => t.key === normalizado || t.alias.includes(normalizado));
  return grupo?.key ?? normalizado;
}

/** Etiqueta legible de un tipo de stand (catalogo) o el mismo valor si no esta. */
export function labelTipoStand(tipo: string | null | undefined): string | null {
  const clave = claveTipoStand(tipo);
  if (!clave) return null;
  return TIPOS_STAND_CATALOGO.find((t) => t.key === clave)?.label ?? clave;
}

/** Area declarada en el tipo de stand ("ESQUINERO 16MT2" -> "16 m2"); null si no se puede inferir. */
export function areaDesdeTipoStand(tipo: string | null | undefined): string | null {
  const match = /(\d+(?:[.,]\d+)?)\s*MT2/i.exec(String(tipo ?? ""));
  const numero = match?.[1]?.replace(",", ".");
  return numero ? `${numero} m²` : null;
}
