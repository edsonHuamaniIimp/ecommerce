"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle } from "@nrivera-iimp/ui-kit-iimp";
import { Search, Eye, FileText, CheckCircle2, Clock, XCircle, RefreshCw, RotateCcw, Info, Upload, Trash2, ChevronDown } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Tooltip, TooltipTrigger, TooltipContent } from "@nrivera-iimp/ui-kit-iimp";
import { Pagination } from "@/components/shared/pagination";
import { authService } from "@/lib/api/services/auth-service";
import { useSearchParams } from "next/navigation";
import { solicitudesService } from "@/lib/api/services/solicitudes-service";
import { dateUtils } from "@/lib/utils/date";
import { useAlertaNavigate } from "@/hooks/use-alerta-navigate";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { ModificarSolicitudModal } from "./modificar-solicitud-modal";
import { ClienteUploadModal } from "./cliente-upload-modal";
import { HistorialModal } from "./historial-modal";
import { RESULTADOS_APROBACION, REVISION_AREA_LABELS, REVISION_AREA_ORDER, ESTADOS_SOLICITUD, MAESTRA_TABLAS, ESTADOS_REEVALUACION } from "@/lib/constants";
import type { SolicitudDTO } from "@/types/dto/solicitudes/solicitudes-response.dto";

type SolicitudRow = SolicitudDTO;

function esMultiStand(row: SolicitudRow) { return (row.standCodes?.length ?? 0) > 1; }
function estaPendiente(row: SolicitudRow) { return row.estadoSolicitud === ESTADOS_SOLICITUD.PENDIENTE; }
function adminSubioDocumentos(row: SolicitudRow) { return ((row.docsAdjuntosCount ?? 0) - (row.clienteDocsAdjuntosCount ?? 0)) > 0; }
function puedeAdjuntarDocumentos(row: SolicitudRow) { return esMultiStand(row) && estaPendiente(row) && adminSubioDocumentos(row); }
function estaRechazada(row: SolicitudRow) { return row.estadoSolicitud === ESTADOS_SOLICITUD.RECHAZADO; }
function tieneReevaluacionPendiente(row: SolicitudRow) { return row.reevaluaciones?.some((r) => r.estado === ESTADOS_REEVALUACION.PENDIENTE) ?? false; }
function estaDadaDeBaja(row: SolicitudRow) { return row.flgActivo === false; }
function puedeSolicitarReevaluacion(row: SolicitudRow) {
  if (estaDadaDeBaja(row) || !estaRechazada(row) || tieneReevaluacionPendiente(row)) return false;
  if (esMultiStand(row) && (row.clienteDocsAdjuntosCount ?? 0) === 0) return false;
  return true;
}
function faltanDocumentosMultiStand(row: SolicitudRow) {
  return esMultiStand(row) && estaRechazada(row) && (row.clienteDocsAdjuntosCount ?? 0) === 0 && !tieneReevaluacionPendiente(row);
}

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

export function MisSolicitudesManager({ eventoId, userId }: { eventoId: string; userId: string }) {
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
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [imgCarousel, setImgCarousel] = useState<{ images: string[]; idx: number } | null>(null);
  const [modifying, setModifying] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [modificarOpen, setModificarOpen] = useState(false);
  const [modificarError, setModificarError] = useState<string | null>(null);
  const [clienteUploadOpen, setClienteUploadOpen] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState<string | null>(null);
  const [clienteUploadRow, setClienteUploadRow] = useState<SolicitudRow | null>(null);

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

  useEffect(() => {
    authService.getSession().then((s) => setUserPermissions(s.permissions ?? [])).catch(() => {});
  }, []);

  const load = async (p?: number, s?: string, pp?: number) => {
    setLoading(true);
    try {
      const data = await solicitudesService.listar(eventoId, p ?? page, pp ?? perPage, s, userId);
      setRows(data.data ?? []);
      setPagination({ page: data.page, total: data.total, totalPages: data.totalPages });

      if (autoOpenId) {
        const found = data.data.find((r) => r.id === autoOpenId);
        if (found) { setDetailRow(found); setDetailOpen(true); }
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [eventoId, userId]);

  useAlertaNavigate("/dashboard/mis-solicitudes", (row) => {
    setDetailRow(row as unknown as SolicitudRow); setDetailOpen(true);
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Mis solicitudes ({pagination.total})</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => load(page, search)} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
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
            <TableSkeleton rows={perPage} columns={6} />
          ) : rows.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No tienes solicitudes de alquiler.</p>
              <p className="text-xs text-muted-foreground mt-1">Cuando realices una reserva desde el plano interactivo, aparecera aqui.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><span>Stand</span></TableHead>
                      <TableHead className="hidden md:table-cell"><span>Tipo</span></TableHead>
                      <TableHead><span>Estado</span></TableHead>
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
                            {row.bloqueId && <span className="ml-1 text-muted-foreground font-normal">{row.bloqueId}</span>}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs">{row.tipoStand ?? "—"}</TableCell>
                          <TableCell>
                            {row.estadoSolicitud === ESTADOS_SOLICITUD.APROBADO ? (
                              <Badge className="text-[10px] pointer-events-none bg-green-100 text-green-800 border-green-200">
                                <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" /> Aprobado
                              </Badge>
                            ) : row.estadoSolicitud === ESTADOS_SOLICITUD.RECHAZADO ? (
                              <Badge className="text-[10px] pointer-events-none bg-red-100 text-red-800 border-red-200">
                                <XCircle className="mr-0.5 h-2.5 w-2.5" /> Rechazado
                              </Badge>
                            ) : row.estadoSolicitud === ESTADOS_SOLICITUD.EN_PROCESO ? (
                              <Badge className="text-[10px] pointer-events-none bg-blue-100 text-blue-800 border-blue-200">
                                <Clock className="mr-0.5 h-2.5 w-2.5" /> En proceso
                              </Badge>
                            ) : row.estadoSolicitud === ESTADOS_SOLICITUD.PENDIENTE_PAGO ? (
                              <Badge className="text-[10px] pointer-events-none bg-indigo-100 text-indigo-800 border-indigo-200">
                                <Clock className="mr-0.5 h-2.5 w-2.5" /> Pendiente Pago
                              </Badge>
                            ) : (
                              <Badge className="text-[10px] pointer-events-none bg-amber-100 text-amber-800 border-amber-200">
                                <Clock className="mr-0.5 h-2.5 w-2.5" /> Pendiente
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
                              {row.flgActivo === false ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400"
                                      onClick={async () => {
                                        const data = await solicitudesService.detalle(row.id);
                                        setDetailRow(data); setDetailOpen(true);
                                      }}>
                                      <Info className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top"><span>Dada de baja</span></TooltipContent>
                                </Tooltip>
                              ) : (
                                <>
                                  {tieneReevaluacionPendiente(row) && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-600"
                                          onClick={async () => {
                                            const data = await solicitudesService.detalle(row.id);
                                            setDetailRow(data); setDetailOpen(true);
                                          }}>
                                          <RotateCcw className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                    <TooltipContent side="top"><span>Re-evaluacion pendiente</span></TooltipContent>
                                  </Tooltip>
                                )}
                                  {puedeAdjuntarDocumentos(row) && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500"
                                          onClick={async () => {
                                            const data = await solicitudesService.detalle(row.id);
                                            setClienteUploadRow(data); setClienteUploadOpen(true);
                                          }}>
                                          <Upload className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top"><span>Adjuntar documentos</span></TooltipContent>
                                    </Tooltip>
                                  )}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                        onClick={async () => {
                                          const data = await solicitudesService.detalle(row.id);
                                          setDetailRow(data); setDetailOpen(true);
                                        }}>
                                        <Eye className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top"><span>Ver estado</span></TooltipContent>
                                  </Tooltip>
                                </>
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
                 <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={(p) => { setPage(p); load(p, search, perPage); }} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col !px-0 !py-0 overflow-hidden">
          {/* Header */}
          <div className="shrink-0 px-5 pt-4 pb-2 border-b border-slate-100 !pr-12">
            <h3 className="text-sm font-semibold text-slate-800">Estado de solicitud</h3>
          </div>
          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-2">
          {detailRow && (
            <>
              {/* Info general */}
              <DetailSection id="info" title="Informacion general" open={accordionOpen === "info"} onToggle={(id) => setAccordionOpen(accordionOpen === id ? null : id)}>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Stand:</span> <span className="font-mono font-medium">{detailRow.standCode}</span>{detailRow.standCodes?.length > 1 && <span className="text-[10px] text-slate-400 ml-1">({detailRow.standCodes.length} stands: {detailRow.standCodes.join(", ")})</span>}</div>
                  <div><span className="text-muted-foreground">Bloque:</span> <span className="font-mono">{detailRow.bloqueId ?? "—"}</span></div>
                  <div><span className="text-muted-foreground">Tipo:</span> <span>{detailRow.tipoStand ?? "—"}</span></div>
                  <div><span className="text-muted-foreground">Fecha:</span> <span>{dateUtils.formatDateTime(detailRow.updatedAt)}</span></div>
                </div>
              </DetailSection>

              {/* Imagenes */}
              {detailRow.imagenes && (detailRow.imagenes as string[]).length > 0 && (
                <DetailSection id="imagenes" title={`Imagenes del stand (${(detailRow.imagenes as string[]).length})`} open={accordionOpen === "imagenes"} onToggle={(id) => setAccordionOpen(accordionOpen === id ? null : id)}>
                  <div className="flex gap-1.5">
                    {(detailRow.imagenes as string[]).slice(0, 4).map((url, i) => (
                      <button key={i}
                        className="h-14 w-14 overflow-hidden rounded border hover:opacity-80 transition-opacity"
                        onClick={() => setImgCarousel({ images: detailRow.imagenes as string[], idx: i })}>
                        <img src={url} className="h-full w-full object-cover" alt={`Imagen ${i + 1}`} />
                      </button>
                    ))}
                    {(detailRow.imagenes as string[]).length > 4 && (
                      <span className="flex h-14 w-14 items-center justify-center rounded border bg-muted text-xs text-muted-foreground">
                        +{(detailRow.imagenes as string[]).length - 4}
                      </span>
                    )}
                  </div>
                </DetailSection>
              )}

              {/* Documentos */}
              {((!detailRow.standCodes || detailRow.standCodes.length <= 1) && (detailRow.documentos as string[]).length > 0) || (detailRow.docsAdjuntos && detailRow.docsAdjuntos.length > 0) ? (
                <DetailSection id="docs" title={`Documentos (${detailRow.standCodes?.length > 1 ? (detailRow.docsAdjuntosCount ?? 0) : (detailRow.documentos as string[]).length})`} open={accordionOpen === "docs"} onToggle={(id) => setAccordionOpen(accordionOpen === id ? null : id)}>
                  {/* Single-stand */}
                  {(!detailRow.standCodes || detailRow.standCodes.length <= 1) && (detailRow.documentos as string[]).length > 0 && (
                    <div className="space-y-0.5 rounded-md border p-2">
                      {(detailRow.documentos as string[]).map((url, i) => (
                        <a key={i} href={url} target="_blank" className="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-primary hover:bg-primary/5 transition-colors">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate flex-1">{url.split("/").pop() ?? url}</span>
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
                            <p className="mb-1.5 text-[11px] font-medium text-slate-400 uppercase tracking-wider">Tus documentos ({clienteDocs.length})</p>
                            <div className="space-y-0.5 rounded-md border border-green-200 bg-green-50/50 p-2">
                              {clienteDocs.map((doc, i) => (
                                <div key={i} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs group">
                                  <FileText className="h-3.5 w-3.5 shrink-0 text-green-600" />
                                  <a href={doc.url} target="_blank" className="text-green-700 hover:text-green-900 transition-colors truncate flex-1 font-medium">{doc.nombre}</a>
                                  <span className="text-[10px] text-slate-400 shrink-0">{dateUtils.formatDateTime(doc.createdAt)}</span>
                                  <a href={doc.url} target="_blank" className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 shrink-0">
                                    <Eye className="h-3 w-3" />
                                  </a>
                                  <button className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 shrink-0"
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
                </DetailSection>
              ) : null}

              {/* Esperando Contrato */}
              {detailRow.standCodes?.length > 1 && detailRow.estadoSolicitud === ESTADOS_SOLICITUD.PENDIENTE && (detailRow.docsAdjuntosCount ?? 0) === 0 && detailRow.flgActivo !== false && (
                <DetailSection id="accion" title="Accion requerida" open={accordionOpen === "accion"} onToggle={(id) => setAccordionOpen(accordionOpen === id ? null : id)}>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                    <Clock className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                    <p className="text-xs font-semibold text-amber-700">Esperando Contrato</p>
                    <p className="text-[11px] text-amber-600 mt-0.5">La administracion del IIMP aun no ha subido el contrato para esta solicitud multiple. Una vez que el contrato este disponible, podras adjuntar tus documentos y continuar con el proceso.</p>
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
                          <Badge variant={
                            reev.estado === ESTADOS_REEVALUACION.APROBADO ? "default"
                            : reev.estado === ESTADOS_REEVALUACION.RECHAZADO ? "destructive"
                            : "secondary"
                          } className="text-[10px]">
                            {reev.estado === ESTADOS_REEVALUACION.APROBADO ? "Aprobada"
                              : reev.estado === ESTADOS_REEVALUACION.RECHAZADO ? "Rechazada"
                              : "Pendiente"}
                          </Badge>
                        </div>
                        {reev.motivo && (
                          <p className="text-[11px] text-muted-foreground italic mb-1">"{reev.motivo}"</p>
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
                  {REVISION_AREA_ORDER.map((area) => {
                    const rev = detailRow.revisiones.find((r) => r.area === area);
                    const estado = rev?.estado ?? RESULTADOS_APROBACION.PENDIENTE;
                    return (
                      <div key={area} className="rounded bg-muted/30 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{REVISION_AREA_LABELS[area]}</span>
                          <Badge className={`text-[10px] pointer-events-none ${estado === RESULTADOS_APROBACION.APROBADO ? "bg-green-100 text-green-800 border-green-200" : estado === RESULTADOS_APROBACION.RECHAZADO ? "bg-red-100 text-red-800 border-red-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                            {estado === RESULTADOS_APROBACION.APROBADO ? "Aprobado" : estado === RESULTADOS_APROBACION.RECHAZADO ? "Rechazado" : "Pendiente"}
                          </Badge>
                        </div>
                        {rev?.comentario && (
                          <p className="text-[11px] text-muted-foreground italic">"{rev.comentario}"</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </DetailSection>

              {/* Documentos requeridos */}
              {faltanDocumentosMultiStand(detailRow) && (
                <DetailSection id="reqdocs" title="Documentos requeridos" open={accordionOpen === "reqdocs"} onToggle={(id) => setAccordionOpen(accordionOpen === id ? null : id)}>
                  <div className="text-center mb-3">
                    <p className="text-xs text-amber-700">Para solicitar una re-evaluacion, primero debes adjuntar al menos un documento.</p>
                  </div>
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-amber-300 bg-white/60 p-5 hover:border-amber-400 hover:bg-amber-100/50 transition-colors">
                    <Upload className="h-6 w-6 text-amber-500" />
                    <span className="text-xs font-medium text-amber-700">Arrastra un archivo o haz click aqui</span>
                    <span className="text-[10px] text-amber-500">PDF, DOC, DOCX, JPG, PNG — max 10 MB</span>
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
                </DetailSection>
              )}
            </>
          )}
          {detailRow && estaDadaDeBaja(detailRow) && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
              <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-red-700 mb-1">Solicitud rechazada y dada de baja</p>
              <p className="text-xs text-red-600 mb-3">Esta solicitud ya no puede continuar el proceso. Para volver a solicitarla, ingresa al plano y selecciona el stand disponible.</p>
              <div className="flex justify-center gap-2">
                <Button size="sm" variant="outline" className="rounded-full px-3 text-xs font-medium" asChild>
                  <Link href="/plano"><span>Ir al plano</span></Link>
                </Button>
              </div>
            </div>
          )}
          </div>
          {/* Footer */}
          {detailRow && puedeSolicitarReevaluacion(detailRow) && (
            <div className="shrink-0 border-t border-slate-100 px-5 py-3 flex justify-end">
              <Button size="sm" variant="default" className="rounded-full px-4 text-xs font-semibold"
                onClick={() => { setModificarOpen(true); setModificarError(null); }}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Solicitar Re-evaluacion
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm delete doc */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle><span>Eliminar documento</span></DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">Estas seguro de eliminar este documento? Esta accion no se puede deshacer.</p>
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
            <img src={imgCarousel.images[imgCarousel.idx]} className="max-h-[70vh] w-full object-contain" alt={`Imagen ${imgCarousel.idx + 1}`} />
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
