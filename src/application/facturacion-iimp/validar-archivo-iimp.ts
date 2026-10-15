import {
  API_ERROR_CODES,
  APP_URL,
  MAX_LINK_ARCHIVO_IIMP,
  MAX_NOMBRE_ARCHIVO_IIMP,
  TIPOS_ARCHIVO_IIMP,
  TIPOS_ARCHIVO_IIMP_CON_CUOTA,
  type TipoArchivoIImp,
} from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import type { ReservaIimpArchivoInput } from "@/domain/ports/reserva-iimp-client";

const REGEX_LINK_HTTP = /^https?:\/\/\S+$/i;

/**
 * Convierte un link relativo (`/uploads/...`) en URL absoluta con la base de la
 * app: el IIMP exige http(s) y no puede resolver rutas internas nuestras.
 */
export function normalizarLinkArchivoIImp(link: string, baseUrl: string = APP_URL): string {
  if (link.startsWith("/")) return new URL(link, baseUrl).toString();
  return link;
}

/**
 * Valida un archivo (link) de la cuenta corriente del IIMP con las mismas reglas
 * del API: tipo soportado, link http(s), nombre acotado y `cuota` obligatoria en
 * detraccion/diferencia dentro del rango de la cuenta.
 */
export function validarArchivoIImp(archivo: ReservaIimpArchivoInput, cuotas: number): void {
  if (!Object.values(TIPOS_ARCHIVO_IIMP).includes(archivo.tipo as TipoArchivoIImp)) {
    throw new DomainError(`Tipo de archivo invalido; valores: ${Object.values(TIPOS_ARCHIVO_IIMP).join(", ")}`, API_ERROR_CODES.VALIDATION, 400);
  }
  if (!archivo.link || !REGEX_LINK_HTTP.test(archivo.link) || archivo.link.length > MAX_LINK_ARCHIVO_IIMP) {
    throw new DomainError("El link del archivo debe ser una URL http(s) valida", API_ERROR_CODES.VALIDATION, 400);
  }
  if (archivo.nombre && archivo.nombre.length > MAX_NOMBRE_ARCHIVO_IIMP) {
    throw new DomainError(`El nombre del archivo no puede superar ${MAX_NOMBRE_ARCHIVO_IIMP} caracteres`, API_ERROR_CODES.VALIDATION, 400);
  }
  const exigeCuota = TIPOS_ARCHIVO_IIMP_CON_CUOTA.includes(archivo.tipo as TipoArchivoIImp);
  if (exigeCuota && !Number.isInteger(archivo.cuota)) {
    throw new DomainError("La constancia de pago requiere el numero de cuota", API_ERROR_CODES.VALIDATION, 400);
  }
  if (archivo.cuota !== undefined && archivo.cuota !== null) {
    if (!Number.isInteger(archivo.cuota) || archivo.cuota < 1 || (cuotas > 0 && archivo.cuota > cuotas)) {
      throw new DomainError(`La cuota ${archivo.cuota} no existe en la cuenta corriente (tiene ${cuotas})`, API_ERROR_CODES.VALIDATION, 400);
    }
  }
}
