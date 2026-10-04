import type { Idioma } from "@/lib/shared/constants";

/** Cuota configurada por el cliente: porcentaje y fecha (montos los calcula el servidor). */
export interface CuotaContratoRequestDTO {
  porcentaje: number;
  /** Fecha de pago en ISO `yyyy-mm-dd` (no pasada y en orden ascendente). */
  fechaVencimiento: string;
}

/**
 * Cuerpo de POST `/api/contratos/generar`.
 * Solo se envían **porcentajes y fechas**: los montos e imagenes del Anexo 1 los genera
 * el servidor desde el precio del stand y los datos del plano (nunca se confía en montos
 * ni archivos del cliente).
 */
export interface GenerarContratoRequestDTO {
  solicitudId: string;
  /** Idioma del contrato (F3); si falta se resuelve el idioma del cliente. */
  idioma?: Idioma;
  /** Cuotas configuradas (1..3, porcentajes suman 100%; fechas ascendentes desde hoy). */
  cuotas: CuotaContratoRequestDTO[];
}
