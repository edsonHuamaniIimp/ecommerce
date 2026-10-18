"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/shared/utils";

import { DD_PASOS } from "@/lib/shared/constants";


interface Props {
  /** Paso actual (1 a 4). */
  actual: number;
  /** Pasos ya completados (por defecto, todos los anteriores al actual). */
  completados?: number[];
  /** Pasos a los que se puede navegar. */
  navegables?: number[];
  /** Navegacion al hacer click en un paso habilitado. */
  onStepClick?: (numero: number) => void;
}

/** Stepper horizontal del formulario de Debida Diligencia (4 pasos). */
export function DdStepper({ actual, completados, navegables, onStepClick }: Props) {
  const hechos = completados ?? DD_PASOS.filter((p) => p.numero < actual).map((p) => p.numero);
  const permitidos = navegables ?? [actual, ...hechos];

  return (
    <nav aria-label="Progreso del formulario de debida diligencia">
      <ol className="grid grid-cols-4">
        {DD_PASOS.map((paso, indice) => {
          const activo = paso.numero === actual;
          const completado = hechos.includes(paso.numero);
          const puedeNavegar = permitidos.includes(paso.numero) && Boolean(onStepClick);
          return (
            <li key={paso.numero} className="relative flex flex-col items-center">
              {indice > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-4 right-1/2 -z-0 h-[2px] w-full",
                    completado || activo ? "bg-primary/30" : "bg-border",
                  )}
                />
              )}
              <button
                type="button"
                disabled={!puedeNavegar}
                onClick={() => onStepClick?.(paso.numero)}
                aria-current={activo ? "step" : undefined}
                aria-label={puedeNavegar ? `Ir al paso ${paso.label}` : paso.label}
                title={puedeNavegar ? `Ir a ${paso.label}` : "Completa los pasos anteriores"}
                className={cn(
                  "z-10 flex w-full flex-col items-center border-0 bg-transparent p-0",
                  puedeNavegar ? "cursor-pointer" : "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                    completado && "border-success bg-success text-success-foreground",
                    activo && !completado && "border-primary bg-primary text-primary-foreground ring-4 ring-primary/10",
                    !activo && !completado && "border-border bg-card text-muted-foreground",
                    puedeNavegar && !activo && "hover:border-primary/60",
                  )}
                >
                  {completado ? <Check className="h-4 w-4" aria-hidden="true" /> : paso.numero}
                </span>
                <span
                  className={cn(
                    "mt-2 hidden text-center text-xs font-medium sm:block",
                    activo ? "font-bold text-primary" : "text-muted-foreground",
                    puedeNavegar && !activo && "hover:text-primary",
                  )}
                >
                  {paso.label}
                </span>
                <span
                  className={cn(
                    "mt-2 text-center text-[10px] font-medium sm:hidden",
                    activo ? "font-bold text-primary" : "text-muted-foreground",
                  )}
                >
                  {paso.corto}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
