import "server-only";

import { ERROR_LOG_SOURCES, type ErrorLogSource } from "@/lib/shared/constants";
import { errorLogger } from "@/lib/server/error-logger";

export interface ApiErrorLogInput {
  request: Request;
  status: number;
  code: string;
  message: string;
  stack?: string;
  /** Accion/slug interno de la ruta (ej. "crear"); el path completo se toma del request. */
  action?: string;
  source?: ErrorLogSource;
}

/**
 * Registra un fallo de API en `error_log` sin bloquear la respuesta.
 * Centraliza el formato para evitar duplicar metadata en router y rutas directas.
 */
export const apiErrorLogger = {
  registrar(input: ApiErrorLogInput): void {
    try {
      const path = new URL(input.request.url).pathname;
      void errorLogger.log({
        message: input.message,
        stack: input.stack,
        url: input.request.url,
        metadata: {
          source: input.source ?? ERROR_LOG_SOURCES.SERVER_API,
          method: input.request.method,
          path,
          action: input.action ?? null,
          status: input.status,
          code: input.code,
        },
      });
    } catch {
      /* La trazabilidad nunca debe romper la respuesta del API. */
    }
  },
};
