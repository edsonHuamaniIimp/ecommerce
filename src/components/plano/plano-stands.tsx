"use client";

import type { PlanoStand, EstadoStand } from "@/types/reserva";
import { ESTADOS_STAND } from "@/lib/shared/constants";

const COLORS: Record<EstadoStand, string> = {
  [ESTADOS_STAND.RESERVADO]: "#16a34a",
  [ESTADOS_STAND.EN_EVALUACION]: "#cbd5e1",
  [ESTADOS_STAND.DISPONIBLE]: "#ffffff",
};

interface PlanoStandsProps {
  stands: PlanoStand[];
  selectedIds: string[];
  onToggle: (standId: string) => void;
}

export function PlanoStands({ stands, selectedIds, onToggle }: PlanoStandsProps) {
  return (
    <div className="w-full">
      <svg
        viewBox="0 0 320 380"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Plano interactivo de stands"
        className="h-auto w-full rounded-lg border bg-muted/30"
      >
        {stands.map((st) => {
          const selected = selectedIds.includes(st.id);
          const selectable = st.estado === ESTADOS_STAND.DISPONIBLE;
          const fill = selected ? "var(--primary)" : COLORS[st.estado];
          const textFill =
            selected || st.estado === ESTADOS_STAND.RESERVADO ? "#ffffff" : "#0f172a";
          return (
            <g
              key={st.id}
              onClick={selectable ? () => onToggle(st.id) : undefined}
              style={{ cursor: selectable ? "pointer" : "not-allowed" }}
            >
              <rect
                x={st.x}
                y={st.y}
                width={st.ancho}
                height={st.alto}
                rx={6}
                fill={fill}
                stroke={selected ? "var(--primary)" : "#94a3b8"}
                strokeWidth={selected ? 2 : 1}
              />
              <text
                x={st.x + st.ancho / 2}
                y={st.y + st.alto / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={15}
                fontWeight={600}
                fill={textFill}
              >
                {st.numero}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <LegendItem color={COLORS.disponible} border label="Disponible" />
        <LegendItem color={COLORS.en_evaluacion} label="En evaluación" />
        <LegendItem color={COLORS.reservado} label="Reservado" />
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm border"
            style={{ backgroundColor: "var(--primary)" }}
          />
          Seleccionado
        </span>
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
  border = false,
}: {
  color: string;
  label: string;
  border?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`inline-block h-3 w-3 rounded-sm ${border ? "border" : ""}`}
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
