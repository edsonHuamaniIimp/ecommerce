import 'client-only';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

export const apiConfig = {
  baseUrl: BASE_URL,
} as const;

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  code: ApiErrorCode;
  detalles: string[];

  constructor(code: ApiErrorCode, message: string, detalles: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.detalles = detalles;
  }
}
