"use client";

import { useCallback, useEffect, useState } from "react";
import { authService } from "@/lib/client/api/services/auth-service";
import type { SessionDTO } from "@/types/dto/auth/session.dto";

/**
 * Sesion del usuario resuelta desde la fachada cliente.
 * Evita que las paginas importen `@/lib/server/auth`.
 * `refrescar` vuelve a consultar la sesion (p. ej. tras auto-registro).
 */
export function useSesion(): { session: SessionDTO | null; cargando: boolean; refrescar: () => Promise<SessionDTO | null> } {
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [cargando, setCargando] = useState(true);

  const refrescar = useCallback(async (): Promise<SessionDTO | null> => {
    try {
      const s = await authService.getSession();
      setSession(s);
      return s;
    } catch {
      setSession(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let activo = true;
    authService
      .getSession()
      .then((s) => { if (activo) setSession(s); })
      .catch(() => { if (activo) setSession(null); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, []);

  return { session, cargando, refrescar };
}
