"use client";

import { StandsManager } from "@/components/stands/stands-manager";
import { PaginaDashboard } from "@/components/dashboard/pagina-dashboard";
import { useSesion } from "@/hooks/use-sesion";

export default function StandsPage() {
  const { session, cargando } = useSesion();
  const eventoId = session?.eventoId ?? "";

  return (
    <PaginaDashboard
      titulo="Gestion de Stands"
      descripcion="Documentos e imagenes por stand vinculado."
      cargando={cargando}
      tieneEvento={Boolean(eventoId)}
    >
      <StandsManager eventoId={eventoId} />
    </PaginaDashboard>
  );
}
