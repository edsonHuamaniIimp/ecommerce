"use client";

import { useSyncExternalStore } from "react";
import { LS_KEYS } from "@/lib/shared/constants";

export interface EventoPublico {
  eventoId: string;
  nombre?: string;
  tipoEvento?: number;
  codigoEvento?: number;
}

/**
 * Cache del snapshot: ademas de evitar parseos repetidos, mantiene la referencia
 * estable que exige useSyncExternalStore.
 */
let cache: EventoPublico | null | undefined;

function leerSnapshot(): EventoPublico | null {
  if (cache !== undefined) return cache;
  try {
    const raw = localStorage.getItem(LS_KEYS.EVENTO_PUBLICO);
    cache = raw ? (JSON.parse(raw) as EventoPublico) : null;
  } catch {
    cache = null;
  }
  return cache;
}

function suscribir(): () => void {
  // El evento publico se escribe antes de navegar (presala), no durante la vista.
  return () => {};
}

const SNAPSHOT_SERVIDOR = (): null => null;

/** Evento seleccionado en el portal publico (localStorage), sin setState en efectos. */
export function useEventoPublico(): EventoPublico | null {
  return useSyncExternalStore(suscribir, leerSnapshot, SNAPSHOT_SERVIDOR);
}
