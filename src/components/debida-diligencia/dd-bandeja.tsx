"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { AlertTriangle, CheckCircle2, Clock, Eye, RefreshCw, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { StatsCard } from "@/components/dashboard/stats-card";
import type { DdBandejaResponseDTO, DdBandejaRowDTO, DdEmpresaEstadoDTO } from "@/types/dto/debida-diligencia";
import { DdEstadoBadge, DdVigenciaBadge } from "./dd-estado-badge";
import { DdRevisionModal } from "./dd-revision-modal";
import { DdImportModal } from "./dd-import-modal";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import {
  BADGE_STYLES,
  DD_BANDEJA_FILTROS,
  DD_ESTADOS,
  DD_PER_PAGE_DEFAULT,
  DD_REPUTACION_ESTADOS,
  DD_REPUTACION_ESTADO_LABELS,
  DD_RESULTADOS,
  DD_RESULTADO_LABELS,
  DD_ESTADO_EVALUACION_LABELS,
  DD_VINCULO_LABELS,
  PER_PAGE_OPCIONES,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";

const RESUMEN_VACIO = {
  total: 0,
  pendientes: 0,
  enRevision: 0,
  observadas: 0,
  aprobadas: 0,
  rechazadas: 0,
};

/** Bandeja de revision de Logistica del modulo Debida Diligencia. */
export function DdBandeja() {
  const [data, setData] = useState<DdBandejaResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<string>(DD_ESTADOS.EN_REVISION);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DD_PER_PAGE_DEFAULT);
  const [revisando, setRevisando] = useState<DdBandejaRowDTO | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [externas, setExternas] = useState<DdEmpresaEstadoDTO[]>([]);
  const [filtroExterno, setFiltroExterno] = useState<string>("todos");
  const [extPage, setExtPage] = useState(1);
  const [extPerPage, setExtPerPage] = useState(10);

  const refs = useRef({ page, perPage, search, estado });
  useEffect(() => { refs.current = { page, perPage, search, estado }; }, [page, perPage, search, estado]);

  const load = useCallback(async (overrides?: Partial<{ page: number; perPage: number; search: string; estado: string }>) => {
    const actual = { ...refs.current, ...overrides };
    try {
      const respuesta = await debidaDiligenciaService.bandeja({
        page: actual.page,
        perPage: actual.perPage,
        search: actual.search.trim() || undefined,
        estado: actual.estado,
      });
      setData(respuesta);
      try {
        const externasRespuesta = await debidaDiligenciaService.empresasTodas({
          search: actual.search.trim() || undefined,
        });
        setExternas(externasRespuesta);
      } catch {
        setExternas([]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la bandeja");
    } finally {
      setLoading(false);
    }
  }, []);

  const recargar = (overrides?: Partial<{ page: number; perPage: number; search: string; estado: string }>) => {
    setLoading(true);
    void load(overrides);
  };

  useEffect(() => { void load(); }, [load]);

  const cambiarFiltro = (valor: string) => {
    setEstado(valor);
    setPage(1);
    recargar({ estado: valor, page: 1 });
  };

  const resumen = data?.resumen ?? RESUMEN_VACIO;
  const normalizarDocumento = (valor: string | null | undefined) =>
    (valor ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const externasPorRuc = new Map(externas.map((empresa) => [normalizarDocumento(empresa.documento), empresa]));
  const externasFiltradas = externas.filter((empresa) => {
    if (filtroExterno !== "todos" && empresa.resultado !== filtroExterno) return false;
    return true;
  });
  const extTotalPages = Math.max(1, Math.ceil(externasFiltradas.length / extPerPage));
  const extPageSafe = Math.min(extPage, extTotalPages);
  const extRows = externasFiltradas.slice((extPageSafe - 1) * extPerPage, extPageSafe * extPerPage);


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Debida Diligencia</h1>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
              {resumen.enRevision} en revisión
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Revisa documentos, resuelve observaciones y deriva nombres a Comunicaciones.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Importación masiva</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={loading}
            onClick={() => recargar()}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Recargar</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Pendientes" value={resumen.pendientes} icon={<Clock className="h-4 w-4" />} chip={{ texto: "Borradores y sin iniciar", variante: "muted" }} />
        <StatsCard title="En revisión" value={resumen.enRevision} icon={<Eye className="h-4 w-4" />} chip={{ texto: "Requieren decisión", variante: "primary" }} />
        <StatsCard title="Observadas" value={resumen.observadas} icon={<AlertTriangle className="h-4 w-4" />} chip={{ texto: "Esperando corrección", variante: "gold" }} />
        <StatsCard title="Aprobadas" value={resumen.aprobadas} icon={<CheckCircle2 className="h-4 w-4" />} chip={{ texto: "Vigencia de 6 meses", variante: "primary" }} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="space-y-3 border-b border-border pb-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative w-full lg:flex-1">
              <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar razón social, RUC o expediente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setPage(1);
                    recargar({ search: e.currentTarget.value, page: 1 });
                  }
                }}
                className="h-8 border-border bg-secondary pl-8 text-xs placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
            <Select value={String(perPage)} onValueChange={(valor) => { const n = Number(valor); setPerPage(n); setPage(1); recargar({ perPage: n, page: 1 }); }}>
              <SelectTrigger className="h-8 w-[80px] shrink-0 border-border text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PER_PAGE_OPCIONES.map((n) => (
                  <SelectItem key={n} value={String(n)}><span>{n}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
            {DD_BANDEJA_FILTROS.map((filtro) => {
              const activo = estado === filtro.value;
              return (
                <Button
                  key={filtro.value}
                  type="button"
                  size="sm"
                  variant={activo ? "default" : "outline"}
                  className="h-7 rounded-full px-3 text-[11px]"
                  onClick={() => cambiarFiltro(filtro.value)}
                >
                  <span>{filtro.label}</span>
                </Button>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-4">
          {loading ? (
            <TableSkeleton rows={perPage} columns={7} />
          ) : !data || data.data.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No hay expedientes en este filtro.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {estado === DD_ESTADOS.EN_REVISION
                  ? "Cuando un cliente envíe su debida diligencia aparecerá aquí."
                  : "Prueba con otro estado o limpia la búsqueda."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] uppercase tracking-wide">Empresa</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide md:table-cell">Vínculo</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Documentos</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Estado</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Reputación</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Vigencia</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide xl:table-cell">Asignado</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wide">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((fila) => (
                      <TableRow key={fila.id}>
                        <TableCell className="max-w-[260px]">
                          <p className="truncate text-xs font-semibold text-foreground">{fila.empresa.razonSocial}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">RUC {fila.empresa.ruc}</p>
                          <p className="text-[10px] text-muted-foreground">{fila.codigo}</p>
                        </TableCell>
                        <TableCell className="hidden text-xs md:table-cell">
                          {fila.tipoRelacionComercial ? DD_VINCULO_LABELS[fila.tipoRelacionComercial] ?? fila.tipoRelacionComercial : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${fila.documentoCargados === fila.documentoTotal ? "text-success" : "text-warning"}`}>
                              {fila.documentoCargados}/{fila.documentoTotal}
                            </span>
                            <span className="h-1.5 w-14 overflow-hidden rounded-full bg-secondary">
                              <span
                                className={`block h-full ${fila.documentoCargados === fila.documentoTotal ? "bg-success" : "bg-warning"}`}
                                style={{ width: `${(fila.documentoCargados / fila.documentoTotal) * 100}%` }}
                              />
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DdEstadoBadge estado={fila.estado} />
                          {externasPorRuc.has(normalizarDocumento(fila.empresa.ruc)) && (
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              Registro externo: {externasPorRuc.get(normalizarDocumento(fila.empresa.ruc))?.resultadoLabel}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {fila.reputacionCasos === 0 ? (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          ) : (
                            <Badge
                              className={`pointer-events-none text-[9px] ${
                                fila.reputacionEstado === DD_REPUTACION_ESTADOS.CON_HALLAZGOS
                                  ? BADGE_STYLES.DESTRUCTIVE
                                  : fila.reputacionEstado === DD_REPUTACION_ESTADOS.REQUIERE_INFORMACION
                                    ? BADGE_STYLES.WARNING
                                    : fila.reputacionEstado === DD_REPUTACION_ESTADOS.SIN_HALLAZGOS
                                      ? BADGE_STYLES.SUCCESS
                                      : BADGE_STYLES.NEUTRAL
                              }`}
                            >
                              <span>
                                {fila.reputacionEstado
                                  ? DD_REPUTACION_ESTADO_LABELS[fila.reputacionEstado] ?? fila.reputacionEstado
                                  : "Pendiente"}
                                {fila.reputacionCasos > 1 ? ` (${fila.reputacionCasos})` : ""}
                              </span>
                            </Badge>
                          )}
                          {fila.reputacionCasos > 0 ? (
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {[
                                fila.reputacionSinHallazgos > 0
                                  ? `${fila.reputacionSinHallazgos} sin hallazgos`
                                  : "",
                                fila.reputacionConHallazgos > 0
                                  ? `${fila.reputacionConHallazgos} con hallazgos`
                                  : "",
                                fila.reputacionRequiereInformacion > 0
                                  ? `${fila.reputacionRequiereInformacion} requiere info`
                                  : "",
                                fila.reputacionPendientes > 0
                                  ? `${fila.reputacionPendientes} pendiente`
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="space-y-1">
                            <DdVigenciaBadge estado={fila.estado} fechaVencimiento={fila.fechaVencimiento} />
                            {fila.fechaVencimiento ? (
                              <p className="text-[10px] text-muted-foreground">Vence {dateUtils.format(fila.fechaVencimiento)}</p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden max-w-[160px] truncate text-[11px] text-muted-foreground xl:table-cell">
                          {fila.revisadoPor ?? "Sin asignar"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-[11px]"
                            onClick={() => setRevisando(fila)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Revisar</span>
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
                <Pagination
                  page={data.page}
                  totalPages={data.totalPages}
                  onPageChange={(p) => { setPage(p); recargar({ page: p }); }}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="space-y-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Registro externo de Debida Diligencia</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Empresas importadas manualmente. Es informativo y no crea expedientes internos.
              </p>
            </div>
            <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.NEUTRAL}`}>
              <span>{externasFiltradas.length} empresa(s)</span>
            </Badge>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={filtroExterno} onValueChange={(valor) => { setFiltroExterno(valor); setExtPage(1); }}>
              <SelectTrigger className="h-8 w-full border-border text-xs sm:w-[220px]">
                <SelectValue placeholder="Resultado externo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos"><span>Todos los resultados</span></SelectItem>
                {Object.entries(DD_RESULTADO_LABELS).map(([valor, label]) => (
                  <SelectItem key={valor} value={valor}><span>{label}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(extPerPage)} onValueChange={(valor) => { setExtPerPage(Number(valor)); setExtPage(1); }}>
              <SelectTrigger className="h-8 w-[90px] border-border text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50].map((n) => (
                  <SelectItem key={n} value={String(n)}><span>{n}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {extRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay empresas externas para este filtro.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] uppercase tracking-wide">Empresa</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Resultado</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Evaluación</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Revisión</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Vencimiento</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide xl:table-cell">Origen</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wide">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extRows.map((empresa) => (
                      <TableRow key={empresa.id}>
                        <TableCell className="max-w-[280px]">
                          <p className="truncate text-xs font-semibold text-foreground">{empresa.razonSocial}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {empresa.tipoDocumento} {empresa.documento}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`pointer-events-none text-[10px] ${
                              empresa.resultado === DD_RESULTADOS.APTO
                                ? BADGE_STYLES.SUCCESS
                                : empresa.resultado === DD_RESULTADOS.NO_APTO
                                  ? BADGE_STYLES.DESTRUCTIVE
                                  : BADGE_STYLES.WARNING
                            }`}
                          >
                            <span>{empresa.resultadoLabel || DD_RESULTADO_LABELS[empresa.resultado as keyof typeof DD_RESULTADO_LABELS] || empresa.resultado}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`pointer-events-none text-[10px] ${empresa.vigente ? BADGE_STYLES.SUCCESS : BADGE_STYLES.DESTRUCTIVE}`}>
                            <span>
                              {empresa.estadoEvaluacionLabel
                                ?? DD_ESTADO_EVALUACION_LABELS[empresa.estadoEvaluacion as keyof typeof DD_ESTADO_EVALUACION_LABELS]
                                ?? empresa.estadoEvaluacion
                                ?? "Sin evaluación"}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden text-[11px] text-muted-foreground lg:table-cell">
                          {empresa.fechaRevision ? dateUtils.format(empresa.fechaRevision) : "—"}
                        </TableCell>
                        <TableCell className="hidden text-[11px] text-muted-foreground lg:table-cell">
                          {empresa.fechaVencimiento ? dateUtils.format(empresa.fechaVencimiento) : "—"}
                        </TableCell>
                        <TableCell className="hidden text-[11px] text-muted-foreground xl:table-cell">
                          {empresa.origen || "Importación manual"}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-[10px] text-muted-foreground">Solo lectura</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-muted-foreground">
                  {externasFiltradas.length} resultados · página {extPageSafe} de {extTotalPages}
                </span>
                <Pagination page={extPageSafe} totalPages={extTotalPages} onPageChange={setExtPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <DdImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => void recargar()}
      />

      {revisando ? (
        <DdRevisionModal
          fila={revisando}
          onClose={() => setRevisando(null)}
          onDone={() => recargar()}
        />
      ) : null}
    </div>
  );
}
