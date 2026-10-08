"use client";

import { useState } from "react";
import { Button, Input, Label, Tabs, TabsList, TabsTrigger } from "@nrivera-iimp/ui-kit-iimp";
import { toast } from "sonner";
import { entidadesService, type EmpresaEntidadDTO } from "@/lib/client/api/services/entidades-service";
import { empresasService } from "@/lib/client/api/services/empresas-service";
import type { EmpresaAccesoDTO } from "@/types/dto/usuarios/usuario.dto";

/** Origen de la busqueda de empresa: local (backoffice) o catalogo SIE (API de entidades). */
export type FuenteEmpresa = "local" | "sie";

/** Opcion normalizada para pintar el resultado de cualquiera de las fuentes. */
interface OpcionEmpresa {
  key: string;
  titulo: string;
  sub: string;
  idEmpresa: string;
  nombreEmpresa: string;
  ruc: string | null;
  /** false = empresa local sin codigo SIE (no se puede vincular al acceso). */
  seleccionable: boolean;
}

/**
 * Selector de empresa para los accesos del Portal del Cliente.
 * Fuentes: `local` = empresas registradas en el backoffice (/dashboard/empresas),
 * `sie` = catalogo de la API de entidades (codigo SIE compartido).
 */
export function EmpresaPicker({ seleccion, onSeleccion, label = "Empresa", fuentes = ["sie"] }: {
  seleccion: EmpresaAccesoDTO | null;
  onSeleccion: (empresa: EmpresaAccesoDTO | null) => void;
  label?: string;
  /** Fuentes habilitadas; la primera es la activa por defecto. */
  fuentes?: FuenteEmpresa[];
}) {
  const [fuente, setFuente] = useState<FuenteEmpresa>(fuentes[0] ?? "sie");
  const [q, setQ] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<OpcionEmpresa[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cambiarFuente = (valor: string) => {
    setFuente(valor as FuenteEmpresa);
    setResultados(null);
    setError(null);
  };

  const buscarLocal = async (termino: string): Promise<OpcionEmpresa[]> => {
    const respuesta = await empresasService.listar({ search: termino, perPage: 10 });
    return (respuesta.data ?? []).map((e) => ({
      key: `local-${e.id}`,
      titulo: e.razonSocial,
      sub: `RUC ${e.ruc}${e.sieCode ? ` · ${e.sieCode}` : " · sin codigo SIE"}`,
      idEmpresa: e.sieCode ?? "",
      nombreEmpresa: e.razonSocial,
      ruc: e.ruc,
      seleccionable: Boolean(e.sieCode),
    }));
  };

  const buscarSie = async (termino: string): Promise<OpcionEmpresa[]> => {
    const lista: EmpresaEntidadDTO[] = await entidadesService.buscarEmpresas(termino);
    return lista.map((e) => ({
      key: `sie-${e.idEmpresa || e.razonSocial}`,
      titulo: e.razonSocial,
      sub: `${e.idEmpresa}${e.documento ? ` · ${e.documento}` : ""}`,
      idEmpresa: e.idEmpresa,
      nombreEmpresa: e.razonSocial,
      ruc: e.documento || null,
      seleccionable: true,
    }));
  };

  const buscar = async () => {
    const termino = q.trim();
    if (termino.length < 3) { setError("Escribe al menos 3 caracteres (razon social o RUC)"); return; }
    setError(null);
    setBuscando(true);
    try {
      const lista = fuente === "local" ? await buscarLocal(termino) : await buscarSie(termino);
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
      {fuentes.length > 1 && (
        <Tabs value={fuente} onValueChange={cambiarFuente}>
          <TabsList className="grid h-8 w-full grid-cols-2">
            <TabsTrigger value="local" className="text-xs"><span>Empresas locales</span></TabsTrigger>
            <TabsTrigger value="sie" className="text-xs"><span>Catalogo SIE</span></TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      <div className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); }}
          onKeyDown={(e) => { if (e.key === "Enter") void buscar(); }}
          placeholder={fuente === "local" ? "Razon social o RUC (empresas del backoffice)" : "Razon social o RUC"}
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
              key={e.key}
              type="button"
              variant="ghost"
              disabled={!e.seleccionable}
              className="h-auto w-full justify-start px-2 py-1 text-left disabled:opacity-60"
              onClick={() => {
                onSeleccion({ idEmpresa: e.idEmpresa, nombreEmpresa: e.nombreEmpresa, ruc: e.ruc });
                setResultados(null);
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{e.titulo}</span>
                <span className="block font-mono text-[10px] text-muted-foreground">{e.sub}</span>
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
