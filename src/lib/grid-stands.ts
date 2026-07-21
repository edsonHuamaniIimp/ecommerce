import type { PlanoStand } from "@/types/reserva";
import { ESTADOS_STAND } from "@/lib/constants";

/* ================================================================
   48 bloques del isométrico mapeados a PlanoStand para plano-grid.
   IDs, tipos y orden de generación respetados.
   ================================================================ */

interface GridStandDef {
  id: string;
  numero: string;
  tipoStand: string;
  tipoStandId: string;
  w: number;
  d: number;
  color: string;
}

const defs: GridStandDef[] = [
  // ── CE izquierda (10 S_vert, amarillo) ──
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `EXT-IZQ-${String(i + 1).padStart(2, "0")}`,
    numero: `E-I${i + 1}`,
    tipoStand: "Columna Extrema",
    tipoStandId: "ts-ce",
    w: 2.5, d: 2,
    color: "#FFD700",
  })),
  // ── CE derecha (10 S_vert, amarillo) ──
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `EXT-DER-${String(i + 1).padStart(2, "0")}`,
    numero: `E-D${i + 1}`,
    tipoStand: "Columna Extrema",
    tipoStandId: "ts-ce",
    w: 2.5, d: 2,
    color: "#FFD700",
  })),
  // ── Interior Izq Grupo A (8: 4P + 4C) ──
  ...["A1","A2","A3","A4","A5","A6","A7","A8"].map((suf, i) => ({
    id: `INT-IZQ-${suf}`,
    numero: `IA${suf}`,
    tipoStand: i === 0 || i === 3 || i === 4 || i === 7 ? "Preferencial" : "Estándar A",
    tipoStandId: i === 0 || i === 3 || i === 4 || i === 7 ? "ts-pref" : "ts-std-a",
    w: 2, d: 2,
    color: i === 0 || i === 3 || i === 4 || i === 7 ? "#32CD32" : "#90EE90",
  })),
  // ── Interior Izq Grupo B (8: 4P + 4C) ──
  ...["B1","B2","B3","B4","B5","B6","B7","B8"].map((suf, i) => ({
    id: `INT-IZQ-${suf}`,
    numero: `IB${suf}`,
    tipoStand: i === 0 || i === 3 || i === 4 || i === 7 ? "Preferencial" : "Estándar A",
    tipoStandId: i === 0 || i === 3 || i === 4 || i === 7 ? "ts-pref" : "ts-std-a",
    w: 2, d: 2,
    color: i === 0 || i === 3 || i === 4 || i === 7 ? "#32CD32" : "#90EE90",
  })),
  // ── Interior Der (8: 4P + 4C) ──
  ...[1,2,3,4,5,6,7,8].map((n, i) => ({
    id: `INT-DER-${n}`,
    numero: `ID${n}`,
    tipoStand: i === 0 || i === 3 || i === 4 || i === 7 ? "Preferencial" : "Estándar A",
    tipoStandId: i === 0 || i === 3 || i === 4 || i === 7 ? "ts-pref" : "ts-std-a",
    w: 2, d: 2,
    color: i === 0 || i === 3 || i === 4 || i === 7 ? "#32CD32" : "#90EE90",
  })),
  // ── Islas Grandes (4 BG, verde oscuro) ──
  ...[1,2,3,4].map((n) => ({
    id: `ISLA-GRANDE-${n}`,
    numero: `IG${n}`,
    tipoStand: "Isla Grande",
    tipoStandId: "ts-bg",
    w: 3.5, d: 3.5,
    color: "#006400",
  })),
];

export function buildGridStands(): PlanoStand[] {
  return defs.map((d) => ({
    id: d.id,
    numero: d.numero,
    tipoStand: d.tipoStand,
    tipoStandId: d.tipoStandId,
    monto: d.w * d.d * 500,
    moneda: "USD",
    medidas: `${d.w}×${d.d}m`,
    x: 0, y: 0,
    ancho: d.w,
    alto: d.d,
    estado: ESTADOS_STAND.DISPONIBLE,
    empresa: null,
    tipoCamara: null,
    numeroCamara: null,
  }));
}
