"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
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
import type { DdMatrizEvaluacionFilaDTO, DdMatrizEvaluacionResponseDTO } from "@/types/dto/debida-diligencia";
import {
  DdMatrizAmbitoBadge,
  DdMatrizConclusionBadge,
  DdMatrizConclusionComplianceBadge,
  DdMatrizResultadoBadge,
  DdMatrizResultadoFinalBadge,
} from "./dd-matriz-badges";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import {
  BADGE_STYLES,
  DD_MATRIZ_AMBITO_LABELS,
  DD_MATRIZ_CONCLUSION_COMPLIANCE_LABELS,
  DD_MATRIZ_CONCLUSION_LABELS,
  DD_MATRIZ_FILTRO_SIN_EVALUAR,
  DD_MATRIZ_FILTRO_TODOS,
  DD_MATRIZ_ORIGENES,
  DD_MATRIZ_PER_PAGE_DEFAULT,
  DD_MATRIZ_RESULTADO_FINAL_LABELS,
  DD_MATRIZ_RESULTADO_LABELS,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_RUTAS,
  PER_PAGE_OPCIONES,
  type DdMatrizAmbito,
  type DdMatrizConclusion,
  type DdMatrizConclusionCompliance,
  type DdMatrizResultado,
  type DdMatrizResultadoFinal,
  type DdMatrizTipoVinculo,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import {
  exportarTablaCsv,
  exportarTablaExcel,
  nombreArchivoExport,
  type ColumnaExportacion,
} from "@/lib/shared/utils/export-tabla";

interface Filtros {
  page: number;
  perPage: number;
  search: string;
  tipo: string;
  ambito: string;
  resultadoFinal: string;
}

const FILTROS_INICIALES: Filtros = {
  page: 1,
  perPage: DD_MATRIZ_PER_PAGE_DEFAULT,
  search: "",
  tipo: DD_MATRIZ_FILTRO_TODOS,
  ambito: DD_MATRIZ_FILTRO_TODOS,
  resultadoFinal: DD_MATRIZ_FILTRO_TODOS,
};

function consultaDe(filtros: Filtros, perPage = filtros.perPage, page = filtros.page) {
  const sinEvaluar = filtros.resultadoFinal === DD_MATRIZ_FILTRO_SIN_EVALUAR;
  return {
    page,
    perPage,
    search: filtros.search.trim() || undefined,
    tipo: filtros.tipo !== DD_MATRIZ_FILTRO_TODOS ? filtros.tipo : undefined,
    ambito: filtros.ambito !== DD_MATRIZ_FILTRO_TODOS ? filtros.ambito : undefined,
    resultadoFinal:
      filtros.resultadoFinal !== DD_MATRIZ_FILTRO_TODOS && !sinEvaluar ? filtros.resultadoFinal : undefined,
    sinEvaluar: sinEvaluar || undefined,
  };
}

const etiqueta = <T extends string>(catalogo: Record<T, string>, valor: string | null): string =>
  valor ? (catalogo[valor as T] ?? valor) : "";

/** Lista de la Matriz de evaluacion DD: una fila por vinculo (empresa o persona ligada). */
export function DdMatrizEvaluacionLista() {
  const [data, setData] = useState<DdMatrizEvaluacionResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportando, setExportando] = useState<"csv" | "xlsx" | null>(null);
  const filtrosRef = useRef(filtros);

  const cargar = useCallback(async (siguientes?: Filtros) => {
    const actual = siguientes ?? filtrosRef.current;
    filtrosRef.current = actual;
    try {
      const respuesta = await ddMatrizEvaluacionService.listar(consultaDe(actual));
      setData(respuesta);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la matriz");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const aplicar = (cambios: Partial<Filtros>) => {
    const siguientes = { ...filtrosRef.current, page: 1, ...cambios };
    setFiltros(siguientes);
    setLoading(true);
    void cargar(siguientes);
  };

  const filtrosActivos = [filtros.tipo, filtros.ambito, filtros.resultadoFinal].filter(
    (v) => v !== DD_MATRIZ_FILTRO_TODOS,
  ).length;

  /** Exporta todas las paginas que cumplen los filtros aplicados. */
  const exportar = async (formato: "csv" | "xlsx") => {
    setExportando(formato);
    try {
      const actuales = filtrosRef.current;
      const perPage = 100;
      const primera = await ddMatrizEvaluacionService.listar(consultaDe(actuales, perPage, 1));
      const filas: DdMatrizEvaluacionFilaDTO[] = [...primera.data];
      for (let page = 2; page <= primera.totalPages; page += 1) {
        filas.push(...(await ddMatrizEvaluacionService.listar(consultaDe(actuales, perPage, page))).data);
      }
      if (filas.length === 0) {
        toast.error("No hay registros para exportar con los filtros actuales");
        return;
      }
      const columnas: ColumnaExportacion<DdMatrizEvaluacionFilaDTO>[] = [
        { encabezado: "Expediente", valor: (r) => r.codigo },
        { encabezado: "Empresa", valor: (r) => r.empresaRazonSocial },
        { encabezado: "RUC", valor: (r) => r.empresaRuc },
        { encabezado: "Fecha de ingreso", valor: (r) => dateUtils.format(r.fechaIngreso) },
        { encabezado: "Vínculo", valor: (r) => r.nombre },
        { encabezado: "Tipo de vínculo", valor: (r) => etiqueta<DdMatrizTipoVinculo>(DD_MATRIZ_TIPO_VINCULO_LABELS, r.tipo) },
        { encabezado: "Documento", valor: (r) => [r.tipoDocumento, r.documento].filter(Boolean).join(" - ") },
        { encabezado: "Nacional o extranjera", valor: (r) => etiqueta<DdMatrizAmbito>(DD_MATRIZ_AMBITO_LABELS, r.ambito) },
        { encabezado: "Motivo", valor: (r) => r.motivo ?? "" },
        { encabezado: "Evento o proyecto", valor: (r) => r.eventoProyecto ?? "" },
        { encabezado: "Resultado SIG", valor: (r) => etiqueta<DdMatrizResultado>(DD_MATRIZ_RESULTADO_LABELS, r.sigResultado) },
        { encabezado: "Conclusión SIG", valor: (r) => etiqueta<DdMatrizConclusion>(DD_MATRIZ_CONCLUSION_LABELS, r.sigConclusion) },
        { encabezado: "Resultado reputacional", valor: (r) => etiqueta<DdMatrizResultado>(DD_MATRIZ_RESULTADO_LABELS, r.repResultado) },
        { encabezado: "Conclusión reputacional", valor: (r) => etiqueta<DdMatrizConclusion>(DD_MATRIZ_CONCLUSION_LABELS, r.repConclusion) },
        { encabezado: "Resultado Compliance", valor: (r) => etiqueta<DdMatrizResultado>(DD_MATRIZ_RESULTADO_LABELS, r.cmpResultado) },
        { encabezado: "Conclusión Compliance", valor: (r) => etiqueta<DdMatrizConclusionCompliance>(DD_MATRIZ_CONCLUSION_COMPLIANCE_LABELS, r.cmpConclusion) },
        { encabezado: "Resultado final", valor: (r) => etiqueta<DdMatrizResultadoFinal>(DD_MATRIZ_RESULTADO_FINAL_LABELS, r.resultadoFinal) },
      ];
      if (formato === "csv") {
        exportarTablaCsv(filas, columnas, nombreArchivoExport("dd-matriz-evaluacion", "csv"));
      } else {
        await exportarTablaExcel(filas, columnas, nombreArchivoExport("dd-matriz-evaluacion", "xlsx"), "Matriz DD");
      }
      toast.success(`${filas.length} registro(s) exportado(s)`);
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
            <span>{exportando === "xlsx" ? "Exportando..." : "Excel"}</span>
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={exportando !== null || loading} onClick={() => { void exportar("csv"); }}>
            <FileText className={`h-3.5 w-3.5 ${exportando === "csv" ? "animate-pulse" : ""}`} />
            <span>{exportando === "csv" ? "Exportando..." : "CSV"}</span>
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={loading} onClick={() => aplicar({ page: filtrosRef.current.page })}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Recargar</span>
          </Button>
        </div>
      </div>

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
            <div className="grid gap-2 rounded-lg border border-border bg-secondary/40 p-3 sm:grid-cols-2 lg:grid-cols-4">
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
            <TableSkeleton rows={filtros.perPage} columns={8} />
          ) : !data || data.data.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No hay vínculos en este filtro.</p>
              <p className="mt-1 text-xs text-muted-foreground">Cuando un cliente envíe su debida diligencia aparecerá aquí.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] uppercase tracking-wide">Vínculo</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide md:table-cell">Empresa</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Ingreso</TableHead>
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
                      <TableRow key={fila.id}>
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
