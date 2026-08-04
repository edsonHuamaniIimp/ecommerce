"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@nrivera-iimp/ui-kit-iimp";
import { LayoutDashboard, CheckCircle, Building2, DollarSign } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { DashboardTable } from "@/components/dashboard/dashboard-table";
import type { Reserva } from "@/types/reserva";

interface DashboardContentProps {
  reservas: Reserva[];
  stats: {
    totalStands: string;
    reservados: string;
    disponibles: string;
    montoTotal: string;
    procesoCount: string;
  };
}

export function DashboardContent({
  reservas,
  stats,
}: DashboardContentProps) {
  return (
    <div className="space-y-8 pt-6 sm:pt-8 lg:pt-10">

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Total Stands"
          value={stats.totalStands}
          subtitle="en el plano"
          variant="secondary"
          icon={<LayoutDashboard className="h-4 w-4" />}
        />
        <StatsCard
          title="Reservados"
          value={stats.reservados}
          subtitle="stands ocupados"
          variant="success"
          icon={<CheckCircle className="h-4 w-4" />}
        />
        <StatsCard
          title="Disponibles"
          value={stats.disponibles}
          subtitle="listos para reservar"
          variant="primary"
          icon={<Building2 className="h-4 w-4" />}
        />
        <StatsCard
          title="Monto Total"
          value={stats.montoTotal}
          subtitle={`${stats.procesoCount} stands en proceso`}
          variant="warning"
          icon={<DollarSign className="h-4 w-4" />}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle><span>Ultimas reservas</span></CardTitle>
        </CardHeader>
        <CardContent>
          <DashboardTable reservas={reservas} />
        </CardContent>
      </Card>
    </div>
  );
}
