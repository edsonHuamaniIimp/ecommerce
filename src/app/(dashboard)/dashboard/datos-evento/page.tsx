"use client";

import { DatosEventoManager } from "@/components/plano/datos-evento-manager";
import { PaginaDashboard } from "@/components/dashboard/pagina-dashboard";
import { useSesion } from "@/hooks/use-sesion";

export default function DatosEventoPage() {
  const { session, cargando } = useSesion();
  const eventoId = session?.eventoId ?? "";

  return (
    <PaginaDashboard
      titulo="Datos del Evento"
      descripcion="Stands vinculados desde KBEventos"
      cargando={cargando}
      tieneEvento={Boolean(eventoId)}
    >
      <DatosEventoManager eventoId={eventoId} />
    </PaginaDashboard>
  );
}
