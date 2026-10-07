import type { CuotaBorradorDTO } from "./generar-borrador-contrato-request.dto";
import type { DatosContratoDTO } from "./datos-contrato.dto";
import type { Idioma } from "@/lib/shared/constants";

/**
 * Cuerpo de POST `/api/contratos/firmar-borrador` (RF-12, paso Contrato).
 * El servidor estampa la firma digital del perfil sobre el borrador; no crea solicitud.
 */
export interface FirmarBorradorContratoRequestDTO {
  standIds: string[];
  idioma?: Idioma;
  cuotas: CuotaBorradorDTO[];
  /** Datos del exhibidor capturados en el wizard (cuerpo del contrato). */
  contrato?: DatosContratoDTO;
}
