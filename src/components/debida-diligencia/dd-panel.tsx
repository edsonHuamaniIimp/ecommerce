"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nrivera-iimp/ui-kit-iimp";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { DdEstadoBadge, DdDocumentoBadge } from "./dd-estado-badge";
import { DdMatrizBoton } from "./dd-matriz-boton";
import { useSesion } from "@/hooks/use-sesion";
import { tienePermiso } from "@/lib/shared/utils/permisos";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import {
  DD_DOCUMENTOS_REQUERIDOS,
  DD_ESTADOS,
  PERMISSIONS,
  DD_FILTRO_TODAS,
  DD_MATRIZ_ESTADO_FILTROS,
  DD_MATRIZ_PER_PAGE_MAX,
  DD_PER_PAGE_DEFAULT,
  PER_PAGE_OPCIONES,
  DD_ESTADO_LABELS,
  DD_OBSERVACION_AREA_LABELS,
  DD_OBSERVACION_ESTADOS,
  DD_RUTAS,
  DD_VIGENCIA_MESES,
  DD_VINCULOS,
  DD_VINCULO_LABELS,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { ddUtils } from "@/lib/shared/utils/debida-diligencia";
import type { DdExpedienteDTO, DdMatrizResponseDTO, DdMatrizRowDTO, DdPanelDTO } from "@/types/dto/debida-diligencia";

const COLORES = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--destructive)",
  border: "var(--border)",
} as const;

function descargarMatriz(matriz: DdMatrizRowDTO[], evento: string) {
  const cabeceras = ["Empresa", "RUC", "Vínculo", "Expediente", "Estado DD", "Última revisión", "Vigencia hasta", "Responsable"];
  const filas = matriz.map((fila) => [
    fila.empresa.razonSocial,
    fila.empresa.ruc,
    fila.tipoRelacionComercial ? DD_VINCULO_LABELS[fila.tipoRelacionComercial] ?? fila.tipoRelacionComercial : "",
    fila.codigo ?? "",
    fila.estado ? DD_ESTADO_LABELS[fila.estado] ?? fila.estado : ddUtils.etiquetaSinIniciar(),
    fila.fechaAprobacion ? dateUtils.format(fila.fechaAprobacion) : "",
    fila.fechaVencimiento ? dateUtils.format(fila.fechaVencimiento) : "",
    fila.revisadoPor ?? "",
  ]);
  const contenido = [cabeceras, ...filas]
    .map((fila) => fila.map((celda) => `"${String(celda).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${contenido}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `matriz-debida-diligencia-${evento.replace(/\s+/g, "-").toLowerCase()}.csv`;
  enlace.click();
  URL.revokeObjectURL(url);
}

function BarraVinculo({ fila, maximo }: { fila: DdPanelDTO["porVinculo"][number]; maximo: number }) {
  const anchoTotal = maximo > 0 ? (fila.total / maximo) * 100 : 0;
  return (
    <div className="grid grid-cols-[120px_1fr_36px] items-center gap-2 sm:grid-cols-[160px_1fr_42px]">
      <span className="truncate text-[11px] text-muted-foreground sm:text-xs">{fila.label}</span>
      <div className="flex h-4 w-full overflow-hidden rounded bg-secondary" aria-hidden="true">
        <span className="h-full bg-success" style={{ width: `${anchoTotal > 0 ? (fila.aprobadas / Math.max(fila.total, 1)) * anchoTotal : 0}%` }} />
        <span className="h-full bg-warning" style={{ width: `${anchoTotal > 0 ? (fila.observadas / Math.max(fila.total, 1)) * anchoTotal : 0}%` }} />
        <span className="h-full bg-muted-foreground/30" style={{ width: `${anchoTotal > 0 ? (fila.pendientes / Math.max(fila.total, 1)) * anchoTotal : 0}%` }} />
      </div>
      <span className="text-right text-[11px] font-semibold text-foreground">{fila.total}</span>
    </div>
  );
}

function DonaVigencia({ vigencia }: { vigencia: DdPanelDTO["vigencia"] }) {
  const radio = 42;
  const circunferencia = 2 * Math.PI * radio;
  const total = Math.max(vigencia.total, 1);
  const segmentos = [
    { valor: vigencia.vigentes, color: COLORES.success },
    { valor: vigencia.porVencer, color: COLORES.warning },
    { valor: vigencia.vencidas, color: COLORES.danger },
  ];
  let acumulado = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <svg width="132" height="132" viewBox="0 0 120 120" role="img" aria-label={`Vigencia: ${vigencia.vigentes} vigentes, ${vigencia.porVencer} por vencer y ${vigencia.vencidas} vencidas`}>
        <circle cx="60" cy="60" r={radio} fill="none" stroke={COLORES.border} strokeWidth="12" />
        {segmentos.map((segmento, indice) => {
          if (segmento.valor <= 0) return null;
          const largo = (segmento.valor / total) * circunferencia;
          const offset = -((acumulado / total) * circunferencia);
          acumulado += segmento.valor;
          return (
            <circle
              key={indice}
              cx="60"
              cy="60"
              r={radio}
              fill="none"
              stroke={segmento.color}
              strokeWidth="12"
              strokeDasharray={`${largo} ${circunferencia - largo}`}
              strokeDashoffset={offset}
              transform="rotate(-90 60 60)"
            />
          );
        })}
        <text x="60" y="56" textAnchor="middle" fill="currentColor" className="text-foreground text-[15px] font-bold">{vigencia.total}</text>
        <text x="60" y="70" textAnchor="middle" fill="currentColor" className="text-muted-foreground text-[8px] uppercase tracking-wide">total</text>
      </svg>
      <div className="space-y-1.5">
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="h-2 w-2 rounded-full bg-success" />Vigentes <strong className="ml-auto text-foreground">{vigencia.vigentes}</strong></p>
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="h-2 w-2 rounded-full bg-warning" />Por vencer <strong className="ml-auto text-foreground">{vigencia.porVencer}</strong></p>
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="h-2 w-2 rounded-full bg-destructive" />Vencidas <strong className="ml-auto text-foreground">{vigencia.vencidas}</strong></p>
      </div>
      <table className="sr-only">
        <caption>Vigencia de debidas diligencias</caption>
        <thead><tr><th>Estado</th><th>Total</th></tr></thead>
        <tbody>
          <tr><td>Vigentes</td><td>{vigencia.vigentes}</td></tr>
          <tr><td>Por vencer</td><td>{vigencia.porVencer}</td></tr>
          <tr><td>Vencidas</td><td>{vigencia.vencidas}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

/** Panel del modulo: KPIs, estado por vinculo, vigencia y matriz de empresas. */
export function DdPanel() {
  const { session } = useSesion();
  const puedeMatriz = tienePermiso(session, PERMISSIONS.DD_MATRIZ);
  const [data, setData] = useState<DdPanelDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [matriz, setMatriz] = useState<DdMatrizResponseDTO | null>(null);
  const [matrizLoading, setMatrizLoading] = useState(true);
  const [matrizSearch, setMatrizSearch] = useState("");
  const [matrizEstado, setMatrizEstado] = useState(DD_FILTRO_TODAS);
  const [matrizVinculo, setMatrizVinculo] = useState(DD_FILTRO_TODAS);
  const [matrizPage, setMatrizPage] = useState(1);
  const [matrizPerPage, setMatrizPerPage] = useState(DD_PER_PAGE_DEFAULT);
  const [ficha, setFicha] = useState<DdExpedienteDTO | null>(null);
  const [fichaOpen, setFichaOpen] = useState(false);
  const [fichaLoading, setFichaLoading] = useState(false);

  const load = async () => {
    try {
      setData(await debidaDiligenciaService.panel());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el panel");
    } finally {
      setLoading(false);
    }
  };

  const cargarMatriz = (overrides?: Partial<{ page: number; perPage: number; search: string; estado: string; vinculo: string }>) => {
    const actual = {
      page: matrizPage,
      perPage: matrizPerPage,
      search: matrizSearch,
      estado: matrizEstado,
      vinculo: matrizVinculo,
      ...overrides,
    };
    setMatrizLoading(true);
    debidaDiligenciaService
      .matriz({
        page: actual.page,
        perPage: actual.perPage,
        search: actual.search.trim() || undefined,
        estado: actual.estado,
        vinculo: actual.vinculo,
      })
      .then(setMatriz)
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo cargar la matriz"))
      .finally(() => setMatrizLoading(false));
  };

  useEffect(() => {
    let activo = true;
    Promise.all([
      debidaDiligenciaService.panel(),
      debidaDiligenciaService.matriz({
        page: 1,
        perPage: DD_PER_PAGE_DEFAULT,
        estado: DD_FILTRO_TODAS,
        vinculo: DD_FILTRO_TODAS,
      }),
    ])
      .then(([panel, matrizInicial]) => {
        if (!activo) return;
        setData(panel);
        setMatriz(matrizInicial);
      })
      .catch((err) => {
        if (activo) toast.error(err instanceof Error ? err.message : "No se pudo cargar el panel");
      })
      .finally(() => {
        if (!activo) return;
        setLoading(false);
        setMatrizLoading(false);
      });
    return () => { activo = false; };
  }, []);

  const verFicha = async (id: string) => {
    if (id.startsWith("empresa-")) return;
    setFichaOpen(true);
    setFicha(null);
    setFichaLoading(true);
    try {
      setFicha(await debidaDiligenciaService.detalle(id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la ficha");
      setFichaOpen(false);
    } finally {
      setFichaLoading(false);
    }
  };

  const maximoVinculo = useMemo(
    () => Math.max(1, ...(data?.porVinculo.map((v) => v.total) ?? [1])),
    [data],
  );

  const exportarMatriz = async () => {
    try {
      const todas = await debidaDiligenciaService.matriz({
        page: 1,
        perPage: DD_MATRIZ_PER_PAGE_MAX,
        search: matrizSearch.trim() || undefined,
        estado: matrizEstado,
        vinculo: matrizVinculo,
      });
      descargarMatriz(todas.data, dateUtils.todayInputValue());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo exportar la matriz");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-12 w-72 rounded-xl" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <ShieldCheck className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No se pudo cargar el panel de Debida Diligencia.</p>
          <Button type="button" size="sm" variant="outline" onClick={() => { setLoading(true); void load(); cargarMatriz(); }} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reintentar</span>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Panel de Debida Diligencia</h1>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              Módulo DD
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Vigencia de {DD_VIGENCIA_MESES} meses · {data.kpis.empresasRegistradas} empresas · {data.kpis.aprobadasVigentes} aprobadas y vigentes
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5 text-xs"
          onClick={() => void exportarMatriz()}
        >
          <Download className="h-3.5 w-3.5" />
          <span>Exportar matriz</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Aprobadas y vigentes" value={data.kpis.aprobadasVigentes} icon={<CheckCircle2 className="h-4 w-4" />} chip={{ texto: "Dentro de vigencia", variante: "primary" }} />
        <StatsCard title="Por vencer en 30 días" value={data.kpis.porVencer} icon={<AlertTriangle className="h-4 w-4" />} chip={{ texto: "Requieren renovación", variante: "gold" }} />
        <StatsCard title="En revisión" value={data.kpis.enRevision} icon={<Users className="h-4 w-4" />} chip={{ texto: "Logística / Comunicaciones", variante: "primary" }} />
        <StatsCard title="Rechazadas" value={data.kpis.rechazadas} icon={<XCircle className="h-4 w-4" />} chip={{ texto: "Informe legal", variante: "muted" }} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle><span className="text-sm font-bold text-primary">Estado por vínculo</span></CardTitle>
            <p className="text-[11px] text-muted-foreground">Aprobadas, observadas y pendientes por tipo de relación comercial.</p>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {data.porVinculo.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Aún no hay expedientes registrados.</p>
            ) : (
              data.porVinculo.map((fila) => <BarraVinculo key={fila.vinculo} fila={fila} maximo={maximoVinculo} />)
            )}
            <div className="flex flex-wrap gap-3 border-t border-border pt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" />Aprobadas</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" />Observadas</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/30" />Pendientes</span>
            </div>
            <table className="sr-only">
              <caption>Estado de debidas diligencias por vínculo</caption>
              <thead>
                <tr><th>Vínculo</th><th>Total</th><th>Aprobadas</th><th>Observadas</th><th>Pendientes</th></tr>
              </thead>
              <tbody>
                {data.porVinculo.map((fila) => (
                  <tr key={fila.vinculo}>
                    <td>{fila.label}</td>
                    <td>{fila.total}</td>
                    <td>{fila.aprobadas}</td>
                    <td>{fila.observadas}</td>
                    <td>{fila.pendientes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle><span className="text-sm font-bold text-primary">Vigencia</span></CardTitle>
            <p className="text-[11px] text-muted-foreground">Estado de las debidas diligencias aprobadas.</p>
          </CardHeader>
          <CardContent className="pt-4">
            <DonaVigencia vigencia={data.vigencia} />
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border pb-3">
          <CardTitle><span className="text-sm font-bold text-primary">Matriz de empresas</span></CardTitle>
          <p className="text-[11px] text-muted-foreground">Todas las empresas activas y el estado de su debida diligencia en el evento.</p>
        </CardHeader>
        <CardContent className="space-y-3 p-0">
          <div className="flex flex-col gap-2 border-b border-border p-4 lg:flex-row lg:items-center">
            <div className="relative w-full lg:flex-1">
              <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar razón social, RUC o expediente..."
                value={matrizSearch}
                onChange={(e) => setMatrizSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setMatrizPage(1);
                    cargarMatriz({ search: e.currentTarget.value, page: 1 });
                  }
                }}
                className="h-8 border-border bg-secondary pl-8 text-xs placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
            <Select value={matrizEstado} onValueChange={(valor) => { setMatrizEstado(valor); setMatrizPage(1); cargarMatriz({ estado: valor, page: 1 }); }}>
              <SelectTrigger className="h-8 w-full border-border text-xs lg:w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DD_MATRIZ_ESTADO_FILTROS.map((filtro) => (
                  <SelectItem key={filtro.value} value={filtro.value}><span>{filtro.label}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={matrizVinculo} onValueChange={(valor) => { setMatrizVinculo(valor); setMatrizPage(1); cargarMatriz({ vinculo: valor, page: 1 }); }}>
              <SelectTrigger className="h-8 w-full border-border text-xs lg:w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DD_FILTRO_TODAS}><span>Todos los vínculos</span></SelectItem>
                {Object.values(DD_VINCULOS).map((vinculo) => (
                  <SelectItem key={vinculo} value={vinculo}><span>{DD_VINCULO_LABELS[vinculo]}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(matrizPerPage)} onValueChange={(valor) => { const n = Number(valor); setMatrizPerPage(n); setMatrizPage(1); cargarMatriz({ perPage: n, page: 1 }); }}>
              <SelectTrigger className="h-8 w-[80px] shrink-0 border-border text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PER_PAGE_OPCIONES.map((n) => (
                  <SelectItem key={n} value={String(n)}><span>{n}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" className="h-8 w-8 shrink-0 p-0" onClick={() => cargarMatriz()} disabled={matrizLoading} title="Recargar matriz">
              <RefreshCw className={`h-3.5 w-3.5 ${matrizLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {matrizLoading ? (
            <div className="p-4"><TableSkeleton rows={matrizPerPage} columns={7} /></div>
          ) : !matriz || matriz.data.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No hay empresas con los filtros seleccionados.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] uppercase tracking-wide">Empresa</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide md:table-cell">Vínculo</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Estado DD</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Última revisión</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Vigencia hasta</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide xl:table-cell">Responsable</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wide">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matriz.data.map((fila) => (
                      <TableRow key={fila.id}>
                        <TableCell className="max-w-[260px]">
                          <p className="truncate text-xs font-semibold text-foreground">{fila.empresa.razonSocial}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">RUC {fila.empresa.ruc}</p>
                          {fila.codigo ? <p className="text-[10px] text-muted-foreground">{fila.codigo}</p> : null}
                        </TableCell>
                        <TableCell className="hidden text-xs md:table-cell">
                          {fila.tipoRelacionComercial ? DD_VINCULO_LABELS[fila.tipoRelacionComercial] ?? fila.tipoRelacionComercial : "—"}
                        </TableCell>
                        <TableCell><DdEstadoBadge estado={fila.estado} /></TableCell>
                        <TableCell className="hidden text-xs lg:table-cell">{dateUtils.format(fila.fechaAprobacion)}</TableCell>
                        <TableCell className="hidden text-xs lg:table-cell">{dateUtils.format(fila.fechaVencimiento)}</TableCell>
                        <TableCell className="hidden max-w-[150px] truncate text-[11px] text-muted-foreground xl:table-cell">
                          {fila.revisadoPor ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-[11px]"
                              disabled={!fila.codigo}
                              onClick={() => void verFicha(fila.id)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Ver ficha</span>
                            </Button>
                            {puedeMatriz ? <DdMatrizBoton expedienteId={fila.id} disabled={!fila.codigo || fila.estado === DD_ESTADOS.BORRADOR} /> : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-muted-foreground">
                  {matriz.total} resultados — página {matriz.page} de {matriz.totalPages || 1}
                </span>
                <Pagination
                  page={matriz.page}
                  totalPages={matriz.totalPages}
                  onPageChange={(p) => { setMatrizPage(p); cargarMatriz({ page: p }); }}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        La debida diligencia se aplica a todas las empresas. Las empresas pendientes pueden reservar, pero no
        avanzar en aprobaciones.
      </p>

      <Dialog open={fichaOpen} onOpenChange={setFichaOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base font-semibold">Ficha de debida diligencia</DialogTitle>
          </DialogHeader>
          {fichaLoading ? (
            <div className="space-y-2 py-2">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : !ficha ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sin información disponible.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 p-3">
                <div>
                  <p className="text-xs font-semibold text-foreground">{ficha.empresa.razonSocial}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">RUC {ficha.empresa.ruc} · {ficha.codigo}</p>
                </div>
                <DdEstadoBadge estado={ficha.estado} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Representante legal</p>
                  <p className="text-xs text-foreground">{ficha.representanteNombre ?? "—"}</p>
                  <p className="text-[11px] text-muted-foreground">{ficha.representanteTipoDocumento ?? ""} {ficha.representanteDocumento ?? ""}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Correo de contacto</p>
                  <p className="break-all text-xs text-foreground">{ficha.emailRepresentante ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Sitio web</p>
                  <p className="break-all text-xs text-foreground">{ficha.sitioWeb ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Vigencia</p>
                  <p className="text-xs text-foreground">{dateUtils.format(ficha.fechaVencimiento)}</p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Documentos</p>
                <div className="space-y-1.5">
                  {DD_DOCUMENTOS_REQUERIDOS.map((requisito) => {
                    const documento = ficha.documentos.find((d) => d.tipo === requisito.tipo);
                    return (
                      <div key={requisito.tipo} className="flex items-center justify-between gap-2 rounded border border-border px-3 py-2">
                        <span className="min-w-0 truncate text-[11px] text-foreground">{requisito.titulo}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          {documento ? <DdDocumentoBadge estado={documento.estado} /> : null}
                          {documento ? (
                            <a href={documento.url} target="_blank" rel="noreferrer" className="text-[11px] font-medium text-primary underline underline-offset-2">
                              Ver
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {ficha.observaciones.filter((o) => o.estado === DD_OBSERVACION_ESTADOS.ABIERTA).length > 0 ? (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Observaciones abiertas</p>
                  <div className="space-y-1.5">
                    {ficha.observaciones.filter((o) => o.estado === DD_OBSERVACION_ESTADOS.ABIERTA).map((observacion) => (
                      <div key={observacion.id} className="rounded border border-warning/40 bg-warning/5 px-3 py-2">
                        <p className="text-[10px] font-semibold text-warning">{DD_OBSERVACION_AREA_LABELS[observacion.area] ?? observacion.area}</p>
                        <p className="text-[11px] text-foreground">{observacion.texto}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {ficha.estado === DD_ESTADOS.RECHAZADA && ficha.motivoRechazo ? (
                <div className="rounded border border-destructive/40 bg-destructive/5 px-3 py-2">
                  <p className="text-[10px] font-semibold text-destructive">Motivo del rechazo</p>
                  <p className="text-[11px] text-foreground">{ficha.motivoRechazo}</p>
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
                  <a href={DD_RUTAS.BANDEJA}>
                    <FileText className="h-3.5 w-3.5" />
                    <span>Ir a la bandeja</span>
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
