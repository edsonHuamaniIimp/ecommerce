"use client";

import { Badge } from "@nrivera-iimp/ui-kit-iimp";
import { CheckCircle2, Clock, FileEdit, XCircle } from "lucide-react";
import {
  BADGE_STYLES,
  DD_DOCUMENTO_ESTADO_LABELS,
  DD_DOCUMENTO_ESTADOS,
  DD_ESTADO_LABELS,
  DD_ESTADOS,
  DD_REPUTACION_ESTADO_LABELS,
  DD_REPUTACION_ESTADOS,
} from "@/lib/shared/constants";
import { DD_VIGENCIAS, ddUtils } from "@/lib/shared/utils/debida-diligencia";

export function DdEstadoBadge({
  estado,
  sinIniciarLabel = "Sin iniciar",
}: {
  estado: string | null | undefined;
  sinIniciarLabel?: string;
}) {
  if (!estado) {
    return (
      <Badge className={`pointer-events-none gap-1 text-[10px] ${BADGE_STYLES.NEUTRAL}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        <span>{sinIniciarLabel}</span>
      </Badge>
    );
  }

  const label = DD_ESTADO_LABELS[estado] ?? estado;

  if (estado === DD_ESTADOS.APROBADA) {
    return (
      <Badge className={`pointer-events-none gap-1 text-[10px] ${BADGE_STYLES.SUCCESS}`}>
        <CheckCircle2 className="h-2.5 w-2.5" />
        <span>{label}</span>
      </Badge>
    );
  }
  if (estado === DD_ESTADOS.RECHAZADA) {
    return (
      <Badge className={`pointer-events-none gap-1 text-[10px] ${BADGE_STYLES.DESTRUCTIVE}`}>
        <XCircle className="h-2.5 w-2.5" />
        <span>{label}</span>
      </Badge>
    );
  }
  if (estado === DD_ESTADOS.EN_REVISION) {
    return (
      <Badge className={`pointer-events-none gap-1 text-[10px] ${BADGE_STYLES.INFO}`}>
        <Clock className="h-2.5 w-2.5" />
        <span>{label}</span>
      </Badge>
    );
  }
  if (estado === DD_ESTADOS.EN_LEGAL) {
    return (
      <Badge className={`pointer-events-none gap-1 text-[10px] ${BADGE_STYLES.INDIGO}`}>
        <Clock className="h-2.5 w-2.5" />
        <span>{label}</span>
      </Badge>
    );
  }
  if (estado === DD_ESTADOS.OBSERVADA) {
    return (
      <Badge className={`pointer-events-none gap-1 text-[10px] ${BADGE_STYLES.WARNING}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-warning" />
        <span>{label}</span>
      </Badge>
    );
  }
  if (estado === DD_ESTADOS.BORRADOR) {
    return (
      <Badge className={`pointer-events-none gap-1 text-[10px] ${BADGE_STYLES.NEUTRAL}`}>
        <FileEdit className="h-2.5 w-2.5" />
        <span>{label}</span>
      </Badge>
    );
  }
  return (
    <Badge className={`pointer-events-none gap-1 text-[10px] ${BADGE_STYLES.WARNING}`}>
      <Clock className="h-2.5 w-2.5" />
      <span>{label}</span>
    </Badge>
  );
}

export function DdDocumentoBadge({ estado }: { estado: string }) {
  const label = DD_DOCUMENTO_ESTADO_LABELS[estado] ?? estado;
  if (estado === DD_DOCUMENTO_ESTADOS.CARGADO) {
    return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.SUCCESS}`}><span>{label}</span></Badge>;
  }
  if (estado === DD_DOCUMENTO_ESTADOS.OBSERVADO) {
    return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.WARNING}`}><span>{label}</span></Badge>;
  }
  if (estado === DD_DOCUMENTO_ESTADOS.APROBADO) {
    return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.SUCCESS}`}><span>{label}</span></Badge>;
  }
  if (estado === DD_DOCUMENTO_ESTADOS.RECHAZADO) {
    return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.DESTRUCTIVE}`}><span>{label}</span></Badge>;
  }
  return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.NEUTRAL}`}><span>{label}</span></Badge>;
}

export function DdReputacionBadge({ estado }: { estado: string }) {
  const label = DD_REPUTACION_ESTADO_LABELS[estado] ?? estado;
  if (estado === DD_REPUTACION_ESTADOS.SIN_HALLAZGOS) {
    return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.SUCCESS}`}><span>{label}</span></Badge>;
  }
  if (estado === DD_REPUTACION_ESTADOS.CON_HALLAZGOS) {
    return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.DESTRUCTIVE}`}><span>{label}</span></Badge>;
  }
  if (estado === DD_REPUTACION_ESTADOS.REQUIERE_INFORMACION) {
    return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.WARNING}`}><span>{label}</span></Badge>;
  }
  if (estado === DD_REPUTACION_ESTADOS.CERRADA) {
    return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.NEUTRAL}`}><span>{label}</span></Badge>;
  }
  if (estado === DD_REPUTACION_ESTADOS.EN_ANALISIS) {
    return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.INFO}`}><span>{label}</span></Badge>;
  }
  return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.WARNING}`}><span>{label}</span></Badge>;
}

/** Vigencia calculada de una DD aprobada. */
export function DdVigenciaBadge({
  estado,
  fechaVencimiento,
  fechaAprobacion,
}: {
  estado: string;
  fechaVencimiento: string | null;
  fechaAprobacion?: string | null;
}) {
  const vigencia = ddUtils.estadoVigencia(estado, fechaVencimiento, undefined, fechaAprobacion);
  if (vigencia === DD_VIGENCIAS.VENCIDA) {
    return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.DESTRUCTIVE}`}><span>Vencida</span></Badge>;
  }
  if (vigencia === DD_VIGENCIAS.POR_VENCER) {
    return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.WARNING}`}><span>Por vencer</span></Badge>;
  }
  if (vigencia === DD_VIGENCIAS.VIGENTE) {
    return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.SUCCESS}`}><span>Vigente</span></Badge>;
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}
