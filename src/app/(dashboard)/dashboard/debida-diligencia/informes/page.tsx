"use client";

import { Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { DdInformeBandeja } from "@/components/debida-diligencia/dd-informe-bandeja";
import { DdAccesoDenegado } from "@/components/debida-diligencia/dd-acceso-denegado";
import { useSesion } from "@/hooks/use-sesion";
import { PERMISSIONS } from "@/lib/shared/constants";
import { tienePermiso } from "@/lib/shared/utils/permisos";

export default function DebidaDiligenciaInformesPage() {
  const { session, cargando } = useSesion();

  if (cargando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-80 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!tienePermiso(session, PERMISSIONS.DD_MATRIZ)) {
    return <DdAccesoDenegado mensaje="Los informes de debida diligencia están reservados a las áreas evaluadoras." />;
  }

  return <DdInformeBandeja />;
}
