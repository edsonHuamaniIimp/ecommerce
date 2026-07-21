"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@nrivera-iimp/ui-kit-iimp";
import { LayoutDashboard, CheckCircle, Building2, DollarSign } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { DashboardTable } from "@/components/dashboard/dashboard-table";
import { EventoSelector } from "@/components/dashboard/evento-selector";
import type { Evento, Reserva } from "@/types/reserva";

interface DashboardContentProps {
  reservas: Reserva[];
  eventos: Evento[];
  eventoActual: Evento;
  stats: {
    totalStands: string;
    reservados: string;
    disponibles: string;
    montoTotal: string;
    procesoCount: string;
  };
  eventoNombre?: string;
}

export function DashboardContent({
  reservas,
  eventos,
  eventoActual,
  stats,
  eventoNombre,
}: DashboardContentProps) {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white px-6">
        <div className="flex-1">
          <p className="text-sm font-semibold tracking-tight text-slate-700">
            Panel de Control — {eventoNombre ?? `${eventoActual.eventoPadreId.toUpperCase()} ${eventoActual.anio}`}
          </p>
        </div>
        <EventoSelector
          eventos={eventos}
          selectedId={eventoActual.id}
          onSelect={() => {}}
        />
      </header>

      <div className="space-y-8 p-6 lg:p-10">
        {/* KPI Cards */}
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

        {/* Tabla de reservas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              <span>Últimas reservas</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardTable reservas={reservas} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
