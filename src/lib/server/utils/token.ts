import 'server-only';

import { randomBytes } from "crypto";

/** Token aleatorio URL-safe, criptograficamente seguro (invitaciones y reseteos). */
export function generarTokenAleatorio(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

/** Codigo numerico de longitud fija, criptograficamente seguro (verificacion por correo). */
export function generarCodigoNumerico(longitud: number): string {
  let codigo = "";
  for (let i = 0; i < longitud; i += 1) {
    codigo += randomBytes(1).readUInt8(0) % 10;
  }
  return codigo;
}
