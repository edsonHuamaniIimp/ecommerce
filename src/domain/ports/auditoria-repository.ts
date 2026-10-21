/** Evento auditables de cualquier modulo (tabla `audit_log`). */
export interface AuditoriaEvento {
  tipo: string;
  entidad?: string | null;
  actor?: string | null;
  mensaje: string;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  metodo?: string | null;
  ruta?: string | null;
}

export interface IAuditoriaRepository {
  registrar(evento: AuditoriaEvento): Promise<void>;
}
