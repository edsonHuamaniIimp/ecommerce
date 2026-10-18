"use client";

import { Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { DdReputacion } from "@/components/debida-diligencia/dd-reputacion";
import { DdAccesoDenegado } from "@/components/debida-diligencia/dd-acceso-denegado";
import { useSesion } from "@/hooks/use-sesion";
import { PERMISSIONS } from "@/lib/shared/constants";
import { tienePermiso } from "@/lib/shared/utils/permisos";

export default function DebidaDiligenciaReputacionPage() {
  const { session, cargando } = useSesion();

  if (cargando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-80 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!tienePermiso(session, PERMISSIONS.DD_REPUTACION)) {
    return <DdAccesoDenegado mensaje="La revisión reputacional está reservada al área de Comunicaciones." />;
  }

  return <DdReputacion />;
}
