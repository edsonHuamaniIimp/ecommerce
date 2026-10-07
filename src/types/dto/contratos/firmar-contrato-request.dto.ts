import type { Idioma } from "@/lib/shared/constants";
import type { DatosContratoDTO } from "./datos-contrato.dto";

/**
 * Cuerpo de POST `/api/contratos/firmar` (RF-12).
 * El servidor estampa la **firma digital** cargada en el perfil del usuario
 * (`user_role.firma_url`) sobre el contrato generado; no se reciben archivos.
 */
export interface FirmarContratoRequestDTO {
  solicitudId: string;
  /** Idioma del documento (F3); si falta se resuelve el idioma del cliente. */
  idioma?: Idioma;
  /** Datos del exhibidor capturados en el wizard (cuerpo del contrato). */
  contrato?: DatosContratoDTO;
}
