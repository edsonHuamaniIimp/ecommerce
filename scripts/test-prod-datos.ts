/**
 * Constantes compartidas de los scripts de data de prueba en produccion.
 * Importadas por seed-prod-test.ts y cleanup-prod-test.ts para que los
 * marcadores nunca diverjan entre crear y borrar.
 *
 * NO importar desde src/ (los scripts corren con tsx sin bundler de app).
 */

export const TEST_CODIGO_PADRE = "TEST";
export const TEST_TIPO_EVENTO = 999;
export const TEST_CODIGO_EVENTO = 999;
export const TEST_ANIO = "2026";
export const TEST_STAND_COUNT = 5;
export const STAND_PREFIX = "TEST-";
export const TEST_EMPRESA = "Empresa Test SAC";

/**
 * Usuarios de prueba. Se vinculan a roles EXISTENTES (nunca se crean roles).
 * El flujo SGC requiere: cliente (crea solicitud), logistica + comunicacion
 * (revisan; comunicacion dispara el expediente al SGC) y admin (supervisa).
 */
export const TEST_USERS = [
  { email: "test.cliente@iimp.org.pe", rol: "cliente", password: "test123" },
  { email: "test.logistica@iimp.org.pe", rol: "logistica", password: "test123" },
  { email: "test.comunicacion@iimp.org.pe", rol: "comunicacion", password: "test123" },
  { email: "test.admin@iimp.org.pe", rol: "admin", password: "test123" },
] as const;

export const TEST_USER_IDS = TEST_USERS.map((u) => `user|${u.email}`);
export const TEST_USER_EMAILS = TEST_USERS.map((u) => u.email);
