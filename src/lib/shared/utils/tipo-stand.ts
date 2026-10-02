import { TIPOS_STAND_CATALOGO } from "@/lib/shared/constants";

/**
 * Clave canonica del tipo de stand: normaliza mayusculas/espacios y resuelve los
 * alias del catalogo (p. ej. "Isla Grande" no aplica; "ISLA" → "ISLAS").
 * Devuelve null si el tipo viene vacio.
 */
export function claveTipoStand(tipo: string | null | undefined): string | null {
  const normalizado = String(tipo ?? "").toUpperCase().replace(/\s+/g, "");
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
