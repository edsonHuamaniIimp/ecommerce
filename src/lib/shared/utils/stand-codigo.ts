/** Prefijo tecnico con el que el plano nombra sus bloques (mockup/vinculacion). */
const PREFIJO_BLOQUE = "BLOQUE-";

/**
 * Codigo comercial del stand: si el dato viene del plano (p. ej. "BLOQUE-774")
 * se muestra solo el codigo comercial ("774"); si ya es comercial se deja igual.
 */
export function codigoComercialStand(codigo: string | null | undefined): string {
  const valor = String(codigo ?? "").trim();
  if (valor.toUpperCase().startsWith(PREFIJO_BLOQUE)) {
    return valor.slice(PREFIJO_BLOQUE.length).trim();
  }
  return valor;
}
