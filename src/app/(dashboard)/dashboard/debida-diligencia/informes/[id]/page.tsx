"use client";

import { useParams } from "next/navigation";
import { Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { DdInformeDetalle } from "@/components/debida-diligencia/dd-informe-detalle";
import { DdAccesoDenegado } from "@/components/debida-diligencia/dd-acceso-denegado";
import { useSesion } from "@/hooks/use-sesion";
import { PERMISSIONS } from "@/lib/shared/constants";
import { tienePermiso } from "@/lib/shared/utils/permisos";

export default function DebidaDiligenciaInformeDetallePage() {
  const params = useParams<{ id: string }>();
  const { session, cargando } = useSesion();

  if (cargando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-80 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!tienePermiso(session, PERMISSIONS.DD_INFORMES) || !params?.id) {
    return <DdAccesoDenegado mensaje="Los informes de debida diligencia están reservados a las áreas evaluadoras." />;
  }

  return <DdInformeDetalle expedienteId={params.id} />;
}
