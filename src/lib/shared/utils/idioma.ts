import { IDIOMAS, IDIOMA_DEFAULT, IDIOMA_LOCALES } from "@/lib/shared/constants";
import type { Idioma } from "@/lib/shared/constants";

/** True si el valor es un idioma soportado. */
export function esIdioma(valor: unknown): valor is Idioma {
  return valor === IDIOMAS.ES || valor === IDIOMAS.EN;
}

/** Devuelve el idioma si es válido; en caso contrario, el idioma por defecto (español). */
export function idiomaODefecto(valor: unknown): Idioma {
  return esIdioma(valor) ? valor : IDIOMA_DEFAULT;
}

/** Locale BCP-47 del idioma (es-PE / en-US) para formateo de fechas y montos. */
export function localeDeIdioma(idioma: string | null | undefined): string {
  return IDIOMA_LOCALES[idiomaODefecto(idioma)];
}
