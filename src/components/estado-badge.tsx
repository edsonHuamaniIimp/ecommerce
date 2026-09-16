"use client";

import { Badge } from "@nrivera-iimp/ui-kit-iimp";
import type { EstadoStand, EstadoReserva } from "@/types/reserva";
import { ESTADOS_STAND, ESTADOS_RESERVA } from "@/lib/shared/constants";

function badgeVariant(
  estado: EstadoStand | EstadoReserva,
): "default" | "secondary" | "destructive" | "outline" {
  switch (estado) {
    case ESTADOS_STAND.DISPONIBLE:
    case ESTADOS_RESERVA.BORRADOR:
    case ESTADOS_RESERVA.REGISTRADA:
      return "secondary";
    case ESTADOS_STAND.EN_EVALUACION:
    case ESTADOS_RESERVA.EN_APROBACION:
    case ESTADOS_RESERVA.ENVIADA_FACTURACION:
      return "default";
    case ESTADOS_STAND.RESERVADO:
    case ESTADOS_RESERVA.APROBADA:
    case ESTADOS_RESERVA.FACTURADA:
      return "default";
    case ESTADOS_RESERVA.RECHAZADA:
    case ESTADOS_RESERVA.CANCELADA:
      return "destructive";
    default:
      return "outline";
  }
}

function label(estado: EstadoStand | EstadoReserva): string {
  const labels: Record<string, string> = {
    [ESTADOS_STAND.DISPONIBLE]: "Disponible",
    [ESTADOS_STAND.EN_EVALUACION]: "En evaluación",
    [ESTADOS_STAND.RESERVADO]: "Reservado",
    [ESTADOS_RESERVA.BORRADOR]: "Borrador",
    [ESTADOS_RESERVA.REGISTRADA]: "Registrada",
    [ESTADOS_RESERVA.EN_APROBACION]: "En aprobación",
    [ESTADOS_RESERVA.APROBADA]: "Aprobada",
    [ESTADOS_RESERVA.ENVIADA_FACTURACION]: "Enviada",
    [ESTADOS_RESERVA.FACTURADA]: "Facturada",
    [ESTADOS_RESERVA.RECHAZADA]: "Rechazada",
    [ESTADOS_RESERVA.CANCELADA]: "Cancelada",
  };
  return labels[estado] ?? estado;
}

export function EstadoStandBadge({ estado }: { estado: EstadoStand }) {
  return <Badge variant={badgeVariant(estado)}><span>{label(estado)}</span></Badge>;
}

export function EstadoReservaBadge({ estado }: { estado: EstadoReserva }) {
  return <Badge variant={badgeVariant(estado)}><span>{label(estado)}</span></Badge>;
}
