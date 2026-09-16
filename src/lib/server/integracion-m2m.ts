import 'server-only';

const IS_LOCAL = process.env.NODE_ENV !== "production";

/**
 * Validacion M2M para endpoints de integracion (Sistema de Montaje).
 * El consumidor envia el header x-api-key con la clave compartida.
 * En ambiente local (desarrollo) se permite consumo directo sin clave.
 */
export function validarIntegracionM2M(request: Request): boolean {
  if (IS_LOCAL) return true;
  const clave = process.env.INTEGRACION_API_KEY;
  if (!clave) return false;
  const enviada = request.headers.get("x-api-key");
  return enviada === clave;
}
