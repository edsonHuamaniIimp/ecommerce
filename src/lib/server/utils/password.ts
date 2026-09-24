import 'server-only';

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const PREFIJO = "scrypt";
const LONGITUD_SALT = 16;
const LONGITUD_CLAVE = 32;
const PARAMETROS = { N: 16384, r: 8, p: 1 } as const;

/**
 * Hash compacto `scrypt$<salt-b64url>$<clave-b64url>`.
 * Se mantiene bajo 100 caracteres para caber en `user_role.password`.
 */
export function hashPassword(plano: string): string {
  const salt = randomBytes(LONGITUD_SALT);
  const clave = scryptSync(plano, salt, LONGITUD_CLAVE, PARAMETROS);
  return `${PREFIJO}$${salt.toString("base64url")}$${clave.toString("base64url")}`;
}

/** True si el valor almacenado ya es un hash scrypt. */
export function esHash(valor: string): boolean {
  return valor.startsWith(`${PREFIJO}$`);
}

/**
 * Verifica una contrasena contra el valor almacenado.
 * Soporta el formato legacy en texto plano para migrar sin romper accesos.
 */
export function verificarPassword(plano: string, almacenado: string): boolean {
  if (!esHash(almacenado)) return plano === almacenado;

  const [, saltB64, claveB64] = almacenado.split("$");
  if (!saltB64 || !claveB64) return false;

  try {
    const salt = Buffer.from(saltB64, "base64url");
    const esperada = Buffer.from(claveB64, "base64url");
    const calculada = scryptSync(plano, salt, esperada.length, PARAMETROS);
    return esperada.length === calculada.length && timingSafeEqual(esperada, calculada);
  } catch {
    return false;
  }
}
