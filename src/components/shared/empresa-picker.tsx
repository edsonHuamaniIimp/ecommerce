"use client";

import { useState } from "react";
import { Button, Input, Label } from "@nrivera-iimp/ui-kit-iimp";
import { toast } from "sonner";
import { entidadesService, type EmpresaEntidadDTO } from "@/lib/client/api/services/entidades-service";
import type { EmpresaAccesoDTO } from "@/types/dto/usuarios/usuario.dto";

/**
 * Selector de empresa contra la API de entidades (la misma que usa el perfil):
 * busca por razon social o RUC y devuelve el codigo SIE compartido (E0000003804).
 */
export function EmpresaPicker({ seleccion, onSeleccion, label = "Empresa" }: {
  seleccion: EmpresaAccesoDTO | null;
  onSeleccion: (empresa: EmpresaAccesoDTO | null) => void;
  label?: string;
}) {
  const [q, setQ] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<EmpresaEntidadDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buscar = async () => {
    const termino = q.trim();
    if (termino.length < 3) { setError("Escribe al menos 3 caracteres (razon social o RUC)"); return; }
    setError(null);
    setBuscando(true);
    try {
      const lista = await entidadesService.buscarEmpresas(termino);
      setResultados(lista);
      if (lista.length === 0) toast.info("No se encontraron empresas");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar empresas");
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  };

  if (seleccion) {
    return (
      <div className="space-y-1">
        <Label className="text-xs"><span>{label} *</span></Label>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary p-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{seleccion.nombreEmpresa}</p>
            <p className="font-mono text-[10px] text-muted-foreground">
              {seleccion.idEmpresa}{seleccion.ruc ? ` · RUC ${seleccion.ruc}` : ""}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 text-xs"
            onClick={() => { onSeleccion(null); setQ(""); setResultados(null); }}
          >
            <span>Cambiar</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs"><span>{label} *</span></Label>
      <div className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); }}
          onKeyDown={(e) => { if (e.key === "Enter") void buscar(); }}
          placeholder="Razon social o RUC"
          className="h-8 text-xs"
        />
        <Button size="sm" className="h-8 shrink-0" onClick={() => { void buscar(); }} disabled={buscando}>
          <span>{buscando ? "Buscando..." : "Buscar"}</span>
        </Button>
      </div>
      {resultados && resultados.length > 0 && (
        <div className="max-h-[180px] space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
          {resultados.map((e) => (
            <Button
              key={e.idEmpresa || e.razonSocial}
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start px-2 py-1 text-left"
              onClick={() => {
                onSeleccion({ idEmpresa: e.idEmpresa, nombreEmpresa: e.razonSocial, ruc: e.documento || null });
                setResultados(null);
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{e.razonSocial}</span>
                <span className="block font-mono text-[10px] text-muted-foreground">
                  {e.idEmpresa}{e.documento ? ` · ${e.documento}` : ""}
                </span>
              </span>
            </Button>
          ))}
        </div>
      )}
      {resultados && resultados.length === 0 && !buscando && (
        <p className="rounded-lg border border-dashed border-border bg-secondary px-3 py-2 text-center text-[11px] text-muted-foreground">
          <span>Sin resultados.</span>
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
