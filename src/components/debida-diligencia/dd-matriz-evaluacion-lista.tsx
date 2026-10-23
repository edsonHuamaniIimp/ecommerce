"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  CardHeader,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nrivera-iimp/ui-kit-iimp";
import { Eye, FileSpreadsheet, FileText, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import type {
  DdMatrizEvaluacionExportarRequestDTO,
  DdMatrizEvaluacionResponseDTO,
  DdMatrizEvaluacionResumenDTO,
} from "@/types/dto/debida-diligencia";
import {
  DdMatrizAmbitoBadge,
  DdMatrizConclusionBadge,
  DdMatrizConclusionComplianceBadge,
  DdMatrizResultadoBadge,
  DdMatrizResultadoFinalBadge,
} from "./dd-matriz-badges";
import { DdMatrizResumen } from "./dd-matriz-resumen";
import { DdPaisBandera } from "./dd-pais-bandera";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import {
  BADGE_STYLES,
  DD_MATRIZ_AMBITO_LABELS,
  DD_MATRIZ_FILTRO_SIN_EVALUAR,
  DD_MATRIZ_FILTRO_SIN_PAIS,
  DD_MATRIZ_FILTRO_TODOS,
  DD_MATRIZ_ORIGENES,
  DD_MATRIZ_PER_PAGE_DEFAULT,
  DD_MATRIZ_RESULTADO_FINAL_LABELS,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_RUTAS,
  PER_PAGE_OPCIONES,
  REGEX_PAIS,
  type DdMatrizTipoVinculo,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { COLUMNAS_MATRIZ_CSV, exportarMatrizExcel } from "@/lib/shared/utils/dd-matriz-excel";
import { exportarTablaCsv, nombreArchivoExport } from "@/lib/shared/utils/export-tabla";
import { nombrePais } from "@/lib/shared/utils/pais";

interface Filtros {
  page: number;
  perPage: number;
  search: string;
  tipo: string;
  ambito: string;
  pais: string;
  resultadoFinal: string;
}

const FILTROS_INICIALES: Filtros = {
  page: 1,
  perPage: DD_MATRIZ_PER_PAGE_DEFAULT,
  search: "",
  tipo: DD_MATRIZ_FILTRO_TODOS,
  ambito: DD_MATRIZ_FILTRO_TODOS,
  pais: DD_MATRIZ_FILTRO_TODOS,
  resultadoFinal: DD_MATRIZ_FILTRO_TODOS,
};

/** Filtros que comparten la lista y la exportacion (el pais ISO solo si se eligio uno concreto). */
function filtrosComunes(filtros: Filtros): DdMatrizEvaluacionExportarRequestDTO {
  const sinEvaluar = filtros.resultadoFinal === DD_MATRIZ_FILTRO_SIN_EVALUAR;
  return {
    search: filtros.search.trim() || undefined,
    tipo: filtros.tipo !== DD_MATRIZ_FILTRO_TODOS ? filtros.tipo : undefined,
    ambito: filtros.ambito !== DD_MATRIZ_FILTRO_TODOS ? filtros.ambito : undefined,
    pais: REGEX_PAIS.test(filtros.pais) ? filtros.pais : undefined,
    sinPais: filtros.pais === DD_MATRIZ_FILTRO_SIN_PAIS || undefined,
    resultadoFinal:
      filtros.resultadoFinal !== DD_MATRIZ_FILTRO_TODOS && !sinEvaluar ? filtros.resultadoFinal : undefined,
    sinEvaluar: sinEvaluar || undefined,
  };
}

function consultaDe(filtros: Filtros) {
  return { ...filtrosComunes(filtros), page: filtros.page, perPage: filtros.perPage };
}

const etiqueta = <T extends string>(catalogo: Record<T, string>, valor: string | null): string =>
  valor ? (catalogo[valor as T] ?? valor) : "";

/** Lista de la Matriz de evaluacion DD: una fila por vinculo (empresa o persona ligada). */
export function DdMatrizEvaluacionLista() {
  const [data, setData] = useState<DdMatrizEvaluacionResponseDTO | null>(null);
  const [resumen, setResumen] = useState<DdMatrizEvaluacionResumenDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportando, setExportando] = useState<"csv" | "xlsx" | null>(null);
  /** Vinculos marcados para exportar; persiste entre paginas y filtros. */
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const filtrosRef = useRef(filtros);

  /** `conResumen` refresca tambien los stats (son del evento completo: no cambian con los filtros). */
  const cargar = useCallback(async (siguientes?: Filtros, conResumen = false) => {
    const actual = siguientes ?? filtrosRef.current;
    filtrosRef.current = actual;
    try {
      const respuesta = await ddMatrizEvaluacionService.listar(consultaDe(actual));
      setData(respuesta);
      /* Despues de listar: la lista sincroniza las filas automaticas que los stats cuentan. */
      if (conResumen) setResumen(await ddMatrizEvaluacionService.resumen());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la matriz");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void cargar(undefined, true); }, [cargar]);

  const aplicar = (cambios: Partial<Filtros>, conResumen = false) => {
    const siguientes = { ...filtrosRef.current, page: 1, ...cambios };
    setFiltros(siguientes);
    setLoading(true);
    void cargar(siguientes, conResumen);
  };

  const filtrosActivos = [filtros.tipo, filtros.ambito, filtros.pais, filtros.resultadoFinal].filter(
    (v) => v !== DD_MATRIZ_FILTRO_TODOS,
  ).length;

  const alternar = (id: string, marcado: boolean) =>
    setSeleccion((previa) => {
      const siguiente = new Set(previa);
      if (marcado) siguiente.add(id);
      else siguiente.delete(id);
      return siguiente;
    });

  const idsPagina = data?.data.map((f) => f.id) ?? [];
  const marcadosPagina = idsPagina.filter((id) => seleccion.has(id)).length;
  const estadoCabecera: boolean | "indeterminate" =
    idsPagina.length > 0 && marcadosPagina === idsPagina.length ? true : marcadosPagina > 0 ? "indeterminate" : false;

  const alternarPagina = (marcado: boolean) =>
    setSeleccion((previa) => {
      const siguiente = new Set(previa);
      for (const id of idsPagina) {
        if (marcado) siguiente.add(id);
        else siguiente.delete(id);
      }
      return siguiente;
    });

  /** Exporta en el formato de la matriz oficial: los marcados o, si no hay, todo lo filtrado. */
  const exportar = async (formato: "csv" | "xlsx") => {
    setExportando(formato);
    try {
      const respuesta = await ddMatrizEvaluacionService.exportar(
        seleccion.size > 0 ? { ids: [...seleccion] } : filtrosComunes(filtrosRef.current),
      );
      if (respuesta.data.length === 0) {
        toast.error("No hay registros para exportar con los filtros actuales");
        return;
      }
      if (formato === "csv") {
        exportarTablaCsv(respuesta.data, COLUMNAS_MATRIZ_CSV, nombreArchivoExport("dd-matriz-evaluacion", "csv"));
      } else {
        await exportarMatrizExcel(respuesta.data, nombreArchivoExport("dd-matriz-evaluacion", "xlsx"));
      }
      toast.success(`${respuesta.data.length} vínculo(s) exportado(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo exportar la matriz");
    } finally {
      setExportando(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Matriz de evaluación DD</h1>
            {data ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                {data.total} vínculos
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Evaluación de debida diligencia por vínculo: cada empresa y las personas ligadas a ella.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={exportando !== null || loading} onClick={() => { void exportar("xlsx"); }}>
            <FileSpreadsheet className={`h-3.5 w-3.5 ${exportando === "xlsx" ? "animate-pulse" : ""}`} />
            <span>{exportando === "xlsx" ? "Exportando..." : seleccion.size > 0 ? `Excel (${seleccion.size})` : "Excel"}</span>
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={exportando !== null || loading} onClick={() => { void exportar("csv"); }}>
            <FileText className={`h-3.5 w-3.5 ${exportando === "csv" ? "animate-pulse" : ""}`} />
            <span>{exportando === "csv" ? "Exportando..." : seleccion.size > 0 ? `CSV (${seleccion.size})` : "CSV"}</span>
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={loading} onClick={() => aplicar({ page: filtrosRef.current.page }, true)}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Recargar</span>
          </Button>
        </div>
      </div>

      <DdMatrizResumen resumen={resumen} />

      <Card className="overflow-hidden">
        <CardHeader className="space-y-3 border-b border-border pb-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar vínculo, empresa, documento o expediente..."
                value={filtros.search}
                onChange={(e) => setFiltros((previos) => ({ ...previos, search: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") aplicar({ search: e.currentTarget.value }); }}
                className="h-8 border-border bg-secondary pl-8 text-xs placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
            <Button type="button" variant={filtersOpen ? "default" : "outline"} size="sm" className="h-8 shrink-0 gap-1.5 px-2.5 text-xs" onClick={() => setFiltersOpen((v) => !v)}>
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filtros</span>
              {filtrosActivos > 0 ? <span className="rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-bold">{filtrosActivos}</span> : null}
            </Button>
            <Select value={String(filtros.perPage)} onValueChange={(valor) => aplicar({ perPage: Number(valor) })}>
              <SelectTrigger className="h-8 w-[80px] shrink-0 border-border text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PER_PAGE_OPCIONES.map((n) => (
                  <SelectItem key={n} value={String(n)}><span>{n}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtersOpen ? (
            <div className="grid gap-2 rounded-lg border border-border bg-secondary/40 p-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="mx-filtro-tipo">Tipo de vínculo</label>
                <Select value={filtros.tipo} onValueChange={(valor) => aplicar({ tipo: valor })}>
                  <SelectTrigger id="mx-filtro-tipo" className="h-8 border-border text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DD_MATRIZ_FILTRO_TODOS}><span>Todos</span></SelectItem>
                    {Object.entries(DD_MATRIZ_TIPO_VINCULO_LABELS).map(([valor, label]) => (
                      <SelectItem key={valor} value={valor}><span>{label}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="mx-filtro-ambito">Nacional / extranjera</label>
                <Select value={filtros.ambito} onValueChange={(valor) => aplicar({ ambito: valor })}>
                  <SelectTrigger id="mx-filtro-ambito" className="h-8 border-border text-xs"><SelectValue placeholder="Ámbito" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DD_MATRIZ_FILTRO_TODOS}><span>Todos</span></SelectItem>
                    {Object.entries(DD_MATRIZ_AMBITO_LABELS).map(([valor, label]) => (
                      <SelectItem key={valor} value={valor}><span>{label}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="mx-filtro-final">Resultado final</label>
                <Select value={filtros.resultadoFinal} onValueChange={(valor) => aplicar({ resultadoFinal: valor })}>
                  <SelectTrigger id="mx-filtro-final" className="h-8 border-border text-xs"><SelectValue placeholder="Resultado final" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DD_MATRIZ_FILTRO_TODOS}><span>Todos</span></SelectItem>
                    <SelectItem value={DD_MATRIZ_FILTRO_SIN_EVALUAR}><span>Sin evaluar</span></SelectItem>
                    {Object.entries(DD_MATRIZ_RESULTADO_FINAL_LABELS).map(([valor, label]) => (
                      <SelectItem key={valor} value={valor}><span>{label}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="mx-filtro-pais">País</label>
                <Select value={filtros.pais} onValueChange={(valor) => aplicar({ pais: valor })}>
                  <SelectTrigger id="mx-filtro-pais" className="h-8 border-border text-xs"><SelectValue placeholder="País" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DD_MATRIZ_FILTRO_TODOS}><span>Todos</span></SelectItem>
                    <SelectItem value={DD_MATRIZ_FILTRO_SIN_PAIS}><span>Sin país registrado</span></SelectItem>
                    {(data?.paises ?? []).map((p) => (
                      <SelectItem key={p.pais} value={p.pais}>
                        <span className="flex items-center gap-2">
                          <DdPaisBandera pais={p.pais} />
                          <span>{nombrePais(p.pais)} ({p.total})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground" disabled={filtrosActivos === 0 && !filtros.search} onClick={() => aplicar({ ...FILTROS_INICIALES, perPage: filtrosRef.current.perPage })}>
                  <X className="h-3.5 w-3.5" />
                  <span>Limpiar filtros</span>
                </Button>
              </div>
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-3 pt-4">
          {loading ? (
            <TableSkeleton rows={filtros.perPage} columns={10} />
          ) : !data || data.data.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No hay vínculos en este filtro.</p>
              <p className="mt-1 text-xs text-muted-foreground">Cuando un cliente envíe su debida diligencia aparecerá aquí.</p>
            </div>
          ) : (
            <>
              {seleccion.size > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                  <span className="font-medium text-foreground">
                    {seleccion.size} vínculo(s) seleccionado(s): Excel y CSV exportarán solo estos.
                  </span>
                  <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setSeleccion(new Set())}>
                    <X className="h-3.5 w-3.5" /><span>Limpiar selección</span>
                  </Button>
                </div>
              ) : null}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox checked={estadoCabecera} aria-label="Seleccionar los vínculos de esta página" onCheckedChange={(v) => alternarPagina(v === true)} />
                      </TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Vínculo</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide md:table-cell">Empresa</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Ingreso</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">País</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Nac. / Extr.</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">SIG</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide xl:table-cell">Reputacional</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide xl:table-cell">Compliance</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Resultado final</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wide">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((fila) => (
                      <TableRow key={fila.id} data-state={seleccion.has(fila.id) ? "selected" : undefined}>
                        <TableCell className="w-8">
                          <Checkbox checked={seleccion.has(fila.id)} aria-label={`Seleccionar ${fila.nombre}`} onCheckedChange={(v) => alternar(fila.id, v === true)} />
                        </TableCell>
                        <TableCell className="max-w-[260px]">
                          <p className="truncate text-xs font-semibold text-foreground">{fila.nombre}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {[fila.tipoDocumento, fila.documento].filter(Boolean).join(" ") || "Sin documento"}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.INDIGO}`}>
                              <span>{etiqueta<DdMatrizTipoVinculo>(DD_MATRIZ_TIPO_VINCULO_LABELS, fila.tipo)}</span>
                            </Badge>
                            {fila.origen === DD_MATRIZ_ORIGENES.MANUAL ? (
                              <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.NEUTRAL}`}><span>Manual</span></Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden max-w-[220px] md:table-cell">
                          <p className="truncate text-xs text-foreground">{fila.empresaRazonSocial}</p>
                          <p className="text-[10px] text-muted-foreground">{fila.codigo}{fila.eventoProyecto ? ` · ${fila.eventoProyecto}` : ""}</p>
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap text-[11px] text-muted-foreground lg:table-cell">
                          {dateUtils.format(fila.fechaIngreso)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <DdPaisBandera pais={fila.pais} />
                            {fila.pais ? <span className="hidden font-mono text-[11px] text-muted-foreground xl:inline">{fila.pais}</span> : null}
                          </div>
                        </TableCell>
                        <TableCell><DdMatrizAmbitoBadge valor={fila.ambito} /></TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="space-y-1">
                            <DdMatrizResultadoBadge valor={fila.sigResultado} />
                            <DdMatrizConclusionBadge valor={fila.sigConclusion} />
                          </div>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <div className="space-y-1">
                            <DdMatrizResultadoBadge valor={fila.repResultado} />
                            <DdMatrizConclusionBadge valor={fila.repConclusion} />
                          </div>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <div className="space-y-1">
                            <DdMatrizResultadoBadge valor={fila.cmpResultado} />
                            <DdMatrizConclusionComplianceBadge valor={fila.cmpConclusion} />
                          </div>
                        </TableCell>
                        <TableCell><DdMatrizResultadoFinalBadge valor={fila.resultadoFinal} /></TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-[11px]">
                            <Link href={`${DD_RUTAS.MATRIZ}/${fila.id}`} title="Abrir detalle del vínculo">
                              <Eye className="h-3.5 w-3.5" />
                              <span>Abrir</span>
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-muted-foreground">
                  {data.total} resultados · página {data.page} de {data.totalPages || 1}
                </span>
                <Pagination page={data.page} totalPages={data.totalPages} onPageChange={(p) => aplicar({ page: p })} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
