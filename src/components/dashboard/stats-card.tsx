"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/shared/utils";

interface StatsCardProps {
  title: string;
  value: number | string;
  icon?: ReactNode;
  /** Chip con una metrica derivada (ej. "37.5% colocado"). */
  chip?: { texto: string; variante?: "primary" | "muted" | "gold" };
  /** Linea inferior con un dato contextual (ej. "7 en evaluacion"). */
  footer?: { texto: string; destacado?: string };
}

const CHIP_ESTILOS = {
  primary: "bg-primary/10 text-primary",
  muted: "bg-secondary text-muted-foreground",
  gold: "bg-gold/15 text-gold",
} as const;

export function StatsCard({ title, value, icon, chip, footer }: StatsCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</span>
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-primary">{icon}</span>
        )}
      </div>

      <div>
        <p className="text-3xl font-bold tracking-tight text-primary break-words">{value}</p>
        {chip && (
          <span
            className={cn(
              "mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
              CHIP_ESTILOS[chip.variante ?? "muted"],
            )}
          >
            {chip.texto}
          </span>
        )}
      </div>

      {footer && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
          <span>{footer.texto}</span>
          {footer.destacado && <span className="shrink-0 font-medium text-primary">{footer.destacado}</span>}
        </div>
      )}
    </div>
  );
}
