import 'client-only';

import { authService } from "./api/services/auth-service";
import { LS_KEYS } from "@/lib/shared/constants";

interface EventoPublicoGuardado {
  eventoId?: string;
  nombre?: string;
  tipoEvento?: number;
  codigoEvento?: number;
  eventoPadreNombre?: string;
}

/**
 * Si el usuario se acaba de autenticar (login/registro) y eligio un evento en el
 * portal publico (localStorage), lo aplica a su sesion. **La seleccion publica
 * reciente gana**: sincroniza si cambia el evento **o** si solo cambian los nombres
 * visibles (el evento local nace con placeholder "Evento N/2026" y KB lo llama
 * "PERUMIN 2027": sin esto el dashboard mostraba el placeholder).
 */
export async function sincronizarEventoPublicoEnSesion(): Promise<void> {
  const session = await authService.getSession();
  if (!session.authenticated) return;

  let guardado: EventoPublicoGuardado | null = null;
  try {
    const raw = localStorage.getItem(LS_KEYS.EVENTO_PUBLICO);
    guardado = raw ? (JSON.parse(raw) as EventoPublicoGuardado) : null;
  } catch {
    return;
  }
  if (!guardado?.eventoId) return;

  const mismoEvento = session.eventoId === guardado.eventoId;
  const mismosNombres = !guardado.nombre || guardado.nombre === session.eventoNombre;
  if (mismoEvento && mismosNombres) return;

  // Best-effort: si falla la sincronizacion no debe romper el login/registro.
  await authService
    .seleccionarEvento({
      eventoId: guardado.eventoId,
      tipoEvento: guardado.tipoEvento,
      codigoEvento: guardado.codigoEvento,
      eventoNombre: guardado.nombre,
      eventoPadreNombre: guardado.eventoPadreNombre,
    })
    .catch(() => {});
}
