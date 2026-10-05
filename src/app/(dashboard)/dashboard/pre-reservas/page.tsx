"use client";

import { PreReservasManager } from "@/components/pre-reservas/pre-reservas-manager";
import { PaginaDashboard } from "@/components/dashboard/pagina-dashboard";
import { useSesion } from "@/hooks/use-sesion";

export default function PreReservasPage() {
  const { session, cargando } = useSesion();
  const eventoId = session?.eventoId ?? "";

  return (
    <PaginaDashboard
      titulo="Pre-reservas"
      descripcion="Bloquea stands disponibles a nombre de una empresa (sin solicitud ni contrato)."
      cargando={cargando}
      tieneEvento={Boolean(eventoId)}
    >
      <PreReservasManager
        eventoId={eventoId}
        tipoEvento={session?.tipoEvento}
        codigoEvento={session?.codigoEvento}
      />
    </PaginaDashboard>
  );
}
