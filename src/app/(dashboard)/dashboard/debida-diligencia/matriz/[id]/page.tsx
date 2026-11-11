"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { DdMatrizDecisionVinculo } from "@/components/debida-diligencia/dd-matriz-decision-vinculo";
import { DdMatrizRevisionVinculo } from "@/components/debida-diligencia/dd-matriz-revision-vinculo";
import { DdAccesoDenegado } from "@/components/debida-diligencia/dd-acceso-denegado";
import { useSesion } from "@/hooks/use-sesion";
import { PERMISSIONS } from "@/lib/shared/constants";
import { tienePermiso } from "@/lib/shared/utils/permisos";

export default function DebidaDiligenciaMatrizDetallePage() {
  const params = useParams<{ id: string }>();
  const { session, cargando } = useSesion();
  const [modo, setModo] = useState<"revision" | "edicion">("revision");

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

  return modo === "revision" ? (
    <DdMatrizRevisionVinculo id={params.id} onEditar={() => setModo("edicion")} />
  ) : (
    <DdMatrizDecisionVinculo id={params.id} onVolverRevision={() => setModo("revision")} />
  );
}
