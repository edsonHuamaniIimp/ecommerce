"use client";

import Link from "next/link";
import { Button } from "@nrivera-iimp/ui-kit-iimp";
import { Map } from "lucide-react";
import { MisSolicitudesManager } from "@/components/solicitudes/mis-solicitudes-manager";
import { PaginaDashboard } from "@/components/dashboard/pagina-dashboard";
import { useSesion } from "@/hooks/use-sesion";

export default function MisSolicitudesPage() {
  const { session, cargando } = useSesion();
  const eventoId = session?.eventoId ?? "";
  const userId = session?.userId ?? "";

  return (
    <PaginaDashboard
      titulo="Mis solicitudes"
      descripcion="Estado de tus solicitudes de alquiler de stands en el evento actual."
      cargando={cargando}
      tieneEvento={Boolean(eventoId)}
      accion={
        <Button asChild variant="outline" className="gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
          <Link href="/mapa">
            <Map className="h-4 w-4" />
            <span>Nueva reserva en el plano</span>
          </Link>
        </Button>
      }
    >
      <MisSolicitudesManager eventoId={eventoId} userId={userId} />
    </PaginaDashboard>
  );
}
