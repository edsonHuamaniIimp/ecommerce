"use client";

import { useEffect, useState } from "react";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { ClienteDashboardContent } from "@/components/dashboard/cliente-dashboard-content";
import { AprobacionesSection } from "@/components/dashboard/aprobaciones-section";
import { dashboardService } from "@/lib/client/api/services/dashboard-service";
import { useSesion } from "@/hooks/use-sesion";
import { MONEDAS, ROLES } from "@/lib/shared/constants";
import type { EstadisticasEventoDTO } from "@/types/dto/dashboard/estadisticas-evento.dto";

const ESTADISTICAS_VACIAS: EstadisticasEventoDTO = {
  totalStands: 0,
  reservados: 0,
  disponibles: 0,
  enProceso: 0,
  montoTotal: 0,
  moneda: MONEDAS.US_DOLAR,
};

export default function DashboardPage() {
  const { session, cargando } = useSesion();
  const eventoId = session?.eventoId ?? "";
  const roles = session?.roles ?? [];
  /* Portal del Cliente: los usuarios con rol cliente ven "Mi Panel"; el resto, el panel de control. */
  const esCliente = roles.includes(ROLES.CLIENTE) && !roles.includes(ROLES.ADMIN);
  const [stats, setStats] = useState<EstadisticasEventoDTO | null>(null);

  useEffect(() => {
    if (esCliente || !eventoId) return;
    dashboardService
      .estadisticas()
      .then(setStats)
      .catch(() => setStats(ESTADISTICAS_VACIAS));
  }, [eventoId, esCliente]);

  if (esCliente) {
    return <ClienteDashboardContent session={session} cargando={cargando} />;
  }

  return (
    <div className="space-y-6 pb-10">
      <DashboardContent
        reservas={[]}
        stats={stats ?? ESTADISTICAS_VACIAS}
        eventoNombre={session?.eventoNombre ?? session?.eventoPadreNombre ?? null}
        cargando={cargando || (Boolean(eventoId) && stats === null)}
      />
      <AprobacionesSection reservas={[]} />
    </div>
  );
}
