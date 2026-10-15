import { IIMP_NUMERO_SOLICITUD_MAX, IIMP_NUMERO_SOLICITUD_PREFIJO } from "@/lib/shared/constants";

/**
 * Numero de solicitud que viaja al IIMP (`NumeroSolicitud`): determinista desde
 * el id de la solicitud, unico y dentro del maximo de 30 caracteres. Es la llave
 * de idempotencia del IIMP (una solicitud = una reserva) y tambien identifica la
 * cuenta corriente en los endpoints de archivos.
 */
export function numeroSolicitudIImp(solicitudId: string): string {
  const compacto = solicitudId.replace(/-/g, "");
  return `${IIMP_NUMERO_SOLICITUD_PREFIJO}${compacto.slice(0, IIMP_NUMERO_SOLICITUD_MAX - IIMP_NUMERO_SOLICITUD_PREFIJO.length)}`;
}
