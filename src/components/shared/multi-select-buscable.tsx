"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
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
import { ChevronsUpDown } from "lucide-react";
import { normalizarTexto } from "@/lib/shared/utils/normalizar-texto";

interface Props {
  /** Opciones disponibles (valor = etiqueta mostrada). */
  opciones: string[];
  /** Valores seleccionados; vacio = sin filtro. */
  value: string[];
  onChange: (value: string[]) => void;
  /** Texto del boton cuando no hay seleccion. */
  placeholderTodos: string;
  /** Texto del boton cuando no hay opciones. */
  placeholderVacio?: string;
  placeholderBusqueda?: string;
  ariaLabel: string;
  disabled?: boolean;
}

/** Select buscable con checkboxes y seleccion multiple. */
export function MultiSelectBuscable({
  opciones,
  value,
  onChange,
  placeholderTodos,
  placeholderVacio,
  placeholderBusqueda = "Buscar...",
  ariaLabel,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const seleccion = new Set(value);

  const alternar = (opcion: string) => {
    const siguiente = new Set(seleccion);
    if (siguiente.has(opcion)) siguiente.delete(opcion);
    else siguiente.add(opcion);
    onChange(opciones.filter((item) => siguiente.has(item)));
  };

  const resumen =
    opciones.length === 0
      ? (placeholderVacio ?? placeholderTodos)
      : value.length === 0
        ? placeholderTodos
        : value.length === 1
          ? value[0]
          : `${value.length} seleccionadas`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className="h-8 w-full justify-between px-2.5 text-xs font-normal"
        >
          <span className="truncate">{resumen}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command
          filter={(itemValue, search) =>
            normalizarTexto(itemValue).includes(normalizarTexto(search)) ? 1 : 0
          }
        >
          <CommandInput placeholder={placeholderBusqueda} />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {opciones.map((opcion) => (
                <CommandItem key={opcion} value={opcion} onSelect={() => alternar(opcion)}>
                  <Checkbox checked={seleccion.has(opcion)} className="mr-2 pointer-events-none" tabIndex={-1} />
                  <span className="truncate">{opcion}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {value.length > 0 ? (
            <div className="border-t p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-full text-xs"
                onClick={() => onChange([])}
              >
                Limpiar selección
              </Button>
            </div>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
