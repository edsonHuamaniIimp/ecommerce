"use client";

import { PaginaDashboard } from "@/components/dashboard/pagina-dashboard";
import { DdAccesoDenegado } from "@/components/debida-diligencia/dd-acceso-denegado";
import { DdRepositorio } from "@/components/debida-diligencia/dd-repositorio";
import { useSesion } from "@/hooks/use-sesion";
import { PERMISSIONS } from "@/lib/shared/constants";
import { tienePermiso } from "@/lib/shared/utils/permisos";

export default function DebidaDiligenciaRepositorioPage() {
  const { session, cargando } = useSesion();
  const eventoId = session?.eventoId ?? "";
  const autorizado = tienePermiso(session, PERMISSIONS.DD_MATRIZ);

  return (
    <PaginaDashboard
      titulo="Centro documental de Debida Diligencia"
      descripcion="Documentos del cliente y evidencias de cada vínculo, con filtros por tipo, área, formato y fecha."
      cargando={cargando}
      tieneEvento={Boolean(eventoId)}
      ancho="amplio"
    >
      {autorizado ? (
        <DdRepositorio />
      ) : (
        <DdAccesoDenegado mensaje="El centro documental está reservado a las áreas que evalúan la debida diligencia." />
      )}
    </PaginaDashboard>
  );
}
