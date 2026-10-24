"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@nrivera-iimp/ui-kit-iimp";
import { Check, ChevronsUpDown } from "lucide-react";
import { eventosServiceClient } from "@/lib/client/api/services/eventos-service";
import { DD_EVENTO_TODOS, DD_EVENTO_TODOS_LABEL, TIPOS_EVENTO_LABELS } from "@/lib/shared/constants";
import type { EventoPadrePresalaDTO } from "@/types/dto/eventos";

interface Props {
  value: string;
  onChange: (eventoId: string) => void;
  incluirTodos?: boolean;
}

/** Normaliza la respuesta del API de eventos, que puede venir envuelta. */
function normalizarPadres(data: unknown): EventoPadrePresalaDTO[] {
  if (Array.isArray(data)) return data as EventoPadrePresalaDTO[];
  if (!data || typeof data !== "object") return [];
  const registro = data as Record<string, unknown>;
  for (const clave of ["data", "listEvent", "events", "items"]) {
    if (Array.isArray(registro[clave])) {
      return registro[clave] as EventoPadrePresalaDTO[];
    }
  }
  return [];
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const ID_EVENTO_LOCAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Selector buscable de version de evento para las bandejas y el panel de DD. */
export function DdEventoSelect({ value, onChange, incluirTodos = false }: Props) {
  const [padres, setPadres] = useState<EventoPadrePresalaDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let activo = true;
    eventosServiceClient
      .listar()
      .then((data) => {
        if (activo) setPadres(normalizarPadres(data));
      })
      .catch(() => {
        if (activo) setPadres([]);
      })
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  const opciones = useMemo(() => {
    const unicas = new Map<string, { id: string; label: string; anio: string }>();
    for (const padre of padres) {
      for (const version of padre.versiones) {
        if (!ID_EVENTO_LOCAL.test(version.id)) continue;
        const label = `${TIPOS_EVENTO_LABELS[version.tipoEvento ?? -1] ?? padre.nombre} ${version.anio}`;
        const clave = `${label}|${version.anio}`;
        if (!unicas.has(clave)) {
          unicas.set(clave, { id: version.id, label, anio: version.anio });
        }
      }
    }
    return [...unicas.values()].sort(
      (a, b) => b.anio.localeCompare(a.anio) || a.label.localeCompare(b.label),
    );
  }, [padres]);

  const seleccionado = value === DD_EVENTO_TODOS
    ? DD_EVENTO_TODOS_LABEL
    : opciones.find((opcion) => opcion.id === value)?.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Evento"
          disabled={loading}
          className="h-8 w-[240px] justify-between px-2.5 text-xs font-normal"
        >
          <span className="truncate">
            {seleccionado ?? (loading ? "Cargando eventos..." : "Seleccionar evento")}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command
          filter={(itemValue, search) =>
            normalizar(itemValue).includes(normalizar(search)) ? 1 : 0
          }
        >
          <CommandInput placeholder="Buscar evento o año..." />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {incluirTodos ? (
                <CommandItem
                  value={DD_EVENTO_TODOS_LABEL}
                  keywords={["todos", "eventos"]}
                  onSelect={() => {
                    onChange(DD_EVENTO_TODOS);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      value === DD_EVENTO_TODOS ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <span>{DD_EVENTO_TODOS_LABEL}</span>
                </CommandItem>
              ) : null}
              {opciones.map((opcion) => (
                <CommandItem
                  key={opcion.id}
                  value={`${opcion.label} ${opcion.anio}`}
                  keywords={[opcion.label, opcion.anio]}
                  onSelect={() => {
                    onChange(opcion.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      value === opcion.id ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <span>{opcion.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
