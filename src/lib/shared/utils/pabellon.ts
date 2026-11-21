import { repararTextoCp437 } from "@/lib/shared/utils/texto-externo";

/**
 * Repara etiquetas de pabellon con el caracter CP437 que sustituye a "Ó"
 * cuando la fuente viene codificada como Latin-1/CP437 ("PABELLËN" -> "PABELLÓN").
 */
export function normalizarPabellon(valor: string | null | undefined): string | null {
  const texto = repararTextoCp437(String(valor ?? "")).trim();
  return texto || null;
}
