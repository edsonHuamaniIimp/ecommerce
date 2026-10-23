"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nrivera-iimp/ui-kit-iimp";
import { AlertTriangle, CheckCircle2, Clock, Download, Eye, FileSpreadsheet, FileText, History, RefreshCw, Search, SlidersHorizontal, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { StatsCard } from "@/components/dashboard/stats-card";
import type { DdBandejaResponseDTO, DdBandejaRowDTO } from "@/types/dto/debida-diligencia";
import { DdEstadoBadge, DdVigenciaBadge } from "./dd-estado-badge";
import { DdRevisionModal } from "./dd-revision-modal";
import { DdHistorialDialog } from "./dd-historial-dialog";
import { DdImportModal } from "./dd-import-modal";
import { DdMatrizBoton } from "./dd-matriz-boton";
import { useSesion } from "@/hooks/use-sesion";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import {
  BADGE_STYLES,
  DD_ASIGNACION_FILTRO,
  DD_BANDEJA_FILTROS,
  DD_BANDEJA_ORDEN,
  DD_BANDEJA_ORDEN_LABELS,
  DD_DOCUMENTOS_FILTRO,
  DD_ESTADOS,
  DD_ESTADO_LABELS,
  DD_FILTRO_TODAS,
  DD_IMPORTACION_REVISOR,
  DD_IMPORTACION_REVISOR_LABEL,
  DD_ORIGEN_LABELS,
  DD_ORIGENES,
  DD_PER_PAGE_DEFAULT,
  DD_REPUTACION_ESTADOS,
  DD_REPUTACION_FILTRO_PENDIENTE,
  DD_REPUTACION_ESTADO_LABELS,
  DD_SOLICITUDES_FILTRO,
  DD_VINCULO_LABELS,
  PERMISSIONS,
  PER_PAGE_OPCIONES,
} from "@/lib/shared/constants";
import { tienePermiso } from "@/lib/shared/utils/permisos";
import { dateUtils } from "@/lib/shared/utils/date";
import { etiquetaTipoDocumentoEmpresa } from "@/lib/shared/utils/documento-empresa";
import {
  exportarTablaCsv,
  exportarTablaExcel,
  nombreArchivoExport,
  type ColumnaExportacion,
} from "@/lib/shared/utils/export-tabla";

const RESUMEN_VACIO = {
  total: 0,
  pendientes: 0,
  enRevision: 0,
  observadas: 0,
  aprobadas: 0,
  rechazadas: 0,
};

const ESTADOS_REVISABLES = new Set<string>([
  DD_ESTADOS.EN_REVISION,
  DD_ESTADOS.OBSERVADA,
  DD_ESTADOS.APROBADA,
  DD_ESTADOS.RECHAZADA,
]);

function accionRevision(fila: DdBandejaRowDTO): { puede: boolean; label: string } {
  /* Los importados siguen las mismas reglas por estado que los del portal. */
  if (fila.estado === DD_ESTADOS.EN_LEGAL) return { puede: false, label: "En Legal" };
  if (!ESTADOS_REVISABLES.has(fila.estado)) return { puede: false, label: "No enviado" };
  return { puede: true, label: "Revisar" };
}

/** Bandeja de revision de Logistica del modulo Debida Diligencia. */
export function DdBandeja() {
  const { session } = useSesion();
  const puedeMatriz = tienePermiso(session, PERMISSIONS.DD_MATRIZ);
  const [data, setData] = useState<DdBandejaResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<string>(DD_FILTRO_TODAS);
  const [origen, setOrigen] = useState<string>(DD_FILTRO_TODAS);
  const [vinculo, setVinculo] = useState<string>(DD_FILTRO_TODAS);
  const [documentos, setDocumentos] = useState<string>(DD_FILTRO_TODAS);
  const [reputacion, setReputacion] = useState<string>(DD_FILTRO_TODAS);
  const [asignacion, setAsignacion] = useState<string>(DD_FILTRO_TODAS);
  const [solicitudes, setSolicitudes] = useState<string>(DD_FILTRO_TODAS);
  const [orden, setOrden] = useState<string>(DD_BANDEJA_ORDEN.ACTUALIZADOS);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DD_PER_PAGE_DEFAULT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [revisando, setRevisando] = useState<DdBandejaRowDTO | null>(null);
  const [historialId, setHistorialId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportando, setExportando] = useState<"csv" | "xlsx" | null>(null);

  const refs = useRef({ page, perPage, search, estado, origen, vinculo, documentos, reputacion, asignacion, solicitudes, orden });
  useEffect(() => { refs.current = { page, perPage, search, estado, origen, vinculo, documentos, reputacion, asignacion, solicitudes, orden }; }, [page, perPage, search, estado, origen, vinculo, documentos, reputacion, asignacion, solicitudes, orden]);

  const load = useCallback(async (overrides?: Partial<{ page: number; perPage: number; search: string; estado: string; origen: string; vinculo: string; documentos: string; reputacion: string; asignacion: string; solicitudes: string; orden: string }>) => {
    const actual = { ...refs.current, ...overrides };
    try {
      const respuesta = await debidaDiligenciaService.bandeja({
        page: actual.page,
        perPage: actual.perPage,
        search: actual.search.trim() || undefined,
        estado: actual.estado,
        origen: actual.origen,
        vinculo: actual.vinculo,
        documentos: actual.documentos,
        reputacion: actual.reputacion,
        asignacion: actual.asignacion,
        solicitudes: actual.solicitudes,
        orden: actual.orden,
      });
      setData(respuesta);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la bandeja");
    } finally {
      setLoading(false);
    }
  }, []);

  const recargar = (overrides?: Partial<{ page: number; perPage: number; search: string; estado: string; origen: string; vinculo: string; documentos: string; reputacion: string; asignacion: string; solicitudes: string; orden: string }>) => {
    setLoading(true);
    void load(overrides);
  };

  useEffect(() => { void load(); }, [load]);

  const limpiarFiltros = () => {
    setSearch("");
    setEstado(DD_FILTRO_TODAS);
    setOrigen(DD_FILTRO_TODAS);
    setVinculo(DD_FILTRO_TODAS);
    setDocumentos(DD_FILTRO_TODAS);
    setReputacion(DD_FILTRO_TODAS);
    setAsignacion(DD_FILTRO_TODAS);
    setSolicitudes(DD_FILTRO_TODAS);
    setOrden(DD_BANDEJA_ORDEN.ACTUALIZADOS);
    setPage(1);
    recargar({
      search: "",
      estado: DD_FILTRO_TODAS,
      origen: DD_FILTRO_TODAS,
      vinculo: DD_FILTRO_TODAS,
      documentos: DD_FILTRO_TODAS,
      reputacion: DD_FILTRO_TODAS,
      asignacion: DD_FILTRO_TODAS,
      solicitudes: DD_FILTRO_TODAS,
      orden: DD_BANDEJA_ORDEN.ACTUALIZADOS,
      page: 1,
    });
  };

  const filtrosActivos = [
    estado,
    origen,
    vinculo,
    documentos,
    reputacion,
    asignacion,
    solicitudes,
  ].filter((valor) => valor !== DD_FILTRO_TODAS).length;

  /** Exporta todas las paginas que cumplen los filtros aplicados. */
  const exportar = async (formato: "csv" | "xlsx") => {
    setExportando(formato);
    try {
      const filtros = refs.current;
      const perPage = 100;
      const primera = await debidaDiligenciaService.bandeja({
        page: 1,
        perPage,
        search: filtros.search.trim() || undefined,
        estado: filtros.estado,
        origen: filtros.origen,
        vinculo: filtros.vinculo,
        documentos: filtros.documentos,
        reputacion: filtros.reputacion,
        asignacion: filtros.asignacion,
        solicitudes: filtros.solicitudes,
        orden: filtros.orden,
      });
      const filas: DdBandejaRowDTO[] = [...primera.data];
      for (let page = 2; page <= primera.totalPages; page += 1) {
        const siguiente = await debidaDiligenciaService.bandeja({
          page,
          perPage,
          search: filtros.search.trim() || undefined,
          estado: filtros.estado,
          origen: filtros.origen,
          vinculo: filtros.vinculo,
          documentos: filtros.documentos,
          reputacion: filtros.reputacion,
          asignacion: filtros.asignacion,
          solicitudes: filtros.solicitudes,
          orden: filtros.orden,
        });
        filas.push(...siguiente.data);
      }
      if (filas.length === 0) {
        toast.error("No hay registros para exportar con los filtros actuales");
        return;
      }
      const columnas: ColumnaExportacion<DdBandejaRowDTO>[] = [
        { encabezado: "Empresa", valor: (r) => r.empresa.razonSocial },
        { encabezado: "Tipo documento", valor: (r) => etiquetaTipoDocumentoEmpresa(r.empresa.tipoDocumento, r.empresa.ruc) },
        { encabezado: "Documento", valor: (r) => r.empresa.ruc },
        { encabezado: "Expediente", valor: (r) => r.codigo },
        { encabezado: "Procedencia", valor: (r) => DD_ORIGEN_LABELS[r.origen] ?? r.origen },
        { encabezado: "Vínculo / motivo", valor: (r) => r.motivoImportacion ?? (r.tipoRelacionComercial ? DD_VINCULO_LABELS[r.tipoRelacionComercial] ?? r.tipoRelacionComercial : "") },
        { encabezado: "Estado", valor: (r) => DD_ESTADO_LABELS[r.estado] ?? r.estado },
        { encabezado: "Creado", valor: (r) => (r.fechaCreacion ? dateUtils.format(r.fechaCreacion) : "") },
        { encabezado: "Solicitudes", valor: (r) => r.solicitudesAlquiler },
        { encabezado: "Estado origen", valor: (r) => r.estadoOrigen ?? "" },
        { encabezado: "Proyecto", valor: (r) => r.eventoProyecto ?? "" },
        { encabezado: "Documentos", valor: (r) => `${r.documentoCargados}/${r.documentoTotal}` },
        { encabezado: "Enviado", valor: (r) => (r.fechaEnvio ? dateUtils.format(r.fechaEnvio) : "") },
        { encabezado: "Aprobado", valor: (r) => (r.fechaAprobacion ? dateUtils.format(r.fechaAprobacion) : "") },
        { encabezado: "Vence", valor: (r) => (r.fechaVencimiento ? dateUtils.format(r.fechaVencimiento) : "") },
        { encabezado: "Asignado", valor: (r) => r.revisadoPor === DD_IMPORTACION_REVISOR ? DD_IMPORTACION_REVISOR_LABEL : (r.revisadoPor ?? "") },
      ];
      if (formato === "csv") {
        exportarTablaCsv(filas, columnas, nombreArchivoExport("dd-bandeja", "csv"));
      } else {
        await exportarTablaExcel(filas, columnas, nombreArchivoExport("dd-bandeja", "xlsx"), "DD Bandeja");
      }
      toast.success(`${filas.length} registro(s) exportado(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo exportar la bandeja");
    } finally {
      setExportando(null);
    }
  };

  const resumen = data?.resumen ?? RESUMEN_VACIO;


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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                disabled={exportando !== null || loading}
              >
                <Download className={`h-3.5 w-3.5 ${exportando ? "animate-pulse" : ""}`} />
                <span>{exportando ? "Exportando..." : "Exportar"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel><span>Bandeja filtrada ({data?.total ?? 0})</span></DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={exportando !== null} onSelect={() => { void exportar("xlsx"); }}>
                <FileSpreadsheet className="mr-2 h-3.5 w-3.5" />
                <span>Excel (.xlsx)</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={exportando !== null} onSelect={() => { void exportar("csv"); }}>
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar razón social, documento o expediente..."
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
            <Button
              type="button"
              variant={filtersOpen ? "default" : "outline"}
              size="sm"
              className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
              onClick={() => setFiltersOpen((valor) => !valor)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filtros</span>
              {filtrosActivos > 0 ? (
                <span className="rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-bold">{filtrosActivos}</span>
              ) : null}
            </Button>
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

          {filtersOpen ? (
            <div className="grid gap-2 rounded-lg border border-border bg-secondary/40 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="dd-filtro-estado">Estado</label>
                <Select value={estado} onValueChange={(valor) => { setEstado(valor); setPage(1); recargar({ estado: valor, page: 1 }); }}>
                  <SelectTrigger id="dd-filtro-estado" className="h-8 border-border text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    {DD_BANDEJA_FILTROS.map((filtro) => (
                      <SelectItem key={filtro.value} value={filtro.value}><span>{filtro.label}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="dd-filtro-origen">Procedencia</label>
                <Select value={origen} onValueChange={(valor) => { setOrigen(valor); setPage(1); recargar({ origen: valor, page: 1 }); }}>
                  <SelectTrigger id="dd-filtro-origen" className="h-8 border-border text-xs"><SelectValue placeholder="Procedencia" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DD_FILTRO_TODAS}><span>Todos</span></SelectItem>
                    <SelectItem value={DD_ORIGENES.FLUJO_REGULAR}><span>{DD_ORIGEN_LABELS[DD_ORIGENES.FLUJO_REGULAR]}</span></SelectItem>
                    <SelectItem value={DD_ORIGENES.IMPORTADO}><span>{DD_ORIGEN_LABELS[DD_ORIGENES.IMPORTADO]}</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="dd-filtro-vinculo">Vínculo</label>
                <Select value={vinculo} onValueChange={(valor) => { setVinculo(valor); setPage(1); recargar({ vinculo: valor, page: 1 }); }}>
                  <SelectTrigger id="dd-filtro-vinculo" className="h-8 border-border text-xs"><SelectValue placeholder="Vínculo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DD_FILTRO_TODAS}><span>Todos</span></SelectItem>
                    {Object.entries(DD_VINCULO_LABELS).map(([valor, label]) => (
                      <SelectItem key={valor} value={valor}><span>{label}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="dd-filtro-documentos">Documentos</label>
                <Select value={documentos} onValueChange={(valor) => { setDocumentos(valor); setPage(1); recargar({ documentos: valor, page: 1 }); }}>
                  <SelectTrigger id="dd-filtro-documentos" className="h-8 border-border text-xs"><SelectValue placeholder="Documentos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DD_FILTRO_TODAS}><span>Todos</span></SelectItem>
                    <SelectItem value={DD_DOCUMENTOS_FILTRO.CON}><span>Con documentos</span></SelectItem>
                    <SelectItem value={DD_DOCUMENTOS_FILTRO.SIN}><span>Sin documentos</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="dd-filtro-solicitudes">Solicitudes</label>
                <Select value={solicitudes} onValueChange={(valor) => { setSolicitudes(valor); setPage(1); recargar({ solicitudes: valor, page: 1 }); }}>
                  <SelectTrigger id="dd-filtro-solicitudes" className="h-8 border-border text-xs"><SelectValue placeholder="Solicitudes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DD_FILTRO_TODAS}><span>Todas</span></SelectItem>
                    <SelectItem value={DD_SOLICITUDES_FILTRO.CON}><span>Con solicitudes</span></SelectItem>
                    <SelectItem value={DD_SOLICITUDES_FILTRO.SIN}><span>Sin solicitudes</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="dd-filtro-reputacion">Reputación</label>
                <Select value={reputacion} onValueChange={(valor) => { setReputacion(valor); setPage(1); recargar({ reputacion: valor, page: 1 }); }}>
                  <SelectTrigger id="dd-filtro-reputacion" className="h-8 border-border text-xs"><SelectValue placeholder="Reputación" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DD_FILTRO_TODAS}><span>Todas</span></SelectItem>
                    <SelectItem value={DD_REPUTACION_FILTRO_PENDIENTE}><span>Pendiente</span></SelectItem>
                    {[DD_REPUTACION_ESTADOS.SIN_HALLAZGOS, DD_REPUTACION_ESTADOS.CON_HALLAZGOS, DD_REPUTACION_ESTADOS.REQUIERE_INFORMACION].map((valor) => (
                      <SelectItem key={valor} value={valor}><span>{DD_REPUTACION_ESTADO_LABELS[valor]}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="dd-filtro-asignacion">Asignación</label>
                <Select value={asignacion} onValueChange={(valor) => { setAsignacion(valor); setPage(1); recargar({ asignacion: valor, page: 1 }); }}>
                  <SelectTrigger id="dd-filtro-asignacion" className="h-8 border-border text-xs"><SelectValue placeholder="Asignación" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DD_FILTRO_TODAS}><span>Todas</span></SelectItem>
                    <SelectItem value={DD_ASIGNACION_FILTRO.IMPORTACION}><span>{DD_IMPORTACION_REVISOR_LABEL}</span></SelectItem>
                    <SelectItem value={DD_ASIGNACION_FILTRO.SIN_ASIGNAR}><span>Sin asignar</span></SelectItem>
                    <SelectItem value={DD_ASIGNACION_FILTRO.REVISOR}><span>Con revisor</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="dd-filtro-orden">Orden</label>
                <Select value={orden} onValueChange={(valor) => { setOrden(valor); setPage(1); recargar({ orden: valor, page: 1 }); }}>
                  <SelectTrigger id="dd-filtro-orden" className="h-8 border-border text-xs"><SelectValue placeholder="Orden" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DD_BANDEJA_ORDEN_LABELS).map(([valor, label]) => (
                      <SelectItem key={valor} value={valor}><span>{label}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground" onClick={limpiarFiltros} disabled={filtrosActivos === 0}>
                  <X className="h-3.5 w-3.5" />
                  <span>Limpiar filtros</span>
                </Button>
              </div>
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-3 pt-4">
          {loading ? (
            <TableSkeleton rows={perPage} columns={11} />
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
                      <TableHead className="hidden text-[10px] uppercase tracking-wide md:table-cell">Creado</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide md:table-cell">Vínculo</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Documentos</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Estado</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Solicitudes</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Reputación</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Vigencia</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide xl:table-cell">Asignado</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wide">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((fila) => {
                      const accion = accionRevision(fila);
                      return (
                      <TableRow key={fila.id}>
                        <TableCell className="max-w-[260px]">
                          <p className="truncate text-xs font-semibold text-foreground">{fila.empresa.razonSocial}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{etiquetaTipoDocumentoEmpresa(fila.empresa.tipoDocumento, fila.empresa.ruc)} {fila.empresa.ruc}</p>
                          <p className="text-[10px] text-muted-foreground">{fila.codigo}</p>
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap text-[11px] text-muted-foreground md:table-cell">
                          {fila.fechaCreacion ? dateUtils.format(fila.fechaCreacion) : "—"}
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
                        </TableCell>
                        <TableCell>
                          <Link
                            href="/dashboard/solicitudes"
                            className="inline-flex"
                            title={fila.solicitudesAlquiler > 0 ? "Ver solicitudes de alquiler" : "Sin solicitudes de alquiler"}
                          >
                            <Badge className={`text-[9px] ${fila.solicitudesAlquiler > 0 ? BADGE_STYLES.INFO : BADGE_STYLES.NEUTRAL}`}>
                              <span>{fila.solicitudesAlquiler > 0 ? `Sí (${fila.solicitudesAlquiler})` : "No"}</span>
                            </Badge>
                          </Link>
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
                          {fila.revisadoPor === DD_IMPORTACION_REVISOR ? DD_IMPORTACION_REVISOR_LABEL : (fila.revisadoPor ?? "Sin asignar")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-[11px]"
                              onClick={() => setHistorialId(fila.id)}
                            >
                              <History className="h-3.5 w-3.5" />
                              <span>Ver historial</span>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-[11px]"
                              disabled={!accion.puede}
                              title={accion.puede ? "Revisar expediente" : accion.label}
                              onClick={() => { if (accion.puede) setRevisando(fila); }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>{accion.label}</span>
                            </Button>
                            {puedeMatriz ? <DdMatrizBoton expedienteId={fila.id} disabled={fila.estado === DD_ESTADOS.BORRADOR} /> : null}
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
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

      <DdHistorialDialog
        expedienteId={historialId}
        open={historialId !== null}
        onOpenChange={(abierto) => { if (!abierto) setHistorialId(null); }}
      />
    </div>
  );
}
