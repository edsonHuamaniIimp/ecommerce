"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { SinEvento } from "./sin-evento";

interface Props {
  titulo: string;
  descripcion: string;
  cargando: boolean;
  tieneEvento: boolean;
  /** Accion opcional alineada a la derecha del encabezado. */
  accion?: ReactNode;
  /** Ancho del contenido; `amplio` para bandejas con muchas columnas. */
  ancho?: "estandar" | "amplio";
  children: ReactNode;
}

/** Shell de las vistas internas que dependen del evento activo. */
export function PaginaDashboard({ titulo, descripcion, cargando, tieneEvento, accion, ancho = "estandar", children }: Props) {
  const anchoClase = ancho === "amplio" ? "max-w-screen-2xl" : "max-w-7xl";

  if (cargando) {
    return (
      <main className="flex-1 py-6">
        <div className={`mx-auto w-full ${anchoClase} space-y-4`}>
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 py-6">
      <div className={`mx-auto w-full ${anchoClase} space-y-4`}>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{titulo}</h1>
            <p className="text-sm text-muted-foreground">{descripcion}</p>
          </div>
          {accion && <div className="shrink-0">{accion}</div>}
        </div>
        {tieneEvento ? children : <SinEvento />}
      </div>
    </main>
  );
}
