"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nrivera-iimp/ui-kit-iimp";
import { ESTADOS_EVENTO } from "@/lib/constants";
import type { Evento } from "@/types/reserva";

interface EventoSelectorProps {
  eventos: Evento[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function EventoSelector({ eventos, selectedId, onSelect }: EventoSelectorProps) {
  return (
    <Select value={selectedId} onValueChange={onSelect}>
      <SelectTrigger className="w-[280px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {eventos.map((ev) => (
          <SelectItem key={ev.id} value={ev.id}>
            <span>
              {ev.eventoPadreId.toUpperCase()} {ev.anio} {ev.estado !== ESTADOS_EVENTO.ACTIVE && "(Inactivo)"}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
