import { buildItems as gessBuildItems, computeBounds as gessComputeBounds, buildFurniture as gessBuildFurniture } from "./gess/construccion";
import { GESS_BLOQUE_IDS } from "./gess/bloques";
import { BLOCK_LABEL } from "./gess/tipos";

/** Item generico de bloque 3D (compatible con cualquier plano, en codigo o BD) */
export interface PlanoItem {
  id: string;
  dim: { w: number; d: number; h: number; color: string };
  type: string;
  x: number;
  z: number;
}

export interface PlanoFurnitureItem {
  id: string;
  type: string;
  x: number;
  z: number;
  rotY: number;
}

export interface PlanoBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface PlanoDefinition {
  id: string;
  nombre: string;
  descripcion: string;
  buildItems: () => PlanoItem[];
  computeBounds: (items: PlanoItem[]) => PlanoBounds;
  buildFurniture: () => PlanoFurnitureItem[];
  bloqueIds: readonly string[];
  blockLabel: Record<string, { label: string; nombre: string }>;
}

/** Catalogo de planos definidos en codigo (fallback cuando la BD no tiene el plano) */
export const PLANOS: Record<string, PlanoDefinition> = {
  gess: {
    id: "gess",
    nombre: "GESS",
    descripcion: "Plano isometrico del evento GESS — 52 bloques con kioskos rusticos y plaza central",
    buildItems: gessBuildItems as () => PlanoItem[],
    computeBounds: gessComputeBounds as (items: PlanoItem[]) => PlanoBounds,
    buildFurniture: gessBuildFurniture,
    bloqueIds: GESS_BLOQUE_IDS,
    blockLabel: BLOCK_LABEL,
  },
};

export function getPlano(id: string): PlanoDefinition | undefined {
  return PLANOS[id];
}

export function listPlanos(): { id: string; nombre: string; descripcion: string }[] {
  return Object.values(PLANOS).map((p) => ({ id: p.id, nombre: p.nombre, descripcion: p.descripcion }));
}

function computeBoundsDefault(items: PlanoItem[]): PlanoBounds {
  if (items.length === 0) return { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const it of items) {
    minX = Math.min(minX, it.x - it.dim.w / 2);
    maxX = Math.max(maxX, it.x + it.dim.w / 2);
    minZ = Math.min(minZ, it.z - it.dim.d / 2);
    maxZ = Math.max(maxZ, it.z + it.dim.d / 2);
  }
  return { minX: minX - 4, maxX: maxX + 4, minZ: minZ - 4, maxZ: maxZ + 4 };
}

interface PlanoPublicoResponse {
  codigo: string;
  nombre: string;
  tipos: Array<{ codigo: string; label: string; nombre: string; w: number; d: number; h: number; color: string }>;
  bloques: Array<{ bloqueId: string; tipoCodigo: string; x: number; z: number; rotY: number }>;
  furniture: Array<{ refId: string; tipo: string; x: number; z: number; rotY: number }>;
}

/**
 * Carga un plano 3D: primero intenta desde la BD (Laboratorio 3D),
 * si no existe o falla, usa el fallback en codigo (PLANOS).
 */
export async function loadPlanoDefinition(codigo: string): Promise<PlanoDefinition | undefined> {
  try {
    const res = await fetch(`/api/planos/publico?codigo=${encodeURIComponent(codigo)}`);
    const json = (await res.json()) as { success?: boolean; data?: PlanoPublicoResponse };
    if (json.success && json.data) {
      const data = json.data;
      const dimMap: Record<string, { w: number; d: number; h: number; color: string }> = {};
      const labelMap: Record<string, { label: string; nombre: string }> = {};
      for (const t of data.tipos) {
        dimMap[t.codigo] = { w: t.w, d: t.d, h: t.h, color: t.color };
        labelMap[t.codigo] = { label: t.label, nombre: t.nombre };
      }
      const items: PlanoItem[] = data.bloques.map((b) => ({
        id: b.bloqueId,
        dim: dimMap[b.tipoCodigo] ?? { w: 2, d: 2, h: 2.4, color: "#94a3b8" },
        type: b.tipoCodigo,
        x: b.x,
        z: b.z,
      }));
      return {
        id: data.codigo,
        nombre: data.nombre,
        descripcion: "",
        buildItems: () => items,
        buildFurniture: () => data.furniture.map((f) => ({ id: f.refId, type: f.tipo, x: f.x, z: f.z, rotY: f.rotY })),
        computeBounds: computeBoundsDefault,
        bloqueIds: data.bloques.map((b) => b.bloqueId),
        blockLabel: labelMap,
      };
    }
  } catch { /* fallback al codigo */ }
  return getPlano(codigo);
}
