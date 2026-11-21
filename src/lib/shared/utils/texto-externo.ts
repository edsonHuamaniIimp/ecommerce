/**
 * Repara caracteres que llegan mal codificados desde fuentes externas
 * (CP437/Latin-1): "EST┴NDAR" y "EXHIBICIËN" -> "ESTÁNDAR" y "EXHIBICIÓN".
 */
export function repararTextoCp437(valor: string): string {
  return valor
    .replace(/\u2534/g, "Á")
    .replace(/Ë/g, "Ó")
    .replace(/ë/g, "ó");
}
