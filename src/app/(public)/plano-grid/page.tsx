"use client";

import { useEffect, useState } from "react";
import { eventosService } from "@/lib/client/api/services/facade";
import { PlanoGrid2D } from "@/components/plano/plano-grid-2d";
import type { Evento, EventoPadre } from "@/types/reserva";

type ContextoEvento = { evento: Evento; eventoPadre: EventoPadre };

export default function PlanoGridPage() {
  const [contexto, setContexto] = useState<ContextoEvento | null>(null);

  useEffect(() => {
    let activo = true;
    eventosService
      .getEventoActual()
      .then((c) => {
        if (activo) setContexto(c);
      })
      .catch(() => {
        // Sin contexto: se muestra el título sin datos del evento.
      });
    return () => {
      activo = false;
    };
  }, []);

  return (
    <main className="flex-1 px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Plano Grid 2D{contexto ? ` — ${contexto.eventoPadre.nombre} ${contexto.evento.anio}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Reconstrucción exacta del layout espacial isométrico. Celdas coloreadas = stands, vacías = pasillos.
          </p>
        </div>
        <PlanoGrid2D />
      </div>
    </main>
  );
}
