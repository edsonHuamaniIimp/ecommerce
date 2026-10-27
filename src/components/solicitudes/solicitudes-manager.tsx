"use client";

import Image from "next/image";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, Badge, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@nrivera-iimp/ui-kit-iimp";
import { Search, Eye, FileText, CheckCircle2, Clock, XCircle, RefreshCw, Send, AlertTriangle, AlertCircle, History, Trash2, ChevronDown, ClipboardCheck, CreditCard, Download, SlidersHorizontal, X, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/shared/pagination";
import { StatsCard } from "@/components/dashboard/stats-card";
import { authService } from "@/lib/client/api/services/auth-service";
import { maestraService } from "@/lib/client/api/services/maestra-service";
import { MAESTRA_TABLAS, ESTADOS_SOLICITUD, RESULTADOS_APROBACION, REVISION_AREAS, REVISION_AREA_LABELS, REVISION_AREA_SGC_LABEL, ESTADOS_REEVALUACION, ESTADOS_SOLICITUD_MAESTRA_ID, ESTADOS_SOLICITUD_LABELS, ESTADOS_DOCUMENTO_SOLICITUD, ESTADOS_DOCUMENTO_SOLICITUD_LABELS, ESTADOS_DOCUMENTO_SOLICITUD_MAESTRA_ID, RESULTADOS_APROBACION_LABELS, SOLICITUDES_FILTRO_SGC, SOLICITUDES_FILTRO_SGC_LABELS, SOLICITUDES_ORDEN, SOLICITUDES_ORDEN_LABELS, SOLICITUDES_EXPORT_MAX_FILAS, SOLICITUDES_FILTRO_DD, BADGE_STYLES, PERMISSIONS, TIPOS_DOCUMENTO_SOLICITUD } from "@/lib/shared/constants";
import { areasRevisionLocal, legalDelegadaAlSgc } from "@/lib/shared/utils/revision-areas";
import { anexosBloqueantesFaltantes } from "@/lib/shared/utils/solicitud-documentos";
import { precioTexto } from "@/lib/shared/utils/precio-stand";
import { archivoUtils } from "@/lib/shared/utils/archivo";
import { solicitudesService } from "@/lib/client/api/services/solicitudes-service";
import type { SolicitudesListFiltros } from "@/lib/client/api/services/solicitudes-service";
import type { SolicitudDTO } from "@/types/dto/solicitudes/solicitudes-response.dto";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { DdEstadoBadge } from "@/components/debida-diligencia/dd-estado-badge";
import { SolicitudReview } from "./solicitud-review";
import { NotificarModal } from "./notificar-modal";
import { HistorialModal } from "./historial-modal";
import { SgcExpedientePanel } from "@/components/sgc/sgc-expediente-panel";
import { Tooltip, TooltipTrigger, TooltipContent } from "@nrivera-iimp/ui-kit-iimp";
import { useSearchParams } from "next/navigation";
import { dateUtils } from "@/lib/shared/utils/date";
import { useAlertaNavigate } from "@/hooks/use-alerta-navigate";
import { useMaestraLabels } from "@/hooks/use-maestra-labels";

type SolicitudRow = SolicitudDTO;

function estaPendientePago(row: SolicitudRow) { return row.estadoSolicitud === ESTADOS_SOLICITUD.PENDIENTE_PAGO; }
function estaRechazada(row: SolicitudRow) { return row.estadoSolicitud === ESTADOS_SOLICITUD.RECHAZADO; }
/** Flujo homologado: individual y multiple usan la misma accion de revision. */
function puedeRevisar(row: SolicitudRow) { return !estaPendientePago(row); }
function tieneReevaluacionPendiente(row: SolicitudRow) { return row.reevaluaciones?.some((r) => r.estado === ESTADOS_REEVALUACION.PENDIENTE) ?? false; }
function ddPendienteValidacion(row: SolicitudRow) { return row.ddEstado?.requiereDeclaracionVigencia === true; }
function ddApta(row: SolicitudRow) { return row.ddEstado?.aptoParaContratar === true; }

/** Columnas de la exportacion avanzada (CSV/Excel) de la bandeja filtrada. */
const SOLICITUDES_EXPORT_COLUMNAS = [
  "Stand(s)",
  "Bloque",
  "Empresa",
  "Usuario",
  "Correo",
  "Tipo stand",
  "Precio USD",
  "Estado",
  "Revision Asociado",
  "Revision Legal",
  "SGC envio",
  "SGC estado",
  "Docs totales",
  "Docs observados",
  "Creada",
  "Actualizada",
] as const;

function filaExportacion(row: SolicitudRow, estadoLabels: Record<string, string>): Array<string | number> {
  const estadoRev = (area: string) => {
    const rev = row.revisiones?.find((r) => r.area === area);
    const estado = rev?.estado ?? RESULTADOS_APROBACION.PENDIENTE;
    return RESULTADOS_APROBACION_LABELS[estado as keyof typeof RESULTADOS_APROBACION_LABELS] ?? estado;
  };
  const estado = row.estadoSolicitud as keyof typeof ESTADOS_SOLICITUD_LABELS;
  return [
    row.standCodes?.length ? row.standCodes.join(", ") : row.standCode,
    row.bloqueId ?? "",
    row.empresa ?? "",
    row.nombreUsuario ?? "",
    row.email ?? "",
    row.tipoStand ?? "",
    row.precio ?? 0,
    estadoLabels[row.estadoSolicitud] ?? ESTADOS_SOLICITUD_LABELS[estado] ?? row.estadoSolicitud,
    estadoRev(REVISION_AREAS.ASOCIADO),
    estadoRev(REVISION_AREAS.LEGAL),
    row.sgcEstadoEnvio ?? "",
    row.sgcLifecycleStatus ?? "",
    (row.docsAdjuntosCount ?? 0) + ((row.documentos as string[])?.length ?? 0),
    (row.docsAdjuntos ?? []).filter((d) => d.estado === ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO).length,
    dateUtils.formatDateTime(row.createdAt),
    dateUtils.formatDateTime(row.updatedAt),
  ];
}

function nombreArchivoExport(extension: "csv" | "xlsx"): string {
  const ahora = new Date();
  const dos = (n: number) => String(n).padStart(2, "0");
  const marca = `${ahora.getFullYear()}${dos(ahora.getMonth() + 1)}${dos(ahora.getDate())}-${dos(ahora.getHours())}${dos(ahora.getMinutes())}`;
  return `solicitudes-${marca}.${extension}`;
}

function csvCelda(valor: string | number): string {
  const texto = String(valor ?? "");
  return `"${texto.replace(/"/g, '""')}"`;
}

function DetailSection({ id, title, open, onToggle, children }: { id: string; title: string; open: boolean; onToggle: (id: string) => void; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border transition-shadow duration-200 hover:shadow-sm">
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full justify-between rounded-none px-4 py-2.5 text-sm font-semibold tracking-tight text-foreground hover:bg-secondary"
        onClick={() => onToggle(id)}
      >
        <span>{title}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </Button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-3.5 pt-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function SolicitudesManagerContent({ eventoId }: { eventoId: string }) {
  const searchParams = useSearchParams();
  const autoOpenId = searchParams.get("id");
  const [rows, setRows] = useState<SolicitudRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [filters, setFilters] = useState<SolicitudesListFiltros>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [resumen, setResumen] = useState({ pendientes: 0, enRevision: 0, observadas: 0, aprobadas: 0 });
  const [ddResumen, setDdResumen] = useState({ aptas: 0, noAptas: 0, pendientesValidacion: 0 });
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<SolicitudRow | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRow, setReviewRow] = useState<SolicitudRow | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [notificarOpen, setNotificarOpen] = useState(false);
  const [notificarRow, setNotificarRow] = useState<SolicitudRow | null>(null);
  const [notificarSending, setNotificarSending] = useState(false);
  const [notificarError, setNotificarError] = useState<string | null>(null);
  const [reevaluacionRow, setReevaluacionRow] = useState<SolicitudRow | null>(null);
  const [reevaluacionOpen, setReevaluacionOpen] = useState(false);
  const [reevaluacionAction, setReevaluacionAction] = useState<"aprobar" | "rechazar" | null>(null);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [historialStandId, setHistorialStandId] = useState<string | null>(null);
  const [accordionOpen, setAccordionOpen] = useState<string | null>(null);
  const [bajaRow, setBajaRow] = useState<SolicitudRow | null>(null);
  const [bajaOpen, setBajaOpen] = useState(false);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [hasViewPerm, setHasViewPerm] = useState(false);
  const [solicitudEstadoLabels, setSolicitudEstadoLabels] = useState<Record<string, string>>({});
  const [imgCarousel, setImgCarousel] = useState<{ images: string[]; idx: number } | null>(null);
  const documentoEstadoLabels = useMaestraLabels(
    MAESTRA_TABLAS.DOCUMENTO_ESTADO,
    ESTADOS_DOCUMENTO_SOLICITUD_MAESTRA_ID,
    ESTADOS_DOCUMENTO_SOLICITUD_LABELS,
  );

  const pageRef = useRef(page);
  const perPageRef = useRef(perPage);
  const filtersRef = useRef<SolicitudesListFiltros>(filters);
  const firstSearchRef = useRef(true);
  const loadSeqRef = useRef(0);
  const reviewOpenRef = useRef(reviewOpen);
  const autoOpenIdRef = useRef(autoOpenId);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { perPageRef.current = perPage; }, [perPage]);
  useEffect(() => { filtersRef.current = filters; }, [filters]);
  useEffect(() => { reviewOpenRef.current = reviewOpen; }, [reviewOpen]);
  useEffect(() => { autoOpenIdRef.current = autoOpenId; }, [autoOpenId]);

  useEffect(() => {
    maestraService.listar(MAESTRA_TABLAS.SOLICITUD_ESTADO).then((items) => {
      const map: Record<string, string> = {};
      for (const item of items) {
        if (item.itemId !== null) map[String(item.itemId)] = item.nombre;
      }
      for (const [key, itemId] of Object.entries(ESTADOS_SOLICITUD_MAESTRA_ID)) {
        const label = map[String(itemId)];
        if (label) map[key] = label;
      }
      setSolicitudEstadoLabels(map);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      const session = await authService.getSession();
      const perms = session.permissions ?? [];
      setUserPermissions(perms);
      // Habilitar la revision si: gestiona la bandeja, es admin, o es revisor/notificador
      // de un area (asi no depende de que el permiso nuevo este cargado en el rol de la BD).
      const esRevisor =
        perms.includes(PERMISSIONS.SOLICITUDES_REVIEW_ASOCIADO) ||
        perms.includes(PERMISSIONS.SOLICITUDES_REVIEW_LEGAL);
      setHasViewPerm(
        perms.includes(PERMISSIONS.SOLICITUDES_GESTION) ||
        perms.includes(PERMISSIONS.ADMIN_FULL) ||
        esRevisor ||
        perms.includes(PERMISSIONS.SOLICITUDES_NOTIFY),
      );
    })();
  }, []);

  const loadResumen = useCallback(async () => {
    if (!eventoId) return;
    try {
      const [pendientes, enRevision, observadas, aprobadas] = await Promise.all([
        solicitudesService.listar(eventoId, 1, 1, undefined, undefined, { estado: ESTADOS_SOLICITUD.PENDIENTE }),
        solicitudesService.listar(eventoId, 1, 1, undefined, undefined, { estado: ESTADOS_SOLICITUD.EN_PROCESO }),
        solicitudesService.listar(eventoId, 1, 1, undefined, undefined, { estado: ESTADOS_SOLICITUD.OBSERVADO }),
        solicitudesService.listar(eventoId, 1, 1, undefined, undefined, { estado: ESTADOS_SOLICITUD.APROBADO }),
      ]);
      setResumen({
        pendientes: pendientes.total,
        enRevision: enRevision.total,
        observadas: observadas.total,
        aprobadas: aprobadas.total,
      });
    } catch {
      /* El resumen es informativo; no bloquea la bandeja. */
    }
  }, [eventoId]);

  const loadDdResumen = useCallback(async () => {
    if (!eventoId) return;
    try {
      let page = 1;
      let totalPages = 1;
      let aptas = 0;
      let noAptas = 0;
      let pendientesValidacion = 0;
      do {
        const data = await solicitudesService.listar(eventoId, page, 500);
        for (const row of data.data ?? []) {
          const pendienteDeclaracion = ddPendienteValidacion(row);
          if (ddApta(row) && !pendienteDeclaracion) aptas += 1;
          else noAptas += 1;
          if (pendienteDeclaracion) pendientesValidacion += 1;
        }
        totalPages = data.totalPages;
        page += 1;
      } while (page <= totalPages);
      setDdResumen({ aptas, noAptas, pendientesValidacion });
    } catch {
      /* El resumen DD es informativo; no bloquea la bandeja. */
    }
  }, [eventoId]);

  const load = useCallback(async (p?: number, s?: string, pp?: number, f?: SolicitudesListFiltros) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      const data = await solicitudesService.listar(
        eventoId,
        p ?? pageRef.current,
        pp ?? perPageRef.current,
        s,
        undefined,
        f ?? filtersRef.current,
      );
      /* Descarta respuestas viejas cuando busqueda/filtros cambian rapido. */
      if (seq !== loadSeqRef.current) return;
      setRows(data.data?.filter((r) => r.flgActivo !== false) ?? []);
      setPagination({ page: data.page, total: data.total, totalPages: data.totalPages });
      void loadResumen();
      void loadDdResumen();

      if (autoOpenIdRef.current && !reviewOpenRef.current) {
        const found = data.data?.find((r) => r.id === autoOpenIdRef.current);
        if (found) { setReviewRow(found); setReviewOpen(true); }
        // Clean URL to avoid re-opening on reload
        const next = new URL(window.location.href);
        next.searchParams.delete("id");
        window.history.replaceState({}, "", next.toString());
      }
    } catch { /* ignore */ } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [eventoId, loadResumen, loadDdResumen]);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  /* Busqueda con debounce (400 ms); el primer render no dispara una segunda carga. */
  useEffect(() => {
    if (firstSearchRef.current) { firstSearchRef.current = false; return; }
    const timer = setTimeout(() => {
      setPage(1);
      void load(1, search, perPageRef.current, filtersRef.current);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, load]);

  const aplicarFiltros = (next: SolicitudesListFiltros) => {
    setFilters(next);
    setPage(1);
    void load(1, search, perPage, next);
  };

  const alternarEstado = (estado: string) => {
    aplicarFiltros({
      ...filters,
      dd: undefined,
      estado: filters.estado === estado ? undefined : estado,
    });
  };

  const alternarDd = (dd: string) => {
    aplicarFiltros({
      ...filters,
      estado: undefined,
      dd: filters.dd === dd ? undefined : dd,
    });
  };

  const limpiarFiltros = () => aplicarFiltros({});

  const filtrosActivos = [
    filters.estado,
    filters.dd,
    filters.areaPendiente,
    filters.sgc,
    filters.docsObservados ? "observados" : undefined,
    filters.desde,
    filters.hasta,
    filters.orden && filters.orden !== SOLICITUDES_ORDEN.RECIENTES ? filters.orden : undefined,
  ].filter(Boolean).length;

  const handleExport = async (formato: "csv" | "xlsx") => {
    setExporting(formato);
    try {
      const filas: SolicitudRow[] = [];
      const perPageExport = 200;
      let pageExport = 1;
      while (filas.length < SOLICITUDES_EXPORT_MAX_FILAS) {
        const data = await solicitudesService.listar(eventoId, pageExport, perPageExport, search, undefined, filters);
        const lote = (data.data ?? []).filter((r) => r.flgActivo !== false);
        filas.push(...lote);
        if (lote.length === 0 || pageExport >= data.totalPages) break;
        pageExport += 1;
      }
      const seleccion = filas.slice(0, SOLICITUDES_EXPORT_MAX_FILAS);
      if (seleccion.length === 0) {
        toast.error("No hay solicitudes para exportar con los filtros actuales");
        return;
      }
      const datos = seleccion.map((row) => filaExportacion(row, solicitudEstadoLabels));

      if (formato === "csv") {
        const contenido = [SOLICITUDES_EXPORT_COLUMNAS.map(csvCelda).join(",")]
          .concat(datos.map((fila) => fila.map(csvCelda).join(",")))
          .join("\r\n");
        const blob = new Blob([`\uFEFF${contenido}`], { type: "text/csv;charset=utf-8" });
        archivoUtils.descargarBlob(blob, nombreArchivoExport("csv"));
      } else {
        const ExcelJS = (await import("exceljs")).default;
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Solicitudes");
        ws.columns = SOLICITUDES_EXPORT_COLUMNAS.map((titulo) => ({
          header: titulo,
          key: titulo,
          width: Math.max(14, titulo.length + 4),
        }));
        ws.addRows(datos);
        ws.getRow(1).font = { bold: true };
        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer as ArrayBuffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        archivoUtils.descargarBlob(blob, nombreArchivoExport("xlsx"));
      }
      toast.success(`${seleccion.length} solicitud(es) exportadas`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar la bandeja");
    } finally {
      setExporting(null);
    }
  };

  useAlertaNavigate("/dashboard/solicitudes", (row) => {
    if (typeof row.id !== "string" || typeof row.standCode !== "string") return;
    setDetailRow(row as SolicitudRow);
    setDetailOpen(true);
  });

  const handleReviewSaved = async (updated: SolicitudRow) => {
    try {
      const fresh = await solicitudesService.detalle(updated.id);
      setRows((prev) => prev.map((r) => (r.id === fresh.id ? fresh : r)));
      setReviewRow(fresh);
    } catch {
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setReviewRow(updated);
    }
  };

  const handleOpenReview = async (rowId: string) => {
    setLoadingDetail(true);
    setReviewOpen(true);
    try {
      const data = await solicitudesService.detalle(rowId);
      setReviewRow(data);
    } catch { /* ignore */ }
    setLoadingDetail(false);
  };

  const handleNotificar = async (modo: "automatico" | "personalizado", mensaje?: string) => {
    if (!notificarRow) return;
    setNotificarSending(true);
    setNotificarError(null);
    try {
      await solicitudesService.notificar({
        solicitudId: notificarRow.id,
        to: notificarRow.email ?? "",
        modo,
        mensaje: mensaje || undefined,
      });
      setNotificarOpen(false);
      setNotificarRow(null);
      toast.success("Notificacion enviada al cliente");
    } catch (e) {
      setNotificarError(e instanceof Error ? e.message : "Error de conexion");
    }
    setNotificarSending(false);
  };

  const canNotify = userPermissions.includes(PERMISSIONS.SOLICITUDES_NOTIFY) || userPermissions.includes(PERMISSIONS.ADMIN_FULL);

  const confirmDarDeBaja = async () => {
    if (!bajaRow) return;
    try {
      await solicitudesService.darDeBaja({ solicitudId: bajaRow.id });
      toast.success("Solicitud dada de baja");
      setBajaOpen(false);
      setBajaRow(null);
      load(page, search, perPage);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const handleOrdenPago = async () => {
    if (!reviewRow) return;
    try {
      await solicitudesService.ordenPago({ solicitudId: reviewRow.id });
      toast.success("Orden de pago generada");
      setReviewOpen(false);
      load(page, search, perPage);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const handleAtenderReevaluacion = async (accion: "aprobar" | "rechazar") => {
    if (!reevaluacionRow) return;
    const reevaluacion = reevaluacionRow.reevaluaciones?.find((r) => r.estado === ESTADOS_REEVALUACION.PENDIENTE);
    if (!reevaluacion) return;

    if (accion === "rechazar") {
      setReevaluacionAction("rechazar");
      return;
    }

    try {
      await solicitudesService.atenderReevaluacion({ reevaluacionId: reevaluacion.id, accion: "aprobar" });
      toast.success("Re-evaluacion aprobada. La solicitud vuelve a revision.");
      setReevaluacionOpen(false);
      setReevaluacionRow(null);
      load(page, search, perPage);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const confirmRechazarReevaluacion = async () => {
    if (!reevaluacionRow) return;
    const reevaluacion = reevaluacionRow.reevaluaciones?.find((r) => r.estado === ESTADOS_REEVALUACION.PENDIENTE);
    if (!reevaluacion) return;
    try {
      await solicitudesService.atenderReevaluacion({ reevaluacionId: reevaluacion.id, accion: "rechazar" });
      toast.success("Re-evaluacion rechazada.");
      setReevaluacionOpen(false);
      setReevaluacionAction(null);
      setReevaluacionRow(null);
      load(page, search, perPage);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
      setReevaluacionAction(null);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatsCard title="Pendientes" value={resumen.pendientes} icon={<Clock className="h-4 w-4" />} chip={{ texto: "Sin iniciar revision", variante: "muted" }} onClick={() => alternarEstado(ESTADOS_SOLICITUD.PENDIENTE)} active={filters.estado === ESTADOS_SOLICITUD.PENDIENTE} />
        <StatsCard title="En revision" value={resumen.enRevision} icon={<Eye className="h-4 w-4" />} chip={{ texto: "Requieren decision", variante: "primary" }} onClick={() => alternarEstado(ESTADOS_SOLICITUD.EN_PROCESO)} active={filters.estado === ESTADOS_SOLICITUD.EN_PROCESO} />
        <StatsCard title="Observadas" value={resumen.observadas} icon={<AlertTriangle className="h-4 w-4" />} chip={{ texto: "Esperando correccion", variante: "gold" }} onClick={() => alternarEstado(ESTADOS_SOLICITUD.OBSERVADO)} active={filters.estado === ESTADOS_SOLICITUD.OBSERVADO} />
        <StatsCard title="Aprobadas" value={resumen.aprobadas} icon={<CheckCircle2 className="h-4 w-4" />} chip={{ texto: "Listas para continuar", variante: "primary" }} onClick={() => alternarEstado(ESTADOS_SOLICITUD.APROBADO)} active={filters.estado === ESTADOS_SOLICITUD.APROBADO} />
        <StatsCard title="DD APTAS" value={ddResumen.aptas} icon={<CheckCircle2 className="h-4 w-4" />} chip={{ texto: "Aptas para contratar", variante: "primary" }} onClick={() => alternarDd(SOLICITUDES_FILTRO_DD.APTAS)} active={filters.dd === SOLICITUDES_FILTRO_DD.APTAS} />
        <StatsCard title="DD NO APTAS" value={ddResumen.noAptas} icon={<XCircle className="h-4 w-4" />} chip={{ texto: ddResumen.pendientesValidacion > 0 ? `${ddResumen.pendientesValidacion} por declaracion` : "No aptas o pendientes", variante: "gold" }} onClick={() => alternarDd(SOLICITUDES_FILTRO_DD.NO_APTAS)} active={filters.dd === SOLICITUDES_FILTRO_DD.NO_APTAS} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-semibold text-primary">En bandeja</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                {pagination.total} {pagination.total === 1 ? "activa" : "activas"}
              </span>
              {filtrosActivos > 0 && (
                <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.INFO}`}>
                  <span>{filtrosActivos} filtro(s)</span>
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" disabled={exporting !== null || loading}>
                    <Download className={`h-3.5 w-3.5 ${exporting ? "animate-pulse" : ""}`} />
                    <span>{exporting ? "Exportando..." : "Exportar"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel><span>Bandeja filtrada ({pagination.total})</span></DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={exporting !== null} onSelect={() => { void handleExport("xlsx"); }}>
                    <FileSpreadsheet className="mr-2 h-3.5 w-3.5" />
                    <span>Excel (.xlsx)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={exporting !== null} onSelect={() => { void handleExport("csv"); }}>
                    <FileText className="mr-2 h-3.5 w-3.5" />
                    <span>CSV (.csv)</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-8 shrink-0 p-0" onClick={() => load(page, search, perPage, filters)} disabled={loading}>
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><span>Recargar</span></TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por empresa, stand, correo o contrato..." value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); load(1, e.currentTarget.value, perPage, filters); } }}
                className="h-8 border-border bg-secondary pl-8 text-xs placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary" />
            </div>
            <Button
              variant={filtersOpen ? "default" : "outline"}
              size="sm"
              className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filtros</span>
              {filtrosActivos > 0 && (
                <span className="rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-bold">{filtrosActivos}</span>
              )}
            </Button>
            <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); load(1, search, Number(v), filters); }}>
              <SelectTrigger className="h-8 w-[70px] shrink-0 border-border text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 15, 50].map((n) => (
                  <SelectItem key={n} value={String(n)}><span>{n}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtersOpen && (
            <div className="grid gap-2 rounded-lg border border-border bg-secondary/40 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="filtro-estado">Estado</label>
                <Select
                  value={filters.estado ?? "todos"}
                  onValueChange={(v) => aplicarFiltros({ ...filters, estado: v === "todos" ? undefined : v })}
                >
                  <SelectTrigger id="filtro-estado" className="h-8 border-border text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos"><span>Todos los estados</span></SelectItem>
                    {Object.values(ESTADOS_SOLICITUD).map((estado) => (
                      <SelectItem key={estado} value={estado}><span>{solicitudEstadoLabels[estado] ?? ESTADOS_SOLICITUD_LABELS[estado]}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="filtro-area">Revision pendiente</label>
                <Select
                  value={filters.areaPendiente ?? "todas"}
                  onValueChange={(v) => aplicarFiltros({ ...filters, areaPendiente: v === "todas" ? undefined : v })}
                >
                  <SelectTrigger id="filtro-area" className="h-8 border-border text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas"><span>Cualquier area</span></SelectItem>
                    {Object.values(REVISION_AREAS).map((area) => (
                      <SelectItem key={area} value={area}><span>{REVISION_AREA_LABELS[area]}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="filtro-sgc">Expediente SGC</label>
                <Select
                  value={filters.sgc ?? "todos"}
                  onValueChange={(v) => aplicarFiltros({ ...filters, sgc: v === "todos" ? undefined : v })}
                >
                  <SelectTrigger id="filtro-sgc" className="h-8 border-border text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos"><span>Cualquier estado SGC</span></SelectItem>
                    {Object.values(SOLICITUDES_FILTRO_SGC).map((valor) => (
                      <SelectItem key={valor} value={valor}><span>{SOLICITUDES_FILTRO_SGC_LABELS[valor]}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="filtro-observados">Documentos</label>
                <Select
                  value={filters.docsObservados ? "observados" : "todos"}
                  onValueChange={(v) => aplicarFiltros({ ...filters, docsObservados: v === "observados" ? true : undefined })}
                >
                  <SelectTrigger id="filtro-observados" className="h-8 border-border text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos"><span>Todos los documentos</span></SelectItem>
                    <SelectItem value="observados"><span>Solo con documentos observados</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="filtro-desde">Creada desde</label>
                <Input id="filtro-desde" type="date" value={filters.desde ?? ""}
                  onChange={(e) => aplicarFiltros({ ...filters, desde: e.target.value || undefined })}
                  className="h-8 border-border bg-background text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="filtro-hasta">Creada hasta</label>
                <Input id="filtro-hasta" type="date" value={filters.hasta ?? ""}
                  onChange={(e) => aplicarFiltros({ ...filters, hasta: e.target.value || undefined })}
                  className="h-8 border-border bg-background text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="filtro-orden">Orden</label>
                <Select
                  value={filters.orden ?? SOLICITUDES_ORDEN.RECIENTES}
                  onValueChange={(v) => aplicarFiltros({ ...filters, orden: v })}
                >
                  <SelectTrigger id="filtro-orden" className="h-8 border-border text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(SOLICITUDES_ORDEN).map((valor) => (
                      <SelectItem key={valor} value={valor}><span>{SOLICITUDES_ORDEN_LABELS[valor]}</span></SelectItem>
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
          )}
        </CardHeader>
        <CardContent className="space-y-3 pt-4">

          {loading ? (
            <TableSkeleton rows={perPage} columns={10} />
          ) : rows.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                {filtrosActivos > 0 || search ? "No hay solicitudes que coincidan con los filtros." : "No hay solicitudes de alquiler pendientes."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {filtrosActivos > 0 || search ? "Ajusta o limpia los filtros para ver mas resultados." : "Cuando un expositor solicite una reserva, aparecera aqui para su revision."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table className="min-w-[1280px]">
                  <TableHeader>
                    <TableRow className="bg-secondary">
                      <TableHead className="min-w-[100px]"><span className="text-[10px] uppercase">Stand</span></TableHead>
                      <TableHead className="min-w-[190px]"><span className="text-[10px] uppercase">Empresa</span></TableHead>
                      <TableHead className="min-w-[170px]"><span className="text-[10px] uppercase">Debida diligencia</span></TableHead>
                      <TableHead className="min-w-[170px]"><span className="text-[10px] uppercase">Usuario</span></TableHead>
                      <TableHead className="min-w-[220px]"><span className="text-[10px] uppercase">Correo</span></TableHead>
                      <TableHead className="min-w-[110px]"><span className="text-[10px] uppercase">Tipo</span></TableHead>
                      <TableHead className="min-w-[120px]"><span className="text-[10px] uppercase">Revision</span></TableHead>
                      <TableHead className="min-w-[80px]"><span className="text-[10px] uppercase">Docs</span></TableHead>
                      <TableHead className="min-w-[150px]"><span className="text-[10px] uppercase">Fecha</span></TableHead>
                      <TableHead className="min-w-[120px] text-right"><span className="text-[10px] uppercase">Accion</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      return (
                        <TableRow key={row.id} className="transition-colors hover:bg-secondary/60">
                          <TableCell className="min-w-[100px] align-top font-medium">
                            <span className="inline-flex items-center rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">
                              {row.standCodes?.length > 1 ? `${row.standCodes.length} stands` : row.standCode}
                            </span>
                            {row.bloqueId && <span className="mt-0.5 block font-mono text-[10px] font-normal text-muted-foreground">{row.bloqueId}</span>}
                          </TableCell>
                          <TableCell className="min-w-[190px] max-w-[260px] align-top text-xs text-foreground" title={row.empresa ?? ""}>
                            {row.empresa ?? "—"}
                          </TableCell>
                          <TableCell className="min-w-[170px] align-top">
                            <div className="space-y-1">
                              {ddPendienteValidacion(row) ? (
                                <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.WARNING}`}>
                                  <span>Declaración de vigencia pendiente</span>
                                </Badge>
                              ) : (
                                <DdEstadoBadge estado={row.ddEstado?.estado ?? null} />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="min-w-[170px] max-w-[230px] align-top text-xs text-foreground" title={row.nombreUsuario ?? row.email ?? ""}>
                            {row.nombreUsuario ?? "—"}
                          </TableCell>
                          <TableCell className="min-w-[220px] max-w-[280px] align-top text-xs text-muted-foreground" title={row.email ?? ""}>
                            {row.email ?? "—"}
                          </TableCell>
                          <TableCell className="min-w-[110px] align-top text-xs text-muted-foreground">{row.tipoStand ?? "—"}</TableCell>
                          <TableCell className="min-w-[120px] align-top">
                             {row.estadoSolicitud === ESTADOS_SOLICITUD.APROBADO ? (
                               <Badge className={`text-[10px] pointer-events-none ${BADGE_STYLES.SUCCESS}`}>
                                 <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" />
                                 {solicitudEstadoLabels[ESTADOS_SOLICITUD.APROBADO] ?? "Aprobado"}
                               </Badge>
                             ) : row.estadoSolicitud === ESTADOS_SOLICITUD.RECHAZADO ? (
                               <Badge className={`text-[10px] pointer-events-none ${BADGE_STYLES.DESTRUCTIVE}`}>
                                 <XCircle className="mr-0.5 h-2.5 w-2.5" />
                                 {solicitudEstadoLabels[ESTADOS_SOLICITUD.RECHAZADO] ?? "Rechazado"}
                               </Badge>
                             ) : row.estadoSolicitud === ESTADOS_SOLICITUD.EN_PROCESO ? (
                               <Badge className={`text-[10px] pointer-events-none ${BADGE_STYLES.INFO}`}>
                                 <Clock className="mr-0.5 h-2.5 w-2.5" />
                                 {solicitudEstadoLabels[ESTADOS_SOLICITUD.EN_PROCESO] ?? "En proceso"}
                               </Badge>
                             ) : row.estadoSolicitud === ESTADOS_SOLICITUD.PAGADO ? (
                               <Badge className={`text-[10px] pointer-events-none ${BADGE_STYLES.SUCCESS}`}>
                                 <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" />
                                 {solicitudEstadoLabels[ESTADOS_SOLICITUD.PAGADO] ?? "Pagado"}
                               </Badge>
                             ) : row.estadoSolicitud === ESTADOS_SOLICITUD.OBSERVADO ? (
                               <Badge className={`text-[10px] pointer-events-none ${BADGE_STYLES.WARNING}`}>
                                 <AlertCircle className="mr-0.5 h-2.5 w-2.5" />
                                 {solicitudEstadoLabels[ESTADOS_SOLICITUD.OBSERVADO] ?? "Observado"}
                               </Badge>
                             ) : row.estadoSolicitud === ESTADOS_SOLICITUD.PENDIENTE_PAGO ? (
                               <Badge className={`text-[10px] pointer-events-none ${BADGE_STYLES.INDIGO}`}>
                                 <Clock className="mr-0.5 h-2.5 w-2.5" />
                                 {solicitudEstadoLabels[ESTADOS_SOLICITUD.PENDIENTE_PAGO] ?? "Pendiente Pago"}
                               </Badge>
                             ) : (
                               <Badge className={`text-[10px] pointer-events-none ${BADGE_STYLES.WARNING}`}>
                                 <Clock className="mr-0.5 h-2.5 w-2.5" />
                                 {solicitudEstadoLabels[ESTADOS_SOLICITUD.PENDIENTE] ?? "Pendiente"}
                               </Badge>
                             )}
                          </TableCell>
                          <TableCell className="min-w-[80px] align-top text-xs">
                            {`${(row.docsAdjuntosCount ?? 0) + ((row.documentos as string[])?.length ?? 0)} doc(s)`}
                          </TableCell>
                          <TableCell className="min-w-[150px] align-top text-xs text-muted-foreground">
                            {dateUtils.formatDateTime(row.createdAt)}
                          </TableCell>
                          <TableCell className="min-w-[120px] text-right align-top">
                            <div className="flex gap-0.5 justify-end">
                              {row.revisiones.some((r) => r.updatedBy) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                      onClick={() => { setHistorialStandId(row.id); setHistorialOpen(true); }}>
                                      <History className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top"><span>Historial</span></TooltipContent>
                                </Tooltip>
                              )}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                    onClick={() => { setDetailRow(row); setDetailOpen(true); }}>
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top"><span>Ver detalle</span></TooltipContent>
                              </Tooltip>
                              {hasViewPerm &&
                                puedeRevisar(row) &&
                                (!row.ddEstado?.requiereDeclaracionVigencia ||
                                  userPermissions.includes(PERMISSIONS.ADMIN_FULL)) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="default" size="sm" className="h-7 w-7 p-0"
                                      onClick={() => handleOpenReview(row.id)}>
                                      <ClipboardCheck className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top"><span>Revisar</span></TooltipContent>
                                </Tooltip>
                              )}
                              {estaRechazada(row) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                      onClick={() => { setBajaRow(row); setBajaOpen(true); }}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top"><span>Dar de baja</span></TooltipContent>
                                </Tooltip>
                              )}
                              {canNotify && estaRechazada(row) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                                      onClick={() => { setNotificarRow(row); setNotificarOpen(true); }}>
                                      <Send className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top"><span>Notificar rechazo</span></TooltipContent>
                                </Tooltip>
                              )}
                              {tieneReevaluacionPendiente(row) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="default" size="sm" className="h-7 w-7 p-0 bg-warning hover:bg-warning/90"
                                      onClick={() => { setReevaluacionRow(row); setReevaluacionOpen(true); }}>
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top"><span>Solicitud de re-evaluacion pendiente</span></TooltipContent>
                                </Tooltip>
                              )}
                              {estaPendientePago(row) && !row.tieneFacturacion && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="default" size="sm" className="h-7 w-7 p-0 bg-primary hover:bg-primary/90"
                                      onClick={async () => {
                                        try {
                                          await solicitudesService.ordenPago({ solicitudId: row.id });
                                          toast.success("Facturacion generada");
                                          load(page, search, perPage);
                                        } catch { toast.error("Error al generar facturacion"); }
                                      }}>
                                      <CreditCard className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top"><span>Generar facturacion</span></TooltipContent>
                                </Tooltip>
                              )}
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
                  {pagination.total} resultados {"\u2014"} página {pagination.page} de {pagination.totalPages || 1}
                </span>
                <Pagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  onPageChange={(p) => { setPage(p); load(p, search, perPage); }}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col !px-0 !py-0 overflow-hidden">
          {/* Header */}
          <div className="shrink-0 px-5 pt-4 pb-2 border-b border-border !pr-12">
            <h3 className="text-sm font-semibold text-foreground">Detalle de solicitud</h3>
          </div>
          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-2">
          {detailRow && (
            <>
              {/* Info general â€” siempre visible */}
              <DetailSection id="info" title="Informacion general" open={accordionOpen === "info"} onToggle={(id) => setAccordionOpen(accordionOpen === id ? null : id)}>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Stand:</span> <span className="font-mono font-medium">{detailRow.standCode}</span>{detailRow.standCodes?.length > 1 && <span className="text-[10px] text-muted-foreground ml-1">({detailRow.standCodes.length} stands: {detailRow.standCodes.join(", ")})</span>}</div>
                  <div><span className="text-muted-foreground">Bloque:</span> <span className="font-mono">{detailRow.bloqueId ?? "â€”"}</span></div>
                  <div><span className="text-muted-foreground">Tipo:</span> <span>{detailRow.tipoStand ?? "â€”"}</span></div>
                  <div><span className="text-muted-foreground">Precio:</span> <span>{precioTexto(detailRow.precio)}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Empresa:</span> <span>{detailRow.empresa ?? "â€”"}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Estado:</span>{" "}
                    <Badge className={`text-[10px] ${
                      detailRow.estadoSolicitud === ESTADOS_SOLICITUD.APROBADO ? BADGE_STYLES.SUCCESS
                      : detailRow.estadoSolicitud === ESTADOS_SOLICITUD.RECHAZADO ? BADGE_STYLES.DESTRUCTIVE
                      : detailRow.estadoSolicitud === ESTADOS_SOLICITUD.EN_PROCESO ? BADGE_STYLES.INFO
                      : detailRow.estadoSolicitud === ESTADOS_SOLICITUD.PENDIENTE_PAGO ? BADGE_STYLES.INDIGO
                      : detailRow.estadoSolicitud === ESTADOS_SOLICITUD.PAGADO ? BADGE_STYLES.SUCCESS
                      : BADGE_STYLES.WARNING
                    }`}>
                      {solicitudEstadoLabels[detailRow.estadoSolicitud] ?? detailRow.estadoSolicitud}
                    </Badge>
                  </div>
                  <div className="col-span-2"><span className="text-muted-foreground">Fecha solicitud:</span> <span>{dateUtils.formatDateTime(detailRow.createdAt)}</span></div>
                </div>
              </DetailSection>

              {/* Imagenes */}
              {detailRow.imagenes.length > 0 && (
                <DetailSection id="imagenes" title={`Imagenes (${detailRow.imagenes.length})`} open={accordionOpen === "imagenes"} onToggle={(id) => setAccordionOpen(accordionOpen === id ? null : id)}>
                  <div className="flex gap-1.5">
                    {detailRow.imagenes.slice(0, 4).map((url: string, i: number) => (
                      <Button key={i} type="button" variant="ghost"                        className="h-14 w-14 overflow-hidden rounded border p-0 hover:opacity-80"
                        onClick={() => setImgCarousel({ images: detailRow.imagenes as string[], idx: i })}>
                        <Image width={64} height={64} src={url} alt={`Imagen ${i + 1}`} className="h-full w-full object-cover" />
                      </Button>
                    ))}
                    {detailRow.imagenes.length > 4 && (
                      <span className="flex h-14 w-14 items-center justify-center rounded border bg-muted text-xs text-muted-foreground">
                        +{detailRow.imagenes.length - 4}
                      </span>
                    )}
                  </div>
                </DetailSection>
              )}

              {/* Documentos (legacy JSON + adjuntos del flujo nuevo, single y multi) */}
              {((detailRow.docsAdjuntosCount ?? 0) + ((detailRow.documentos as string[])?.length ?? 0)) > 0 ? (
                <DetailSection id="docs" title={`Documentos (${(detailRow.docsAdjuntosCount ?? 0) + ((detailRow.documentos as string[])?.length ?? 0)})`} open={accordionOpen === "docs"} onToggle={(id) => setAccordionOpen(accordionOpen === id ? null : id)}>
                  {/* Single-stand */}
                  {(!detailRow.standCodes || detailRow.standCodes.length <= 1) && (detailRow.documentos as string[]).length > 0 && (
                    <div className="space-y-0.5 rounded-md border p-2">
                      {(detailRow.documentos as string[]).map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" className="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-primary hover:bg-primary/5 transition-colors">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate flex-1">{url.split("/").pop() ?? url}</span>
                          <Eye className="h-3 w-3 opacity-50 shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}
                  {/* Adjuntos del flujo nuevo (single y multi) */}
                  {detailRow.docsAdjuntos && detailRow.docsAdjuntos.length > 0 && (() => {
                    const adminDocs = detailRow.docsAdjuntos.filter(doc => doc.userId !== detailRow.userId);
                    const clienteDocs = detailRow.docsAdjuntos.filter(doc => doc.userId === detailRow.userId);
                    return (
                      <div className="space-y-2">
                        {adminDocs.length > 0 && (
                          <div>
                            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Administrador ({adminDocs.length})</p>
                            <div className="space-y-0.5 rounded-md border border-info/30 bg-info/10 p-2">
                              {adminDocs.map((doc, i) => (
                                <div key={i} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs">
                                  <FileText className="h-3.5 w-3.5 shrink-0 text-info" />
                                  <a href={doc.url} target="_blank" className="text-info hover:text-info transition-colors truncate flex-1 font-medium">{doc.nombre}</a>
                                  {doc.estado === ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO && (
                                    <Badge className={`pointer-events-none shrink-0 text-[9px] ${BADGE_STYLES.WARNING}`} title={doc.motivoObservacion ?? undefined}><span>{documentoEstadoLabels[ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO]}</span></Badge>
                                  )}
                                  {doc.estado === ESTADOS_DOCUMENTO_SOLICITUD.REEMPLAZADO && (
                                    <Badge className={`pointer-events-none shrink-0 text-[9px] ${BADGE_STYLES.NEUTRAL}`}><span>{documentoEstadoLabels[ESTADOS_DOCUMENTO_SOLICITUD.REEMPLAZADO]}</span></Badge>
                                  )}
                                  <span className="text-[10px] text-muted-foreground shrink-0">{dateUtils.formatDateTime(doc.createdAt)}</span>
                                  <a href={doc.url} target="_blank" className="text-muted-foreground hover:text-foreground shrink-0">
                                    <Eye className="h-3 w-3" />
                                  </a>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {clienteDocs.length > 0 && (
                          <div>
                            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Cliente ({clienteDocs.length})</p>
                            <div className="space-y-0.5 rounded-md border border-success/30 bg-success/10 p-2">
                              {clienteDocs.map((doc, i) => (
                                <div key={i} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs">
                                  <FileText className="h-3.5 w-3.5 shrink-0 text-success" />
                                  <a href={doc.url} target="_blank" className="text-success hover:text-green-900 transition-colors truncate flex-1 font-medium">{doc.nombre}</a>
                                  {doc.estado === ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO && (
                                    <Badge className={`pointer-events-none shrink-0 text-[9px] ${BADGE_STYLES.WARNING}`} title={doc.motivoObservacion ?? undefined}><span>{documentoEstadoLabels[ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO]}</span></Badge>
                                  )}
                                  {doc.estado === ESTADOS_DOCUMENTO_SOLICITUD.REEMPLAZADO && (
                                    <Badge className={`pointer-events-none shrink-0 text-[9px] ${BADGE_STYLES.NEUTRAL}`}><span>{documentoEstadoLabels[ESTADOS_DOCUMENTO_SOLICITUD.REEMPLAZADO]}</span></Badge>
                                  )}
                                  <span className="text-[10px] text-muted-foreground shrink-0">{dateUtils.formatDateTime(doc.createdAt)}</span>
                                  <a href={doc.url} target="_blank" className="text-muted-foreground hover:text-foreground shrink-0">
                                    <Eye className="h-3 w-3" />
                                  </a>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </DetailSection>
              ) : null}

              {/* Re-evaluacion */}
              {detailRow.reevaluaciones && detailRow.reevaluaciones.length > 0 && (
                <DetailSection id="reevaluacion" title={`Re-evaluacion (${detailRow.reevaluaciones.length})`} open={accordionOpen === "reevaluacion"} onToggle={(id) => setAccordionOpen(accordionOpen === id ? null : id)}>
                  <div className="space-y-2">
                    {detailRow.reevaluaciones.map((reev, i) => {
                      const docs = (reev.documentos as string[]) ?? [];
                      return (
                      <div key={i} className={`rounded px-3 py-2 text-xs ${
                        reev.estado === ESTADOS_REEVALUACION.APROBADO ? "bg-success/10 border border-success/30"
                        : reev.estado === ESTADOS_REEVALUACION.RECHAZADO ? "bg-destructive/10 border border-destructive/30"
                        : "bg-warning/10 border border-warning/30"
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">Solicitud de re-evaluacion</span>
                          <Badge className={`text-[10px] pointer-events-none ${
                            reev.estado === ESTADOS_REEVALUACION.APROBADO ? BADGE_STYLES.SUCCESS
                            : reev.estado === ESTADOS_REEVALUACION.RECHAZADO ? BADGE_STYLES.DESTRUCTIVE
                            : BADGE_STYLES.WARNING
                          }`}>
                            {reev.estado === ESTADOS_REEVALUACION.APROBADO ? "Aprobada"
                              : reev.estado === ESTADOS_REEVALUACION.RECHAZADO ? "Rechazada"
                              : "Pendiente"}
                          </Badge>
                        </div>
                        {reev.motivo && (
                          <p className="text-[11px] text-muted-foreground italic mb-1">&quot;{reev.motivo}&quot;</p>
                        )}
                        {docs.length > 0 && (
                          <div className="space-y-0.5 mt-1">
                            {docs.map((url, j) => (
                              <a key={j} href={url} target="_blank" className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs text-primary hover:bg-primary/5 transition-colors">
                                <FileText className="h-3 w-3 shrink-0" />
                                <span className="truncate flex-1">{url.split("/").pop() ?? url}</span>
                                <Eye className="h-3 w-3 opacity-50 shrink-0" />
                              </a>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                          <span>{dateUtils.formatDateTime(reev.createdAt)}</span>
                          {reev.createdBy && <span>{reev.createdBy}</span>}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </DetailSection>
              )}

              {/* Estado de revision */}
              <DetailSection id="revision" title="Estado de revision" open={accordionOpen === "revision"} onToggle={(id) => setAccordionOpen(accordionOpen === id ? null : id)}>
                <div className="space-y-1.5">
                  {areasRevisionLocal(detailRow.revisiones, { sgcEnabled: detailRow.sgcEnabled }).map((area) => {
                    const rev = detailRow.revisiones.find((r) => r.area === area);
                    const estado = rev?.estado ?? RESULTADOS_APROBACION.PENDIENTE;
                    return (
                      <div key={area} className="flex items-center justify-between rounded bg-muted/30 px-2 py-1 text-xs">
                        <span className="font-medium">{REVISION_AREA_LABELS[area]}</span>
                        <Badge className={`text-[10px] pointer-events-none ${estado === RESULTADOS_APROBACION.APROBADO ? BADGE_STYLES.SUCCESS : estado === RESULTADOS_APROBACION.RECHAZADO ? BADGE_STYLES.DESTRUCTIVE : estado === RESULTADOS_APROBACION.OBSERVADO ? BADGE_STYLES.WARNING : BADGE_STYLES.WARNING}`} title={estado === RESULTADOS_APROBACION.OBSERVADO ? (rev?.comentario ?? undefined) : undefined}>
                          {estado === RESULTADOS_APROBACION.APROBADO ? "Aprobado" : estado === RESULTADOS_APROBACION.RECHAZADO ? "Rechazado" : estado === RESULTADOS_APROBACION.OBSERVADO ? "Observado" : "Pendiente"}
                        </Badge>
                      </div>
                    );
                  })}
                  {detailRow.sgcEnabled && legalDelegadaAlSgc(detailRow.revisiones) && (
                    <div className="flex items-center justify-between rounded bg-muted/30 px-2 py-1 text-xs">
                      <span className="font-medium">{REVISION_AREA_SGC_LABEL}</span>
                      <Badge className={`text-[10px] pointer-events-none ${BADGE_STYLES.INFO}`}>
                        <span>Delegado al SGC</span>
                      </Badge>
                    </div>
                  )}
                </div>
              </DetailSection>

              {/* Expediente SGC */}
              <DetailSection id="sgc" title="Expediente SGC" open={accordionOpen === "sgc"} onToggle={(id) => setAccordionOpen(accordionOpen === id ? null : id)}>
                <SgcExpedientePanel
                  solicitudId={detailRow.id}
                  tieneContratoAdmin={detailRow.docsAdjuntos.some((d) => d.userId === null)}
                  tieneContratoFirmado={detailRow.docsAdjuntos.some(
                    (d) => d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
                  )}
                  tieneAnexos={
                    detailRow.docsAdjuntos.some(
                      (d) => d.userId !== null && d.categoria !== TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
                    ) || (detailRow.documentos as string[]).length > 0
                  }
                  requisitosFaltantes={anexosBloqueantesFaltantes(detailRow.docsAdjuntos)}
                  motivo={detailRow.sgcSubsanacionMotivo}
                />
              </DetailSection>
            </>
          )}
          </div>
          {/* Footer */}
          {hasViewPerm &&
            detailRow &&
            !estaPendientePago(detailRow) &&
            (!detailRow.ddEstado?.requiereDeclaracionVigencia ||
              userPermissions.includes(PERMISSIONS.ADMIN_FULL)) && (
            <div className="shrink-0 border-t border-border px-5 py-3 flex justify-end">
              <Button size="sm" variant="default" className="rounded-full px-4 text-xs font-semibold" onClick={() => {
                setDetailOpen(false);
                setReviewRow(detailRow);
                setReviewOpen(true);
              }}>
                Ir a revision
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col !px-0 !py-0 overflow-hidden">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">Cargando solicitud...</p>
            </div>
          ) : reviewRow ? (
            <SolicitudReview
              key={reviewRow.id}
              row={reviewRow}
              userPermissions={userPermissions}
              onSaved={handleReviewSaved}
              onClose={() => setReviewOpen(false)}
              onOrdenPago={handleOrdenPago}
            />
          ) : (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">No se pudo cargar la solicitud.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Notificar dialog */}
      <Dialog open={notificarOpen} onOpenChange={setNotificarOpen}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] flex flex-col !px-0 !py-0 overflow-hidden">
          {notificarRow && (
            <NotificarModal
              standCode={notificarRow.standCode}
              empresa={notificarRow.empresa ?? "â€”"}
              tipoStand={notificarRow.tipoStand}
              email={notificarRow.email ?? ""}
              revisiones={notificarRow.revisiones}
              onSend={handleNotificar}
              onClose={() => { setNotificarOpen(false); setNotificarRow(null); }}
              sending={notificarSending}
              error={notificarError}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Re-evaluacion dialog */}
      <Dialog open={reevaluacionOpen} onOpenChange={setReevaluacionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle><span>Solicitud de re-evaluacion</span></DialogTitle>
          </DialogHeader>
          {reevaluacionRow && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border bg-muted/20 p-3 text-xs">
                <div><span className="text-muted-foreground">Stand:</span> <span className="font-mono font-medium">{reevaluacionRow.standCode}</span></div>
                {reevaluacionRow.empresa && <div><span className="text-muted-foreground">Empresa:</span> <span>{reevaluacionRow.empresa}</span></div>}
                <div><span className="text-muted-foreground">Estado:</span> <Badge className={`text-[10px] pointer-events-none ${BADGE_STYLES.DESTRUCTIVE}`}>Rechazado</Badge></div>
              </div>
              {(() => {
                const reev = reevaluacionRow.reevaluaciones?.find((r: { estado: string }) => r.estado === ESTADOS_REEVALUACION.PENDIENTE);
                if (!reev) return null;
                return (
                  <>
                    {reev.motivo && (
                      <div className="rounded-lg border bg-warning/10 p-3">
                        <p className="text-[10px] font-semibold text-warning mb-1">Justificacion del cliente:</p>
                        <p className="text-xs text-foreground italic">&quot;{reev.motivo}&quot;</p>
                      </div>
                    )}
                    {reev.documentos && Array.isArray(reev.documentos) && (reev.documentos as string[]).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Documentos adjuntos:</p>
                        <div className="space-y-0.5">
                          {(reev.documentos as string[]).map((url: string, i: number) => (
                            <a key={i} href={url} target="_blank" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                              <FileText className="h-3 w-3" /> {url.split("/").pop()}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {reev.createdBy && (
                      <p className="text-[11px] text-muted-foreground">Enviada por: {reev.createdBy}</p>
                    )}
                  </>
                );
              })()}
              <div className="flex gap-2">
                <Button variant="default" size="sm" className="flex-1 rounded-full text-xs bg-primary hover:bg-primary/90"
                  onClick={() => handleAtenderReevaluacion("aprobar")}>
                  <span>Aprobar</span>
                </Button>
                <Button variant="destructive" size="sm" className="flex-1 rounded-full text-xs"
                  onClick={() => handleAtenderReevaluacion("rechazar")}>
                  <span>Rechazar</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm rechazar re-evaluacion */}
      <Dialog open={reevaluacionAction === "rechazar"} onOpenChange={() => setReevaluacionAction(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle><span>Confirmar rechazo</span></DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Al rechazar, la solicitud se eliminara y el stand volvera a estar disponible.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1 rounded-full text-xs" onClick={() => setReevaluacionAction(null)}>
              <span>Cancelar</span>
            </Button>
            <Button variant="destructive" size="sm" className="flex-1 rounded-full text-xs"
              onClick={confirmRechazarReevaluacion}>
              <span>Si, rechazar</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dar de baja confirm */}
      <Dialog open={bajaOpen} onOpenChange={setBajaOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle><span>Dar de baja solicitud</span></DialogTitle>
          </DialogHeader>
          {bajaRow && (
            <div className="space-y-3 text-sm">
              <div className="text-xs text-muted-foreground">
                La solicitud del stand <strong className="font-mono">{bajaRow.standCode}</strong> esta en estado <Badge className={`text-[10px] pointer-events-none ${BADGE_STYLES.DESTRUCTIVE}`}>Rechazado</Badge>.
              </div>
              <p className="text-xs text-muted-foreground">Al darla de baja, se eliminara logicamente y el stand volvera a estar disponible.</p>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1 rounded-full text-xs" onClick={() => setBajaOpen(false)}>
                  <span>Cancelar</span>
                </Button>
                <Button variant="destructive" size="sm" className="flex-1 rounded-full text-xs" onClick={confirmDarDeBaja}>
                  <span>Si, dar de baja</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Historial dialog */}
      <Dialog open={historialOpen} onOpenChange={setHistorialOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col !px-0 !py-0 overflow-hidden">
          {historialStandId && <HistorialModal solicitudId={historialStandId} />}
        </DialogContent>
      </Dialog>

      {imgCarousel && (
        <Dialog open={true} onOpenChange={() => setImgCarousel(null)}>
          <DialogContent className="sm:max-w-2xl bg-black/90 border-slate-700">
            <Button type="button" variant="ghost" size="icon"
              className="absolute left-2 top-1/2 z-10 h-auto w-auto -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 hover:text-white"
              onClick={() => setImgCarousel((prev) => prev ? { ...prev, idx: Math.max(0, prev.idx - 1) } : null)}
              disabled={imgCarousel.idx === 0}
            >
              <span className="text-lg">â€¹</span>
            </Button>
            <Image width={1200} height={800} src={imgCarousel.images[imgCarousel.idx] ?? ""} alt={`Imagen ${imgCarousel.idx + 1}`} className="max-h-[70vh] w-full object-contain" />
            <Button type="button" variant="ghost" size="icon"
              className="absolute right-2 top-1/2 z-10 h-auto w-auto -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 hover:text-white"
              onClick={() => setImgCarousel((prev) => prev ? { ...prev, idx: Math.min(prev.images.length - 1, prev.idx + 1) } : null)}
              disabled={imgCarousel.idx === imgCarousel.images.length - 1}
            >
              <span className="text-lg">â€º</span>
            </Button>
            <p className="text-center text-xs text-white/60">{imgCarousel.idx + 1} / {imgCarousel.images.length}</p>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export function SolicitudesManager({ eventoId }: { eventoId: string }) {
  return (
    <Suspense fallback={null}>
      <SolicitudesManagerContent eventoId={eventoId} />
    </Suspense>
  );
}
