/**
 * Repara etiquetas de pabellon con el caracter CP437 que sustituye a "Ó"
 * cuando la fuente viene codificada como Latin-1/CP437 ("PABELLËN" -> "PABELLÓN").
 */
export function normalizarPabellon(valor: string | null | undefined): string | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  return texto.replace(/PABELLËN/g, "PABELLÓN");
}
