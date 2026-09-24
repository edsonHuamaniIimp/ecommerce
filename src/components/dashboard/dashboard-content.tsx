"use client";

import { Building2, CheckCircle, DollarSign, LayoutDashboard, TrendingUp } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { DashboardTable } from "@/components/dashboard/dashboard-table";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { numberUtils } from "@/lib/shared/utils/number";
import type { EstadisticasEventoDTO } from "@/types/dto/dashboard/estadisticas-evento.dto";
import type { Reserva } from "@/types/reserva";

interface DashboardContentProps {
  reservas: Reserva[];
  stats: EstadisticasEventoDTO;
  eventoNombre?: string | null;
  cargando?: boolean;
}

export function DashboardContent({ reservas, stats, eventoNombre, cargando = false }: DashboardContentProps) {
  const pctColocado = numberUtils.porcentaje(stats.reservados, stats.totalStands);
  const pctLibre = numberUtils.porcentaje(stats.disponibles, stats.totalStands);

  if (cargando) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">Panel de Control</h1>
            {eventoNombre && (
              <span className="rounded-full border border-gold/20 bg-gold/15 px-2 py-0.5 text-[11px] font-medium text-gold">
                {eventoNombre}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">
            Monitoreo general de ocupacion, reservas comerciales y recaudacion del evento activo.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Stands"
          value={stats.totalStands}
          icon={<LayoutDashboard className="h-4 w-4" />}
          chip={{ texto: "Inventario del evento", variante: "muted" }}
        />
        <StatsCard
          title="Reservados"
          value={stats.reservados}
          icon={<CheckCircle className="h-4 w-4" />}
          chip={{ texto: `${pctColocado}% colocado`, variante: "primary" }}
          footer={{ texto: `${stats.enProceso} en evaluacion`, destacado: stats.enProceso > 0 ? "En proceso" : undefined }}
        />
        <StatsCard
          title="Disponibles"
          value={stats.disponibles}
          icon={<Building2 className="h-4 w-4" />}
          chip={{ texto: `${pctLibre}% libre`, variante: "muted" }}
        />
        <StatsCard
          title="Monto Total"
          value={numberUtils.monto(stats.montoTotal, stats.moneda)}
          icon={<DollarSign className="h-4 w-4" />}
          chip={{ texto: "Reservas formalizadas", variante: "gold" }}
          footer={
            stats.enProceso > 0
              ? { texto: `${stats.enProceso} en evaluacion`, destacado: "Sin formalizar" }
              : undefined
          }
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-1 border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <CardTitle>
              <span className="flex items-center gap-2 text-base font-bold text-primary">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span>Ultimas reservas registradas</span>
              </span>
            </CardTitle>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              {reservas.length} {reservas.length === 1 ? "activa" : "activas"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Control y validacion de comprobantes, cartas de intencion y aprobacion SGC.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <DashboardTable reservas={reservas} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
