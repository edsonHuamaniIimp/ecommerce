"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@nrivera-iimp/ui-kit-iimp";
import { PlanoStands } from "@/components/plano/plano-stands";
import { ReservaForm } from "@/components/reserva/reserva-form";
import { reservasService } from "@/lib/client/api/services/facade";
import type { ReservaCreateInput } from "@/lib/client/api/services/types";
import type { PlanoStand, Evento, EventoPadre } from "@/types/reserva";

interface ReservaWorkspaceProps {
  stands: PlanoStand[];
  evento: Evento;
  eventoPadre: EventoPadre;
}

export function ReservaWorkspace({ stands, evento, eventoPadre }: ReservaWorkspaceProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reservado, setReservado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = useCallback((standId: string) => {
    setSelectedIds((prev) =>
      prev.includes(standId) ? prev.filter((id) => id !== standId) : [...prev, standId],
    );
  }, []);

  const handleClear = useCallback(() => {
    setSelectedIds([]);
    setReservado(false);
    setError(null);
  }, []);

  const handleReservar = useCallback(async (input: ReservaCreateInput) => {
    try {
      setError(null);
      input.eventoId = evento.id;
      input.standIds = selectedIds;
      await reservasService.create(input);
      setReservado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar la reserva");
    }
  }, [evento.id, selectedIds]);

  const selectedStands = stands.filter((s) => selectedIds.includes(s.id));

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-8 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>
              <span>Plano interactivo — {eventoPadre.nombre} {evento.anio}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PlanoStands
              stands={stands}
              selectedIds={selectedIds}
              onToggle={handleToggle}
            />
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-4 space-y-4">
        {reservado ? (
          <Card>
            <CardHeader>
              <CardTitle>
                <span>Reserva enviada</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground text-sm">
              <p>
                <span>
                  La reserva ha sido registrada y enviada a evaluación. El stand
                  aparecerá en estado &ldquo;En evaluación&rdquo; en el plano mientras
                  pasa por las aprobaciones correspondientes.
                </span>
              </p>
            </CardContent>
          </Card>
        ) : (
          <ReservaForm
            selectedStands={selectedStands}
            onClear={handleClear}
            onReservar={handleReservar}
            error={error}
          />
        )}
      </div>
    </div>
  );
}
