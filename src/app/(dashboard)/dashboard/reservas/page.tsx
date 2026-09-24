"use client";

import { ReservasManager } from "@/components/reservas/reservas-manager";
import { PaginaDashboard } from "@/components/dashboard/pagina-dashboard";
import { useSesion } from "@/hooks/use-sesion";

export default function ReservasPage() {
  const { session, cargando } = useSesion();
  const eventoId = session?.eventoId ?? "";

  return (
    <PaginaDashboard
      titulo="Gestion de Reservas"
      descripcion="Solicitudes de reserva de stands recibidas desde el plano interactivo."
      cargando={cargando}
      tieneEvento={Boolean(eventoId)}
    >
      <ReservasManager eventoId={eventoId} />
    </PaginaDashboard>
  );
}
