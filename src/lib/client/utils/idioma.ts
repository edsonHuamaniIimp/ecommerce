import { IDIOMA_COOKIE } from "@/lib/shared/constants";

/**
 * Valor crudo de la cookie de idioma (`iimp_idioma`) en el navegador; `null` si no
 * existe o si se ejecuta en servidor. Resolver con `idiomaODefecto`.
 */
export function leerIdiomaCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${IDIOMA_COOKIE}=`));
  return match ? match.slice(IDIOMA_COOKIE.length + 1) : null;
}
