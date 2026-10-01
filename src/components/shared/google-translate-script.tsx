"use client";

import { useEffect } from "react";
import Script from "next/script";
import {
  GOOGTRANS_COOKIE,
  GOOGTRANS_VALUES,
  IDIOMAS,
  IDIOMA_COOKIE,
  IDIOMA_DEFAULT,
  IDIOMA_SYNC_SESSION_KEY,
} from "@/lib/shared/constants";
import type { Idioma } from "@/lib/shared/constants";

/** Lee una cookie del navegador por nombre. */
function leerCookie(nombre: string): string {
  if (typeof document === "undefined") return "";
  const par = document.cookie.split("; ").find((c) => c.startsWith(`${nombre}=`));
  return par ? par.split("=").slice(1).join("=") : "";
}

/**
 * Website Translator de Google (portal): traduce el DOM al inglés cuando la preferencia
 * es `en`. El widget nativo queda oculto; el cambio se maneja con el selector propio
 * (`LanguageSwitcher`) escribiendo las cookies `iimp_idioma` y `googtrans`.
 */
export function GoogleTranslateScript() {
  /* Sincroniza `googtrans` con la preferencia guardada (p. ej., tras iniciar sesión). */
  useEffect(() => {
    try {
      const idioma = (leerCookie(IDIOMA_COOKIE) || IDIOMA_DEFAULT) as Idioma;
      const googtransActual = leerCookie(GOOGTRANS_COOKIE);
      const esperado = GOOGTRANS_VALUES[idioma] ?? GOOGTRANS_VALUES[IDIOMA_DEFAULT];
      if (idioma !== IDIOMA_DEFAULT && googtransActual !== esperado && !sessionStorage.getItem(IDIOMA_SYNC_SESSION_KEY)) {
        sessionStorage.setItem(IDIOMA_SYNC_SESSION_KEY, "1");
        document.cookie = `${GOOGTRANS_COOKIE}=${esperado};path=/`;
        window.location.reload();
      }
    } catch {
      /* best-effort */
    }
  }, []);

  return (
    <>
      <Script id="google-translate-init" strategy="afterInteractive">
        {`
          function googleTranslateElementInit() {
            if (!window.google || !window.google.translate) return;
            new window.google.translate.TranslateElement(
              { pageLanguage: ${JSON.stringify(IDIOMA_DEFAULT)}, includedLanguages: ${JSON.stringify(IDIOMAS.EN)}, autoDisplay: false },
              'google_translate_element'
            );
          }
        `}
      </Script>
      <Script
        id="google-translate"
        src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
      />
      <div id="google_translate_element" className="hidden" aria-hidden="true" />
    </>
  );
}
