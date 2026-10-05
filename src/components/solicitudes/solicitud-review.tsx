"use client";

import { useState } from "react";
import { Button, Badge, Textarea, Label, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@nrivera-iimp/ui-kit-iimp";
import { CheckCircle2, XCircle, Clock, UserCircle2, ChevronLeft, ChevronRight, FileText, Pencil, Eye, Download, ExternalLink } from "lucide-react";
import {
  REVISION_AREAS,
  REVISION_AREA_LABELS,
  REVISION_AREA_PERMISSIONS,
  REVISION_AREA_SGC_STEP,
  RESULTADOS_APROBACION,
  BADGE_STYLES,
  PERMISSIONS,
  TIPOS_DOCUMENTO_SOLICITUD,
  CATEGORIAS_DOCUMENTO,
  SGC_LIFECYCLE_STATUSES,
  ESTADOS_SOLICITUD,
  ANEXOS_REQUERIDOS,
  type ResultadoAprobacion,
} from "@/lib/shared/constants";
import { areasRevisionLocal, legalDelegadaAlSgc } from "@/lib/shared/utils/revision-areas";
import { anexosBloqueantesFaltantes, hayContratoAdminNuevoParaFirmar, modoSubsanacionEfectivo } from "@/lib/shared/utils/solicitud-documentos";
import { solicitudesService } from "@/lib/client/api/services/solicitudes-service";
import { sgcService } from "@/lib/client/api/services/sgc-service";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/use-confirm";
import type { SolicitudDTO } from "@/types/dto/solicitudes/solicitudes-response.dto";
import { RevisionStepIndicator } from "./revision-step-indicator";
import { MontajistaAsignada } from "./montajista-asignada";
import { useSesion } from "@/hooks/use-sesion";
import { SgcExpedientePanel } from "@/components/sgc/sgc-expediente-panel";
import { SgcDocumentoUpload } from "@/components/sgc/sgc-documento-upload";
import { dateUtils } from "@/lib/shared/utils/date";
import { stringUtils } from "@/lib/shared/utils/string";
import { puedeGenerarOrdenPago, sgcAprobado } from "@/lib/shared/utils/sgc-estado";

type SolicitudRow = SolicitudDTO;

interface RevisionData {
  id: string;
  solicitudId: string;
  area: string;
  estado: string;
  comentario: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
}

function getRevision(row: SolicitudRow, area: string): RevisionData | null {
  return row.revisiones.find((r) => r.area === area) ?? null;
}

/** Etiqueta del requisito de un documento (RF-13): Ficha RUC, Vigencia de Poder, DNI/Pasaporte. */
function etiquetaRequisito(requisito?: string | null): string | null {
  return ANEXOS_REQUERIDOS.find((a) => a.key === requisito)?.label ?? null;
}

/** Tipo de vista previa segun la extension del archivo. */
function tipoPreview(url: string): "pdf" | "imagen" | "otro" {
  const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext)) return "imagen";
  return "otro";
}

function canReviewArea(permissions: string[], area: string): boolean {
  const perm = REVISION_AREA_PERMISSIONS[area as keyof typeof REVISION_AREA_PERMISSIONS];
  if (!perm) return false;
  return permissions.includes(perm) || permissions.includes(PERMISSIONS.ADMIN_FULL);
}

export function SolicitudReview({
  row,
  userPermissions,
  onSaved,
  onClose,
  onOrdenPago,
}: {
  row: SolicitudRow;
  userPermissions: string[];
  onSaved: (updated: SolicitudRow) => void;
  onClose: () => void;
  onOrdenPago?: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [reviewState, setReviewState] = useState<Record<string, { accion: string; comentario: string }>>({
    [REVISION_AREAS.ASOCIADO]: { accion: row.revisionAsociado?.estado ?? RESULTADOS_APROBACION.PENDIENTE, comentario: row.revisionAsociado?.comentario ?? "" },
    [REVISION_AREAS.LEGAL]: { accion: row.revisionLegal?.estado ?? RESULTADOS_APROBACION.PENDIENTE, comentario: row.revisionLegal?.comentario ?? "" },
  });
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [confirmReject, setConfirmReject] = useState<{ area: string; accion: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [aprobandoBypass, setAprobandoBypass] = useState(false);
  /** Documento en vista previa (modal en la misma vista). */
  const [previewDoc, setPreviewDoc] = useState<{ url: string; nombre: string } | null>(null);
  const { confirm, confirmDialog } = useConfirm();
  const { session } = useSesion();

  const areas = areasRevisionLocal(row.revisiones);
  // El SGC es el ultimo paso (Legal delegada) SOLO si la integracion esta habilitada.
  const legalDelegada = legalDelegadaAlSgc(row.revisiones);
  const mostrarSgc = row.sgcEnabled && legalDelegada;
  const sgcStepIndex = areas.length;
  const stepAreas: Record<number, string> = {
    ...Object.fromEntries(areas.map((area, idx) => [idx, area])),
    ...(mostrarSgc ? { [sgcStepIndex]: REVISION_AREA_SGC_STEP } : {}),
  };
  const totalSteps = areas.length + (mostrarSgc ? 1 : 0);
  const isAdmin = userPermissions.includes(PERMISSIONS.ADMIN_FULL);
  const esPasoSgc = mostrarSgc && currentStep === sgcStepIndex;
  const isLast = currentStep === totalSteps - 1;
  const isFirst = currentStep === 0;

  /** BYPASS SOLO ADMIN: aprueba Legal (SGC) sin esperar al SGC real. */
  const aprobarLegalBypass = async () => {
    const ok = await confirm({
      title: "Aprobar Legal (SGC) — bypass admin",
      description:
        "Marca el expediente como aprobado (Vigente) sin esperar la aprobacion real del SGC, para habilitar la orden de pago. ¿Continuar?",
      confirmLabel: "Aprobar",
      destructive: true,
    });
    if (!ok) return;
    setAprobandoBypass(true);
    try {
      await sgcService.aprobarBypass(row.id);
      toast.success("Legal (SGC) aprobado (bypass admin)");
      onSaved(row);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al aprobar el SGC");
    } finally {
      setAprobandoBypass(false);
    }
  };

  /* Documentos legacy del stand (columna JSON `documentos`, normalizados). */
  const documentosLegacy = ((row.documentos as string[]) ?? []).map((url) => ({
    url,
    nombre: stringUtils.nombreArchivo(url),
    categoria: row.documentosCategorias?.[url],
  }));

  /* Contrato para el SGC, por prioridad (igual que `sgc-integracion-service.seleccionarContrato`):
     1) firmado por el cliente (`contrato_firmado`), 2) v1 del administrador (`userId` null),
     3) documento legacy (reserva de 1 stand, que sube el contrato al reservar). */
  const contratoFirmadoCliente = row.docsAdjuntos
    .filter((d) => d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO)
    .map((d) => ({ nombre: d.nombre, url: d.url }));
  const contratosSolicitud = row.docsAdjuntos
    .filter((d) => d.userId === null)
    .map((d) => ({ nombre: d.nombre, url: d.url }));
  const contratoSgc = [...contratoFirmadoCliente, ...contratosSolicitud];
  if (contratoSgc.length === 0) {
    // Si el admin categorizo un documento legacy como "contrato", se prefiere ese.
    const legacyContrato = documentosLegacy.find((d) => d.categoria === CATEGORIAS_DOCUMENTO.CONTRATO) ?? documentosLegacy[0];
    if (legacyContrato) contratoSgc.push(legacyContrato);
  }
  const tieneContrato = contratoSgc.length > 0;
  const contratoUrl = contratoSgc[0]?.url;
  /* El admin ya adjunto un contrato posterior al ultimo firmado del cliente (subsanacion). */
  const tieneContratoAdminNuevo = hayContratoAdminNuevoParaFirmar(row);

  /* Anexos: documentos del cliente (tabla, sin el contrato firmado) + legacy, deduplicados,
     excluyendo el que ya se usa como contrato. */
  const anexosMap = new Map<string, { nombre: string; url: string }>();
  for (const d of documentosLegacy) anexosMap.set(d.url, d);
  for (const d of row.docsAdjuntos.filter((x) => x.userId !== null && x.categoria !== TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO)) {
    anexosMap.set(d.url, { nombre: d.nombre, url: d.url });
  }
  if (contratoUrl) anexosMap.delete(contratoUrl);
  const anexosSolicitud = [...anexosMap.values()];

  const goToStep = (step: number) => {
    setEditing(false);
    setSubmitError(null);
    setCurrentStep(step);
  };

  const stepState = (area: string): ResultadoAprobacion => {
    const rev = getRevision(row, area);
    return (rev?.estado as ResultadoAprobacion) ?? RESULTADOS_APROBACION.PENDIENTE;
  };

  const handleReview = async (area: string, accion: string) => {
    const state = reviewState[area];
    if (!state) return;

    if (accion === RESULTADOS_APROBACION.RECHAZADO && !state.comentario.trim()) {
      setValidationErrors((prev) => ({ ...prev, [area]: "La justificacion es obligatoria para rechazar" }));
      return;
    }

    setValidationErrors((prev) => ({ ...prev, [area]: "" }));
    setSubmitting(area);
    setSubmitError(null);
    try {
      const saved = await solicitudesService.revisar({
        solicitudId: row.id,
        area,
        estado: accion,
        comentario: state.comentario || undefined,
      });
      const updated = { ...row };
      const idx = updated.revisiones.findIndex((r) => r.area === area);
      const mappedRev: SolicitudRow["revisiones"][number] = {
        id: saved.id,
        solicitudId: saved.solicitudId,
        area: saved.area,
        estado: saved.estado,
        comentario: saved.comentario,
        createdBy: saved.createdBy,
        updatedBy: saved.updatedBy,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      };
      if (idx >= 0) {
        updated.revisiones = [...updated.revisiones];
        updated.revisiones[idx] = mappedRev;
      } else {
        updated.revisiones = [...updated.revisiones, mappedRev];
      }
      updated.revisionAsociado = updated.revisiones.find((r) => r.area === REVISION_AREAS.ASOCIADO) ?? null;
      updated.revisionLegal = updated.revisiones.find((r) => r.area === REVISION_AREAS.LEGAL) ?? null;
      onSaved(updated);
      setEditing(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Error al guardar la revision");
    }
    setSubmitting(null);
  };

  const handleRechazar = () => {
    const state = reviewState[currentArea];
    if (!state || !state.comentario.trim()) {
      setValidationErrors((prev) => ({ ...prev, [currentArea]: "La justificacion es obligatoria para rechazar" }));
      return;
    }
    setConfirmReject({ area: currentArea, accion: RESULTADOS_APROBACION.RECHAZADO });
  };

  const currentArea = stepAreas[currentStep] ?? areas[0] ?? REVISION_AREAS.ASOCIADO;
  const currentRev = getRevision(row, currentArea);
  const canReview = canReviewArea(userPermissions, currentArea);
  const todasAprobadas = areas.every((area) => {
    const rev = getRevision(row, area);
    return rev?.estado === RESULTADOS_APROBACION.APROBADO;
  });
  const requiereSgc = mostrarSgc;
  const sgcOk = sgcAprobado(row.sgcLifecycleStatus);
  // El SGC devolvio (observed) o rechazo (rejected): ahi si se puede reemplazar el contrato.
  const sgcSubsanable =
    row.sgcLifecycleStatus === SGC_LIFECYCLE_STATUSES.OBSERVED ||
    row.sgcLifecycleStatus === SGC_LIFECYCLE_STATUSES.REJECTED;
  // Con el contrato ya enviado al SGC no se ofrece reemplazarlo hasta que lo devuelva/rechace.
  const puedeReemplazarContrato = !row.sgcDocumentosEnviados || sgcSubsanable;
  const puedeOrdenPago = todasAprobadas && puedeGenerarOrdenPago(requiereSgc, row.sgcLifecycleStatus);

  // Linear flow: can only go to step N if step N-1 is done
  const stepCanGo = (step: number): boolean => {
    if (mostrarSgc && step === sgcStepIndex) return todasAprobadas;
    if (step === 0) return true;
    const prevArea = stepAreas[step - 1];
    if (!prevArea) return false;
    const prevRev = getRevision(row, prevArea);
    return prevRev !== null && prevRev.estado !== RESULTADOS_APROBACION.PENDIENTE;
  };
  const canAdvance = currentRev !== null && currentRev.estado !== RESULTADOS_APROBACION.PENDIENTE;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ===== HEADER ===== */}
      <div className="shrink-0 space-y-3 border-b border-border px-5 pt-4 pb-3">
        <div className="pr-6">
          <h2 className="text-sm font-semibold text-foreground">Revisar solicitud</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-mono font-medium text-foreground">{row.standCode}</span>
            {row.bloqueId && (
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground/50">·</span>
                <span>{row.bloqueId}</span>
              </span>
            )}
            {row.tipoStand && (
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground/50">·</span>
                <span>{row.tipoStand}</span>
              </span>
            )}
            {row.empresa && (
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground/50">·</span>
                <span className="max-w-[200px] truncate">{row.empresa}</span>
              </span>
            )}
          </div>
        </div>

        <RevisionStepIndicator
          currentStep={currentStep}
          stepState={stepState}
          onGoStep={goToStep}
          stepCanGo={stepCanGo}
          areas={areas}
          mostrarSgc={mostrarSgc}
          sgcDone={sgcOk}
          sgcCurrent={esPasoSgc}
          sgcCanGo={todasAprobadas}
          onGoSgc={() => goToStep(sgcStepIndex)}
        />

        {/* Client documents */}
        {(() => {
          const docs: Array<{ url: string; nombre: string; fecha?: string; origen: string; categoria?: string; requisito?: string | null }> = [];

          // Single-stand: documentos JSON field (client-submitted at solicitud creation)
          const jsonDocs = (row.documentos as string[]) ?? [];
          for (const url of jsonDocs) {
            docs.push({ url, nombre: stringUtils.nombreArchivo(url), origen: "solicitud", categoria: row.documentosCategorias?.[url] });
          }

          // Multi-stand: client's docsAdjuntos
          const clienteDocs = (row.docsAdjuntos ?? []).filter(d => d.userId === row.userId);
          for (const d of clienteDocs) {
            docs.push({ url: d.url, nombre: d.nombre, fecha: d.createdAt, origen: "adjunto", categoria: d.categoria ?? undefined, requisito: d.requisito });
          }

          // Re-evaluacion documents
          for (const reev of row.reevaluaciones ?? []) {
            const reevDocs = (reev.documentos as string[]) ?? [];
            for (const url of reevDocs) {
              docs.push({ url, nombre: stringUtils.nombreArchivo(url), fecha: reev.createdAt, origen: "reevaluacion" });
            }
          }

          // Deduplicate by URL
          const seen = new Set<string>();
          const unique = docs.filter(d => { if (seen.has(d.url)) return false; seen.add(d.url); return true; });

          if (unique.length === 0) return null;

          return (
            <div className="border-t border-border pt-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Documentos adjuntos</h4>
                <span className="text-[11px] text-muted-foreground">{unique.length} archivo(s)</span>
              </div>
              <div className="space-y-1">
                {unique.map((doc, i) => {
                  const esContrato = doc.url === contratoUrl || doc.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO;
                  const requisitoLabel = etiquetaRequisito(doc.requisito);
                  const etiqueta = esContrato
                    ? "Contrato"
                    : doc.categoria === TIPOS_DOCUMENTO_SOLICITUD.ANEXO
                      ? "Documento adjunto"
                      : doc.origen === "reevaluacion"
                        ? "Re-evaluacion"
                        : "Documento adjunto";
                  return (
                    <div
                      key={i}
                      className="group flex items-center gap-2 rounded-lg border border-border bg-secondary px-2.5 py-2 text-xs transition-colors hover:border-success/30 hover:bg-success/10"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-success" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground group-hover:text-success">{doc.nombre}</p>
                        {requisitoLabel && (
                          <p className="truncate text-[10px] text-muted-foreground">{requisitoLabel}</p>
                        )}
                      </div>
                      <Badge className={`pointer-events-none shrink-0 text-[9px] ${esContrato ? BADGE_STYLES.INFO : BADGE_STYLES.NEUTRAL}`}>
                        <span>{etiqueta}</span>
                      </Badge>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{doc.fecha ? dateUtils.formatDateTime(doc.fecha) : "—"}</span>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                          title="Vista previa"
                          onClick={() => setPreviewDoc({ url: doc.url, nombre: doc.nombre })}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                          title="Descargar"
                          asChild
                        >
                          <a href={doc.url} download={doc.nombre}>
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                          title="Abrir en otra pestaña"
                          asChild
                        >
                          <a href={doc.url} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ===== BODY ===== */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {submitError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {submitError}
          </div>
        )}

        {/* Empresa montajista (solo admin, con la reserva pagada/oficializada) */}
        {isAdmin && row.estadoSolicitud === ESTADOS_SOLICITUD.PAGADO && (
          <MontajistaAsignada
            standApiId={row.standApiId}
            standCode={row.standCode}
            asignadaId={row.empresaMontajistaId}
            asignadaNombre={row.empresaMontajistaNombre}
            tipoEvento={session?.tipoEvento ?? 0}
            codigoEvento={session?.codigoEvento ?? 0}
            onChanged={() => onSaved(row)}
          />
        )}

        {/* Integracion SGC — revision Legal delegada (ultimo paso) */}
        {esPasoSgc && (
          <div className="space-y-3 rounded-lg border border-border bg-secondary/40 p-4">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Revision Legal (SGC)</h4>
            <SgcExpedientePanel
              key={`${row.sgcEstadoEnvio ?? "none"}-${row.sgcLifecycleStatus ?? "none"}-${row.sgcSubsanacionMotivo ?? "none"}-${row.sgcSubsanacionModo ?? "none"}`}
              solicitudId={row.id}
              tieneContratoAdmin={tieneContrato}
              tieneContratoAdminNuevo={tieneContratoAdminNuevo}
              tieneAnexos={anexosSolicitud.length > 0}
              requisitosFaltantes={anexosBloqueantesFaltantes(row.docsAdjuntos)}
              tieneContratoFirmado={row.docsAdjuntos.some(
                (d) => d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
              )}
              motivo={row.sgcSubsanacionMotivo}
              modo={modoSubsanacionEfectivo(row)}
              onSolicitudChanged={() => onSaved(row)}
              onSynced={(s) => {
                /* Si lo sincronizado difiere de la fila, refrescamos para actualizar
                   el step Legal (SGC) y habilitar la orden de pago (flujo regular). */
                if (s.lifecycleStatus !== row.sgcLifecycleStatus || s.stage !== row.sgcStage) {
                  onSaved(row);
                }
              }}
            />
            {!sgcOk && (
              <>
                {puedeReemplazarContrato && (
                  <SgcDocumentoUpload
                    solicitudId={row.id}
                    tipo={TIPOS_DOCUMENTO_SOLICITUD.CONTRATO}
                    titulo={sgcSubsanable ? "Contrato corregido (v1)" : "Contrato (v1)"}
                    archivos={contratoSgc}
                    ctaVacio={sgcSubsanable ? "Subir contrato corregido (v1)" : "Adjuntar contrato (v1)"}
                    ctaConArchivos={sgcSubsanable ? "Reemplazar con contrato corregido (v1)" : "Reemplazar contrato (v1)"}
                    vacioTexto="Aún no hay contrato: ni el firmado por el cliente ni el contrato (v1) del administrador."
                    varios={false}
                    onAttached={() => onSaved(row)}
                  />
                )}
                <SgcDocumentoUpload
                  solicitudId={row.id}
                  tipo={TIPOS_DOCUMENTO_SOLICITUD.ANEXO}
                  titulo="Documentos adjuntos"
                  hint={ANEXOS_REQUERIDOS.map((a) => a.label)}
                  archivos={anexosSolicitud}
                  ctaVacio="Adjuntar los documentos requeridos"
                  ctaConArchivos="Adjuntar más documentos"
                  vacioTexto="Aún no adjuntaste los documentos requeridos."
                  onAttached={() => onSaved(row)}
                />
              </>
            )}
            {todasAprobadas && requiereSgc && !sgcOk && (
              <p className="mt-2 text-[11px] text-warning">
                Pendiente de aprobacion del SGC. La orden de pago se habilita cuando el contrato pase a Vigencia.
              </p>
            )}
            {isAdmin && !sgcOk && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
                disabled={aprobandoBypass}
                onClick={() => { void aprobarLegalBypass(); }}
                title="Solo administrador: aprueba Legal (SGC) para habilitar la orden de pago"
              >
                <span>{aprobandoBypass ? "Aprobando..." : "Bypass admin: aprobar Legal (SGC)"}</span>
              </Button>
            )}
          </div>
        )}

        {!esPasoSgc && (
          <section className="space-y-3">
        {/* Step title + status badge */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Revision de {REVISION_AREA_LABELS[currentArea as keyof typeof REVISION_AREA_LABELS]}
          </h4>
          <Badge className={`text-[10px] pointer-events-none ${
            currentRev?.estado === RESULTADOS_APROBACION.APROBADO
              ? BADGE_STYLES.SUCCESS
              : currentRev?.estado === RESULTADOS_APROBACION.RECHAZADO
                ? BADGE_STYLES.DESTRUCTIVE
                : BADGE_STYLES.WARNING
          }`}>
            {currentRev?.estado === RESULTADOS_APROBACION.APROBADO ? (
              <><CheckCircle2 className="mr-0.5 h-2.5 w-2.5" /> Aprobado</>
            ) : currentRev?.estado === RESULTADOS_APROBACION.RECHAZADO ? (
              <><XCircle className="mr-0.5 h-2.5 w-2.5" /> Rechazado</>
            ) : (
              <><Clock className="mr-0.5 h-2.5 w-2.5" /> Pendiente</>
            )}
          </Badge>
        </div>

        {/* Audit info */}
        {currentRev?.createdBy && (
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <UserCircle2 className="h-3 w-3" />
              Revisado por: {currentRev.createdBy}
            </span>
            {currentRev.updatedBy && currentRev.updatedBy !== currentRev.createdBy && (
              <span className="flex items-center gap-1">
                <UserCircle2 className="h-3 w-3" />
                Modificado por: {currentRev.updatedBy}
              </span>
            )}
            <span>{dateUtils.formatDateTime(currentRev.createdAt)}</span>
          </div>
        )}

        {/* Already reviewed — read-only view */}
        {currentRev && currentRev.estado !== RESULTADOS_APROBACION.PENDIENTE && !editing && (
          <div className="space-y-3">
            {currentRev.comentario && (
              <div className="rounded-md bg-secondary border border-border p-3">
                <p className="text-[10px] font-semibold text-muted-foreground mb-1">Justificacion:</p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{currentRev.comentario}</p>
              </div>
            )}
            {canReview && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-medium"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3 w-3" />
                <span>Cambiar estado</span>
              </Button>
            )}
            {!canReview && (
              <p className="text-xs text-muted-foreground">
                No tienes permisos para revisar esta area.
              </p>
            )}
          </div>
        )}

        {/* Pending or editing — show form */}
        {(!currentRev || currentRev.estado === RESULTADOS_APROBACION.PENDIENTE || editing) && canReview && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Comentario / Justificacion</Label>
              <Textarea
                value={reviewState[currentArea]?.comentario ?? ""}
                onChange={(e) => {
                  setReviewState((prev) => {
                    const current = prev[currentArea];
                    if (!current) return prev;
                    return {
                      ...prev,
                      [currentArea]: { ...current, comentario: e.target.value },
                    };
                  });
                  setValidationErrors((prev) => ({ ...prev, [currentArea]: "" }));
                }}
                placeholder="Escribe tu descargo o justificacion..."
                className="mt-1 text-xs min-h-[100px]"
              />
              {validationErrors[currentArea] && (
                <p className="mt-1 text-[11px] text-destructive font-medium">{validationErrors[currentArea]}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {editing && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs font-medium"
                  onClick={() => setEditing(false)}
                >
                  <span>Cancelar</span>
                </Button>
              )}
              <Button
                size="sm"
                variant="destructive"
                disabled={!!submitting}
                className="gap-1.5 text-xs font-medium"
                onClick={handleRechazar}
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>{submitting === currentArea ? "..." : "Rechazar"}</span>
              </Button>
              <Button
                size="sm"
                disabled={!!submitting}
                className="gap-1.5 text-xs font-semibold"
                onClick={() => handleReview(currentArea, RESULTADOS_APROBACION.APROBADO)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{submitting === currentArea ? "..." : "Aprobar"}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Pending or editing but no permission */}
        {(!currentRev || currentRev.estado === RESULTADOS_APROBACION.PENDIENTE || editing) && !canReview && (
          <div className="py-2">
            <p className="text-xs text-muted-foreground">
              No tienes permisos para revisar esta area.
            </p>
            {!isAdmin && (
              <div className="mt-2 text-xs text-muted-foreground">
                <p className="font-medium">Puedes revisar:</p>
                <div className="mt-1 flex gap-2">
                  {areas.filter((a) => canReviewArea(userPermissions, a)).map((a) => (
                    <Button
                      key={a}
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-auto px-2.5 py-0.5 text-[11px] hover:bg-success/10 hover:text-success"
                      onClick={() => {
                        const idx = areas.indexOf(a);
                        goToStep(idx);
                      }}
                    >
                      <span>{REVISION_AREA_LABELS[a]}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
          </section>
        )}
      </div>

      {/* ===== FOOTER ===== */}
      <div className="shrink-0 border-t border-border px-5 py-3">
        <div className="flex w-full items-center justify-between gap-2">
          <div>
            {!isFirst && (
              <Button
                variant="outline"
                size="sm"
                disabled={!!submitting}
                className="gap-1.5 text-xs font-medium"
                onClick={() => goToStep(Math.max(0, currentStep - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Anterior</span>
              </Button>
            )}
          </div>
          <div>
            {!isLast && (
              <Button
                size="sm"
                disabled={!canAdvance}
                className="gap-1.5 text-xs font-semibold"
                onClick={() => goToStep(Math.min(totalSteps - 1, currentStep + 1))}
              >
                <span>Siguiente</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {isLast && puedeOrdenPago && onOrdenPago ? (
              <Button
                size="sm"
                className="text-xs font-semibold"
                onClick={onOrdenPago}
              >
                <span>Generar orden de pago</span>
              </Button>
            ) : isLast && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-medium"
                onClick={onClose}
              >
                <span>Cerrar</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation dialog for rejection */}
      <Dialog open={!!confirmReject} onOpenChange={() => setConfirmReject(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold"><span>Confirmar rechazo</span></DialogTitle>
          </DialogHeader>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Estas seguro de <strong className="text-foreground">rechazar</strong> la revision de{" "}
            <strong className="text-foreground">{REVISION_AREA_LABELS[confirmReject?.area as keyof typeof REVISION_AREA_LABELS] ?? ""}</strong>?
            Esta accion quedara registrada con tu justificacion.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setConfirmReject(null)}
            >
              <span>Cancelar</span>
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="text-xs font-medium"
              onClick={() => {
                if (confirmReject) {
                  handleReview(confirmReject.area, confirmReject.accion);
                  setConfirmReject(null);
                }
              }}
            >
              <span>Si, rechazar</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vista previa del documento (modal en la misma vista) */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) setPreviewDoc(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-6 text-sm font-semibold"><span>{previewDoc?.nombre ?? ""}</span></DialogTitle>
          </DialogHeader>
          {previewDoc && (
            <div className="space-y-3">
              {tipoPreview(previewDoc.url) === "pdf" && (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.nombre}
                  className="h-[65vh] w-full rounded-lg border border-border bg-white"
                />
              )}
              {tipoPreview(previewDoc.url) === "imagen" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewDoc.url}
                  alt={previewDoc.nombre}
                  className="mx-auto max-h-[65vh] rounded-lg border border-border object-contain"
                />
              )}
              {tipoPreview(previewDoc.url) === "otro" && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  <span>Vista previa no disponible para este formato (DOCX). Descárgalo o ábrelo en otra pestaña.</span>
                </p>
              )}
              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" className="text-xs" asChild>
                  <a href={previewDoc.url} download={previewDoc.nombre}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    <span>Descargar</span>
                  </a>
                </Button>
                <Button size="sm" className="text-xs" asChild>
                  <a href={previewDoc.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    <span>Abrir en otra pestaña</span>
                  </a>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
