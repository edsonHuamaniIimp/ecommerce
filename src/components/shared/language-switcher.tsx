"use client";

import { useRouter } from "next/navigation";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@nrivera-iimp/ui-kit-iimp";
import { Check, Globe } from "lucide-react";
import { authService } from "@/lib/client/api/services/auth-service";
import {
  GOOGTRANS_COOKIE,
  GOOGTRANS_VALUES,
  IDIOMAS_DISPONIBLES,
  IDIOMA_COOKIE,
  IDIOMA_COOKIE_MAX_AGE,
  IDIOMA_LABELS,
  IDIOMA_LABELS_CORTOS,
} from "@/lib/shared/constants";
import type { Idioma } from "@/lib/shared/constants";
import { idiomaODefecto } from "@/lib/shared/utils/idioma";

/** Escribe las cookies de preferencia y de Google Translate (fuera del render). */
function escribirCookiesIdioma(idioma: Idioma): void {
  document.cookie = `${IDIOMA_COOKIE}=${idioma};path=/;max-age=${IDIOMA_COOKIE_MAX_AGE}`;
  document.cookie = `${GOOGTRANS_COOKIE}=${GOOGTRANS_VALUES[idioma]};path=/`;
}

/**
 * Selector de idioma (ES/EN) del portal. Guarda la preferencia en el usuario (si hay
 * sesión), sincroniza las cookies `iimp_idioma` y `googtrans` y recarga para que
 * Google Translate aplique el idioma.
 */
export function LanguageSwitcher({ idiomaActual }: { idiomaActual?: string | null }) {
  const router = useRouter();
  const actual: Idioma = idiomaODefecto(idiomaActual);

  const cambiar = async (idioma: Idioma) => {
    if (idioma === actual) return;
    try {
      await authService.cambiarIdioma(idioma);
    } catch {
      /* Sin sesión (sitio público): la preferencia queda solo en cookies. */
    }
    escribirCookiesIdioma(idioma);
    router.refresh();
    window.location.reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs font-semibold" title="Cambiar idioma">
          <Globe className="h-3.5 w-3.5" />
          <span>{IDIOMA_LABELS_CORTOS[actual]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {IDIOMAS_DISPONIBLES.map((idioma) => (
          <DropdownMenuItem key={idioma} className="gap-2 text-xs" onClick={() => { void cambiar(idioma); }}>
            <span className="flex-1">{IDIOMA_LABELS[idioma]}</span>
            {actual === idioma && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
