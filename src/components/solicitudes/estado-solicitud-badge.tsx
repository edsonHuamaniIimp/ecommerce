"use client";

import { Badge } from "@nrivera-iimp/ui-kit-iimp";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { BADGE_STYLES, ESTADOS_SOLICITUD } from "@/lib/shared/constants";

/** Badge del estado de la solicitud (mismo criterio en todas las bandejas de solicitudes). */
export function EstadoSolicitudBadge({ estado }: { estado: string | null }) {
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
  if (estado === ESTADOS_SOLICITUD.PAGADO) {
    return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.SUCCESS}`}><CheckCircle2 className="mr-0.5 h-2.5 w-2.5" /><span>Pagado</span></Badge>;
  }
  return <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.WARNING}`}><Clock className="mr-0.5 h-2.5 w-2.5" /><span>Pendiente</span></Badge>;
}
