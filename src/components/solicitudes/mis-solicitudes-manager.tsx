"use client";

import Image from "next/image";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, Badge, Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, ToggleGroup, ToggleGroupItem } from "@nrivera-iimp/ui-kit-iimp";
import { Search, Eye, FileText, CheckCircle2, Clock, XCircle, RefreshCw, RotateCcw, Upload, Trash2, ChevronRight, CreditCard, CalendarDays, Paperclip, LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Pagination } from "@/components/shared/pagination";
import { useSearchParams } from "next/navigation";
import { solicitudesService } from "@/lib/client/api/services/solicitudes-service";
import { dateUtils } from "@/lib/shared/utils/date";
import { stringUtils } from "@/lib/shared/utils/string";
import { useAlertaNavigate } from "@/hooks/use-alerta-navigate";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { ModificarSolicitudModal } from "./modificar-solicitud-modal";
import { ClienteUploadModal } from "./cliente-upload-modal";
import { RESULTADOS_APROBACION, REVISION_AREA_LABELS, REVISION_AREA_SGC_LABEL, ESTADOS_SOLICITUD, ESTADOS_REEVALUACION, BADGE_STYLES } from "@/lib/shared/constants";
import { areasRevisionLocal, legalDelegadaAlSgc } from "@/lib/shared/utils/revision-areas";
import { enVentanaContratoMultistand, enVentanaLegalSgc, requiereDocsReevaluacion } from "@/lib/shared/utils/solicitud-documentos";
import { sgcAprobado } from "@/lib/shared/utils/sgc-estado";
import type { SolicitudDTO } from "@/types/dto/solicitudes/solicitudes-response.dto";

type SolicitudRow = SolicitudDTO;

function esMultiStand(row: SolicitudRow) { return (row.standCodes?.length ?? 0) > 1; }
function puedeAdjuntarDocumentos(row: SolicitudRow) { return enVentanaContratoMultistand(row) || enVentanaLegalSgc(row); }
function estaRechazada(row: SolicitudRow) { return row.estadoSolicitud === ESTADOS_SOLICITUD.RECHAZADO; }
function tieneReevaluacionPendiente(row: SolicitudRow) { return row.reevaluaciones?.some((r) => r.estado === ESTADOS_REEVALUACION.PENDIENTE) ?? false; }
function estaDadaDeBaja(row: SolicitudRow) { return row.flgActivo === false; }
function puedePagarNiubizz(row: SolicitudRow) {
  return row.estadoSolicitud === ESTADOS_SOLICITUD.PENDIENTE_PAGO && row.tipoFacturacion === "niubizz";
}
function puedeSolicitarReevaluacion(row: SolicitudRow) {
  if (estaDadaDeBaja(row) || !estaRechazada(row) || tieneReevaluacionPendiente(row)) return false;
  if (esMultiStand(row) && (row.clienteDocsAdjuntosCount ?? 0) === 0) return false;
  return true;
}
function faltanDocumentosMultiStand(row: SolicitudRow) { return requiereDocsReevaluacion(row); }

/** Seccion del detalle: separador superior + encabezado uniforme y contenido. */
function ModalSection({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</h4>
        {meta && <span className="text-[11px] text-muted-foreground">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

/** Punto de la linea de tiempo de revision segun estado. */
function revisionDotClass(estado: string): string {
  if (estado === RESULTADOS_APROBACION.APROBADO) return "bg-success";
  if (estado === RESULTADOS_APROBACION.RECHAZADO) return "bg-destructive";
  return "border border-dashed border-muted-foreground/60 bg-background";
}

/** Etiqueta legible del estado de una revision por area. */
function etiquetaEstadoArea(estado: string): string {
  if (estado === RESULTADOS_APROBACION.APROBADO) return "Aprobado";
  if (estado === RESULTADOS_APROBACION.RECHAZADO) return "Rechazado";
  return "Pendiente";
}

/** Item del timeline para el paso "Legal (SGC)" segun el estado del expediente SGC. */
function estadoSgcItem(row: SolicitudRow): { key: string; label: string; estado: string; etiqueta: string; badge: string; comentario: string | null } {
  if (sgcAprobado(row.sgcLifecycleStatus)) {
    return { key: "sgc", label: REVISION_AREA_SGC_LABEL, estado: RESULTADOS_APROBACION.APROBADO, etiqueta: "Aprobado", badge: BADGE_STYLES.SUCCESS, comentario: null };
  }
  return {
    key: "sgc",
    label: REVISION_AREA_SGC_LABEL,
    estado: RESULTADOS_APROBACION.PENDIENTE,
    etiqueta: row.sgcEstadoEnvio ? "En revision (SGC)" : "Delegado al SGC",
    badge: BADGE_STYLES.INFO,
    comentario: null,
  };
}

/** Badge del estado de la solicitud (mismo criterio que la tabla original). */
function EstadoSolicitudBadge({ estado }: { estado: string | null }) {
  if (estado === ESTADOS_SOLICITUD.APROBADO) {
    return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.SUCCESS}`}><CheckCircle2 className="mr-0.5 h-2.5 w-2.5" /><span>Aprobado</span></Badge>;
  }
  if (estado === ESTADOS_SOLICITUD.RECHAZADO) {
    return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.DESTRUCTIVE}`}><XCircle className="mr-0.5 h-2.5 w-2.5" /><span>Rechazado</span></Badge>;
  }
  if (estado === ESTADOS_SOLICITUD.EN_PROCESO) {
    return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.INFO}`}><Clock className="mr-0.5 h-2.5 w-2.5" /><span>En proceso</span></Badge>;
  }
  if (estado === ESTADOS_SOLICITUD.PENDIENTE_PAGO) {
    return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.INDIGO}`}><Clock className="mr-0.5 h-2.5 w-2.5" /><span>Pendiente Pago</span></Badge>;
  }
  return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.WARNING}`}><Clock className="mr-0.5 h-2.5 w-2.5" /><span>Pendiente</span></Badge>;
}

/** Clases del badge de una revision por area. */
function claseEstadoArea(estado: string): string {
  if (estado === RESULTADOS_APROBACION.APROBADO) return BADGE_STYLES.SUCCESS;
  if (estado === RESULTADOS_APROBACION.RECHAZADO) return BADGE_STYLES.DESTRUCTIVE;
  return BADGE_STYLES.WARNING;
}

/** Badges del flujo de evaluacion por area (local + SGC). */
function FlujoRevision({ row }: { row: SolicitudRow }) {
  if (!(row.revisiones?.length > 0)) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {areasRevisionLocal(row.revisiones).map((area) => {
        const rev = row.revisiones.find((r) => r.area === area);
        const estado = rev?.estado ?? RESULTADOS_APROBACION.PENDIENTE;
        return (
          <span key={area} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${claseEstadoArea(estado)}`}>
            {REVISION_AREA_LABELS[area]}: {estado === RESULTADOS_APROBACION.APROBADO ? "Aprobado" : estado === RESULTADOS_APROBACION.RECHAZADO ? "Rechazado" : "Pendiente"}
          </span>
        );
      })}
      {row.sgcEnabled && legalDelegadaAlSgc(row.revisiones) && (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_STYLES.INFO}`}>{REVISION_AREA_SGC_LABEL}</span>
      )}
    </div>
  );
}

/** Etiqueta del stand o conteo cuando la solicitud es multiple. */
function standTitulo(row: SolicitudRow): string {
  return (row.standCodes?.length ?? 0) > 1 ? `${row.standCodes.length} stands` : (row.standCode ?? "-");
}

/** Accion "Ver detalle" (link con flecha, segun diseno). */
function VerDetalleButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="group h-8 w-full justify-center gap-1 px-2 text-xs font-semibold text-primary hover:bg-primary/5 hover:text-primary sm:w-auto"
      onClick={onClick}
    >
      <span>Ver detalle</span>
      <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </Button>
  );
}

function MisSolicitudesManagerContent({ eventoId, userId }: { eventoId: string; userId: string }) {
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
  const [imgCarousel, setImgCarousel] = useState<{ images: string[]; idx: number } | null>(null);
  const [modifying, setModifying] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [modificarOpen, setModificarOpen] = useState(false);
  const [modificarError, setModificarError] = useState<string | null>(null);
  const [clienteUploadOpen, setClienteUploadOpen] = useState(false);
  const [clienteUploadRow, setClienteUploadRow] = useState<SolicitudRow | null>(null);
  const [view, setView] = useState<"cards" | "rows">("cards");

  const pageRef = useRef(page);
  const perPageRef = useRef(perPage);
  const autoOpenIdRef = useRef(autoOpenId);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { perPageRef.current = perPage; }, [perPage]);
  useEffect(() => { autoOpenIdRef.current = autoOpenId; }, [autoOpenId]);

  const handleModificar = async (documentos: string[], justificacion: string) => {
    if (!detailRow) return;
    setModifying(true);
    setModificarError(null);
    try {
      await solicitudesService.reevaluar({ solicitudId: detailRow.id, motivo: justificacion, documentos });
      toast.success("Solicitud de re-evaluacion enviada.");
      setModificarOpen(false);
      setDetailOpen(false);
      load(page, search, perPage);
    } catch (e) {
      setModificarError(e instanceof Error ? e.message : "Error al enviar");
    }
    setModifying(false);
  };

  const openDetail = async (id: string) => {
    const data = await solicitudesService.detalle(id);
    setDetailRow(data);
    setDetailOpen(true);
  };

  const load = useCallback(async (p?: number, s?: string, pp?: number) => {
    setLoading(true);
    try {
      const data = await solicitudesService.listar(eventoId, p ?? pageRef.current, pp ?? perPageRef.current, s, userId);
      setRows(data.data ?? []);
      setPagination({ page: data.page, total: data.total, totalPages: data.totalPages });

      if (autoOpenIdRef.current) {
        const found = data.data.find((r) => r.id === autoOpenIdRef.current);
        if (found) { setDetailRow(found); setDetailOpen(true); }
        const next = new URL(window.location.href);
        next.searchParams.delete("id");
        window.history.replaceState({}, "", next.toString());
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [eventoId, userId]);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  useAlertaNavigate("/dashboard/mis-solicitudes", (row) => {
    if (typeof row.id !== "string" || typeof row.standCode !== "string") return;
    setDetailRow(row as SolicitudRow);
    setDetailOpen(true);
  });

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-semibold text-primary">Tus solicitudes</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                {pagination.total} {pagination.total === 1 ? "registrada" : "registradas"}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ToggleGroup
                type="single"
                value={view}
                onValueChange={(v) => { if (v === "cards" || v === "rows") setView(v); }}
                variant="outline"
                size="sm"
                className="h-8"
              >
                <ToggleGroupItem value="cards" className="h-8 px-2" title="Vista de tarjetas" aria-label="Vista de tarjetas">
                  <LayoutGrid className="h-3.5 w-3.5" />
                </ToggleGroupItem>
                <ToggleGroupItem value="rows" className="h-8 px-2" title="Vista de filas" aria-label="Vista de filas">
                  <List className="h-3.5 w-3.5" />
                </ToggleGroupItem>
              </ToggleGroup>
              <Button variant="outline" size="sm" className="h-8 w-8 shrink-0 p-0" onClick={() => load(page, search)} disabled={loading} title="Recargar">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por codigo, pabellon o stand (ej. A-12)..." value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); load(1, e.currentTarget.value, perPage); } }}
                className="h-8 border-border bg-secondary pl-8 text-xs placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary" />
            </div>
            <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); load(1, search, Number(v)); }}>
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
        </CardHeader>
        <CardContent className="space-y-3 pt-4">

          {loading ? (
            <TableSkeleton rows={perPage} columns={6} />
          ) : rows.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No tienes solicitudes de alquiler.</p>
              <p className="text-xs text-muted-foreground mt-1">Cuando realices una reserva desde el plano interactivo, aparecera aqui.</p>
            </div>
          ) : (
            <>
              {view === "cards" ? (
              <div className="space-y-3">
                {rows.map((row) => (
                  <article key={row.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors hover:border-primary/40">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/60 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-mono text-sm font-bold text-primary">
                          {row.standCodes?.length > 1 ? `${row.standCodes.length} stands` : row.standCode}
                        </span>
                        {row.bloqueId && <span className="font-mono text-[10px] text-muted-foreground">{row.bloqueId}</span>}
                        <span className="text-xs text-muted-foreground">{row.tipoStand ?? "-"}</span>
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {dateUtils.formatDateTime(row.updatedAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {row.flgActivo === false && (
                          <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.NEUTRAL}`}><span>Dada de baja</span></Badge>
                        )}
                        <EstadoSolicitudBadge estado={row.estadoSolicitud} />
                      </div>
                    </div>

                    <div className="space-y-3 px-4 py-3">
                      {(row.standCodes?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Stands</span>
                          {row.standCodes.map((codigo) => (
                            <span key={codigo} className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">
                              {codigo}
                            </span>
                          ))}
                        </div>
                      )}

                      {row.revisiones?.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Flujo de evaluacion</p>
                          <FlujoRevision row={row} />
                        </div>
                      )}

                      {(tieneReevaluacionPendiente(row) || faltanDocumentosMultiStand(row)) && (
                        <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-warning">
                          <span className="font-semibold">Accion requerida: </span>
                          {tieneReevaluacionPendiente(row)
                            ? "Tienes una re-evaluacion pendiente de revision."
                            : "Faltan documentos por adjuntar para continuar con tu solicitud."}
                        </p>
                      )}

                      <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Paperclip className="h-3.5 w-3.5" />
                          {esMultiStand(row) ? `${row.docsAdjuntosCount ?? 0} doc(s)` : `${(row.documentos as string[])?.length ?? 0} doc(s)`}
                        </span>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          {puedePagarNiubizz(row) && (
                            <Button size="sm" className="w-full justify-center gap-1.5 bg-gold font-bold text-gold-foreground hover:bg-gold/90 sm:w-auto"
                              onClick={() => {
                                if (!row.facturacionId) { toast.error("No se encontro facturacion"); return; }
                                window.location.href = `/dashboard/facturacion/pago?facturacionId=${row.facturacionId}`;
                              }}>
                              <CreditCard className="h-3.5 w-3.5" />
                              <span>Pagar ahora</span>
                            </Button>
                          )}
                          {puedeAdjuntarDocumentos(row) && (
                            <Button size="sm" className="w-full justify-center gap-1.5 bg-primary font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
                              onClick={async () => {
                                const data = await solicitudesService.detalle(row.id);
                                setClienteUploadRow(data); setClienteUploadOpen(true);
                              }}>
                              <Upload className="h-3.5 w-3.5" />
                              <span>Adjuntar documentos</span>
                            </Button>
                          )}
                          <VerDetalleButton onClick={() => { void openDetail(row.id); }} />
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] uppercase tracking-wide">Stand</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide md:table-cell">Bloque</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Tipo</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Flujo</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide sm:table-cell">Docs</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide md:table-cell">Fecha</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Estado</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wide">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap font-mono text-xs font-bold text-primary">
                          {standTitulo(row)}
                          {(row.standCodes?.length ?? 0) > 1 && (
                            <span className="ml-1 font-normal text-muted-foreground">({row.standCodes.join(", ")})</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">{row.bloqueId ?? "—"}</TableCell>
                        <TableCell className="hidden max-w-[140px] truncate text-xs lg:table-cell">{row.tipoStand ?? "—"}</TableCell>
                        <TableCell className="hidden lg:table-cell"><FlujoRevision row={row} /></TableCell>
                        <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground sm:table-cell">
                          {esMultiStand(row) ? `${row.docsAdjuntosCount ?? 0} doc(s)` : `${(row.documentos as string[])?.length ?? 0} doc(s)`}
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground md:table-cell">{dateUtils.formatDateTime(row.updatedAt)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {row.flgActivo === false && (
                              <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.NEUTRAL}`}><span>Dada de baja</span></Badge>
                            )}
                            <EstadoSolicitudBadge estado={row.estadoSolicitud} />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {puedePagarNiubizz(row) && (
                              <Button size="sm" className="h-8 gap-1.5 bg-gold text-xs font-bold text-gold-foreground hover:bg-gold/90"
                                onClick={() => {
                                  if (!row.facturacionId) { toast.error("No se encontro facturacion"); return; }
                                  window.location.href = `/dashboard/facturacion/pago?facturacionId=${row.facturacionId}`;
                                }}>
                                <CreditCard className="h-3.5 w-3.5" />
                                <span>Pagar ahora</span>
                              </Button>
                            )}
                            {puedeAdjuntarDocumentos(row) && (
                              <Button size="sm" className="h-8 gap-1.5 bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                                onClick={async () => {
                                  const data = await solicitudesService.detalle(row.id);
                                  setClienteUploadRow(data); setClienteUploadOpen(true);
                                }}>
                                <Upload className="h-3.5 w-3.5" />
                                <span>Adjuntar</span>
                              </Button>
                            )}
                            <VerDetalleButton onClick={() => { void openDetail(row.id); }} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              )}
              <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-muted-foreground">
                  {pagination.total} resultados — pagina {pagination.page} de {pagination.totalPages || 1}
                </span>
                <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={(p) => { setPage(p); load(p, search, perPage); }} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden sm:max-w-lg">
          {/* Header */}
          <DialogHeader className="shrink-0 border-b border-border pb-3 text-left">
            <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
              <DialogTitle className="text-sm font-semibold text-foreground">Estado de solicitud</DialogTitle>
              {detailRow && <EstadoSolicitudBadge estado={detailRow.estadoSolicitud} />}
            </div>
          </DialogHeader>
          {/* Body */}
          <div className="flex-1 min-h-0 space-y-2 overflow-y-auto py-4">
          {detailRow && (
            <>
              {/* Resumen */}
              <ModalSection title="Informacion general" meta={dateUtils.formatDateTime(detailRow.updatedAt)}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  <div className="space-y-0.5">
                    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Stand</span>
                    <span className="font-mono text-xs font-semibold text-foreground">{standTitulo(detailRow)}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Bloque</span>
                    <span className="font-mono text-xs text-foreground">{detailRow.bloqueId ?? "—"}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Tipo</span>
                    <span className="text-xs text-foreground">{detailRow.tipoStand ?? "—"}</span>
                  </div>
                </div>
                {(detailRow.standCodes?.length ?? 0) > 1 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {detailRow.standCodes.map((codigo) => (
                      <span key={codigo} className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">{codigo}</span>
                    ))}
                  </div>
                )}
              </ModalSection>

              {/* Imagenes */}
              {detailRow.imagenes && (detailRow.imagenes as string[]).length > 0 && (
                <ModalSection title="Imagenes del stand" meta={`${(detailRow.imagenes as string[]).length} archivo(s)`}>
                  <div className="flex flex-wrap gap-2">
                    {(detailRow.imagenes as string[]).slice(0, 4).map((url, i) => (
                      <button key={i}
                        className="h-16 w-16 overflow-hidden rounded-lg border border-border transition-opacity hover:opacity-80"
                        onClick={() => setImgCarousel({ images: detailRow.imagenes as string[], idx: i })}>
                        <Image width={64} height={64} src={url} alt={`Imagen ${i + 1}`} className="h-full w-full object-cover" />
                      </button>
                    ))}
                    {(detailRow.imagenes as string[]).length > 4 && (
                      <span className="flex h-16 w-16 items-center justify-center rounded-lg border border-border bg-secondary text-xs font-medium text-muted-foreground">
                        +{(detailRow.imagenes as string[]).length - 4}
                      </span>
                    )}
                  </div>
                </ModalSection>
              )}

              {/* Documentos */}
              {((!detailRow.standCodes || detailRow.standCodes.length <= 1) && (detailRow.documentos as string[]).length > 0) || (detailRow.docsAdjuntos && detailRow.docsAdjuntos.length > 0) ? (
                <ModalSection title="Expediente y documentacion" meta={`${detailRow.standCodes?.length > 1 ? (detailRow.docsAdjuntosCount ?? 0) : (detailRow.documentos as string[]).length} documento(s)`}>
                  {detailRow.sgcDocumentosEnviados && (
                    <p className="mb-2 rounded-md border border-info/30 bg-info/10 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                      Documentos ya enviados al SGC. No se pueden modificar.
                    </p>
                  )}
                  {/* Single-stand */}
                  {(!detailRow.standCodes || detailRow.standCodes.length <= 1) && (detailRow.documentos as string[]).length > 0 && (
                    <div className="space-y-0.5 rounded-md border p-2">
                      {(detailRow.documentos as string[]).map((url, i) => (
                        <a key={i} href={url} target="_blank" className="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-primary hover:bg-primary/5 transition-colors">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate flex-1">{stringUtils.nombreArchivo(url)}</span>
                          <Eye className="h-3 w-3 opacity-50 shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}
                  {/* Multi-stand */}
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
                                  <span className="text-[10px] text-muted-foreground shrink-0">{doc.uploadedBy ? `${doc.uploadedBy} · ` : ""}{dateUtils.formatDateTime(doc.createdAt)}</span>
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
                            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tus documentos ({clienteDocs.length})</p>
                            <div className="space-y-0.5 rounded-md border border-success/30 bg-success/10 p-2">
                              {clienteDocs.map((doc, i) => (
                                <div key={i} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs group">
                                  <FileText className="h-3.5 w-3.5 shrink-0 text-success" />
                                  <a href={doc.url} target="_blank" className="text-success hover:text-success transition-colors truncate flex-1 font-medium">{doc.nombre}</a>
                                  <span className="text-[10px] text-muted-foreground shrink-0">{doc.uploadedBy ? `${doc.uploadedBy} · ` : ""}{dateUtils.formatDateTime(doc.createdAt)}</span>
                                  <a href={doc.url} target="_blank" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground shrink-0">
                                    <Eye className="h-3 w-3" />
                                  </a>
                                  <button className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setDeleteConfirm(doc.id);
                                    }}>
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </ModalSection>
              ) : null}

              {/* Esperando Contrato */}
              {detailRow.standCodes?.length > 1 && detailRow.estadoSolicitud === ESTADOS_SOLICITUD.PENDIENTE && (detailRow.docsAdjuntosCount ?? 0) === 0 && detailRow.flgActivo !== false && (
                <ModalSection title="Accion requerida">
                  <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <div>
                      <p className="text-xs font-semibold text-warning">Esperando contrato</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-warning">La administracion del IIMP aun no ha subido el contrato para esta solicitud multiple. Una vez que el contrato este disponible, podras adjuntar tus documentos y continuar con el proceso.</p>
                    </div>
                  </div>
                </ModalSection>
              )}

              {/* Re-evaluacion */}
              {detailRow.reevaluaciones && detailRow.reevaluaciones.length > 0 && (
                <ModalSection title="Re-evaluacion" meta={`${detailRow.reevaluaciones.length} registro(s)`}>
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
                          <Badge className={`pointer-events-none text-[10px] ${
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
                          <span className="truncate flex-1">{stringUtils.nombreArchivo(url)}</span>
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
                </ModalSection>
              )}

              {/* Estado de revision */}
              <ModalSection title="Estado de revision">
                {(() => {
                  const areas = areasRevisionLocal(detailRow.revisiones).map((area) => {
                    const rev = detailRow.revisiones.find((r) => r.area === area);
                    const estado = rev?.estado ?? RESULTADOS_APROBACION.PENDIENTE;
                    return { key: area, label: REVISION_AREA_LABELS[area], estado, etiqueta: etiquetaEstadoArea(estado), badge: claseEstadoArea(estado), comentario: rev?.comentario ?? null };
                  });
                  const items = detailRow.sgcEnabled && legalDelegadaAlSgc(detailRow.revisiones)
                    ? [...areas, estadoSgcItem(detailRow)]
                    : areas;
                  return (
                    <div className="space-y-3">
                      {items.map((it, idx) => (
                        <div key={it.key} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <span className={`mt-0.5 h-3 w-3 shrink-0 rounded-full ${revisionDotClass(it.estado)}`} />
                            {idx < items.length - 1 && <span className="my-0.5 w-px flex-1 bg-border" />}
                          </div>
                          <div className="pb-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-foreground">{it.label}</span>
                              <Badge className={`text-[10px] pointer-events-none ${it.badge}`}>{it.etiqueta}</Badge>
                            </div>
                            {it.comentario && (
                              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{it.comentario}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </ModalSection>

              {/* Documentos requeridos */}
              {faltanDocumentosMultiStand(detailRow) && (
                <ModalSection title="Documentos requeridos">
                  <div className="text-center mb-3">
                    <p className="text-xs text-warning">Para solicitar una re-evaluacion, primero debes adjuntar al menos un documento.</p>
                  </div>
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-warning/40 bg-warning/5 p-5 transition-colors hover:border-warning/60 hover:bg-warning/10">
                    <Upload className="h-6 w-6 text-warning" />
                    <span className="text-xs font-medium text-warning">Arrastra un archivo o haz click aqui</span>
                    <span className="text-[10px] text-warning">PDF, DOC, DOCX, JPG, PNG — max 10 MB</span>
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      e.target.value = "";
                      try {
                        const url = await solicitudesService.subirArchivo(file);
                        await solicitudesService.uploadDocumento({
                          solicitudId: detailRow.id, url, nombre: file.name,
                        });
                        toast.success("Documento adjuntado");
                        const data = await solicitudesService.detalle(detailRow.id);
                        setDetailRow(data);
                      } catch (err) { toast.error(err instanceof Error ? err.message : "Error"); }
                    }} />
                  </label>
                </ModalSection>
              )}
            </>
          )}
          {detailRow && estaDadaDeBaja(detailRow) && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-center">
              <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-sm font-semibold text-destructive mb-1">Solicitud rechazada y dada de baja</p>
              <p className="text-xs text-destructive mb-3">Esta solicitud ya no puede continuar el proceso. Para volver a solicitarla, ingresa al plano y selecciona el stand disponible.</p>
              <div className="flex justify-center gap-2">
                <Button size="sm" variant="outline" className="rounded-full px-3 text-xs font-medium" asChild>
                  <Link href="/plano"><span>Ir al plano</span></Link>
                </Button>
              </div>
            </div>
          )}
          </div>
          {/* Footer */}
          {detailRow && (puedePagarNiubizz(detailRow) || puedeSolicitarReevaluacion(detailRow)) && (
            <DialogFooter className="shrink-0 flex-row justify-end gap-2 border-t border-border pt-3">
              {puedePagarNiubizz(detailRow) && (
                <Button size="sm" variant="default" className="gap-1.5 text-xs font-semibold"
                  onClick={() => toast.info("Redirigiendo a la pasarela de pago Niubizz...")}>
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>Pagar con Niubizz</span>
                </Button>
              )}
              {puedeSolicitarReevaluacion(detailRow) && (
                <Button size="sm" variant="default" className="gap-1.5 text-xs font-semibold"
                  onClick={() => { setModificarOpen(true); setModificarError(null); }}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Solicitar Re-evaluacion</span>
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm delete doc */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle><span>Eliminar documento</span></DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Estas seguro de eliminar este documento? Esta accion no se puede deshacer.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1 rounded-full text-xs" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" className="flex-1 rounded-full text-xs" onClick={async () => {
              if (!deleteConfirm || !detailRow) return;
              try {
                await solicitudesService.eliminarDocumento(deleteConfirm);
                toast.success("Documento eliminado");
                const data = await solicitudesService.detalle(detailRow.id);
                setDetailRow(data);
              } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
              setDeleteConfirm(null);
            }}>Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cliente upload dialog */}
      <Dialog open={clienteUploadOpen} onOpenChange={setClienteUploadOpen}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] flex flex-col !px-0 !py-0 overflow-hidden">
          {clienteUploadRow && (
            <ClienteUploadModal
              solicitud={clienteUploadRow}
              onClose={() => setClienteUploadOpen(false)}
              onSaved={() => load(page, search, perPage)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modificar dialog */}
      <Dialog open={modificarOpen} onOpenChange={setModificarOpen}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] flex flex-col !px-0 !py-0 overflow-hidden">
          {detailRow && (
            <ModificarSolicitudModal
              standCode={detailRow.standCode}
              documentos={detailRow.documentos as string[]}
              onModificar={handleModificar}
              onClose={() => setModificarOpen(false)}
              sending={modifying}
              error={modificarError}
            />
          )}
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

export function MisSolicitudesManager({ eventoId, userId }: { eventoId: string; userId: string }) {
  return (
    <Suspense fallback={null}>
      <MisSolicitudesManagerContent eventoId={eventoId} userId={userId} />
    </Suspense>
  );
}
