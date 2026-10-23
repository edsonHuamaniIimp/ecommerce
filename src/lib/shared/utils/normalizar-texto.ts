/**
 * Normaliza un texto para comparar: sin tildes, en mayusculas, sin puntuacion y con
 * espacios colapsados. "N.A." y "n/a" terminan ambos como "N A".
 */
export function normalizarTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}
