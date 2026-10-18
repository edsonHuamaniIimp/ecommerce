"use client";

import { Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { DdBandeja } from "@/components/debida-diligencia/dd-bandeja";
import { DdAccesoDenegado } from "@/components/debida-diligencia/dd-acceso-denegado";
import { useSesion } from "@/hooks/use-sesion";
import { PERMISSIONS } from "@/lib/shared/constants";
import { tienePermiso } from "@/lib/shared/utils/permisos";

export default function DebidaDiligenciaBandejaPage() {
  const { session, cargando } = useSesion();

  if (cargando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-80 rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (!tienePermiso(session, PERMISSIONS.DD_REVISION)) {
    return <DdAccesoDenegado mensaje="La bandeja de revisión está reservada al área de Logística." />;
  }

  return <DdBandeja />;
}
