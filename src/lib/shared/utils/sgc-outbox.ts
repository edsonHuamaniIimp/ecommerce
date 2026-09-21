import { SGC_OUTBOX_BACKOFF_BASE_MS } from "@/lib/shared/constants";

const SGC_OUTBOX_BACKOFF_MAX_MS = 60 * 60 * 1000; // 1 hora

/** Backoff exponencial (base * 2^intentos) con tope de 1 hora. */
export function calcularBackoffMs(intentos: number, base: number = SGC_OUTBOX_BACKOFF_BASE_MS): number {
  const factor = 2 ** Math.max(0, intentos);
  return Math.min(base * factor, SGC_OUTBOX_BACKOFF_MAX_MS);
}
