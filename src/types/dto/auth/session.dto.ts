export interface SessionDTO {
  authenticated: boolean;
  email?: string;
  roles?: string[];
  permissions?: string[];
  eventoId?: string | null;
  eventoPadreId?: string | null;
  eventoNombre?: string | null;
  eventoPadreNombre?: string | null;
  tipoEvento?: number;
  codigoEvento?: number;
}
