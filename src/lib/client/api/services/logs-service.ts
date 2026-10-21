import 'client-only';

import { internalApi } from "./internal-api";

export interface ErrorLogPayload {
  message: string;
  stack?: string;
  digest?: string;
  url?: string;
  path?: string;
  userAgent?: string;
  /** Contexto del flujo (paso, stands, codigo/status HTTP, etc.). */
  metadata?: Record<string, unknown>;
}

export const logsService = {
  /** Registra un error del cliente en el backend. */
  registrar(payload: ErrorLogPayload): Promise<void> {
    return internalApi.post<void>("/api/errors/log", payload);
  },
};
