"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Button, Textarea } from "@nrivera-iimp/ui-kit-iimp";
import { AlertTriangle, CheckCircle2, Circle, Clock, Download, Loader2, Send, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useSgcExpediente } from "@/hooks/use-sgc-expediente";
import { sgcService } from "@/lib/client/api/services/sgc-service";
import {
  BADGE_STYLES,
  SGC_APPROVAL_MARK_LABELS,
  SGC_DOCUMENT_CATEGORIES,
  SGC_LIFECYCLE_LABELS,
  SGC_LIFECYCLE_STATUSES,
  SGC_STEP_STATUSES,
  SGC_STEP_STATUS_LABELS,
  SGC_SUBSANACION_SUGERENCIAS,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";

const LIFECYCLE_BADGES: Record<string, string> = {
  [SGC_LIFECYCLE_STATUSES.ACTIVE]: BADGE_STYLES.SUCCESS,
  [SGC_LIFECYCLE_STATUSES.FINALIZED]: BADGE_STYLES.NEUTRAL,
  [SGC_LIFECYCLE_STATUSES.OBSERVED]: BADGE_STYLES.WARNING,
  [SGC_LIFECYCLE_STATUSES.REJECTED]: BADGE_STYLES.DESTRUCTIVE,
};

function StepIcon({ status }: { status: string }) {
  if (status === SGC_STEP_STATUSES.COMPLETED) return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />;
  if (status === SGC_STEP_STATUSES.REJECTED) return <XCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />;
  if (status === SGC_STEP_STATUSES.CURRENT) return <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" />;
  return <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" />;
}

export function SgcExpedientePanel({
  solicitudId,
  onSynced,
  tieneContratoAdmin = false,
  tieneAnexos = false,
  tieneContratoFirmado = false,
  motivo = null,
  onSolicitudChanged,
}: {
  solicitudId: string;
  /** Notifica el estado sincronizado desde el SGC (para refrescar el flujo/step del padre). */
  onSynced?: (estado: { lifecycleStatus: string | null; stage: string | null }) => void;
  /** Hay un contrato del administrador adjunto a la solicitud. */
  tieneContratoAdmin?: boolean;
  /** Hay anexos adjuntos (documentos que no son el contrato). */
  tieneAnexos?: boolean;
  /** El cliente ya subió su contrato firmado. */
  tieneContratoFirmado?: boolean;
  /** Motivo (libre) de la corrección declarado por el administrador. */
  motivo?: string | null;
  /** Refresca la fila de la solicitud tras una acción (subida/reenvío/declaración). */
  onSolicitudChanged?: () => void;
}) {
  const { data, loading, error, refetch } = useSgcExpediente(solicitudId);
  const [descargando, setDescargando] = useState(false);
  const [enviandoContrato, setEnviandoContrato] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [selMotivo, setSelMotivo] = useState("");
  const [guardandoMotivo, setGuardandoMotivo] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  /* El GET de detalle persiste el estado en BD (sync-on-read); avisamos al padre
     una sola vez por montaje para que refresque la fila/step/orden de pago. */
  const onSyncedRef = useRef(onSynced);
  useEffect(() => {
    onSyncedRef.current = onSynced;
  }, [onSynced]);
  const syncedRef = useRef(false);
  useEffect(() => {
    if (data && !syncedRef.current) {
      syncedRef.current = true;
      onSyncedRef.current?.({ lifecycleStatus: data.lifecycleStatus ?? null, stage: data.stage ?? null });
    }
  }, [data]);

  async function registrarExpediente() {
    setRegistrando(true);
    try {
      await sgcService.registrar(solicitudId);
      toast.success("Expediente registrado en el SGC");
      refetch();
      onSolicitudChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar en el SGC");
    } finally {
      setRegistrando(false);
    }
  }

  async function declararMotivo(motivoNuevo: string | null) {
    setGuardandoMotivo(true);
    try {
      await sgcService.declararMotivo({ solicitudId, motivo: motivoNuevo });
      toast.success(motivoNuevo ? "Listo. El cliente verá qué debe corregir." : "Puedes volver a describir la corrección.");
      onSolicitudChanged?.();
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el motivo");
    } finally {
      setGuardandoMotivo(false);
    }
  }

  async function enviarContrato() {
    setEnviandoContrato(true);
    try {
      /* Envía anexos y contrato; si aún no hay contrato del admin, no bloquea los anexos. */
      const { enviados } = await sgcService.subirAnexos(solicitudId);
      let contratoOk = true;
      try {
        await sgcService.subirContrato(solicitudId);
      } catch {
        contratoOk = false;
      }
      if (contratoOk) {
        toast.success(`Enviado al SGC (contrato + ${enviados} anexo(s))`);
      } else {
        toast.info(`${enviados} anexo(s) enviados. Falta adjuntar el contrato del administrador.`);
      }
      refetch();
      onSolicitudChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar al SGC");
    } finally {
      setEnviandoContrato(false);
    }
  }

  async function reenviarAlSgc() {
    setReenviando(true);
    try {
      await sgcService.reenviar(solicitudId);
      toast.success("Trámite reenviado al SGC con el contrato firmado del cliente");
      refetch();
      onSolicitudChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo reenviar al SGC");
    } finally {
      setReenviando(false);
    }
  }

  async function descargarContrato() {
    setDescargando(true);
    try {
      const { url } = await sgcService.descarga(solicitudId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo descargar el contrato");
    } finally {
      setDescargando(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Cargando expediente SGC...
      </p>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-2 py-1">
        <p className="text-xs text-muted-foreground">Aún no hay expediente registrado en el SGC.</p>
        <Button size="sm" variant="outline" className="w-full" disabled={registrando} onClick={registrarExpediente}>
          {registrando ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />}
          Registrar expediente
        </Button>
      </div>
    );
  }

  /* Devuelto (observed) o rechazado (rejected): en ambos el SGC permite corregir y reenviar. */
  const devuelto = data.lifecycleStatus === SGC_LIFECYCLE_STATUSES.OBSERVED;
  const rechazado = data.lifecycleStatus === SGC_LIFECYCLE_STATUSES.REJECTED;
  const subsanable = devuelto || rechazado;
  const aprobado =
    data.lifecycleStatus === SGC_LIFECYCLE_STATUSES.ACTIVE ||
    data.lifecycleStatus === SGC_LIFECYCLE_STATUSES.FINALIZED;
  const contratoEnviado = (data.documents ?? []).some((d) => d.category === SGC_DOCUMENT_CATEGORIES.CONTRACT);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono font-medium">{data.code}</span>
        {data.lifecycleStatus && (
          <Badge className={`pointer-events-none text-[10px] ${LIFECYCLE_BADGES[data.lifecycleStatus] ?? BADGE_STYLES.NEUTRAL}`}>
            <span>{SGC_LIFECYCLE_LABELS[data.lifecycleStatus] ?? data.lifecycleStatus}</span>
          </Badge>
        )}
        <span className="text-muted-foreground">Etapa: {data.stage}</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        ID SGC: <span className="font-mono">{data.contractId}</span>
      </p>

      {data.steps.length > 0 && (
        <div className="space-y-2">
          {data.steps.map((step) => (
            <div key={step.code} className="flex items-start gap-2">
              <StepIcon status={step.status} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">{step.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {SGC_STEP_STATUS_LABELS[step.status] ?? step.status}
                  {step.completedBy
                    ? ` · ${step.completedBy.actorName} · ${SGC_APPROVAL_MARK_LABELS[step.completedBy.constancy] ?? step.completedBy.constancy}`
                    : ""}
                </p>
              </div>
              {step.completedBy && (
                <span className="shrink-0 text-[10px] text-muted-foreground">{dateUtils.formatDateTime(step.completedBy.completedAt)}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {data.history.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Historial SGC</p>
          {data.history.map((item) => (
            <div key={item.id} className="text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{item.title}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{dateUtils.formatDateTime(item.occurredAt)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {item.detail} · {item.actorName}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Acciones ─────────────────────────────────────────────────────── */}
      {subsanable ? (
        <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />{" "}
            {rechazado ? "El SGC rechazó el trámite" : "El SGC devolvió el trámite (observaciones)"}
          </p>

          {!motivo ? (
            <>
              <p className="text-[11px] text-muted-foreground">
                Explica qué debe corregirse para que el cliente lo vea en “Mis solicitudes”. Puedes
                escribir cualquier indicación: este paso se repite cada vez que el SGC devuelve el trámite.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SGC_SUBSANACION_SUGERENCIAS.map((s) => (
                  <button
                    key={s.titulo}
                    type="button"
                    onClick={() => setSelMotivo(s.texto)}
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    {s.titulo}
                  </button>
                ))}
              </div>
              <Textarea
                value={selMotivo}
                onChange={(e) => setSelMotivo(e.target.value.slice(0, 500))}
                placeholder="Ej.: El cliente debe corregir la firma del representante legal…"
                className="mt-1 min-h-[70px] text-xs"
              />
              <Button
                size="sm"
                className="w-full"
                disabled={!selMotivo.trim() || guardandoMotivo}
                onClick={() => declararMotivo(selMotivo.trim())}
              >
                {guardandoMotivo ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                Guardar indicación
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-md border border-border bg-background px-2.5 py-2">
                <p className="text-[11px] text-muted-foreground">
                  <strong className="text-foreground">Qué corregir:</strong> {motivo}
                </p>
              </div>

              <ol className="space-y-1.5 text-[11px]">
                <li className="flex items-start gap-1.5">
                  {tieneContratoAdmin ? (
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                  ) : (
                    <Clock className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                  )}
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">1. Prepara el contrato</strong> — adjunta abajo una versión
                    nueva si hace falta; si no, el cliente firmará la que ya tiene.
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  {tieneContratoFirmado ? (
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                  ) : (
                    <Clock className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                  )}
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">2. El cliente sube su contrato firmado</strong>{" "}
                    {tieneContratoFirmado
                      ? "· listo"
                      : "· lo hace desde “Mis solicitudes” (descarga, firma y sube el contrato firmado)"}
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5 h-3 w-3 shrink-0" />
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">3. Reenvía al SGC</strong> con el botón de abajo.
                  </span>
                </li>
              </ol>

              <Button
                size="sm"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={!tieneContratoFirmado || reenviando}
                onClick={reenviarAlSgc}
                title={!tieneContratoFirmado ? "Falta que el cliente suba su contrato firmado" : undefined}
              >
                {reenviando ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />}
                Reenviar al SGC
              </Button>
              <button
                type="button"
                className="w-full text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => declararMotivo(null)}
              >
                Cambiar la indicación
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            {contratoEnviado
              ? "El contrato ya está en el SGC. Cuando el SGC lo apruebe, aquí podrás descargar el contrato firmado."
              : "Antes de enviar: adjunta abajo el contrato del administrador y los anexos del cliente. Después envíalos juntos al SGC."}
          </p>

          {!contratoEnviado && !(tieneContratoAdmin && tieneAnexos) && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
              Falta adjuntar: {!tieneContratoAdmin ? "el contrato del administrador" : ""}
              {!tieneContratoAdmin && !tieneAnexos ? " y " : ""}
              {!tieneAnexos ? "los anexos requeridos" : ""}.
            </p>
          )}

          {!contratoEnviado && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={!tieneContratoAdmin || !tieneAnexos || enviandoContrato}
              onClick={enviarContrato}
              title="Envía el contrato y los anexos juntos para la revisión del SGC"
            >
              {enviandoContrato ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Upload className="mr-2 h-3 w-3" />}
              Enviar al SGC para revisión
            </Button>
          )}

          {contratoEnviado && !aprobado && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={enviandoContrato}
              onClick={enviarContrato}
              title="Vuelve a enviar los anexos que falten"
            >
              {enviandoContrato ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Upload className="mr-2 h-3 w-3" />}
              Enviar anexos faltantes
            </Button>
          )}
        </div>
      )}

      {aprobado && (
        <Button size="sm" variant="outline" className="w-full" disabled={descargando} onClick={descargarContrato}>
          {descargando ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Download className="mr-2 h-3 w-3" />}
          Descargar contrato firmado
        </Button>
      )}
    </div>
  );
}
