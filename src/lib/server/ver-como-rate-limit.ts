import "server-only";

import { DomainError } from "@/domain/errors/domain-error";
import { API_ERROR_CODES, VER_COMO } from "@/lib/shared/constants";

interface Ventana {
  count: number;
  resetAt: number;
}

const ventanas = new Map<string, Ventana>();

/** Limita por actor, IP y accion; evita busquedas masivas desde "Ver como". */
export function exigirLimiteVerComo(
  actor: string,
  ip: string | null,
  accion: string,
  maximo: number,
): void {
  const ahora = Date.now();
  const clave = `${accion}:${actor}:${ip ?? "sin-ip"}`;
  const actual = ventanas.get(clave);

  if (!actual || actual.resetAt <= ahora) {
    ventanas.set(clave, { count: 1, resetAt: ahora + VER_COMO.VENTANA_MS });
    if (ventanas.size > 5_000) {
      for (const [key, value] of ventanas) {
        if (value.resetAt <= ahora) ventanas.delete(key);
      }
    }
    return;
  }

  actual.count += 1;
  if (actual.count > maximo) {
    throw new DomainError(
      "Demasiadas consultas en modo Ver como. Espera un minuto e intenta nuevamente.",
      API_ERROR_CODES.TOO_MANY_REQUESTS,
      429,
    );
  }
}
