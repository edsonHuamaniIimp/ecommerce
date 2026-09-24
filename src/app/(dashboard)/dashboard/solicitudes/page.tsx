"use client";

import { SolicitudesManager } from "@/components/solicitudes/solicitudes-manager";
import { PaginaDashboard } from "@/components/dashboard/pagina-dashboard";
import { useSesion } from "@/hooks/use-sesion";

export default function SolicitudesPage() {
  const { session, cargando } = useSesion();
  const eventoId = session?.eventoId ?? "";

  return (
    <PaginaDashboard
      titulo="Solicitudes de alquiler"
      descripcion="Revision de solicitudes de alquiler por area (Comunicacion, Legal, Logistica)."
      cargando={cargando}
      tieneEvento={Boolean(eventoId)}
    >
      <SolicitudesManager eventoId={eventoId} />
    </PaginaDashboard>
  );
}
