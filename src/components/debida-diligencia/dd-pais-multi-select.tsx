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
import { ChevronsUpDown, X } from "lucide-react";
import { DD_MATRIZ_FILTRO_SIN_PAIS } from "@/lib/shared/constants";
import { nombrePais } from "@/lib/shared/utils/pais";
import { normalizarTexto } from "@/lib/shared/utils/normalizar-texto";
import { DdPaisBandera } from "./dd-pais-bandera";

interface OpcionPais {
  pais: string;
  total: number;
}

interface Props {
  id?: string;
  /** Opciones con registros (codigo ISO + cantidad). */
  opciones: OpcionPais[];
  /** Codigos ISO elegidos; puede incluir `DD_MATRIZ_FILTRO_SIN_PAIS`. */
  value: string[];
  onChange: (valor: string[]) => void;
}

/** Selector de varios paises con buscador y casillas. */
export function DdPaisMultiSelect({ id, opciones, value, onChange }: Props) {
  const [abierto, setAbierto] = useState(false);

  const alternar = (codigo: string) =>
    onChange(value.includes(codigo) ? value.filter((item) => item !== codigo) : [...value, codigo]);

  const resumen =
    value.length === 0
      ? "Todos"
      : value.length === 1
        ? value[0] === DD_MATRIZ_FILTRO_SIN_PAIS
          ? "Sin país registrado"
          : nombrePais(value[0] ?? "")
        : `${value.length} países`;

  const todas: OpcionPais[] = opciones;

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={abierto}
          aria-label="País"
          className="h-8 w-full justify-between border-border px-3 text-xs font-normal"
        >
          <span className="truncate">{resumen}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command
          filter={(valor, busqueda) => (normalizarTexto(valor).includes(normalizarTexto(busqueda)) ? 1 : 0)}
        >
          <CommandInput placeholder="Buscar país o código..." />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="sin pais registrado"
                keywords={["sin pais", "sin registrar"]}
                onSelect={() => alternar(DD_MATRIZ_FILTRO_SIN_PAIS)}
              >
                <Checkbox
                  checked={value.includes(DD_MATRIZ_FILTRO_SIN_PAIS)}
                  className="pointer-events-none mr-2"
                  aria-hidden
                  tabIndex={-1}
                />
                <span>Sin país registrado</span>
              </CommandItem>
              {todas.map((opcion) => (
                <CommandItem
                  key={opcion.pais}
                  value={`${opcion.pais} ${nombrePais(opcion.pais)}`}
                  keywords={[opcion.pais, nombrePais(opcion.pais)]}
                  onSelect={() => alternar(opcion.pais)}
                >
                  <Checkbox
                    checked={value.includes(opcion.pais)}
                    className="pointer-events-none mr-2"
                    aria-hidden
                    tabIndex={-1}
                  />
                  <span className="flex items-center gap-2">
                    <DdPaisBandera pais={opcion.pais} />
                    <span>{nombrePais(opcion.pais)}</span>
                  </span>
                  <span className="ml-auto rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {opcion.total}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {value.length > 0 ? (
          <div className="border-t border-border p-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-full gap-1.5 text-xs text-muted-foreground"
              onClick={() => onChange([])}
            >
              <X className="h-3.5 w-3.5" />
              <span>Quitar selección ({value.length})</span>
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
