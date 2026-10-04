"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@nrivera-iimp/ui-kit-iimp";
import { Check, ChevronDown } from "lucide-react";
import { authService } from "@/lib/client/api/services/auth-service";
import {
  GOOGTRANS_COOKIE,
  GOOGTRANS_VALUES,
  IDIOMAS,
  IDIOMAS_DISPONIBLES,
  IDIOMA_COOKIE,
  IDIOMA_COOKIE_MAX_AGE,
  IDIOMA_LABELS,
  IDIOMA_LABELS_CORTOS,
} from "@/lib/shared/constants";
import type { Idioma } from "@/lib/shared/constants";
import { idiomaODefecto } from "@/lib/shared/utils/idioma";
import { leerIdiomaCookie } from "@/lib/client/utils/idioma";

/** Escribe las cookies de preferencia y de Google Translate (fuera del render). */
function escribirCookiesIdioma(idioma: Idioma): void {
  document.cookie = `${IDIOMA_COOKIE}=${idioma};path=/;max-age=${IDIOMA_COOKIE_MAX_AGE}`;
  document.cookie = `${GOOGTRANS_COOKIE}=${GOOGTRANS_VALUES[idioma]};path=/`;
}

/** La cookie no emite eventos: la suscripcion es un no-op (el cambio recarga la pagina). */
function suscribirCookieIdioma(): () => void {
  return () => {};
}

/** Bandera de Espana (idioma espanol), simplificada sin escudo. */
function BanderaEspana() {
  return (
    <svg viewBox="0 0 3 2" className="h-3 w-[18px] shrink-0 rounded-[2px] ring-1 ring-black/10" aria-hidden="true">
      <rect width="3" height="2" fill="#AA151B" />
      <rect y="0.5" width="3" height="1" fill="#F1BF00" />
    </svg>
  );
}

/** Bandera del Reino Unido (idioma ingles): Union Jack simplificada. */
function BanderaReinoUnido() {
  const clipId = useId().replace(/:/g, "uk");
  return (
    <svg viewBox="0 0 60 30" className="h-3 w-[18px] shrink-0 rounded-[2px] ring-1 ring-black/10" aria-hidden="true">
      <clipPath id={clipId}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${clipId})`} stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#FFFFFF" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

/**
 * Selector de idioma (ES/EN) del portal: listado desplegable compacto con banderas.
 * Guarda la preferencia del usuario (si hay sesion), sincroniza las cookies
 * `iimp_idioma` y `googtrans` y recarga para que Google Translate aplique el idioma.
 */
export function LanguageSwitcher({ idiomaActual }: { idiomaActual?: string | null }) {
  const router = useRouter();
  // En vistas publicas (sin prop) el idioma real vive en la cookie; el snapshot de
  // servidor es null para no romper la hidratacion.
  const cookieIdioma = useSyncExternalStore(suscribirCookieIdioma, leerIdiomaCookie, () => null);
  const [optimista, setOptimista] = useState<Idioma | null>(null);
  const actual = optimista ?? idiomaODefecto(cookieIdioma ?? idiomaActual);

  const cambiar = async (idioma: Idioma) => {
    if (idioma === actual) return;
    setOptimista(idioma);
    try {
      await authService.cambiarIdioma(idioma);
    } catch {
      /* Sin sesion (sitio publico): la preferencia queda solo en cookies. */
    }
    escribirCookiesIdioma(idioma);
    router.refresh();
    window.location.reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2" title="Cambiar idioma / Change language">
          {actual === IDIOMAS.ES ? <BanderaEspana /> : <BanderaReinoUnido />}
          <span className="text-xs font-semibold">{IDIOMA_LABELS_CORTOS[actual]}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {IDIOMAS_DISPONIBLES.map((idioma) => {
          const activo = idioma === actual;
          return (
            <DropdownMenuItem key={idioma} className="gap-2 text-xs" onClick={() => { void cambiar(idioma); }}>
              {idioma === IDIOMAS.ES ? <BanderaEspana /> : <BanderaReinoUnido />}
              <span className="flex-1">{IDIOMA_LABELS[idioma]}</span>
              {activo && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
