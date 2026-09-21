"use client";

import Image from "next/image";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle } from "@nrivera-iimp/ui-kit-iimp";
import { Search, Eye, FileText, CheckCircle2, Clock, XCircle, RefreshCw, Send, AlertTriangle, History, Trash2, Upload, ChevronDown, ClipboardCheck, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/shared/pagination";
import { authService } from "@/lib/client/api/services/auth-service";
import { maestraService } from "@/lib/client/api/services/maestra-service";
import { MAESTRA_TABLAS, ESTADOS_SOLICITUD, RESULTADOS_APROBACION, REVISION_AREA_LABELS, REVISION_AREA_SGC_LABEL, ESTADOS_REEVALUACION, ESTADOS_SOLICITUD_MAESTRA_ID, BADGE_STYLES, PERMISSIONS } from "@/lib/shared/constants";
import { areasRevisionLocal, legalDelegadaAlSgc } from "@/lib/shared/utils/revision-areas";
import { solicitudesService } from "@/lib/client/api/services/solicitudes-service";
import type { SolicitudDTO } from "@/types/dto/solicitudes/solicitudes-response.dto";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { SolicitudReview } from "./solicitud-review";
import { NotificarModal } from "./notificar-modal";
import { HistorialModal } from "./historial-modal";
import { SgcExpedientePanel } from "@/components/sgc/sgc-expediente-panel";
import { Tooltip, TooltipTrigger, TooltipContent } from "@nrivera-iimp/ui-kit-iimp";
import { useSearchParams } from "next/navigation";
import { dateUtils } from "@/lib/shared/utils/date";
import { useAlertaNavigate } from "@/hooks/use-alerta-navigate";

type SolicitudRow = SolicitudDTO;

function esMultiStand(row: SolicitudRow) { return (row.standCodes?.length ?? 0) > 1; }
function estaPendiente(row: SolicitudRow) { return row.estadoSolicitud === ESTADOS_SOLICITUD.PENDIENTE; }
function estaPendientePago(row: SolicitudRow) { return row.estadoSolicitud === ESTADOS_SOLICITUD.PENDIENTE_PAGO; }
function estaRechazada(row: SolicitudRow) { return row.estadoSolicitud === ESTADOS_SOLICITUD.RECHAZADO; }
function tieneDocsAdmin(row: SolicitudRow) { return ((row.docsAdjuntosCount ?? 0) - (row.clienteDocsAdjuntosCount ?? 0)) > 0; }
function tieneDocsCliente(row: SolicitudRow) { return (row.clienteDocsAdjuntosCount ?? 0) > 0 || ((row.documentos as string[])?.length ?? 0) > 0; }
function necesitaDocs(row: SolicitudRow) { return esMultiStand(row) && (!tieneDocsAdmin(row) || !tieneDocsCliente(row)); }
function puedeRevisar(row: SolicitudRow) { return !estaPendientePago(row) && !necesitaDocs(row); }
function adminDebeSubirContrato(row: SolicitudRow) { return esMultiStand(row) && estaPendiente(row) && !tieneDocsAdmin(row); }
function tieneReevaluacionPendiente(row: SolicitudRow) { return row.reevaluaciones?.some((r) => r.estado === ESTADOS_REEVALUACION.PENDIENTE) ?? false; }

function DetailSection({ id, title, open, onToggle, children }: { id: string; title: string; open: boolean; onToggle: (id: string) => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden transition-shadow duration-200 hover:shadow-sm">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50/80 transition-colors tracking-tight"
        onClick={() => onToggle(id)}
      >
        <span>{title}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
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
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
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
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadRow, setUploadRow] = useState<SolicitudRow | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bajaRow, setBajaRow] = useState<SolicitudRow | null>(null);
  const [bajaOpen, setBajaOpen] = useState(false);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [hasViewPerm, setHasViewPerm] = useState(false);
  const [solicitudEstadoLabels, setSolicitudEstadoLabels] = useState<Record<string, string>>({});
  const [imgCarousel, setImgCarousel] = useState<{ images: string[]; idx: number } | null>(null);

  const pageRef = useRef(page);
  const perPageRef = useRef(perPage);
  const reviewOpenRef = useRef(reviewOpen);
  const autoOpenIdRef = useRef(autoOpenId);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { perPageRef.current = perPage; }, [perPage]);
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
      setUserPermissions(session.permissions ?? []);
      setHasViewPerm((session.permissions ?? []).includes(PERMISSIONS.SOLICITUDES_VIEW));
    })();
  }, []);

  const load = useCallback(async (p?: number, s?: string, pp?: number) => {
    setLoading(true);
    try {
      const data = await solicitudesService.listar(eventoId, p ?? pageRef.current, pp ?? perPageRef.current, s);
      setRows(data.data?.filter((r) => r.flgActivo !== false) ?? []);
      setPagination({ page: data.page, total: data.total, totalPages: data.totalPages });

      if (autoOpenIdRef.current && !reviewOpenRef.current) {
        const found = data.data?.find((r) => r.id === autoOpenIdRef.current);
        if (found) { setReviewRow(found); setReviewOpen(true); }
        // Clean URL to avoid re-opening on reload
        const next = new URL(window.location.href);
        next.searchParams.delete("id");
        window.history.replaceState({}, "", next.toString());
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [eventoId]);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

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

  const handleUploadDoc = async (file: File) => {
    if (!uploadRow) return;
    setUploading(true);
    try {
      const url = await solicitudesService.subirArchivo(file);
      await solicitudesService.uploadDocumento({
        solicitudId: uploadRow.id,
        url,
        nombre: file.name,
      });
      toast.success("Documento subido correctamente");
      setUploadOpen(false);
      load(page, search, perPage);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir");
    }
    setUploading(false);
  };

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Solicitudes de alquiler ({pagination.total})</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => load(page, search, perPage)} disabled={loading}>
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent><span>Recargar</span></TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); load(1, e.currentTarget.value, perPage); } }}
                className="pl-8 text-xs h-8" />
            </div>
            <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); load(1, search, Number(v)); }}>
              <SelectTrigger className="w-[70px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 15, 50].map((n) => (
                  <SelectItem key={n} value={String(n)}><span>{n}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <TableSkeleton rows={perPage} columns={7} />
          ) : rows.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No hay solicitudes de alquiler pendientes.</p>
              <p className="text-xs text-muted-foreground mt-1">Cuando un expositor solicite una reserva, aparecera aqui para su revision.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><span>Stand</span></TableHead>
                      <TableHead className="hidden sm:table-cell"><span>Empresa</span></TableHead>
                      <TableHead className="hidden md:table-cell"><span>Tipo</span></TableHead>
                      <TableHead><span>Revision</span></TableHead>
                      <TableHead className="hidden sm:table-cell"><span>Docs</span></TableHead>
                      <TableHead className="hidden md:table-cell"><span>Fecha</span></TableHead>
                      <TableHead className="text-right"><span>Accion</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono text-xs font-medium">
                            {row.standCodes?.length > 1 ? `${row.standCodes.length} stands` : row.standCode}
                            {row.bloqueId && <span className="block text-[10px] text-muted-foreground font-normal">{row.bloqueId}</span>}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell max-w-[140px] truncate text-xs text-muted-foreground" title={row.empresa ?? ""}>
                            {row.empresa ?? "—"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs">{row.tipoStand ?? "—"}</TableCell>
                          <TableCell>
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
                          <TableCell className="hidden sm:table-cell text-xs">
                            {esMultiStand(row) ? `${row.docsAdjuntosCount ?? 0} doc(s)` : `${(row.documentos as string[])?.length ?? 0} doc(s)`}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                            {dateUtils.formatDateTime(row.updatedAt)}
                          </TableCell>
                          <TableCell className="text-right">
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
                              {hasViewPerm && puedeRevisar(row) && (
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
                              {adminDebeSubirContrato(row) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                      onClick={() => { setUploadRow(row); setUploadOpen(true); }}>
                                      <Upload className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top"><span>Subir contrato</span></TooltipContent>
                                </Tooltip>
                              )}
                              {estaRechazada(row) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
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
                                    <Button variant="default" size="sm" className="h-7 w-7 p-0 bg-amber-500 hover:bg-amber-600"
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
                                    <Button variant="default" size="sm" className="h-7 w-7 p-0 bg-indigo-500 hover:bg-indigo-600"
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
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">
                  {pagination.total} resultados — pagina {pagination.page} de {pagination.totalPages || 1}
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
          <div className="shrink-0 px-5 pt-4 pb-2 border-b border-slate-100 !pr-12">
            <h3 className="text-sm font-semibold text-slate-800">Detalle de solicitud</h3>
          </div>
          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-2">
          {detailRow && (
            <>
              {/* Info general — siempre visible */}
              <DetailSection id="info" title="Informacion general" open={accordionOpen === "info"} onToggle={(id) => setAccordionOpen(accordionOpen === id ? null : id)}>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Stand:</span> <span className="font-mono font-medium">{detailRow.standCode}</span>{detailRow.standCodes?.length > 1 && <span className="text-[10px] text-slate-400 ml-1">({detailRow.standCodes.length} stands: {detailRow.standCodes.join(", ")})</span>}</div>
                  <div><span className="text-muted-foreground">Bloque:</span> <span className="font-mono">{detailRow.bloqueId ?? "—"}</span></div>
                  <div><span className="text-muted-foreground">Tipo:</span> <span>{detailRow.tipoStand ?? "—"}</span></div>
                  <div><span className="text-muted-foreground">Precio:</span> <span>{detailRow.medidas ?? "—"}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Empresa:</span> <span>{detailRow.empresa ?? "—"}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Estado:</span>{" "}
                    <Badge className={`text-[10px] ${
                      detailRow.estadoSolicitud === ESTADOS_SOLICITUD.APROBADO ? BADGE_STYLES.SUCCESS
                      : detailRow.estadoSolicitud === ESTADOS_SOLICITUD.RECHAZADO ? BADGE_STYLES.DESTRUCTIVE
                      : detailRow.estadoSolicitud === ESTADOS_SOLICITUD.EN_PROCESO ? BADGE_STYLES.INFO
                      : detailRow.estadoSolicitud === ESTADOS_SOLICITUD.PENDIENTE_PAGO ? BADGE_STYLES.INDIGO
                      : BADGE_STYLES.WARNING
                    }`}>
                      {solicitudEstadoLabels[detailRow.estadoSolicitud] ?? detailRow.estadoSolicitud}
                    </Badge>
                  </div>
                  <div className="col-span-2"><span className="text-muted-foreground">Fecha solicitud:</span> <span>{dateUtils.formatDateTime(detailRow.updatedAt)}</span></div>
                </div>
              </DetailSection>

              {/* Imagenes */}
              {detailRow.imagenes.length > 0 && (
                <DetailSection id="imagenes" title={`Imagenes (${detailRow.imagenes.length})`} open={accordionOpen === "imagenes"} onToggle={(id) => setAccordionOpen(accordionOpen === id ? null : id)}>
                  <div className="flex gap-1.5">
                    {detailRow.imagenes.slice(0, 4).map((url: string, i: number) => (
                      <button key={i}
                        className="h-14 w-14 overflow-hidden rounded border hover:opacity-80 transition-opacity"
                        onClick={() => setImgCarousel({ images: detailRow.imagenes as string[], idx: i })}>
                        <Image width={64} height={64} src={url} alt={`Imagen ${i + 1}`} className="h-full w-full object-cover" />
                      </button>
                    ))}
                    {detailRow.imagenes.length > 4 && (
                      <span className="flex h-14 w-14 items-center justify-center rounded border bg-muted text-xs text-muted-foreground">
                        +{detailRow.imagenes.length - 4}
                      </span>
                    )}
                  </div>
                </DetailSection>
              )}

              {/* Documentos */}
              {((!detailRow.standCodes || detailRow.standCodes.length <= 1) && (detailRow.documentos as string[]).length > 0) || (detailRow.standCodes && detailRow.standCodes.length > 1 && detailRow.docsAdjuntos && detailRow.docsAdjuntos.length > 0) ? (
                <DetailSection id="docs" title={`Documentos (${detailRow.standCodes?.length > 1 ? (detailRow.docsAdjuntosCount ?? 0) : (detailRow.documentos as string[]).length})`} open={accordionOpen === "docs"} onToggle={(id) => setAccordionOpen(accordionOpen === id ? null : id)}>
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
                  {/* Multi-stand */}
                  {detailRow.standCodes && detailRow.standCodes.length > 1 && detailRow.docsAdjuntos && detailRow.docsAdjuntos.length > 0 && (() => {
                    const adminDocs = detailRow.docsAdjuntos.filter(doc => doc.userId !== detailRow.userId);
                    const clienteDocs = detailRow.docsAdjuntos.filter(doc => doc.userId === detailRow.userId);
                    return (
                      <div className="space-y-2">
                        {adminDocs.length > 0 && (
                          <div>
                            <p className="mb-1.5 text-[11px] font-medium text-slate-400 uppercase tracking-wider">Administrador ({adminDocs.length})</p>
                            <div className="space-y-0.5 rounded-md border border-blue-200 bg-blue-50/50 p-2">
                              {adminDocs.map((doc, i) => (
                                <div key={i} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs">
                                  <FileText className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                                  <a href={doc.url} target="_blank" className="text-blue-700 hover:text-blue-900 transition-colors truncate flex-1 font-medium">{doc.nombre}</a>
                                  <span className="text-[10px] text-slate-400 shrink-0">{dateUtils.formatDateTime(doc.createdAt)}</span>
                                  <a href={doc.url} target="_blank" className="text-slate-400 hover:text-slate-600 shrink-0">
                                    <Eye className="h-3 w-3" />
                                  </a>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {clienteDocs.length > 0 && (
                          <div>
                            <p className="mb-1.5 text-[11px] font-medium text-slate-400 uppercase tracking-wider">Cliente ({clienteDocs.length})</p>
                            <div className="space-y-0.5 rounded-md border border-green-200 bg-green-50/50 p-2">
                              {clienteDocs.map((doc, i) => (
                                <div key={i} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs">
                                  <FileText className="h-3.5 w-3.5 shrink-0 text-green-600" />
                                  <a href={doc.url} target="_blank" className="text-green-700 hover:text-green-900 transition-colors truncate flex-1 font-medium">{doc.nombre}</a>
                                  <span className="text-[10px] text-slate-400 shrink-0">{dateUtils.formatDateTime(doc.createdAt)}</span>
                                  <a href={doc.url} target="_blank" className="text-slate-400 hover:text-slate-600 shrink-0">
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

              {/* Pendiente: admin debe subir contrato */}
              {detailRow.standCodes && detailRow.standCodes.length > 1 && estaPendiente(detailRow) && !tieneDocsAdmin(detailRow) && (
                <DetailSection id="accion" title="Accion requerida" open={accordionOpen === "accion"} onToggle={(id) => setAccordionOpen(accordionOpen === id ? null : id)}>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                    <Clock className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                    <p className="text-xs font-semibold text-amber-700">Pendiente: Subir Contrato</p>
                    <p className="text-[11px] text-amber-600 mt-0.5">Debes subir el contrato como administrador para que el cliente pueda adjuntar sus documentos y continuar con el proceso.</p>
                  </div>
                </DetailSection>
              )}

              {/* Re-evaluacion */}
              {detailRow.reevaluaciones && detailRow.reevaluaciones.length > 0 && (
                <DetailSection id="reevaluacion" title={`Re-evaluacion (${detailRow.reevaluaciones.length})`} open={accordionOpen === "reevaluacion"} onToggle={(id) => setAccordionOpen(accordionOpen === id ? null : id)}>
                  <div className="space-y-2">
                    {detailRow.reevaluaciones.map((reev, i) => {
                      const docs = (reev.documentos as string[]) ?? [];
                      return (
                      <div key={i} className={`rounded px-3 py-2 text-xs ${
                        reev.estado === ESTADOS_REEVALUACION.APROBADO ? "bg-green-50 border border-green-200"
                        : reev.estado === ESTADOS_REEVALUACION.RECHAZADO ? "bg-red-50 border border-red-200"
                        : "bg-amber-50 border border-amber-200"
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
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
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
                  {areasRevisionLocal(detailRow.revisiones).map((area) => {
                    const rev = detailRow.revisiones.find((r) => r.area === area);
                    const estado = rev?.estado ?? RESULTADOS_APROBACION.PENDIENTE;
                    return (
                      <div key={area} className="flex items-center justify-between rounded bg-muted/30 px-2 py-1 text-xs">
                        <span className="font-medium">{REVISION_AREA_LABELS[area]}</span>
                        <Badge className={`text-[10px] pointer-events-none ${estado === RESULTADOS_APROBACION.APROBADO ? BADGE_STYLES.SUCCESS : estado === RESULTADOS_APROBACION.RECHAZADO ? BADGE_STYLES.DESTRUCTIVE : BADGE_STYLES.WARNING}`}>
                          {estado === RESULTADOS_APROBACION.APROBADO ? "Aprobado" : estado === RESULTADOS_APROBACION.RECHAZADO ? "Rechazado" : "Pendiente"}
                        </Badge>
                      </div>
                    );
                  })}
                  {legalDelegadaAlSgc(detailRow.revisiones) && (
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
                <SgcExpedientePanel solicitudId={detailRow.id} />
              </DetailSection>
            </>
          )}
          </div>
          {/* Footer */}
          {hasViewPerm && detailRow && !estaPendientePago(detailRow) && !necesitaDocs(detailRow) && (
            <div className="shrink-0 border-t border-slate-100 px-5 py-3 flex justify-end">
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
        <DialogContent className="sm:max-w-xl max-h-[92vh] flex flex-col !px-0 !py-0 overflow-hidden">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">Cargando solicitud...</p>
            </div>
          ) : reviewRow ? (
            <SolicitudReview
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
              empresa={notificarRow.empresa ?? "—"}
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
                      <div className="rounded-lg border bg-amber-50 p-3">
                        <p className="text-[10px] font-semibold text-amber-700 mb-1">Justificacion del cliente:</p>
                        <p className="text-xs text-slate-700 italic">&quot;{reev.motivo}&quot;</p>
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
                      <p className="text-[11px] text-slate-400">Enviada por: {reev.createdBy}</p>
                    )}
                  </>
                );
              })()}
              <div className="flex gap-2">
                <Button variant="default" size="sm" className="flex-1 rounded-full text-xs bg-emerald-600 hover:bg-emerald-700"
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
          <p className="text-sm text-slate-600">Al rechazar, la solicitud se eliminara y el stand volvera a estar disponible.</p>
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
              <div className="text-xs text-slate-600">
                La solicitud del stand <strong className="font-mono">{bajaRow.standCode}</strong> esta en estado <Badge className={`text-[10px] pointer-events-none ${BADGE_STYLES.DESTRUCTIVE}`}>Rechazado</Badge>.
              </div>
              <p className="text-xs text-slate-500">Al darla de baja, se eliminara logicamente y el stand volvera a estar disponible.</p>
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

      {/* Upload contrato dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle><span>Subir contrato</span></DialogTitle>
          </DialogHeader>
          {uploadRow && (
            <div className="space-y-3 text-sm">
              <p className="text-xs text-slate-600">
                Solicitud multiple: <strong className="font-mono">{uploadRow.standCodes?.join(", ")}</strong>
              </p>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 p-6 hover:border-primary hover:bg-primary/5 transition-colors">
                <Upload className="h-6 w-6 text-slate-400" />
                <span className="text-xs text-slate-500">{uploading ? "Subiendo..." : "Click para seleccionar archivo"}</span>
                <span className="text-[10px] text-slate-400">PDF, DOC, DOCX — max 10 MB</span>
                <input type="file" className="hidden" accept=".pdf,.doc,.docx" disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadDoc(file);
                    e.target.value = "";
                  }} />
              </label>
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
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 z-10"
              onClick={() => setImgCarousel((prev) => prev ? { ...prev, idx: Math.max(0, prev.idx - 1) } : null)}
              disabled={imgCarousel.idx === 0}
            >
              <span className="text-lg">‹</span>
            </button>
            <Image width={1200} height={800} src={imgCarousel.images[imgCarousel.idx] ?? ""} alt={`Imagen ${imgCarousel.idx + 1}`} className="max-h-[70vh] w-full object-contain" />
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 z-10"
              onClick={() => setImgCarousel((prev) => prev ? { ...prev, idx: Math.min(prev.images.length - 1, prev.idx + 1) } : null)}
              disabled={imgCarousel.idx === imgCarousel.images.length - 1}
            >
              <span className="text-lg">›</span>
            </button>
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
