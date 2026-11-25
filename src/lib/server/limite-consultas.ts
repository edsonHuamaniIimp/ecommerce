import "server-only";

import { DomainError } from "@/domain/errors/domain-error";
import { API_ERROR_CODES } from "@/lib/shared/constants";

interface Ventana {
  count: number;
  resetAt: number;
}

const ventanas = new Map<string, Ventana>();
const MAX_CLAVES = 5_000;

/** Limite de consultas por clave en una ventana de tiempo (en memoria del proceso). Lanza 429 al excederlo. */
export function exigirLimiteConsultas(clave: string, maximo: number, ventanaMs: number, mensaje: string): void {
  const ahora = Date.now();
  const actual = ventanas.get(clave);

  if (!actual || actual.resetAt <= ahora) {
    ventanas.set(clave, { count: 1, resetAt: ahora + ventanaMs });
    if (ventanas.size > MAX_CLAVES) {
      for (const [key, value] of ventanas) {
        if (value.resetAt <= ahora) ventanas.delete(key);
      }
    }
    return;
  }

  actual.count += 1;
  if (actual.count > maximo) {
    throw new DomainError(mensaje, API_ERROR_CODES.TOO_MANY_REQUESTS, 429);
  }
}
