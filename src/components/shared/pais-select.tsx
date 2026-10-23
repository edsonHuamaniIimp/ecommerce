"use client";

import { useMemo, useState } from "react";
import countries from "i18n-iso-countries";
import es from "i18n-iso-countries/langs/es.json";
import { Button, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, Popover, PopoverContent, PopoverTrigger } from "@nrivera-iimp/ui-kit-iimp";
import { Check, ChevronsUpDown } from "lucide-react";

countries.registerLocale(es);

const normalizar = (valor: string) =>
  valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const PAISES = Object.entries(countries.getNames("es"))
  .map(([codigo, nombre]) => ({ codigo, nombre }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

interface PaisSelectProps {
  id?: string;
  value: string;
  onChange: (pais: string) => void;
  error?: string;
  disabled?: boolean;
}

/** Selector buscable de pais; guarda el codigo ISO alpha-2. */
export function PaisSelect({ id, value, onChange, error, disabled = false }: PaisSelectProps) {
  const [open, setOpen] = useState(false);
  const seleccionado = useMemo(
    () => PAISES.find((pais) => pais.codigo === value),
    [value],
  );

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Pais"
            disabled={disabled}
            className={`h-10 w-full justify-between px-3 text-sm font-normal ${error ? "border-destructive" : ""}`}
          >
            <span className="truncate">
              {seleccionado ? `${seleccionado.codigo} - ${seleccionado.nombre}` : "Selecciona pais"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command
            filter={(itemValue, search) =>
              normalizar(itemValue).includes(normalizar(search)) ? 1 : 0
            }
          >
            <CommandInput placeholder="Buscar pais o codigo..." />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                {PAISES.map((pais) => (
                  <CommandItem
                    key={pais.codigo}
                    value={`${pais.codigo} ${pais.nombre}`}
                    keywords={[pais.codigo, pais.nombre]}
                    onSelect={() => {
                      onChange(pais.codigo);
                      setOpen(false);
                    }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${value === pais.codigo ? "opacity-100" : "opacity-0"}`} />
                    <span className="mr-2 font-mono text-xs">{pais.codigo}</span>
                    <span>{pais.nombre}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
