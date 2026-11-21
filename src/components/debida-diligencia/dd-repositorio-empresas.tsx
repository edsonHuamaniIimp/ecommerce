"use client";

import { useMemo, useState } from "react";
import { Input, Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { Building2, Search } from "lucide-react";
import { Pagination } from "@/components/shared/pagination";
import { DdEstadoBadge } from "./dd-estado-badge";
import { DdEventoSelect } from "./dd-evento-select";
import { DD_REPOSITORIO_EMPRESAS_POR_PAGINA } from "@/lib/shared/constants";
import { etiquetaCantidadVinculos } from "@/lib/shared/utils/dd-matriz-evaluacion";
import type { DdMatrizEvaluacionFilaDTO } from "@/types/dto/debida-diligencia";

export interface EmpresaRepositorio {
  expedienteId: string;
  codigo: string;
  eventoLabel: string;
  razonSocial: string;
  ruc: string;
  estado: string;
  filas: DdMatrizEvaluacionFilaDTO[];
}

interface Props {
  empresas: EmpresaRepositorio[];
  seleccionadaId: string | null;
  cargando: boolean;
  eventoId: string;
  onEvento: (eventoId: string) => void;
  onSeleccionar: (expedienteId: string) => void;
}

function normalizar(valor: string): string {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Columna izquierda: empresas con DD, con buscador, evento y paginacion. */
export function DdRepositorioEmpresas({ empresas, seleccionadaId, cargando, eventoId, onEvento, onSeleccionar }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);

  const filtradas = useMemo(() => {
    const termino = normalizar(busqueda.trim());
    return empresas.filter(
      (item) => !termino || normalizar([item.razonSocial, item.ruc, item.codigo].join(" ")).includes(termino),
    );
  }, [empresas, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / DD_REPOSITORIO_EMPRESAS_POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtradas.slice(
    (paginaActual - 1) * DD_REPOSITORIO_EMPRESAS_POR_PAGINA,
    paginaActual * DD_REPOSITORIO_EMPRESAS_POR_PAGINA,
  );

  return (
    <aside className="space-y-3 rounded-lg border border-border bg-card p-3 lg:sticky lg:top-4 lg:self-start">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Building2 className="h-3.5 w-3.5 text-primary" />
          <span>Empresas en DD</span>
        </p>
        <span className="text-[11px] text-muted-foreground">{filtradas.length}</span>
      </div>
      <DdEventoSelect
        value={eventoId}
        incluirTodos
        onChange={(valor) => {
          setBusqueda("");
          setPagina(1);
          onEvento(valor);
        }}
      />
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busqueda}
          onChange={(evento) => {
            setBusqueda(evento.target.value);
            setPagina(1);
          }}
          placeholder="Empresa, RUC o código…"
          aria-label="Buscar empresa"
          className="h-8 pl-8 text-xs"
        />
      </div>

      <div className="space-y-1.5">
        {cargando ? (
          Array.from({ length: DD_REPOSITORIO_EMPRESAS_POR_PAGINA }).map((_, indice) => (
            <Skeleton key={indice} className="h-[68px] rounded-lg" />
          ))
        ) : visibles.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            {busqueda.trim() ? "Ninguna empresa coincide con la búsqueda." : "No hay empresas con debida diligencia."}
          </p>
        ) : (
          visibles.map((item) => (
            <button
              key={item.expedienteId}
              type="button"
              onClick={() => onSeleccionar(item.expedienteId)}
              className={`w-full rounded-lg border p-2.5 text-left transition ${
                seleccionadaId === item.expedienteId
                  ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                  : "border-border hover:bg-secondary/40"
              }`}
            >
              <p className="truncate text-xs font-semibold text-foreground">{item.razonSocial}</p>
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">RUC {item.ruc}</p>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1">
                <DdEstadoBadge estado={item.estado} />
                <span className="text-[10px] text-muted-foreground">
                  {item.codigo} · {etiquetaCantidadVinculos(item.filas.length)}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {!cargando && filtradas.length > DD_REPOSITORIO_EMPRESAS_POR_PAGINA ? (
        <div className="flex flex-wrap items-center justify-between gap-1 border-t border-border pt-2">
          <span className="text-[10px] text-muted-foreground">
            Página {paginaActual} de {totalPaginas}
          </span>
          <Pagination page={paginaActual} totalPages={totalPaginas} onPageChange={setPagina} />
        </div>
      ) : null}
    </aside>
  );
}
