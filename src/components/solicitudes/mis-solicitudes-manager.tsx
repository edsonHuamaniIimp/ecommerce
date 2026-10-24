"use client";

import Image from "next/image";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, Badge, Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, ToggleGroup, ToggleGroupItem } from "@nrivera-iimp/ui-kit-iimp";
import { Search, Eye, FileText, Clock, XCircle, RefreshCw, RotateCcw, Upload, Trash2, ChevronRight, CreditCard, CalendarDays, Paperclip, LayoutGrid, List, MapPin, Map as MapIcon, ImageDown, Loader2, PenLine } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/use-confirm";
import { Pagination } from "@/components/shared/pagination";
import { useSearchParams } from "next/navigation";
import { solicitudesService } from "@/lib/client/api/services/solicitudes-service";
import { dateUtils } from "@/lib/shared/utils/date";
import { stringUtils } from "@/lib/shared/utils/string";
import { useAlertaNavigate } from "@/hooks/use-alerta-navigate";
import { useVistaBandeja } from "@/hooks/use-vista-bandeja";
import { useMaestraLabels } from "@/hooks/use-maestra-labels";
import { MontajistaAsignada } from "./montajista-asignada";
import { EstadoSolicitudBadge } from "./estado-solicitud-badge";
import { useSesion } from "@/hooks/use-sesion";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { ModificarSolicitudModal } from "./modificar-solicitud-modal";
import { ClienteUploadModal } from "./cliente-upload-modal";
import { RecortePlano, type RecortePlanoHandle } from "@/components/plano/recorte-plano";
import { RESULTADOS_APROBACION, REVISION_AREA_LABELS, REVISION_AREA_SGC_LABEL, ESTADOS_SOLICITUD, ESTADOS_REEVALUACION, ESTADOS_DOCUMENTO_SOLICITUD, ESTADOS_DOCUMENTO_SOLICITUD_LABELS, ESTADOS_DOCUMENTO_SOLICITUD_MAESTRA_ID, MAESTRA_TABLAS, BADGE_STYLES, SGC_LIFECYCLE_STATUSES, NIUBIZ_HABILITADO, TIPOS_DOCUMENTO_SOLICITUD, VISTAS_BANDEJA } from "@/lib/shared/constants";
import { areasRevisionLocal, legalDelegadaAlSgc } from "@/lib/shared/utils/revision-areas";
import { precioTexto } from "@/lib/shared/utils/precio-stand";
import { anexosBloqueantesFaltantes, contratoClientePendienteFirma, contratoFirmadoPendienteReemplazo, enVentanaContratoReserva, enVentanaLegalSgc, enVentanaSubsanacionSgc, esperandoContratoCorregidoSgc, requiereDocsReevaluacion } from "@/lib/shared/utils/solicitud-documentos";
import { sgcAprobado } from "@/lib/shared/utils/sgc-estado";
import type { SolicitudDTO } from "@/types/dto/solicitudes/solicitudes-response.dto";

type SolicitudRow = SolicitudDTO;

function esMultiStand(row: SolicitudRow) { return (row.standCodes?.length ?? 0) > 1; }
function estaRechazada(row: SolicitudRow) { return row.estadoSolicitud === ESTADOS_SOLICITUD.RECHAZADO; }
function tieneReevaluacionPendiente(row: SolicitudRow) { return row.reevaluaciones?.some((r) => r.estado === ESTADOS_REEVALUACION.PENDIENTE) ?? false; }
function estaDadaDeBaja(row: SolicitudRow) { return row.flgActivo === false; }
function puedePagarNiubizz(row: SolicitudRow) {
  return NIUBIZ_HABILITADO && row.estadoSolicitud === ESTADOS_SOLICITUD.PENDIENTE_PAGO && row.tipoFacturacion === "niubizz";
}
function puedeSolicitarReevaluacion(row: SolicitudRow) {
  if (estaDadaDeBaja(row) || !estaRechazada(row) || tieneReevaluacionPendiente(row)) return false;
  if (esMultiStand(row) && (row.clienteDocsAdjuntosCount ?? 0) === 0) return false;
  return true;
}
function faltanDocumentosMultiStand(row: SolicitudRow) { return requiereDocsReevaluacion(row); }
/** En ventana de contrato de reserva: faltan anexos obligatorios (Vigencia/DNI). */
function faltanAnexosReserva(row: SolicitudRow) {
  return enVentanaContratoReserva(row) && anexosBloqueantesFaltantes(row.docsAdjuntos).length > 0;
}

/** Estado de la subsanacion local: que falta reemplazar/firmar y si ya se puede reenviar. */
/** Solo se puede eliminar lo subido en la iteracion actual (posterior a la ultima revision). */
function puedeEliminarDocumentoActual(row: SolicitudRow, doc: SolicitudRow["docsAdjuntos"][number]) {
  if (doc.estado && doc.estado !== ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO) return false;
  const ultimaRevision = (row.revisiones ?? []).reduce<string | Date | null>(
    (ultima, r) => (!ultima || dateUtils.isAfter(r.updatedAt, ultima) ? r.updatedAt : ultima),
    null,
  );
  return !ultimaRevision || dateUtils.isAfter(doc.createdAt, ultimaRevision);
}

function accionesObservacion(row: SolicitudRow) {
  const docs = row.docsAdjuntos ?? [];
  const observados = docs.filter((d) => d.estado === ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO);
  const activo = (d: { estado?: string | null }) =>
    !d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO;
  const contratoAdminObservado = observados.some(
    (d) => d.userId === null && d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO,
  );
  const adminContratoVigente = docs
    .filter((d) => activo(d) && d.userId === null && d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO)
    .sort((a, b) => (dateUtils.toMs(b.createdAt) ?? 0) - (dateUtils.toMs(a.createdAt) ?? 0))[0];
  const firmadoVigente = docs
    .filter((d) => activo(d) && d.userId === row.userId && d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO)
    .sort((a, b) => (dateUtils.toMs(b.createdAt) ?? 0) - (dateUtils.toMs(a.createdAt) ?? 0))[0];
  const firmadoObservado = docs
    .filter(
      (d) =>
        d.estado === ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO &&
        d.userId === row.userId &&
        d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
    )
    .sort((a, b) => (dateUtils.toMs(b.createdAt) ?? 0) - (dateUtils.toMs(a.createdAt) ?? 0))[0];
  /* El admin ya subio una version corregida que el cliente aun no firma. */
  const adminEsCorreccion = adminContratoVigente
    ? (!firmadoObservado || dateUtils.isAfter(adminContratoVigente.createdAt, firmadoObservado.createdAt))
    : false;
  const contratoCorregidoPendienteFirma = adminContratoVigente
    ? adminEsCorreccion &&
      (!firmadoVigente || dateUtils.isBefore(firmadoVigente.createdAt, adminContratoVigente.createdAt))
    : false;
  const pendientesReemplazo = observados.filter(
    (obs) =>
      !docs.some(
        (d) =>
          activo(d) &&
          (d.categoria ?? null) === (obs.categoria ?? null) &&
          (d.requisito ?? null) === (obs.requisito ?? null) &&
          dateUtils.isAfter(d.createdAt, obs.createdAt),
      ),
  );
  const firmadoPendienteReemplazo = contratoFirmadoPendienteReemplazo(row);
  const anexosPendientes = pendientesReemplazo.filter(
    (d) => d.userId !== null && d.categoria !== TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
  ).length;
  return {
    observados,
    pendientesReemplazo,
    anexosPendientes,
    contratoAdminObservado,
    adminContratoVigente,
    contratoCorregidoPendienteFirma,
    esperandoContratoCorregidoFirmado: firmadoPendienteReemplazo && !contratoCorregidoPendienteFirma,
    faltaFirmaContrato: contratoCorregidoPendienteFirma || firmadoPendienteReemplazo,
    tieneAnexosObservados: anexosPendientes > 0,
    tieneFirmadoObservado: firmadoPendienteReemplazo,
  };
}

/** Documento del administrador mas reciente (contrato vigente para descargar). */
function adminDocReciente(row: SolicitudRow) {
  return [...(row.docsAdjuntos ?? [])]
    .filter((d) => d.userId === null)
    .sort((a, b) => (dateUtils.toMs(b.createdAt) ?? 0) - (dateUtils.toMs(a.createdAt) ?? 0))[0] ?? null;
}

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
    return { key: "sgc", label: REVISION_AREA_SGC_LABEL, estado: RESULTADOS_APROBACION.APROBADO, etiqueta: "Aprobado por el SGC", badge: BADGE_STYLES.SUCCESS, comentario: null };
  }
  /* Devuelto (observado) o rechazado: el cliente debe corregir y volver a firmar. */
  if (
    row.sgcLifecycleStatus === SGC_LIFECYCLE_STATUSES.OBSERVED ||
    row.sgcLifecycleStatus === SGC_LIFECYCLE_STATUSES.REJECTED
  ) {
    return {
      key: "sgc",
      label: REVISION_AREA_SGC_LABEL,
      estado: RESULTADOS_APROBACION.RECHAZADO,
      etiqueta: row.sgcLifecycleStatus === SGC_LIFECYCLE_STATUSES.REJECTED ? "Rechazado por el SGC" : "Devuelto por el SGC",
      badge: BADGE_STYLES.DESTRUCTIVE,
      comentario: row.sgcSubsanacionMotivo ?? "Corrige el contrato y vuelve a subirlo firmado.",
    };
  }
  return {
    key: "sgc",
    label: REVISION_AREA_SGC_LABEL,
    estado: RESULTADOS_APROBACION.PENDIENTE,
    etiqueta: row.sgcEstadoEnvio ? "En revisión en el SGC" : "Delegado al SGC",
    badge: BADGE_STYLES.INFO,
    comentario: null,
  };
}

/** Clases del badge de una revision por area. */
function claseEstadoArea(estado: string): string {
  if (estado === RESULTADOS_APROBACION.APROBADO) return BADGE_STYLES.SUCCESS;
  if (estado === RESULTADOS_APROBACION.RECHAZADO) return BADGE_STYLES.DESTRUCTIVE;
  if (estado === RESULTADOS_APROBACION.OBSERVADO) return BADGE_STYLES.WARNING;
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

/** Dato etiqueta/valor compacto para las bandejas. */
function Dato({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className="truncate text-xs text-foreground">{valor && valor.trim() ? valor : "-"}</p>
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

function MisSolicitudesManagerContent({ eventoId, userId, empresaVerComoId }: { eventoId: string; userId: string; empresaVerComoId?: string }) {
  const searchParams = useSearchParams();
  const soloLectura = Boolean(empresaVerComoId);
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
  const documentoEstadoLabels = useMaestraLabels(
    MAESTRA_TABLAS.DOCUMENTO_ESTADO,
    ESTADOS_DOCUMENTO_SOLICITUD_MAESTRA_ID,
    ESTADOS_DOCUMENTO_SOLICITUD_LABELS,
  );
  const [modifying, setModifying] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [modificarOpen, setModificarOpen] = useState(false);
  const [modificarError, setModificarError] = useState<string | null>(null);
  const [clienteUploadOpen, setClienteUploadOpen] = useState(false);
  const [clienteUploadRow, setClienteUploadRow] = useState<SolicitudRow | null>(null);
  const [clienteUploadModo, setClienteUploadModo] = useState<"contrato" | "anexos">("anexos");
  /** RF-08: preview del recorte del pabellon con el stand destacado. */
  const [recorteBloque, setRecorteBloque] = useState<{ solicitudId: string; bloqueIds: string[]; etiqueta: string } | null>(null);
  const [guardandoRecorte, setGuardandoRecorte] = useState(false);
  const [reenviandoObservacion, setReenviandoObservacion] = useState(false);
  const { confirm, confirmDialog } = useConfirm();
  const recorteRef = useRef<RecortePlanoHandle | null>(null);
  // Vista cuadricula/lista persistida por bandeja (util compartido).
  const { vista: view, setVista: setView } = useVistaBandeja("mis-solicitudes");
  const { session: sesion } = useSesion();
  const puedePagar = (row: SolicitudRow) => !soloLectura && puedePagarNiubizz(row);
  const puedeReevaluar = (row: SolicitudRow) => !soloLectura && puedeSolicitarReevaluacion(row);

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

  /** RF-08 (F2): genera el PNG del recorte y lo guarda en la solicitud para el contrato. */
  const guardarRecortePng = async () => {
    if (!recorteBloque) return;
    const blob = await recorteRef.current?.exportarPng();
    if (!blob) {
      toast.error("No se pudo generar la imagen del recorte");
      return;
    }
    setGuardandoRecorte(true);
    try {
      const archivo = new File([blob], `recorte-${recorteBloque.etiqueta || "stands"}.png`, { type: "image/png" });
      const url = await solicitudesService.subirArchivo(archivo);
      await solicitudesService.guardarRecortePlano({ solicitudId: recorteBloque.solicitudId, url });
      toast.success("Imagen guardada");
      await openDetail(recorteBloque.solicitudId);
    } catch {
      toast.error("No se pudo guardar la imagen del recorte");
    }
    setGuardandoRecorte(false);
  };

  const openClienteUpload = async (row: SolicitudRow, modo: "contrato" | "anexos") => {
    const data = await solicitudesService.detalle(row.id);
    setClienteUploadRow(data);
    setClienteUploadModo(modo);
    setClienteUploadOpen(true);
  };

  /** Reenvio tras observacion local: el backend valida que cada observado tenga reemplazo. */
  const handleReenviarObservacion = async (row: SolicitudRow) => {
    const ok = await confirm({
      title: "Reenviar solicitud a revision",
      description:
        "Se validarán las nuevas versiones de los documentos observados y la solicitud volverá a la revisión del área Asociado. ¿Continuar?",
      confirmLabel: "Reenviar",
    });
    if (!ok) return;
    setReenviandoObservacion(true);
    try {
      await solicitudesService.reenviarObservacion({ solicitudId: row.id });
      toast.success("Solicitud reenviada a revision");
      await openDetail(row.id);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo reenviar la solicitud");
    } finally {
      setReenviandoObservacion(false);
    }
  };

  const load = useCallback(async (p?: number, s?: string, pp?: number) => {
    setLoading(true);
    try {
      const data = await solicitudesService.listar(
        eventoId,
        p ?? pageRef.current,
        pp ?? perPageRef.current,
        s,
        empresaVerComoId ? undefined : userId,
        { empresaId: empresaVerComoId },
      );
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
  }, [eventoId, userId, empresaVerComoId]);

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
      {soloLectura && (
        <p className="mb-3 flex items-start gap-2 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-[11px] text-info">
          <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Vista de solo lectura: estás viendo las solicitudes de la empresa seleccionada.</span>
        </p>
      )}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-semibold text-primary">{soloLectura ? "Solicitudes de la empresa" : "Tus solicitudes"}</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                {pagination.total} {pagination.total === 1 ? "registrada" : "registradas"}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ToggleGroup
                type="single"
                value={view}
                onValueChange={(v) => { if (v === VISTAS_BANDEJA.GRID || v === VISTAS_BANDEJA.ROW) setView(v); }}
                variant="outline"
                size="sm"
                className="h-8"
              >
                <ToggleGroupItem value={VISTAS_BANDEJA.GRID} className="h-8 px-2" title="Vista de tarjetas" aria-label="Vista de tarjetas">
                  <LayoutGrid className="h-3.5 w-3.5" />
                </ToggleGroupItem>
                <ToggleGroupItem value={VISTAS_BANDEJA.ROW} className="h-8 px-2" title="Vista de filas" aria-label="Vista de filas">
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
              <p className="text-sm text-muted-foreground">
                {soloLectura ? "Esta empresa no tiene solicitudes de alquiler." : "No tienes solicitudes de alquiler."}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Cuando realices una reserva desde el plano interactivo, aparecera aqui.</p>
            </div>
          ) : (
            <>
              {view === VISTAS_BANDEJA.GRID ? (
              <div className="space-y-3">
                {rows.map((row) => (
                  <article key={row.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors hover:border-primary/40">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/60 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-mono text-sm font-bold text-primary">
                          {row.standCodes?.length > 1 ? `${row.standCodes.length} stands` : row.standCode}
                        </span>
                        <span className="text-xs text-muted-foreground">{row.tipoStand ?? "-"}</span>
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {dateUtils.formatDateTime(row.createdAt)}
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
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                        <Dato label="Empresa" valor={row.empresa} />
                        <Dato label="Precio" valor={precioTexto(row.precio)} />
                        <Dato label="Estado del stand" valor={row.estado} />
                        <Dato label="Documentos" valor={`${(row.docsAdjuntosCount ?? 0) + ((row.documentos as string[])?.length ?? 0)}`} />
                        <Dato label="Coordenadas (X,Y)" valor={row.pabellon} />
                        <Dato label="Ubicación" valor={row.ubicacion} />
                        <Dato label="Tipo" valor={row.tipoStand} />
                      </div>

                      {Array.isArray(row.imagenes) && row.imagenes.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                            Imagenes ({row.imagenes.length})
                          </span>
                          <div className="flex gap-1.5">
                            {(row.imagenes as string[]).slice(0, 5).map((url, i) => (
                              <button
                                key={`${url}-${i}`}
                                type="button"
                                className="h-9 w-12 overflow-hidden rounded border border-border transition-colors hover:border-primary/40"
                                onClick={() => setImgCarousel({ images: row.imagenes as string[], idx: i })}
                                title={`Ver imagen ${i + 1} del stand`}
                              >
                                { }
                                <img src={url} alt={`Imagen ${i + 1} del stand`} className="h-full w-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

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

                      {(tieneReevaluacionPendiente(row) || faltanDocumentosMultiStand(row) || faltanAnexosReserva(row)) && (
                        <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-warning">
                          <span className="font-semibold">Accion requerida: </span>
                          {tieneReevaluacionPendiente(row)
                            ? "Tienes una re-evaluacion pendiente de revision."
                            : faltanAnexosReserva(row)
                              ? "Faltan anexos obligatorios (Vigencia de Poderes y DNI). Adjuntalos para continuar."
                              : "Faltan documentos por adjuntar para continuar con tu solicitud."}
                        </p>
                      )}

                      {!soloLectura && row.estadoSolicitud === ESTADOS_SOLICITUD.OBSERVADO && (() => {
                        const a = accionesObservacion(row);
                        return (
                          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-warning">
                            <span className="font-semibold">Accion requerida: </span>
                            {a.tieneAnexosObservados
                              ? "El area revisora observo documentos. Sube las nuevas versiones y reenvia."
                              : a.esperandoContratoCorregidoFirmado
                                ? "El contrato firmado fue observado. Espera la version corregida del administrador."
                                : a.contratoCorregidoPendienteFirma
                                  ? "El contrato corregido esta listo. Firmalo y reenvia tu solicitud."
                                  : a.contratoAdminObservado && !a.adminContratoVigente
                                    ? "El contrato fue observado. Espera la version corregida del administrador."
                                    : a.pendientesReemplazo.length === 0
                                      ? "La observacion fue subsanada. Puedes reenviar tu solicitud."
                                      : "El area revisora observo documentos. Sube las nuevas versiones y reenvia."}
                            {row.revisionAsociado?.comentario && (
                              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                {row.revisionAsociado.comentario}
                              </span>
                            )}
                          </p>
                        );
                      })()}

                      <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Paperclip className="h-3.5 w-3.5" />
                          {`${(row.docsAdjuntosCount ?? 0) + ((row.documentos as string[])?.length ?? 0)} doc(s)`}
                        </span>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          {puedePagar(row) && (
                            <Button size="sm" className="w-full justify-center gap-1.5 bg-gold font-bold text-gold-foreground hover:bg-gold/90 sm:w-auto"
                              onClick={() => {
                                if (!row.facturacionId) { toast.error("No se encontro facturacion"); return; }
                                window.location.href = `/dashboard/facturacion/pago?facturacionId=${row.facturacionId}`;
                              }}>
                              <CreditCard className="h-3.5 w-3.5" />
                              <span>Pagar ahora</span>
                            </Button>
                          )}
                          {!soloLectura && contratoClientePendienteFirma(row) && (
                            <Button size="sm" className="w-full justify-center gap-1.5 bg-primary font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
                              onClick={() => { void openClienteUpload(row, "contrato"); }}>
                              <PenLine className="h-3.5 w-3.5" />
                              <span>Firmar contrato</span>
                            </Button>
                          )}
                          {!soloLectura && enVentanaLegalSgc(row) && (
                            <Button size="sm" variant="outline" className="w-full justify-center gap-1.5 border-border sm:w-auto"
                              onClick={() => { void openClienteUpload(row, "anexos"); }}>
                              <Upload className="h-3.5 w-3.5" />
                              <span>Adjuntar documentos</span>
                            </Button>
                          )}
                          {!soloLectura && enVentanaSubsanacionSgc(row) && (
                            <Button size="sm" className="w-full justify-center gap-1.5 bg-emerald-600 font-semibold text-white hover:bg-emerald-700 sm:w-auto"
                              onClick={() => { void openClienteUpload(row, "contrato"); }}>
                              <Upload className="h-3.5 w-3.5" />
                              <span>Corregir: subir contrato firmado</span>
                            </Button>
                          )}
                          {esperandoContratoCorregidoSgc(row) && (
                            <Badge className={`pointer-events-none gap-1 py-1 text-[10px] ${BADGE_STYLES.WARNING}`}>
                              <Clock className="h-3 w-3" />
                              <span>Esperando contrato corregido</span>
                            </Badge>
                          )}
                          {!soloLectura && row.estadoSolicitud === ESTADOS_SOLICITUD.OBSERVADO && (() => {
                            const a = accionesObservacion(row);
                            return (
                              <>
                                {(a.contratoCorregidoPendienteFirma || a.tieneAnexosObservados) && (
                                  <Button size="sm" className="w-full justify-center gap-1.5 sm:w-auto"
                                    onClick={() => {
                                      const modo = a.tieneAnexosObservados ? "anexos" : "contrato";
                                      void openClienteUpload(row, modo);
                                    }}>
                                    {a.tieneAnexosObservados
                                      ? <Upload className="h-3.5 w-3.5" />
                                      : <PenLine className="h-3.5 w-3.5" />}
                                    <span>Subsanar observacion</span>
                                  </Button>
                                )}
                                {((a.contratoAdminObservado && !a.adminContratoVigente) || a.esperandoContratoCorregidoFirmado) && (
                                  <Button size="sm" variant="outline" disabled className="w-full justify-center gap-1.5 sm:w-auto">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>Esperando contrato corregido</span>
                                  </Button>
                                )}
                                <Button size="sm" variant="outline"
                                  className="w-full justify-center gap-1.5 sm:w-auto"
                                  disabled={reenviandoObservacion || a.pendientesReemplazo.length > 0 || a.faltaFirmaContrato}
                                  onClick={() => { void handleReenviarObservacion(row); }}>
                                  {reenviandoObservacion ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                  <span>
                                    {reenviandoObservacion
                                      ? "Reenviando..."
                                      : a.anexosPendientes > 0
                                        ? `Falta subir ${a.anexosPendientes}`
                                        : a.faltaFirmaContrato
                                          ? "Falta firmar contrato"
                                          : "Reenviar a revision"}
                                  </span>
                                </Button>
                              </>
                            );
                          })()}
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
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Tipo</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Empresa</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Precio</TableHead>
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
                        <TableCell className="hidden max-w-[140px] truncate text-xs lg:table-cell">{row.tipoStand ?? "-"}</TableCell>
                        <TableCell className="hidden max-w-[160px] truncate text-xs lg:table-cell">{row.empresa ?? "-"}</TableCell>
                        <TableCell className="hidden whitespace-nowrap text-xs lg:table-cell">{precioTexto(row.precio)}</TableCell>
                        <TableCell className="hidden lg:table-cell"><FlujoRevision row={row} /></TableCell>
                        <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground sm:table-cell">
                          {`${(row.docsAdjuntosCount ?? 0) + ((row.documentos as string[])?.length ?? 0)} doc(s)`}
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground md:table-cell">{dateUtils.formatDateTime(row.createdAt)}</TableCell>
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
                            {puedePagar(row) && (
                              <Button size="sm" className="h-8 gap-1.5 bg-gold text-xs font-bold text-gold-foreground hover:bg-gold/90"
                                onClick={() => {
                                  if (!row.facturacionId) { toast.error("No se encontro facturacion"); return; }
                                  window.location.href = `/dashboard/facturacion/pago?facturacionId=${row.facturacionId}`;
                                }}>
                                <CreditCard className="h-3.5 w-3.5" />
                                <span>Pagar ahora</span>
                              </Button>
                            )}
                            {!soloLectura && contratoClientePendienteFirma(row) && (
                              <Button size="sm" className="h-8 gap-1.5 bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                                onClick={() => { void openClienteUpload(row, "contrato"); }}>
                                <PenLine className="h-3.5 w-3.5" />
                                <span>Firmar contrato</span>
                              </Button>
                            )}
                            {!soloLectura && enVentanaLegalSgc(row) && (
                              <Button size="sm" variant="outline" className="h-8 gap-1.5 border-border text-xs"
                                onClick={() => { void openClienteUpload(row, "anexos"); }}>
                                <Upload className="h-3.5 w-3.5" />
                                <span>Adjuntar documentos</span>
                              </Button>
                            )}
                            {!soloLectura && enVentanaSubsanacionSgc(row) && (
                              <Button size="sm" className="h-8 gap-1.5 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
                                onClick={() => { void openClienteUpload(row, "contrato"); }}>
                                <Upload className="h-3.5 w-3.5" />
                                <span>Corregir: subir contrato firmado</span>
                              </Button>
                            )}
                            {esperandoContratoCorregidoSgc(row) && (
                              <Badge className={`pointer-events-none gap-1 py-1 text-[10px] ${BADGE_STYLES.WARNING}`}>
                                <Clock className="h-3 w-3" />
                                <span>Esperando contrato corregido</span>
                              </Badge>
                            )}
                          {!soloLectura && row.estadoSolicitud === ESTADOS_SOLICITUD.OBSERVADO && (() => {
                            const a = accionesObservacion(row);
                            return (
                              <>
                                {(a.contratoCorregidoPendienteFirma || a.tieneAnexosObservados) && (
                                  <Button size="sm" className="w-full justify-center gap-1.5 sm:w-auto"
                                    onClick={() => {
                                      const modo = a.tieneAnexosObservados ? "anexos" : "contrato";
                                      void openClienteUpload(row, modo);
                                    }}>
                                    {a.tieneAnexosObservados
                                      ? <Upload className="h-3.5 w-3.5" />
                                      : <PenLine className="h-3.5 w-3.5" />}
                                    <span>Subsanar observacion</span>
                                  </Button>
                                )}
                                {((a.contratoAdminObservado && !a.adminContratoVigente) || a.esperandoContratoCorregidoFirmado) && (
                                  <Button size="sm" variant="outline" disabled className="w-full justify-center gap-1.5 sm:w-auto">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>Esperando contrato corregido</span>
                                  </Button>
                                )}
                                <Button size="sm" variant="outline"
                                  className="w-full justify-center gap-1.5 sm:w-auto"
                                  disabled={reenviandoObservacion || a.pendientesReemplazo.length > 0 || a.faltaFirmaContrato}
                                  onClick={() => { void handleReenviarObservacion(row); }}>
                                  {reenviandoObservacion ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                  <span>
                                    {reenviandoObservacion
                                      ? "Reenviando..."
                                      : a.anexosPendientes > 0
                                        ? `Falta subir ${a.anexosPendientes}`
                                        : a.faltaFirmaContrato
                                          ? "Falta firmar contrato"
                                          : "Reenviar a revision"}
                                  </span>
                                </Button>
                              </>
                            );
                          })()}
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
                  {pagination.total} resultados — página {pagination.page} de {pagination.totalPages || 1}
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
              <ModalSection title="Informacion general" meta={dateUtils.formatDateTime(detailRow.createdAt)}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  <div className="space-y-0.5">
                    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Stand</span>
                    <span className="font-mono text-xs font-semibold text-foreground">{standTitulo(detailRow)}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Tipo</span>
                    <span className="text-xs text-foreground">{detailRow.tipoStand ?? "-"}</span>
                  </div>
                </div>
                {(detailRow.standCodes?.length ?? 0) > 1 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {detailRow.standCodes.map((codigo) => (
                      <span key={codigo} className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">{codigo}</span>
                    ))}
                  </div>
                )}
                {(detailRow.standsDetalle?.length ?? 0) > 1 ? (
                  (() => {
                    const grupos = new Map<string, { planoId: string; planoNombre: string; stands: string[]; bloqueIds: string[] }>();
                    const sinUbicacion: string[] = [];
                    for (const s of detailRow.standsDetalle ?? []) {
                      if (!s.bloqueId || !s.planoId) { sinUbicacion.push(s.standCode); continue; }
                      const grupo = grupos.get(s.planoId) ?? {
                        planoId: s.planoId,
                        planoNombre: s.planoNombre ?? s.planoCodigo ?? "Pabellón",
                        stands: [],
                        bloqueIds: [],
                      };
                      grupo.stands.push(s.standCode);
                      grupo.bloqueIds.push(s.bloqueId);
                      grupos.set(s.planoId, grupo);
                    }
                    return (
                      <div className="mt-3 space-y-2">
                        {[...grupos.values()].map((g) => (
                          <div key={g.planoId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                            <div className="flex min-w-32 flex-col">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.planoNombre}</span>
                              <span className="font-mono text-[10px] font-bold text-primary">{g.stands.join(", ")}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-full text-xs"
                                onClick={() => setRecorteBloque({ solicitudId: detailRow.id, bloqueIds: g.bloqueIds, etiqueta: g.stands.join("-") })}
                              >
                                <MapPin className="mr-1.5 h-3.5 w-3.5" />
                                <span>Ver ubicación</span>
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 rounded-full text-xs" asChild>
                                <Link href={`/mapa?bloque=${encodeURIComponent(g.bloqueIds[0]!)}`}>
                                  <MapIcon className="mr-1.5 h-3.5 w-3.5" />
                                  <span>Ver en el mapa</span>
                                </Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                        {sinUbicacion.length > 0 && (
                          <p className="text-[11px] text-muted-foreground">
                            <span>Sin ubicación en el plano: {sinUbicacion.join(", ")}</span>
                          </p>
                        )}
                      </div>
                    );
                  })()
                ) : detailRow.bloqueId ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full text-xs"
                      onClick={() => setRecorteBloque({ solicitudId: detailRow.id, bloqueIds: [detailRow.bloqueId!], etiqueta: detailRow.standCode || detailRow.bloqueId! })}
                    >
                      <MapPin className="mr-1.5 h-3.5 w-3.5" />
                      <span>Ver ubicación en el plano</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 rounded-full text-xs" asChild>
                      <Link href={`/mapa?bloque=${encodeURIComponent(detailRow.bloqueId)}`}>
                        <MapIcon className="mr-1.5 h-3.5 w-3.5" />
                        <span>Ver en el mapa</span>
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </ModalSection>

              {/* Empresa montajista (con la reserva pagada/oficializada) */}
              {detailRow.estadoSolicitud === ESTADOS_SOLICITUD.PAGADO && (
                <MontajistaAsignada
                  standApiId={detailRow.standApiId}
                  standCode={detailRow.standCode}
                  asignadaId={detailRow.empresaMontajistaId}
                  asignadaNombre={detailRow.empresaMontajistaNombre}
                  tipoEvento={sesion?.tipoEvento ?? 0}
                  codigoEvento={sesion?.codigoEvento ?? 0}
                  onChanged={() => { void openDetail(detailRow.id); }}
                />
              )}

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
                <ModalSection title="Expediente y documentacion" meta={`${(detailRow.docsAdjuntosCount ?? 0) + ((detailRow.documentos as string[])?.length ?? 0)} documento(s)`}>
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
                    const contratoFirmado = detailRow.docsAdjuntos.filter(doc => doc.userId === detailRow.userId && doc.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO);
                    const anexosCliente = detailRow.docsAdjuntos.filter(doc => doc.userId === detailRow.userId && doc.categoria !== TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO);
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
                        {contratoFirmado.length > 0 && (
                          <div>
                            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tu contrato firmado ({contratoFirmado.length})</p>
                            <div className="space-y-0.5 rounded-md border border-gold/30 bg-gold/10 p-2">
                              {contratoFirmado.map((doc, i) => (
                                <div key={i} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs group">
                                  <FileText className="h-3.5 w-3.5 shrink-0 text-gold" />
                                  <a href={doc.url} target="_blank" className="text-amber-800 hover:text-amber-900 transition-colors truncate flex-1 font-medium">{doc.nombre}</a>
                                  {doc.estado === ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO && (
                                    <Badge className={`pointer-events-none shrink-0 text-[9px] ${BADGE_STYLES.WARNING}`} title={doc.motivoObservacion ?? undefined}><span>{documentoEstadoLabels[ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO]}</span></Badge>
                                  )}
                                  {doc.estado === ESTADOS_DOCUMENTO_SOLICITUD.REEMPLAZADO && (
                                    <Badge className={`pointer-events-none shrink-0 text-[9px] ${BADGE_STYLES.NEUTRAL}`}><span>{documentoEstadoLabels[ESTADOS_DOCUMENTO_SOLICITUD.REEMPLAZADO]}</span></Badge>
                                  )}
                                  <span className="text-[10px] text-muted-foreground shrink-0">{doc.uploadedBy ? `${doc.uploadedBy} · ` : ""}{dateUtils.formatDateTime(doc.createdAt)}</span>
                                  <a href={doc.url} target="_blank" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground shrink-0">
                                    <Eye className="h-3 w-3" />
                                  </a>
                                  {!soloLectura && puedeEliminarDocumentoActual(detailRow, doc) && (
                                    <button className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setDeleteConfirm(doc.id);
                                      }}>
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {anexosCliente.length > 0 && (
                          <div>
                            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tus documentos ({anexosCliente.length})</p>
                            <div className="space-y-0.5 rounded-md border border-success/30 bg-success/10 p-2">
                              {anexosCliente.map((doc, i) => (
                                <div key={i} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs group">
                                  <FileText className="h-3.5 w-3.5 shrink-0 text-success" />
                                  <a href={doc.url} target="_blank" className="text-success hover:text-success transition-colors truncate flex-1 font-medium">{doc.nombre}</a>
                                  {doc.estado === ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO && (
                                    <Badge className={`pointer-events-none shrink-0 text-[9px] ${BADGE_STYLES.WARNING}`} title={doc.motivoObservacion ?? undefined}><span>{documentoEstadoLabels[ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO]}</span></Badge>
                                  )}
                                  {doc.estado === ESTADOS_DOCUMENTO_SOLICITUD.REEMPLAZADO && (
                                    <Badge className={`pointer-events-none shrink-0 text-[9px] ${BADGE_STYLES.NEUTRAL}`}><span>{documentoEstadoLabels[ESTADOS_DOCUMENTO_SOLICITUD.REEMPLAZADO]}</span></Badge>
                                  )}
                                  <span className="text-[10px] text-muted-foreground shrink-0">{doc.uploadedBy ? `${doc.uploadedBy} · ` : ""}{dateUtils.formatDateTime(doc.createdAt)}</span>
                                  <a href={doc.url} target="_blank" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground shrink-0">
                                    <Eye className="h-3 w-3" />
                                  </a>
                                  {!soloLectura && puedeEliminarDocumentoActual(detailRow, doc) && (
                                    <button className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setDeleteConfirm(doc.id);
                                      }}>
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
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

              {/* Contrato disponible: el cliente debe firmar y subirlo */}
              {!soloLectura && detailRow && contratoClientePendienteFirma(detailRow) && detailRow.flgActivo !== false && (
                <ModalSection title="Firma del contrato">
                  <div className="flex flex-col gap-3 rounded-lg border border-info/30 bg-info/10 p-3">
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                      <div>
                        <p className="text-xs font-semibold text-info">Firma del contrato</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                          El IIMP habilitó la firma de tu contrato. Firma digitalmente desde aquí; no se admite subir un contrato firmado manualmente.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {(() => {
                        const adminDoc = adminDocReciente(detailRow);
                        return adminDoc ? (
                          <Button size="sm" variant="outline" className="w-full gap-1.5 sm:w-auto" asChild>
                            <a href={adminDoc.url} target="_blank" rel="noopener noreferrer">
                              <FileText className="h-3.5 w-3.5" />
                              <span>Descargar contrato</span>
                            </a>
                          </Button>
                        ) : null;
                      })()}
                      <Button size="sm" className="w-full gap-1.5 sm:w-auto"
                        onClick={() => { void openClienteUpload(detailRow, "contrato"); }}>
                        <PenLine className="h-3.5 w-3.5" />
                        <span>Firmar contrato</span>
                      </Button>
                    </div>
                  </div>
                </ModalSection>
              )}

              {/* Ventana Legal (SGC): adjuntar anexos antes del envio al SGC */}
              {!soloLectura && detailRow && enVentanaLegalSgc(detailRow) && detailRow.flgActivo !== false && (
                <ModalSection title="Accion requerida">
                  <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/10 p-3">
                    <div className="flex items-start gap-3">
                      <Upload className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="text-xs font-semibold text-primary">Adjuntar documentos (Legal — SGC)</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Antes de enviar el contrato y los documentos adjuntos al SGC, adjunta los documentos requeridos:
                          Ficha RUC, Vigencia de Poder y DNI o Pasaporte del Representante Legal.
                        </p>
                      </div>
                    </div>
                    <Button size="sm" className="w-full gap-1.5 sm:w-auto"
                      onClick={() => { void openClienteUpload(detailRow, "anexos"); }}>
                      <Upload className="h-3.5 w-3.5" />
                      <span>Adjuntar anexos</span>
                    </Button>
                  </div>
                </ModalSection>
              )}

              {/* Subsanación SGC: el cliente descarga el contrato vigente y sube el firmado */}
              {!soloLectura && detailRow && enVentanaSubsanacionSgc(detailRow) && detailRow.flgActivo !== false && (
                <ModalSection title="Accion requerida">
                  <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                    <div className="flex items-start gap-3">
                      <Upload className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      <div>
                        <p className="text-xs font-semibold text-destructive">Corregir: subir contrato firmado</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                          {detailRow.sgcSubsanacionMotivo ?? "El SGC devolvió el trámite y debes corregir el contrato."}
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          Descarga la versión vigente del contrato, fírmala y súbela para que la administración lo reenvíe al SGC.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {(() => {
                        const adminDoc = adminDocReciente(detailRow);
                        return adminDoc ? (
                          <Button size="sm" variant="outline" className="w-full gap-1.5 sm:w-auto" asChild>
                            <a href={adminDoc.url} target="_blank" rel="noopener noreferrer">
                              <FileText className="h-3.5 w-3.5" />
                              <span>Descargar contrato</span>
                            </a>
                          </Button>
                        ) : null;
                      })()}
                      <Button size="sm" className="w-full gap-1.5 sm:w-auto"
                        onClick={() => { void openClienteUpload(detailRow, "contrato"); }}>
                        <PenLine className="h-3.5 w-3.5" />
                        <span>Firmar contrato</span>
                      </Button>
                    </div>
                  </div>
                </ModalSection>
              )}

              {/* El admin declaró un contrato nuevo: el cliente espera a que lo adjunte */}
              {detailRow && esperandoContratoCorregidoSgc(detailRow) && detailRow.flgActivo !== false && (
                <ModalSection title="Accion requerida">
                  <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <div>
                      <p className="text-xs font-semibold text-warning">Esperando contrato corregido</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-warning">
                        La administración del IIMP está preparando una nueva versión del contrato.
                        Cuando esté disponible podrás descargarla, firmarla y subirla.
                      </p>
                      {detailRow.sgcSubsanacionMotivo && (
                        <p className="mt-1 text-[11px] italic text-muted-foreground">&quot;{detailRow.sgcSubsanacionMotivo}&quot;</p>
                      )}
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
              {!soloLectura && faltanDocumentosMultiStand(detailRow) && (
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
          {detailRow && (puedePagar(detailRow) || puedeReevaluar(detailRow)) && (
            <DialogFooter className="shrink-0 flex-row justify-end gap-2 border-t border-border pt-3">
              {puedePagar(detailRow) && (
                <Button size="sm" variant="default" className="gap-1.5 text-xs font-semibold"
                  onClick={() => toast.info("Redirigiendo a la pasarela de pago Niubizz...")}>
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>Pagar con Niubizz</span>
                </Button>
              )}
              {puedeReevaluar(detailRow) && (
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
        <DialogContent className="sm:max-w-2xl max-h-[92vh] flex flex-col !px-0 !py-0 overflow-hidden">
          {clienteUploadRow && (
            <ClienteUploadModal
              solicitud={clienteUploadRow}
              modo={clienteUploadModo}
              onClose={() => setClienteUploadOpen(false)}
              onSaved={() => {
                void load(page, search, perPage);
                if (detailOpen && detailRow) void openDetail(detailRow.id);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modificar dialog */}
      <Dialog open={modificarOpen} onOpenChange={setModificarOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] flex flex-col !px-0 !py-0 overflow-hidden">
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

      {/* RF-08: recorte del pabellon con el stand destacado */}
      {recorteBloque && (
        <Dialog open onOpenChange={() => setRecorteBloque(null)}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                <span>{recorteBloque.bloqueIds.length > 1 ? `Ubicación de los stands ${recorteBloque.etiqueta}` : `Ubicación del stand ${recorteBloque.etiqueta}`}</span>
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              Tu stand está resaltado en el pabellón para que ubiques su posición respecto de los demás stands.
            </p>
            <RecortePlano key={recorteBloque.bloqueIds.join("|")} ref={recorteRef} bloqueIds={recorteBloque.bloqueIds} />
            <DialogFooter>
              <div className="flex w-full flex-wrap items-center justify-between gap-2">
                {detailRow?.id === recorteBloque.solicitudId && detailRow?.recortePlanoUrl ? (
                  <a href={detailRow.recortePlanoUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary hover:underline">
                    <span>Ver imagen guardada</span>
                  </a>
                ) : <span />}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => setRecorteBloque(null)}>
                    <span>Cerrar</span>
                  </Button>
                  {!soloLectura && (
                    <Button size="sm" className="rounded-full text-xs" disabled={guardandoRecorte} onClick={() => { void guardarRecortePng(); }}>
                      {guardandoRecorte ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ImageDown className="mr-1.5 h-3.5 w-3.5" />}
                      <span>Guardar imagen</span>
                    </Button>
                  )}
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {confirmDialog}
    </>
  );
}

export function MisSolicitudesManager({ eventoId, userId, empresaVerComoId }: { eventoId: string; userId: string; empresaVerComoId?: string }) {
  return (
    <Suspense fallback={null}>
      <MisSolicitudesManagerContent eventoId={eventoId} userId={userId} empresaVerComoId={empresaVerComoId} />
    </Suspense>
  );
}
