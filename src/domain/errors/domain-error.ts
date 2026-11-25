import { API_ERROR_CODES, type ApiErrorCode } from "@/lib/shared/constants";

/** Error de negocio comun a todos los dominios (independiente del transporte HTTP). */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: ApiErrorCode = API_ERROR_CODES.VALIDATION,
    public readonly status: number = 400,
    /** Detalle tecnico opcional (p. ej. cuerpo de la respuesta de un sistema externo); no se muestra al usuario. */
    public readonly detalle?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
