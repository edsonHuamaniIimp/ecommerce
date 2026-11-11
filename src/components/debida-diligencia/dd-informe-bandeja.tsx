"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Eye, FileCheck2, FileSearch, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { DdMatrizResultadoFinalBadge } from "./dd-matriz-badges";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import {
  DD_MATRIZ_FILTRO_TODOS,
  DD_MATRIZ_PER_PAGE_DEFAULT,
  DD_MATRIZ_RESULTADO_FINAL_LABELS,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_RUTAS,
  PER_PAGE_OPCIONES,
} from "@/lib/shared/constants";
import { agruparInformes } from "@/lib/shared/utils/dd-informe";
import { dateUtils } from "@/lib/shared/utils/date";
import type { DdMatrizEvaluacionResponseDTO } from "@/types/dto/debida-diligencia";

interface Filtros {
  page: number;
  perPage: number;
  search: string;
  resultadoFinal: string;
}

const FILTROS_INICIALES: Filtros = {
  page: 1,
  perPage: DD_MATRIZ_PER_PAGE_DEFAULT,
  search: "",
  resultadoFinal: DD_MATRIZ_FILTRO_TODOS,
};

/** Bandeja de expedientes con informe de DD disponible para vista previa. */
export function DdInformeBandeja() {
  const [data, setData] = useState<DdMatrizEvaluacionResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let activo = true;
    ddMatrizEvaluacionService
      .listar({
        page: filtros.page,
        perPage: filtros.perPage,
        search: filtros.search.trim() || undefined,
        resultadoFinal:
          filtros.resultadoFinal !== DD_MATRIZ_FILTRO_TODOS ? filtros.resultadoFinal : undefined,
        porEmpresa: true,
      })
      .then((respuesta) => {
        if (activo) setData(respuesta);
      })
      .catch((error) => {
        if (activo) {
          toast.error(error instanceof Error ? error.message : "No se pudieron cargar los informes");
        }
      })
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, [filtros.page, filtros.perPage, filtros.search, filtros.resultadoFinal, refreshKey]);

  const grupos = useMemo(() => agruparInformes(data?.data ?? []), [data]);
  const conFinal = grupos.filter((grupo) => grupo.resultadoFinal).length;
  const pendientes = grupos.reduce((total, grupo) => total + grupo.pendientes, 0);
  const conObservaciones = grupos.reduce((total, grupo) => total + grupo.conObservaciones, 0);

  const aplicar = (cambios: Partial<Filtros>) => {
    setLoading(true);
    setFiltros((actual) => ({ ...actual, page: 1, ...cambios }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Informes de Debida Diligencia</h1>
            <Badge className="pointer-events-none border-primary/20 bg-primary/10 text-[10px] text-primary">
              <FileCheck2 className="mr-1 h-3 w-3" />
              <span>SIG / Logística</span>
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Informes consolidados desde la matriz y las evidencias del expediente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1 text-[11px]">
            <span className="text-muted-foreground">Expedientes: <strong className="text-foreground">{data?.total ?? 0}</strong></span>
            <span className="h-3 w-px bg-border" />
            <span className="text-muted-foreground">Con final: <strong className="text-foreground">{conFinal}</strong></span>
            <span className="h-3 w-px bg-border" />
            <span className="text-muted-foreground">Pendientes: <strong className="text-foreground">{pendientes}</strong></span>
            <span className="h-3 w-px bg-border" />
            <span className="text-muted-foreground">Con observaciones: <strong className="text-warning">{conObservaciones}</strong></span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => {
              setLoading(true);
              setRefreshKey((valor) => valor + 1);
            }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="space-y-3 border-b border-border pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa, RUC o expediente..."
                value={filtros.search}
                onChange={(event) => {
                  const search = event.target.value;
                  setLoading(true);
                  setFiltros((actual) => ({ ...actual, search, page: 1 }));
                }}
                className="h-8 border-border bg-secondary pl-8 text-xs placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
            <Select
              value={filtros.resultadoFinal}
              onValueChange={(valor) => aplicar({ resultadoFinal: valor })}
            >
              <SelectTrigger className="h-8 w-full border-border text-xs sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DD_MATRIZ_FILTRO_TODOS}>Todos los resultados</SelectItem>
                {Object.values(DD_MATRIZ_RESULTADOS_FINALES).map((valor) => (
                  <SelectItem key={valor} value={valor}>
                    {DD_MATRIZ_RESULTADO_FINAL_LABELS[valor]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(filtros.perPage)}
              onValueChange={(valor) => aplicar({ perPage: Number(valor) })}
            >
              <SelectTrigger className="h-8 w-[92px] shrink-0 border-border text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PER_PAGE_OPCIONES.map((opcion) => (
                  <SelectItem key={opcion} value={String(opcion)}>
                    {opcion} filas
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {loading ? (
            <TableSkeleton rows={filtros.perPage} columns={6} />
          ) : grupos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <FileSearch className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Sin informes para este filtro</p>
              <p className="text-xs text-muted-foreground">
                Los expedientes aparecen aquí cuando la matriz sincroniza sus vínculos.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader className="bg-secondary/40">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase tracking-wide">Empresa / RUC</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Expediente</TableHead>
                      <TableHead className="hidden text-center text-[10px] uppercase tracking-wide md:table-cell">Vínculos</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Resultado final</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Actualizado</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wide">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grupos.map((grupo) => (
                      <TableRow key={grupo.expedienteId} className="hover:bg-secondary/40">
                        <TableCell className="max-w-[240px]">
                          <p className="truncate text-xs font-semibold text-foreground">{grupo.empresaRazonSocial}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">RUC {grupo.empresaRuc}</p>
                        </TableCell>
                        <TableCell>
                          <p className="font-mono text-[11px] font-semibold text-primary">{grupo.codigo}</p>
                        </TableCell>
                        <TableCell className="hidden text-center text-xs text-foreground md:table-cell">
                          <span className="font-semibold">{grupo.totalVinculos}</span>
                          {grupo.pendientes > 0 ? (
                            <span className="ml-1 text-[10px] text-warning">({grupo.pendientes} pend.)</span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <DdMatrizResultadoFinalBadge valor={grupo.resultadoFinal} />
                          {grupo.conObservaciones > 0 ? (
                            <p className="mt-1 text-[10px] text-warning">{grupo.conObservaciones} con observación</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden text-[11px] text-muted-foreground lg:table-cell">
                          {dateUtils.formatDateTime(grupo.actualizadoEn)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-[11px]">
                            <Link href={`${DD_RUTAS.INFORMES}/${grupo.expedienteId}`}>
                              <Eye className="h-3.5 w-3.5" />
                              <span>Vista previa</span>
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
                  {data?.total ?? 0} expediente(s) · página {data?.page ?? 1} de {data?.totalPages || 1}
                </span>
                <Pagination
                  page={data?.page ?? 1}
                  totalPages={data?.totalPages ?? 0}
                  onPageChange={(page) => aplicar({ page })}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
