import type { Idioma } from "@/lib/shared/constants";
import type { DatosContratoDTO } from "./datos-contrato.dto";

/** Cuota configurada por el cliente: porcentaje y fecha (montos los calcula el servidor). */
export interface CuotaBorradorDTO {
  porcentaje: number;
  /** Fecha de pago en ISO `yyyy-mm-dd` (no pasada y en orden ascendente). */
  fechaVencimiento: string;
}

/**
 * Cuerpo de POST `/api/contratos/borrador` (paso Contrato del wizard).
 * Genera el contrato con los stands seleccionados y las cuotas configuradas
 * **sin crear la solicitud**; esta se crea al enviar la reserva.
 */
export interface GenerarBorradorContratoRequestDTO {
  /** IDs (`gess_stand`) de los stands seleccionados. */
  standIds: string[];
  /** Idioma del documento (F3); si falta se resuelve el del cliente. */
  idioma?: Idioma;
  cuotas: CuotaBorradorDTO[];
  /** Datos del exhibidor capturados en el wizard (cuerpo del contrato). */
  contrato?: DatosContratoDTO;
}
