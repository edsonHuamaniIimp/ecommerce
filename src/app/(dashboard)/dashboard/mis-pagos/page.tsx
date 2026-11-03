"use client";

import { useState } from "react";
import { Badge } from "@nrivera-iimp/ui-kit-iimp";
import { Eye } from "lucide-react";
import { MisPagosManager } from "@/components/pagos/mis-pagos-manager";
import { ContactoFacturacionButton } from "@/components/pagos/contacto-facturacion-button";
import { EmpresaVerComoSelect } from "@/components/shared/empresa-ver-como-select";
import { useSesion } from "@/hooks/use-sesion";
import { PERMISSIONS } from "@/lib/shared/constants";
import type { EmpresaVerComoDTO } from "@/types/dto/ver-como/empresa-ver-como.dto";

export default function MisPagosPage() {
  const { session } = useSesion();
  const [empresaVerComo, setEmpresaVerComo] = useState<EmpresaVerComoDTO | null>(null);
  const puedeVerComo = Boolean(
    session?.permissions?.includes(PERMISSIONS.ADMIN_FULL) ||
    session?.permissions?.includes(PERMISSIONS.FACTURACION_VIEW),
  );

  return (
    <main className="flex-1 py-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Mis documentos</h1>
            <p className="text-sm text-muted-foreground">
              {empresaVerComo
                ? `Documentos de ${empresaVerComo.razonSocial} por cuota (solo lectura).`
                : "Documentos de tus solicitudes de stands. Consulta, adjunta y descarga los documentos de cada cuota: comprobantes, constancias y facturas."}
            </p>
          </div>
          <ContactoFacturacionButton />
        </div>
        {puedeVerComo && (
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
        <MisPagosManager key={empresaVerComo?.id ?? "mi-cuenta"} empresaVerComoId={empresaVerComo?.id} />
      </div>
    </main>
  );
}
