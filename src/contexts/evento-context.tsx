"use client";

import type { EventoPadre, Evento } from "@/types/reserva";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { LS_KEYS } from "@/lib/constants";

const STORAGE_KEY = "iimp-evento";

interface EventoSelection {
  eventoPadre: EventoPadre;
  evento: Evento;
}

interface EventoContextValue {
  selected: EventoSelection | null;
  selectEvento: (sel: EventoSelection) => void;
  clearSelection: () => void;
  isHydrated: boolean;
}

const EventoCtx = createContext<EventoContextValue | null>(null);

function readFromStorage(): EventoSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EventoSelection;
  } catch {
    return null;
  }
}

function writeToStorage(sel: EventoSelection | null) {
  if (typeof window === "undefined") return;
  try {
    if (sel) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sel));
      localStorage.setItem(LS_KEYS.VERTICAL, sel.eventoPadre.vertical);
      document.documentElement.classList.forEach((c) => {
        if (c.startsWith("vert-")) document.documentElement.classList.remove(c);
      });
      document.documentElement.classList.add(`vert-${sel.eventoPadre.vertical}`);
      document.documentElement.setAttribute("data-vertical", sel.eventoPadre.vertical);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export function EventoProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<EventoSelection | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = readFromStorage();
    if (stored) {
      setSelected(stored);
      writeToStorage(stored);
    }
    setIsHydrated(true);
  }, []);

  const selectEvento = useCallback((sel: EventoSelection) => {
    setSelected(sel);
    writeToStorage(sel);
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(null);
    writeToStorage(null);
  }, []);

  return (
    <EventoCtx.Provider value={{ selected, selectEvento, clearSelection, isHydrated }}>
      {children}
    </EventoCtx.Provider>
  );
}

export function useEvento(): EventoContextValue {
  const ctx = useContext(EventoCtx);
  if (!ctx) throw new Error("useEvento debe usarse dentro de EventoProvider");
  return ctx;
}
