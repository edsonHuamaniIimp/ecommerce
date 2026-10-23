"use client";

import { MisDebidasDiligencias } from "@/components/debida-diligencia/mis-debidas-diligencias";
import { DdAccesoDenegado } from "@/components/debida-diligencia/dd-acceso-denegado";
import { useSesion } from "@/hooks/use-sesion";
import { PERMISSIONS } from "@/lib/shared/constants";
import { tienePermiso } from "@/lib/shared/utils/permisos";

export default function MisDebidasDiligenciasPage() {
  const { session, cargando } = useSesion();

  if (cargando) return null;
  if (!tienePermiso(session, PERMISSIONS.DD_FORMULARIO)) {
    return <DdAccesoDenegado mensaje="Solo la cuenta de la empresa puede ver sus debidas diligencias." />;
  }
  return <MisDebidasDiligencias />;
}
