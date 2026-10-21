"use client";

import "client-only";

import { logsService } from "@/lib/client/api/services/logs-service";
import {
  ERROR_LOG_FLUJOS,
  ERROR_LOG_PASOS_RESERVA,
  ERROR_LOG_SOURCES,
  type ErrorLogPasoReserva,
} from "@/lib/shared/constants";

interface ErrorLike {
  message?: string;
  code?: string;
  status?: number;
  stack?: string;
}

function detalle(error: unknown): Required<Pick<ErrorLike, "message">> & Omit<ErrorLike, "message"> {
  const e = (error ?? {}) as ErrorLike;
  return {
    message: e.message ?? (typeof error === "string" ? error : "Error desconocido"),
    code: e.code,
    status: e.status,
    stack: e.stack,
  };
}

function contexto(): { url?: string; path?: string; userAgent?: string } {
  if (typeof window === "undefined") return {};
  return {
    url: window.location.href,
    path: window.location.pathname,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  };
}

/** Reporte centralizado de errores del flujo de reserva (error_log, best-effort). */
export const errorReporting = {
  reserva(
    paso: ErrorLogPasoReserva,
    error: unknown,
    opciones: { stands?: readonly string[]; extra?: Record<string, unknown> } = {},
  ): void {
    const e = detalle(error);
    void logsService.registrar({
      message: e.message,
      stack: e.stack,
      ...contexto(),
      metadata: {
        source: ERROR_LOG_SOURCES.WIZARD,
        flujo: ERROR_LOG_FLUJOS.RESERVA_STAND,
        paso,
        stands: opciones.stands?.join(",") ?? null,
        code: e.code ?? null,
        status: e.status ?? null,
        ...opciones.extra,
      },
    }).catch(() => {});
  },

  mapa(
    paso: typeof ERROR_LOG_PASOS_RESERVA.MAPA_CARGA | typeof ERROR_LOG_PASOS_RESERVA.MAPA_API,
    error: unknown,
    opciones: { eventoId?: string } = {},
  ): void {
    const e = detalle(error);
    void logsService.registrar({
      message: e.message,
      stack: e.stack,
      ...contexto(),
      metadata: {
        source: ERROR_LOG_SOURCES.MAPA,
        flujo: ERROR_LOG_FLUJOS.RESERVA_STAND,
        paso,
        eventoId: opciones.eventoId ?? null,
        code: e.code ?? null,
        status: e.status ?? null,
      },
    }).catch(() => {});
  },
};
