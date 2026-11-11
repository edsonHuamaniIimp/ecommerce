"use client";

import { Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { DdConfiguracion } from "@/components/debida-diligencia/dd-configuracion";
import { DdAccesoDenegado } from "@/components/debida-diligencia/dd-acceso-denegado";
import { useSesion } from "@/hooks/use-sesion";
import { PERMISSIONS, ROLES } from "@/lib/shared/constants";
import { tienePermiso } from "@/lib/shared/utils/permisos";

export default function DebidaDiligenciaConfiguracionPage() {
  const { session, cargando } = useSesion();

  if (cargando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-80 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const autorizado =
    session?.roles?.includes(ROLES.ADMIN) || tienePermiso(session, PERMISSIONS.DD_ADMIN);

  if (!autorizado) {
    return <DdAccesoDenegado mensaje="La administración de Debida Diligencia está reservada al backoffice." />;
  }

  return <DdConfiguracion />;
}
