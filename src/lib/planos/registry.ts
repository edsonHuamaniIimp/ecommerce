import { buildItems as gessBuildItems, computeBounds as gessComputeBounds, buildFurniture as gessBuildFurniture } from "./gess/construccion";
import { GESS_BLOQUE_IDS } from "./gess/bloques";
import type { Item, BlockType } from "./gess/tipos";
import { BLOCK_LABEL, DIMENSIONES } from "./gess/tipos";

export interface PlanoDefinition {
  id: string;
  nombre: string;
  descripcion: string;
  buildItems: () => Item[];
  computeBounds: (items: Item[]) => { minX: number; maxX: number; minZ: number; maxZ: number };
  buildFurniture: () => { id: string; type: "kiosko"; x: number; z: number; rotY: number }[];
  bloqueIds: readonly string[];
  blockLabel: Record<BlockType, { label: string; nombre: string }>;
}

export const PLANOS: Record<string, PlanoDefinition> = {
  gess: {
    id: "gess",
    nombre: "GESS",
    descripcion: "Plano isometrico del evento GESS — 52 bloques con kioskos rusticos y plaza central",
    buildItems: gessBuildItems,
    computeBounds: gessComputeBounds,
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
