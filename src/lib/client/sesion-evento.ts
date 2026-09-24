import 'client-only';

import { authService } from "./api/services/auth-service";
import { LS_KEYS } from "@/lib/shared/constants";

interface EventoPublicoGuardado {
  eventoId?: string;
  nombre?: string;
  tipoEvento?: number;
  codigoEvento?: number;
}

/**
 * Si el usuario se acaba de autenticar (login/registro) y su sesion aun no tiene
 * evento activo, fija el evento elegido en el portal publico (localStorage) para
 * conservar la seleccion al continuar el flujo (p. ej. reserva desde /mapa).
 */
export async function sincronizarEventoPublicoEnSesion(): Promise<void> {
  const session = await authService.getSession();
  if (!session.authenticated || session.eventoId) return;

  let guardado: EventoPublicoGuardado | null = null;
  try {
    const raw = localStorage.getItem(LS_KEYS.EVENTO_PUBLICO);
    guardado = raw ? (JSON.parse(raw) as EventoPublicoGuardado) : null;
  } catch {
    return;
  }
  if (!guardado?.eventoId) return;

  // Best-effort: si falla la sincronizacion no debe romper el login/registro.
  await authService
    .seleccionarEvento({
      eventoId: guardado.eventoId,
      tipoEvento: guardado.tipoEvento,
      codigoEvento: guardado.codigoEvento,
      eventoNombre: guardado.nombre,
    })
    .catch(() => {});
}
