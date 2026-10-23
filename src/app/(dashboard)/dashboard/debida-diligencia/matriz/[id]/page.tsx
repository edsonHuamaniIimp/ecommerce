"use client";

import { useParams } from "next/navigation";
import { Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { DdMatrizEvaluacionDetalle } from "@/components/debida-diligencia/dd-matriz-evaluacion-detalle";
import { DdAccesoDenegado } from "@/components/debida-diligencia/dd-acceso-denegado";
import { useSesion } from "@/hooks/use-sesion";
import { PERMISSIONS } from "@/lib/shared/constants";
import { tienePermiso } from "@/lib/shared/utils/permisos";

export default function DebidaDiligenciaMatrizDetallePage() {
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

  if (!tienePermiso(session, PERMISSIONS.DD_MATRIZ) || !params?.id) {
    return <DdAccesoDenegado mensaje="La matriz de evaluación está reservada a las áreas que evalúan la debida diligencia." />;
  }

  return <DdMatrizEvaluacionDetalle id={params.id} />;
}
