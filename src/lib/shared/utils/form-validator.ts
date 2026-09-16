/**
 * Utilidades de validacion de formularios de reserva.
 * Centraliza las reglas para evitar logica duplicada en componentes.
 */

/** Solo digitos, trunca a max longitud. */
export function onlyDigits(value: string, max: number): string {
  return value.replace(/\D/g, "").slice(0, max);
}

/** Solo digitos para telefono: max 9, debe empezar con 9. */
export function onlyPhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length > 0 && digits[0] !== "9") return digits.slice(0, 1).replace(/[^9]/, "");
  return digits.slice(0, 9);
}

/** Valida telefono celular peruano: 9 digitos empezando en 9. */
export function isValidTelefono(telefono: string): boolean {
  return /^9\d{8}$/.test(telefono);
}

/** Valida que un email tenga dominio completo (xxx@xxx.xxx). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Valida que el numero de documento cumpla con la longitud minima segun tipo. */
export function isValidDocumento(numeroDocumento: string, isFactura: boolean): boolean {
  const minLength = isFactura ? 11 : 8;
  return /^\d+$/.test(numeroDocumento) && numeroDocumento.length === minLength;
}

/** Valida que todos los campos de datos comerciales y contacto esten completos. */
export function isStepDatosCompleto(datos: {
  razonSocial: string;
  numeroDocumento: string;
  direccion: string;
  telefono: string;
  contacto: string;
  email: string;
  tipoComprobante: string;
}): boolean {
  const isFactura = datos.tipoComprobante === "factura";
  return !!(
    datos.tipoComprobante &&
    (!isFactura || datos.razonSocial) &&
    isValidDocumento(datos.numeroDocumento, isFactura) &&
    datos.direccion &&
    isValidTelefono(datos.telefono) &&
    datos.contacto &&
    isValidEmail(datos.email)
  );
}
