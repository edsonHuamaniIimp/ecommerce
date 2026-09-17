"use client";

import { useState } from "react";
import { Badge, Button } from "@nrivera-iimp/ui-kit-iimp";
import { CheckCircle2, Circle, Clock, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSgcExpediente } from "@/hooks/use-sgc-expediente";
import { sgcService } from "@/lib/client/api/services/sgc-service";
import {
  BADGE_STYLES,
  SGC_APPROVAL_MARK_LABELS,
  SGC_LIFECYCLE_LABELS,
  SGC_LIFECYCLE_STATUSES,
  SGC_STEP_STATUSES,
  SGC_STEP_STATUS_LABELS,
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
  if (status === SGC_STEP_STATUSES.CURRENT) return <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" />;
  return <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" />;
}

export function SgcExpedientePanel({ solicitudId }: { solicitudId: string }) {
  const { data, loading, error } = useSgcExpediente(solicitudId);
  const [descargando, setDescargando] = useState(false);

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Cargando expediente SGC...
      </p>
    );
  }

  if (error || !data) {
    return <p className="py-3 text-xs text-muted-foreground">Aun no hay expediente registrado en el SGC.</p>;
  }

  const puedeDescargar =
    data.lifecycleStatus === SGC_LIFECYCLE_STATUSES.ACTIVE ||
    data.lifecycleStatus === SGC_LIFECYCLE_STATUSES.FINALIZED;

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

      {puedeDescargar && (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={descargando}
          onClick={descargarContrato}
        >
          {descargando ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <Download className="mr-2 h-3 w-3" />
          )}
          Descargar contrato firmado
        </Button>
      )}
    </div>
  );
}
