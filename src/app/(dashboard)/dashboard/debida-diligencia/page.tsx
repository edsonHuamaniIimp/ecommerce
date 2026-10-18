"use client";

import { useState } from "react";
import { Button, Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { RefreshCw } from "lucide-react";
import { DdPanel } from "@/components/debida-diligencia/dd-panel";
import { DdBandeja } from "@/components/debida-diligencia/dd-bandeja";
import { DdReputacion } from "@/components/debida-diligencia/dd-reputacion";
import { DdLegalBandeja } from "@/components/debida-diligencia/dd-legal-bandeja";
import { MiDebidaDiligencia } from "@/components/debida-diligencia/mi-debida-diligencia";
import { DdAccesoDenegado } from "@/components/debida-diligencia/dd-acceso-denegado";
import { useSesion } from "@/hooks/use-sesion";
import { PERMISSIONS } from "@/lib/shared/constants";
import { tienePermiso } from "@/lib/shared/utils/permisos";

export default function DebidaDiligenciaLandingPage() {
  const { session, cargando } = useSesion();
  const [refreshKey, setRefreshKey] = useState(0);

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

  const contenido = tienePermiso(session, PERMISSIONS.DD_PANEL) ? (
    <DdPanel />
  ) : tienePermiso(session, PERMISSIONS.DD_REVISION) ? (
    <DdBandeja />
  ) : tienePermiso(session, PERMISSIONS.DD_LEGAL) ? (
    <DdLegalBandeja />
  ) : tienePermiso(session, PERMISSIONS.DD_REPUTACION) ? (
    <DdReputacion />
  ) : tienePermiso(session, PERMISSIONS.DD_FORMULARIO) ? (
    <MiDebidaDiligencia />
  ) : (
    <DdAccesoDenegado />
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setRefreshKey((valor) => valor + 1)}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Recargar vista</span>
        </Button>
      </div>
      <div key={refreshKey}>{contenido}</div>
    </div>
  );
}
