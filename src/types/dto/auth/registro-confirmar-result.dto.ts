/** Resultado de confirmar el registro (auto-login) o error de negocio. */
export type RegistroConfirmarResult =
  | { token: string; roles: string[]; email: string; remember: boolean }
  | { error: string; status: 400 | 403 | 409 };
