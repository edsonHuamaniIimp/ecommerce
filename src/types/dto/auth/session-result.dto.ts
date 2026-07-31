export type SessionResult =
  | { authenticated: false }
  | { authenticated: true; email: string; roles: string[]; permissions: string[]; eventoId: string | null; eventoPadreId: string | null; eventoNombre: string | null; tipoEvento?: number; codigoEvento?: number };
