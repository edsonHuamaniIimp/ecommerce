"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { LS_KEYS } from "@/lib/shared/constants";

export interface CarritoStandInfo {
  bloqueId: string;
  standCode: string;
  pabellonCodigo: string;
  tipoLabel: string | null;
}

interface PlanoCarritoState {
  /** planoId (codigo del plano/pabellon) -> bloqueIds seleccionados. */
  selecciones: Record<string, string[]>;
  /** bloqueId -> metadata para listar el carrito entre pabellones. */
  items: Record<string, CarritoStandInfo>;
  /** Codigo del plano macro (para navegacion desde el carrito). */
  macroCodigo: string | null;
  /** planoId -> codigo del plano padre (macro o contenedor). */
  parents: Record<string, string | null>;
  toggle: (planoId: string, info: CarritoStandInfo) => void;
  seleccionarSolo: (planoId: string, info: CarritoStandInfo) => void;
  quitar: (bloqueId: string) => void;
  /** Fija la seleccion valida de un plano (descarta ids reservados/desaparecidos). */
  sincronizarPlano: (planoId: string, validos: CarritoStandInfo[]) => void;
  limpiarPlano: (planoId: string) => void;
  limpiar: () => void;
  registrarMacro: (codigo: string) => void;
  registrarPlano: (planoId: string, parentCodigo: string | null) => void;
}

function storageSeguro() {
  if (typeof window !== "undefined") {
    return createJSONStorage(() => window.localStorage);
  }
  return createJSONStorage(() => ({
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  }));
}

export const usePlanoCarrito = create<PlanoCarritoState>()(
  persist(
    (set, get) => ({
      selecciones: {},
      items: {},
      macroCodigo: null,
      parents: {},

      toggle: (planoId, info) => {
        const current = get().selecciones[planoId] ?? [];
        const ya = current.includes(info.bloqueId);
        set((s) => {
          const selecciones = {
            ...s.selecciones,
            [planoId]: ya
              ? current.filter((id) => id !== info.bloqueId)
              : [...current, info.bloqueId],
          };
          const items = { ...s.items };
          if (ya) {
            delete items[info.bloqueId];
          } else {
            items[info.bloqueId] = info;
          }
          return { selecciones, items };
        });
      },

      seleccionarSolo: (planoId, info) => {
        set((s) => {
          const items = { ...s.items };
          for (const [id, it] of Object.entries(items)) {
            if (it.pabellonCodigo === planoId && id !== info.bloqueId) delete items[id];
          }
          items[info.bloqueId] = info;
          return { selecciones: { ...s.selecciones, [planoId]: [info.bloqueId] }, items };
        });
      },

      quitar: (bloqueId) => {
        const info = get().items[bloqueId];
        if (!info) return;
        set((s) => {
          const selecciones = { ...s.selecciones };
          const plano = selecciones[info.pabellonCodigo];
          if (plano) {
            selecciones[info.pabellonCodigo] = plano.filter((id) => id !== bloqueId);
          }
          const items = { ...s.items };
          delete items[bloqueId];
          return { selecciones, items };
        });
      },

      sincronizarPlano: (planoId, validos) => {
        const validIds = new Set(validos.map((v) => v.bloqueId));
        set((s) => {
          const current = s.selecciones[planoId] ?? [];
          const filtrados = current.filter((id) => validIds.has(id));
          const items = { ...s.items };
          for (const [id, info] of Object.entries(items)) {
            if (info.pabellonCodigo === planoId && !validIds.has(id)) delete items[id];
          }
          for (const v of validos) {
            if (filtrados.includes(v.bloqueId)) items[v.bloqueId] = v;
          }
          return { selecciones: { ...s.selecciones, [planoId]: filtrados }, items };
        });
      },

      limpiarPlano: (planoId) => {
        set((s) => {
          const selecciones = { ...s.selecciones };
          const plano = selecciones[planoId] ?? [];
          const items = { ...s.items };
          for (const id of plano) delete items[id];
          delete selecciones[planoId];
          return { selecciones, items };
        });
      },

      limpiar: () => set({ selecciones: {}, items: {} }),

      registrarMacro: (codigo) => set({ macroCodigo: codigo }),

      registrarPlano: (planoId, parentCodigo) =>
        set((s) => ({ parents: { ...s.parents, [planoId]: parentCodigo } })),
    }),
    {
      name: LS_KEYS.PLANO_CARRITO,
      storage: storageSeguro(),
    },
  ),
);

/** Total de stands en el carrito (todos los pabellones). */
export function totalCarrito(selecciones: Record<string, string[]>): number {
  return Object.values(selecciones).reduce((acc, ids) => acc + ids.length, 0);
}

/** Conteo por plano codigo. */
export function conteoPorPlano(selecciones: Record<string, string[]>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [planoId, ids] of Object.entries(selecciones)) {
    if (ids.length > 0) out[planoId] = ids.length;
  }
  return out;
}

/** URL hacia un pabellon conservando el parent (boton "Volver al mapa general"). */
export function urlPabellon(
  pabellonCodigo: string,
  parents: Record<string, string | null>,
  macroCodigo: string | null,
): string {
  const parent = parents[pabellonCodigo] ?? (macroCodigo && macroCodigo !== pabellonCodigo ? macroCodigo : null);
  const qs = new URLSearchParams({ codigo: pabellonCodigo });
  if (parent) qs.set("parent", parent);
  return `/mapa?${qs.toString()}`;
}
