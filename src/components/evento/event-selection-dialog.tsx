"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@nrivera-iimp/ui-kit-iimp";
import { eventosService } from "@/lib/api/services/facade";
import { useEvento } from "@/contexts/evento-context";
import type { EventoPadre, Evento } from "@/types/reserva";
import type { Vertical } from "@/lib/constants";

interface EventoOption {
  evento: Evento;
  eventoPadre: EventoPadre;
}

const VERTICAL_COLOR: Record<Vertical, string> = {
  proexplo: "hsl(24 83% 50%)",
  wmc: "hsl(191 100% 43%)",
  gess: "hsl(140 66% 32%)",
  perumin: "hsl(34 69% 43%)",
};

const DESCRIPCION: Record<Vertical, string> = {
  proexplo: "Prospectiva y Exploración Minera",
  wmc: "World Mining Congress",
  gess: "Gestión Social y Sostenibilidad",
  perumin: "Convención Minera",
};

export function EventSelectionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { selectEvento, selected } = useEvento();
  const [options, setOptions] = useState<EventoOption[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const padres = await eventosService.listEventosPadre();
      const results: EventoOption[] = [];
      for (const p of padres) {
        const evs = await eventosService.listEventos(p.id);
        for (const e of evs) {
          if (e.estado === "active") results.push({ evento: e, eventoPadre: p });
        }
      }
      setOptions(results);
    })();
  }, [open]);

  const handleSelect = (opt: EventoOption) => {
    selectEvento({ evento: opt.evento, eventoPadre: opt.eventoPadre });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle><span>Seleccionar evento</span></DialogTitle>
          <DialogDescription>
            <span>Elegí el evento para el cual deseas reservar stands.</span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {options.map((opt) => {
            const color = VERTICAL_COLOR[opt.eventoPadre.vertical];
            const isActive = selected?.evento.id === opt.evento.id;
            return (
              <button
                key={opt.evento.id}
                type="button"
                onClick={() => handleSelect(opt)}
                className={`group flex items-center gap-4 rounded-lg border px-4 py-3 text-left transition-all ${
                  isActive
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100"
                }`}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {opt.eventoPadre.nombre.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">
                      {opt.eventoPadre.nombre}
                    </span>
                    <span
                      className="shrink-0 rounded px-1.5 py-px text-[10px] font-medium"
                      style={{ backgroundColor: color + "1A", color }}
                    >
                      {opt.evento.anio}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {DESCRIPCION[opt.eventoPadre.vertical]}
                  </p>
                </div>
                {isActive && (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EventSelectionGate() {
  const { selected, isHydrated } = useEvento();
  const [autoOpen, setAutoOpen] = useState(false);

  useEffect(() => {
    if (isHydrated && !selected) {
      const t = setTimeout(() => setAutoOpen(true), 400);
      return () => clearTimeout(t);
    }
    if (selected) setAutoOpen(false);
  }, [isHydrated, selected]);

  return <EventSelectionDialog open={autoOpen} onOpenChange={setAutoOpen} />;
}
