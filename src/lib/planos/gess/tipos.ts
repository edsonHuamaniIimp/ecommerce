export interface Dim { w: number; d: number; h: number; color: string; }

export const DIMENSIONES: Record<string, Dim> = {
  S_vert:  { w:3.2, d:2.5, h:2.4, color:"#FFD700" },
  BG:      { w:3.5, d:3.5, h:3.0, color:"#006400" },
  P:       { w:2, d:2, h:2.4, color:"#32CD32" },
  C:       { w:2, d:2, h:2.0, color:"#90EE90" },
};

export type BlockType = "S" | "BG" | "P" | "C";

export interface Item { id: string; dim: Dim; type: BlockType; x: number; z: number; }

export const BLOCK_LABEL: Record<BlockType, { label: string; nombre: string }> = {
  S:  { label: "S",  nombre: "Columna" },
  BG: { label: "BG", nombre: "Isla Grande" },
  P:  { label: "P",  nombre: "Preferencial" },
  C:  { label: "C",  nombre: "Estándar A" },
};
