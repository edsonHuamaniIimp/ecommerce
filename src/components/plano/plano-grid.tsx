"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@nrivera-iimp/ui-kit-iimp";
import type { PlanoStand } from "@/types/reserva";
import { ESTADOS_STAND } from "@/lib/shared/constants";

/* ================================================================
   Layout tipo sistema de viajes interprovinciales:
   filas → stands, pasillo central (aisle), colores por estado.
   ================================================================ */

const COLS = 4;         // 4 stands por fila
const AISLE_AFTER = 2;  // pasillo entre columna 2 y 3

interface PlanoGridProps {
  stands: PlanoStand[];
}

export function PlanoGrid({ stands }: PlanoGridProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selected = stands.filter((s) => selectedIds.includes(s.id));
  const total = selected.reduce((sum, s) => sum + s.monto, 0);
  const moneda = selected[0]?.moneda ?? "USD";

  // Distribuir stands en filas con pasillo central
  const rows: (PlanoStand | null)[][] = [];
  let i = 0;
  while (i < stands.length) {
    const row: (PlanoStand | null)[] = [];
    for (let col = 0; col < COLS; col++) {
      if (col === AISLE_AFTER) {
        row.push(null); // pasillo
      }
      row.push(i < stands.length ? stands[i++] : null);
    }
    rows.push(row);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Grid de asientos */}
      <div className="lg:col-span-8 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>
              <span>Plano por filas — PERUMIN 38</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-3">
              {/* Indicador de pasillo */}
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                <span className="h-px w-6 bg-slate-300" />
                <span>Pasillo</span>
                <span className="h-px w-6 bg-slate-300" />
              </div>

              {rows.map((row, ri) => (
                <div key={ri} className="flex items-center gap-1.5">
                  <span className="w-5 text-center text-[10px] font-bold text-slate-400">
                    {String.fromCharCode(65 + ri)}
                  </span>
                  {row.map((stand, ci) =>
                    stand === null ? (
                      <div
                        key={`aisle-${ri}-${ci}`}
                        className="h-16 w-8 shrink-0 rounded-md border border-dashed border-slate-200 bg-slate-50"
                      />
                    ) : stand ? (
                      <Seat
                        key={stand.id}
                        stand={stand}
                        selected={selectedIds.includes(stand.id)}
                        onToggle={toggle}
                      />
                    ) : (
                      <div key={`empty-${ri}-${ci}`} className="h-16 w-16 shrink-0" />
                    ),
                  )}
                </div>
              ))}

              {/* Leyenda */}
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <Legend color="#FFD700" label="Columna Extrema (S)" />
                <Legend color="#32CD32" label="Preferencial (P)" />
                <Legend color="#90EE90" label="Estándar A (C)" />
                <Legend color="#006400" label="Isla Grande (BG)" />
                <Legend color="bg-primary border-primary text-primary-foreground" label="Seleccionado" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Panel lateral de selección */}
      <div className="lg:col-span-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>
              <span>Mi selección</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {selected.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                <span>Haz clic en los stands disponibles para seleccionarlos.</span>
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {selected.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          <span>{s.numero}</span>
                        </Badge>
                        <span className="text-muted-foreground">{s.tipoStand}</span>
                      </div>
                      <span className="font-medium">
                        {s.monto.toLocaleString("en-US")} {s.moneda}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t pt-3 text-sm font-bold">
                  <span>Total</span>
                  <span>
                    {total.toLocaleString("en-US")} {moneda}
                  </span>
                </div>
                <Button disabled variant="default" className="w-full">
                  <span>Reservar ({selected.length})</span>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Seat({
  stand,
  selected,
  onToggle,
}: {
  stand: PlanoStand;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const disabled = stand.estado !== ESTADOS_STAND.DISPONIBLE;
  const hex = stand.color ?? "#e2e8f0";
  const base = selected
    ? "bg-primary border-primary text-primary-foreground shadow-sm scale-105 z-10"
    : "";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onToggle(stand.id)}
      style={selected ? {} : { backgroundColor: hex, borderColor: hex, color: isLight(hex) ? "#0f172a" : "#ffffff" }}
      className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border-2 text-center text-[11px] font-bold leading-tight transition-all ${
        disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:shadow-md"
      } ${base}`}
    >
      <span className="text-[9px] uppercase tracking-wider opacity-60">
        {stand.tipoStand.slice(0, 4)}
      </span>
      <span>{stand.numero}</span>
    </button>
  );
}

/** Detecta si un color hex es claro para elegir texto oscuro o blanco */
function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 150;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-sm border ${color}`} />
      {label}
    </span>
  );
}

