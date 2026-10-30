"use client";

import { useMemo, useState } from "react";
import countries from "i18n-iso-countries";
import es from "i18n-iso-countries/langs/es.json";
import { Button, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, Popover, PopoverContent, PopoverTrigger } from "@nrivera-iimp/ui-kit-iimp";
import { Check, ChevronsUpDown } from "lucide-react";
import { ordenarPaisesPorConteo, paisDeTexto } from "@/lib/shared/utils/pais";

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
  resaltado?: boolean;
  disabled?: boolean;
  /**
   * Valor que entrega `onChange`: código ISO por defecto o nombre del país.
   * En modo nombre también reconoce un código ISO ya guardado.
   */
  valueMode?: "codigo" | "nombre";
  mostrarCodigo?: boolean;
  placeholder?: string;
  triggerClassName?: string;
  /** Conteo por codigo ISO para priorizar paises con registros. */
  conteos?: Record<string, number>;
}

/** Selector buscable de país; por defecto guarda el código ISO alpha-2. */
export function PaisSelect({
  id,
  value,
  onChange,
  error,
  resaltado = false,
  disabled = false,
  valueMode = "codigo",
  mostrarCodigo = true,
  placeholder = "Selecciona país",
  triggerClassName = "",
  conteos,
}: PaisSelectProps) {
  const [open, setOpen] = useState(false);
  const opciones = useMemo(() => {
    return ordenarPaisesPorConteo(
      PAISES.map((pais) => ({ ...pais, conteo: conteos?.[pais.codigo] ?? 0 })),
    );
  }, [conteos]);

  const seleccionado = useMemo(() => {
    const buscado = value.trim();
    const codigoLegacy = paisDeTexto(buscado);
    return opciones.find(
      (pais) =>
        pais.codigo === codigoLegacy ||
        pais.codigo === buscado ||
        (valueMode === "nombre" && normalizar(pais.nombre) === normalizar(buscado)),
    );
  }, [value, valueMode, opciones]);

  const valorAnterior = value.trim();

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
            aria-label="País"
            disabled={disabled}
            className={`h-10 w-full justify-between px-3 text-sm font-normal ${resaltado ? "border-warning bg-warning/10 ring-2 ring-warning/20" : error ? "border-destructive" : ""} ${triggerClassName}`}
          >
            <span className="truncate">
              {seleccionado
                ? mostrarCodigo
                  ? `${seleccionado.codigo} - ${seleccionado.nombre}`
                  : seleccionado.nombre
                : valorAnterior || placeholder}
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
            <CommandInput placeholder="Buscar país o código..." />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                {opciones.map((pais) => (
                  <CommandItem
                    key={pais.codigo}
                    value={`${pais.codigo} ${pais.nombre}`}
                    keywords={[pais.codigo, pais.nombre]}
                    onSelect={() => {
                      onChange(valueMode === "nombre" ? pais.nombre : pais.codigo);
                      setOpen(false);
                    }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${seleccionado?.codigo === pais.codigo ? "opacity-100" : "opacity-0"}`} />
                    <span className="mr-2 font-mono text-xs">{pais.codigo}</span>
                    <span>{pais.nombre}</span>
                    {pais.conteo > 0 ? (
                      <span className="ml-auto rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {pais.conteo}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {!seleccionado && valorAnterior ? (
        <p className="text-[10px] text-muted-foreground">
          Se conserva el valor anterior. Selecciona un país para actualizarlo.
        </p>
      ) : null}
      {error && <p className={`text-[11px] ${resaltado ? "text-warning" : "text-destructive"}`}>{error}</p>}
    </div>
  );
}
