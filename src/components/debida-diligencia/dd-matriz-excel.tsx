"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nrivera-iimp/ui-kit-iimp";
import { Download, FileSpreadsheet, FileText, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/shared/pagination";
import type {
  DdMatrizEvaluacionExportFilaDTO,
  DdMatrizEvaluacionExportarRequestDTO,
} from "@/types/dto/debida-diligencia";
import {
  DD_EVENTO_TODOS,
  DD_MATRIZ_AMBITO_LABELS,
  DD_MATRIZ_COLORES,
  DD_MATRIZ_FILTRO_SIN_EVALUAR,
  DD_MATRIZ_FILTRO_TODOS,
  DD_MATRIZ_RESULTADO_FINAL_LABELS,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_RUTAS,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import {
  COLUMNAS_MATRIZ_CSV,
  COLUMNAS_MATRIZ_EXCEL,
  GRUPOS_MATRIZ_EXCEL,
  exportarMatrizExcel,
} from "@/lib/shared/utils/dd-matriz-excel";
import { exportarTablaCsv, nombreArchivoExport } from "@/lib/shared/utils/export-tabla";
import { DdEventoSelect } from "./dd-evento-select";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import { exportarExpedientesDd } from "@/lib/client/utils/dd-exportacion-expedientes";

interface FiltrosExcel {
  eventoId: string;
  search: string;
  tipo: string;
  ambito: string;
  resultadoFinal: string;
}

const FILTROS_INICIALES: FiltrosExcel = {
  eventoId: DD_EVENTO_TODOS,
  search: "",
  tipo: DD_MATRIZ_FILTRO_TODOS,
  ambito: DD_MATRIZ_FILTRO_TODOS,
  resultadoFinal: DD_MATRIZ_FILTRO_TODOS,
};

const POR_PAGINA = 50;

const ANCHOS_CONTEXTO = [210, 150, 175, 230, 190, 105] as const;

const COLOR_ENCABEZADO: Record<string, string> = {
  [DD_MATRIZ_COLORES.COMUN]: "bg-violet-100 text-violet-950",
  [DD_MATRIZ_COLORES.NACIONAL]: "bg-orange-100 text-orange-950",
  [DD_MATRIZ_COLORES.EXTRANJERO]: "bg-sky-100 text-sky-950",
};

const etiqueta = (catalogo: Record<string, string>, valor: string | null | undefined): string =>
  valor ? (catalogo[valor] ?? valor) : "";

function valorCelda(valor: string | number | Date | null): string {
  if (valor instanceof Date) return dateUtils.format(valor);
  if (valor === null || valor === undefined) return "";
  return String(valor);
}

function cuerpoFiltros(filtros: FiltrosExcel): DdMatrizEvaluacionExportarRequestDTO {
  const sinEvaluar = filtros.resultadoFinal === DD_MATRIZ_FILTRO_SIN_EVALUAR;
  return {
    eventoId: filtros.eventoId,
    search: filtros.search.trim() || undefined,
    tipo: filtros.tipo !== DD_MATRIZ_FILTRO_TODOS ? filtros.tipo : undefined,
    ambito: filtros.ambito !== DD_MATRIZ_FILTRO_TODOS ? filtros.ambito : undefined,
    resultadoFinal:
      filtros.resultadoFinal !== DD_MATRIZ_FILTRO_TODOS && !sinEvaluar ? filtros.resultadoFinal : undefined,
    sinEvaluar: sinEvaluar || undefined,
  };
}

/**
 * Vista principal de la matriz: hoja horizontal tipo Excel con las 54 columnas
 * oficiales A-BB. Las columnas de contexto (empresa, relacion, sujeto, documento
 * y ambito) quedan fijas a la izquierda y no forman parte de la exportacion.
 */
export function DdMatrizExcel() {
  const [filas, setFilas] = useState<DdMatrizEvaluacionExportFilaDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosExcel>(FILTROS_INICIALES);
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [exportando, setExportando] = useState<"xlsx" | "csv" | null>(null);
  const [exportandoExpedientes, setExportandoExpedientes] = useState(false);

  const cargar = useCallback(async (siguientes: FiltrosExcel) => {
    try {
      const respuesta = await ddMatrizEvaluacionService.exportar(cuerpoFiltros(siguientes));
      setFilas(respuesta.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar la matriz");
      setFilas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar(filtros);
  }, [cargar, filtros]);

  const aplicar = (cambios: Partial<FiltrosExcel>) => {
    setLoading(true);
    setPagina(1);
    setFiltros((previos) => ({ ...previos, ...cambios }));
  };

  const totalPaginas = Math.max(1, Math.ceil(filas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const filasPagina = useMemo(
    () => filas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA),
    [filas, paginaActual],
  );

  /** Exporta los expedientes de DD (una fila por empresa) con los enlaces a sus documentos. */
  const exportarExpedientes = async (formato: "xlsx" | "csv") => {
    setExportandoExpedientes(true);
    try {
      const total = await exportarExpedientesDd({ eventoId: filtros.eventoId, search: filtros.search }, formato);
      if (total === 0) {
        toast.error("No hay expedientes para exportar con los filtros actuales");
        return;
      }
      toast.success(`${total} expediente(s) exportado(s) con enlaces a sus documentos`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo exportar los expedientes");
    } finally {
      setExportandoExpedientes(false);
    }
  };

  const exportar = async (formato: "xlsx" | "csv") => {
    if (filas.length === 0) {
      toast.error("No hay filas para exportar con los filtros actuales");
      return;
    }
    setExportando(formato);
    try {
      if (formato === "csv") {
        exportarTablaCsv(filas, COLUMNAS_MATRIZ_CSV, nombreArchivoExport("dd-matriz-evaluacion", "csv"));
      } else {
        await exportarMatrizExcel(filas, nombreArchivoExport("dd-matriz-evaluacion", "xlsx"));
      }
      toast.success(`${filas.length} fila(s) exportada(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo exportar la matriz");
    } finally {
      setExportando(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Matriz de evaluación DD</h1>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
              {loading ? "..." : `${filas.length} filas`}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Vista tipo Excel: 54 columnas A–BB, una fila por sujeto evaluado y columnas fijas de contexto.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={loading || exportando !== null}
            onClick={() => { void exportar("xlsx"); }}
          >
            <FileSpreadsheet className={`h-3.5 w-3.5 ${exportando === "xlsx" ? "animate-pulse" : ""}`} />
            <span>{exportando === "xlsx" ? "Exportando..." : "Exportar matriz"}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={loading || exportando !== null}
            onClick={() => { void exportar("csv"); }}
          >
            <FileText className={`h-3.5 w-3.5 ${exportando === "csv" ? "animate-pulse" : ""}`} />
            <span>CSV</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={exportandoExpedientes}
                title="Exporta una fila por expediente con los enlaces a sus documentos"
              >
                <Download className={`h-3.5 w-3.5 ${exportandoExpedientes ? "animate-pulse" : ""}`} />
                <span>{exportandoExpedientes ? "Exportando..." : "Exportar DD con enlaces"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel><span>Expedientes de DD con enlaces a documentos</span></DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={exportandoExpedientes} onSelect={() => { void exportarExpedientes("xlsx"); }}>
                <FileSpreadsheet className="mr-2 h-3.5 w-3.5" />
                <span>Excel (.xlsx)</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={exportandoExpedientes} onSelect={() => { void exportarExpedientes("csv"); }}>
                <FileText className="mr-2 h-3.5 w-3.5" />
                <span>CSV (.csv)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={loading}
            onClick={() => { setLoading(true); void cargar(filtros); }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Recargar</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1fr)_240px_180px_160px_200px]">
        <div className="space-y-1">
          <label className="text-[10px] font-medium uppercase text-muted-foreground">Evento</label>
          <DdEventoSelect value={filtros.eventoId} onChange={(valor) => aplicar({ eventoId: valor })} incluirTodos />
        </div>
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa, sujeto, documento o expediente..."
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") aplicar({ search: evento.currentTarget.value });
            }}
            className="h-9 border-border bg-secondary pl-8 text-xs"
          />
        </div>
        <Select value={filtros.tipo} onValueChange={(valor) => aplicar({ tipo: valor })}>
          <SelectTrigger className="h-9 border-border text-xs"><SelectValue placeholder="Tipo de sujeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={DD_MATRIZ_FILTRO_TODOS}><span>Todos</span></SelectItem>
            {Object.entries(DD_MATRIZ_TIPO_VINCULO_LABELS).map(([valor, label]) => (
              <SelectItem key={valor} value={valor}><span>{label}</span></SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtros.ambito} onValueChange={(valor) => aplicar({ ambito: valor })}>
          <SelectTrigger className="h-9 border-border text-xs"><SelectValue placeholder="Ámbito" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={DD_MATRIZ_FILTRO_TODOS}><span>Todos</span></SelectItem>
            {Object.entries(DD_MATRIZ_AMBITO_LABELS).map(([valor, label]) => (
              <SelectItem key={valor} value={valor}><span>{label}</span></SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtros.resultadoFinal} onValueChange={(valor) => aplicar({ resultadoFinal: valor })}>
          <SelectTrigger className="h-9 border-border text-xs"><SelectValue placeholder="Resultado final" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={DD_MATRIZ_FILTRO_TODOS}><span>Todos</span></SelectItem>
            <SelectItem value={DD_MATRIZ_FILTRO_SIN_EVALUAR}><span>Sin evaluar</span></SelectItem>
            {Object.entries(DD_MATRIZ_RESULTADO_FINAL_LABELS).map(([valor, label]) => (
              <SelectItem key={valor} value={valor}><span>{label}</span></SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Cargando matriz...
        </div>
      ) : filasPagina.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">No hay sujetos evaluados con estos filtros.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cuando existan expedientes enviados, sus empresas y personas vinculadas aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="max-h-[72vh] overflow-auto">
            <table className="w-max min-w-full border-separate border-spacing-0 text-[10px]">
              <colgroup>
                {ANCHOS_CONTEXTO.map((ancho, indice) => (
                  <col key={`contexto-${indice}`} style={{ width: `${ancho}px` }} />
                ))}
                {COLUMNAS_MATRIZ_EXCEL.map((columna, indice) => (
                  <col key={`columna-${indice}`} style={{ width: `${Math.max(130, columna.ancho * 7)}px` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th
                    colSpan={ANCHOS_CONTEXTO.length}
                    className="sticky top-0 z-40 border-r border-b border-border bg-slate-800 px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wide text-white"
                  >
                    Contexto del expediente
                  </th>
                  {GRUPOS_MATRIZ_EXCEL.map((grupo) => (
                    <th
                      key={grupo.titulo}
                      colSpan={grupo.hasta - grupo.desde + 1}
                      className="sticky top-0 z-30 border-r border-b border-border bg-slate-800 px-2 py-2 text-center text-[8px] font-bold uppercase tracking-wide text-white"
                    >
                      {grupo.titulo}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="sticky top-[31px] z-40 border-r border-b border-border bg-slate-100 px-2 py-2 text-left text-[8px] font-bold uppercase text-slate-700" style={{ width: `${ANCHOS_CONTEXTO[0]}px` }}>
                    Empresa
                  </th>
                  <th className="sticky top-[31px] z-40 border-r border-b border-border bg-slate-100 px-2 py-2 text-left text-[8px] font-bold uppercase text-slate-700">
                    Evento
                  </th>
                  <th className="sticky top-[31px] z-40 border-r border-b border-border bg-slate-100 px-2 py-2 text-left text-[8px] font-bold uppercase text-slate-700">
                    Relación comercial
                  </th>
                  <th className="sticky top-[31px] z-40 border-r border-b border-border bg-slate-100 px-2 py-2 text-left text-[8px] font-bold uppercase text-slate-700">
                    Sujeto evaluado
                  </th>
                  <th className="sticky top-[31px] z-40 border-r border-b border-border bg-slate-100 px-2 py-2 text-left text-[8px] font-bold uppercase text-slate-700">
                    Documento / rol
                  </th>
                  <th className="sticky top-[31px] z-40 border-r border-b border-border bg-slate-100 px-2 py-2 text-left text-[8px] font-bold uppercase text-slate-700">
                    Ámbito
                  </th>
                  {COLUMNAS_MATRIZ_EXCEL.map((columna) => (
                    <th
                      key={columna.encabezado}
                      className={`sticky top-[31px] z-20 border-r border-b border-border px-2 py-2 text-center text-[8px] font-bold uppercase leading-tight ${COLOR_ENCABEZADO[columna.color] ?? "bg-secondary"}`}
                    >
                      {columna.encabezado}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasPagina.map((fila, indice) => {
                  const documento = [fila.vinculo.tipoDocumento, fila.vinculo.documento].filter(Boolean).join(" ");
                  return (
                    <tr key={`${fila.expedienteCodigo}-${fila.vinculo.id}-${indice}`} className="hover:bg-primary/[0.03]">
                      <td className="border-r border-b border-border bg-card px-2 py-2 align-top" style={{ width: `${ANCHOS_CONTEXTO[0]}px` }}>
                        <p className="max-w-[195px] truncate font-semibold text-foreground" title={fila.empresa.razonSocial}>
                          {fila.empresa.razonSocial}
                        </p>
                        <p className="font-mono text-[9px] text-muted-foreground">{fila.expedienteCodigo}</p>
                      </td>
                      <td className="border-r border-b border-border bg-card px-2 py-2 align-top">
                        <p className="max-w-[140px] truncate text-foreground" title={fila.eventoLabel}>{fila.eventoLabel}</p>
                      </td>
                      <td className="border-r border-b border-border bg-card px-2 py-2 align-top">
                        <p className="max-w-[160px] truncate text-foreground" title={fila.empresa.motivo ?? ""}>
                          {fila.empresa.motivo || "—"}
                        </p>
                        <p className="text-[9px] text-muted-foreground">{fila.empresa.eventoProyecto || "Sin evento"}</p>
                      </td>
                      <td className="border-r border-b border-border bg-card px-2 py-2 align-top">
                        <Link
                          href={`${DD_RUTAS.MATRIZ}/${fila.vinculo.id}`}
                          className="block max-w-[215px] truncate font-semibold text-primary underline-offset-2 hover:underline"
                          title={fila.vinculo.nombre}
                        >
                          {fila.vinculo.nombre}
                        </Link>
                        <p className="text-[9px] text-muted-foreground">
                          {etiqueta(DD_MATRIZ_TIPO_VINCULO_LABELS, fila.vinculo.tipo)}
                        </p>
                      </td>
                      <td className="border-r border-b border-border bg-card px-2 py-2 align-top">
                        <p className="max-w-[175px] truncate text-foreground" title={documento}>
                          {documento || "Sin documento"}
                        </p>
                        <p className="truncate text-[9px] text-muted-foreground" title={fila.vinculo.cargo ?? ""}>
                          {fila.vinculo.cargo || "Sin cargo"}
                        </p>
                      </td>
                      <td className="border-r border-b border-border bg-card px-2 py-2 align-top">
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${fila.vinculo.ambito === "extranjero" ? "bg-sky-100 text-sky-900" : "bg-orange-100 text-orange-900"}`}>
                          {etiqueta(DD_MATRIZ_AMBITO_LABELS, fila.vinculo.ambito)}
                        </span>
                      </td>
                      {COLUMNAS_MATRIZ_EXCEL.map((columna, columnaIndice) => {
                        const valor = valorCelda(columna.valor(fila));
                        return (
                          <td
                            key={`${fila.vinculo.id}-${columnaIndice}`}
                            className="max-w-[220px] overflow-hidden border-r border-b border-border px-2 py-2 align-top text-[9px] text-foreground"
                            title={valor}
                          >
                            <span className="line-clamp-2 break-words">{valor}</span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 border-t border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {filas.length} fila(s) · página {paginaActual} de {totalPaginas} · 54 columnas A–BB
            </span>
            <Pagination page={paginaActual} totalPages={totalPaginas} onPageChange={setPagina} />
          </div>
        </div>
      )}
    </section>
  );
}




