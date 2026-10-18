import { API_ERROR_CODES, type ApiErrorCode } from "@/lib/shared/constants";

/** Error de negocio comun a todos los dominios (independiente del transporte HTTP). */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: ApiErrorCode = API_ERROR_CODES.VALIDATION,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
