"use client";

import { useEffect, useRef, useState } from "react";
import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@nrivera-iimp/ui-kit-iimp";
import { Building2, Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { verComoService } from "@/lib/client/api/services/ver-como-service";
import { VER_COMO } from "@/lib/shared/constants";
import type { EmpresaVerComoDTO } from "@/types/dto/ver-como/empresa-ver-como.dto";

interface Props {
  value: EmpresaVerComoDTO | null;
  onChange: (empresa: EmpresaVerComoDTO | null) => void;
  disabled?: boolean;
  className?: string;
}

/** Selector buscable de empresas para la vista "Ver como" del administrador. */
export function EmpresaVerComoSelect({ value, onChange, disabled = false, className }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [empresas, setEmpresas] = useState<EmpresaVerComoDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [validando, setValidando] = useState(false);
  const peticionRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const peticion = ++peticionRef.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      verComoService
        .buscarEmpresas(query.trim() || undefined)
        .then((data) => {
          if (peticion === peticionRef.current) setEmpresas(data.data ?? []);
        })
        .catch(() => {
          if (peticion === peticionRef.current) setEmpresas([]);
        })
        .finally(() => {
          if (peticion === peticionRef.current) setLoading(false);
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  const seleccionar = async (empresa: EmpresaVerComoDTO | null) => {
    if (!empresa) {
      onChange(null);
      setOpen(false);
      setQuery("");
      return;
    }
    setValidando(true);
    try {
      const validada = await verComoService.seleccionar(empresa.id);
      onChange(validada);
      setOpen(false);
      setQuery("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo validar la empresa");
    } finally {
      setValidando(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Ver como empresa"
          disabled={disabled || validando}
          className={`h-9 w-full justify-between gap-2 px-3 text-sm font-normal sm:w-[320px] ${className ?? ""}`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{value ? value.razonSocial : "Ver como..."}</span>
          </span>
          {validando ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-60" />
          ) : (
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              maxLength={VER_COMO.MAX_BUSQUEDA}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por razón social o RUC..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-1" role="listbox" aria-label="Empresas">
          {value && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-xs text-muted-foreground hover:bg-secondary"
              onClick={() => { void seleccionar(null); }}
            >
              <X className="h-3.5 w-3.5 shrink-0" />
              <span>Salir de la vista de empresa</span>
            </button>
          )}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Buscando empresas...</span>
            </div>
          ) : empresas.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">Sin resultados.</p>
          ) : (
            empresas.map((empresa) => {
              const activa = value?.id === empresa.id;
              return (
                <button
                  key={empresa.id}
                  type="button"
                  role="option"
                  aria-selected={activa}
                  className="flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left hover:bg-secondary"
                  onClick={() => { void seleccionar(empresa); }}
                >
                  <Check className={`mt-0.5 h-4 w-4 shrink-0 ${activa ? "opacity-100" : "opacity-0"}`} />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-foreground">{empresa.razonSocial}</span>
                    <span className="block truncate font-mono text-[10px] text-muted-foreground">
                      {empresa.ruc}
                      {empresa.nombreComercial ? ` · ${empresa.nombreComercial}` : ""}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
