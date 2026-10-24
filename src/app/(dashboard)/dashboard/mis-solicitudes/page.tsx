"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button } from "@nrivera-iimp/ui-kit-iimp";
import { Eye, Map } from "lucide-react";
import { MisSolicitudesManager } from "@/components/solicitudes/mis-solicitudes-manager";
import { PaginaDashboard } from "@/components/dashboard/pagina-dashboard";
import { EmpresaVerComoSelect } from "@/components/shared/empresa-ver-como-select";
import { useSesion } from "@/hooks/use-sesion";
import { PERMISSIONS } from "@/lib/shared/constants";
import type { EmpresaVerComoDTO } from "@/types/dto/ver-como/empresa-ver-como.dto";

export default function MisSolicitudesPage() {
  const { session, cargando } = useSesion();
  const [empresaVerComo, setEmpresaVerComo] = useState<EmpresaVerComoDTO | null>(null);
  const eventoId = session?.eventoId ?? "";
  const userId = session?.userId ?? "";
  const esAdmin = session?.permissions?.includes(PERMISSIONS.ADMIN_FULL) ?? false;

  return (
    <PaginaDashboard
      titulo="Mis solicitudes"
      descripcion={empresaVerComo ? `Solicitudes de ${empresaVerComo.razonSocial} (solo lectura).` : "Estado de tus solicitudes de alquiler de stands en el evento actual."}
      cargando={cargando}
      tieneEvento={Boolean(eventoId)}
      accion={
        !empresaVerComo ? (
          <Button asChild variant="outline" className="gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
            <Link href="/mapa">
              <Map className="h-4 w-4" />
              <span>Nueva reserva en el plano</span>
            </Link>
          </Button>
        ) : undefined
      }
    >
      {esAdmin && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <EmpresaVerComoSelect value={empresaVerComo} onChange={setEmpresaVerComo} />
          {empresaVerComo && (
            <Badge className="gap-1.5 bg-info/10 text-[11px] font-semibold text-info">
              <Eye className="h-3 w-3" />
              <span>Viendo como {empresaVerComo.razonSocial} · Solo lectura</span>
            </Badge>
          )}
        </div>
      )}
      <MisSolicitudesManager
        key={empresaVerComo?.id ?? "mi-cuenta"}
        eventoId={eventoId}
        userId={userId}
        empresaVerComoId={empresaVerComo?.id}
      />
    </PaginaDashboard>
  );
}
