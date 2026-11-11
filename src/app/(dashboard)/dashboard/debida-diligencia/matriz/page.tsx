"use client";

import { useState } from "react";
import { Button, Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { DdMatrizBandeja } from "@/components/debida-diligencia/dd-matriz-bandeja";
import { DdMatrizEvaluacionLista } from "@/components/debida-diligencia/dd-matriz-evaluacion-lista";
import { DdMatrizExcel } from "@/components/debida-diligencia/dd-matriz-excel";
import { DdAccesoDenegado } from "@/components/debida-diligencia/dd-acceso-denegado";
import { useSesion } from "@/hooks/use-sesion";
import { PERMISSIONS } from "@/lib/shared/constants";
import { tienePermiso } from "@/lib/shared/utils/permisos";

type VistaMatriz = "bandeja" | "matriz" | "extendida";

export default function DebidaDiligenciaMatrizPage() {
  const { session, cargando } = useSesion();
  const [vista, setVista] = useState<VistaMatriz>("bandeja");

  if (cargando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-80 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!tienePermiso(session, PERMISSIONS.DD_MATRIZ)) {
    return <DdAccesoDenegado mensaje="La matriz de evaluación está reservada a las áreas que evalúan la debida diligencia." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant={vista === "bandeja" ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => setVista("bandeja")}
        >
          Bandeja
        </Button>
        <Button
          type="button"
          size="sm"
          variant={vista === "matriz" ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => setVista("matriz")}
        >
          Matriz de evaluación DD
        </Button>
        <Button
          type="button"
          size="sm"
          variant={vista === "extendida" ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => setVista("extendida")}
        >
          Vista extendida
        </Button>
      </div>
      {vista === "bandeja" ? <DdMatrizBandeja /> : null}
      {vista === "matriz" ? <DdMatrizExcel /> : null}
      {vista === "extendida" ? <DdMatrizEvaluacionLista variante="extendida" /> : null}
    </div>
  );
}
