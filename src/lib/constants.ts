/**
 * Constantes compartidas FRONTEND + BACKEND.
 *
 * NUNCA usar strings hardcodeados para validaciones, estados, roles, áreas,
 * verticales ni tipos de comprobante. Siempre referenciar desde este archivo.
 *
 * Ejemplo:
 *   ❌ if (estado === "aprobado") { ... }
 *   ✅ if (estado === ESTADOS_RESERVA.APROBADA) { ... }
 *
 *   ❌ { area: "legal", ... }
 *   ✅ { area: AREAS_APROBACION.LEGAL, ... }
 */

/* ================================================================
   Verticales (alineadas con UI Kit y theming)
   ================================================================ */
export const VERTICALES = {
  PROEXPLO: "proexplo",
  WMC: "wmc",
  GESS: "gess",
  PERUMIN: "perumin",
} as const;

export type Vertical = (typeof VERTICALES)[keyof typeof VERTICALES];

/* ================================================================
   Estados de stand (plano)
   ================================================================ */
export const ESTADOS_STAND = {
  DISPONIBLE: "disponible",
  EN_EVALUACION: "en_evaluacion",
  RESERVADO: "reservado",
} as const;

export type EstadoStand = (typeof ESTADOS_STAND)[keyof typeof ESTADOS_STAND];

/* ================================================================
   Estados de reserva (ciclo de vida)
   ================================================================ */
export const ESTADOS_RESERVA = {
  BORRADOR: "borrador",
  REGISTRADA: "registrada",
  EN_APROBACION: "en_aprobacion",
  APROBADA: "aprobada",
  ENVIADA_FACTURACION: "enviada_facturacion",
  FACTURADA: "facturada",
  RECHAZADA: "rechazada",
  CANCELADA: "cancelada",
} as const;

export type EstadoReserva = (typeof ESTADOS_RESERVA)[keyof typeof ESTADOS_RESERVA];

/* ================================================================
   Estados de evento
   ================================================================ */
export const ESTADOS_EVENTO = {
  DRAFT: "draft",
  ACTIVE: "active",
  CLOSED: "closed",
  CANCELLED: "cancelled",
} as const;

export type EstadoEvento = (typeof ESTADOS_EVENTO)[keyof typeof ESTADOS_EVENTO];

/* ================================================================
   Tipos de comprobante
   ================================================================ */
export const TIPOS_COMPROBANTE = {
  FACTURA: "factura",
  BOLETA: "boleta",
} as const;

export type TipoComprobante = (typeof TIPOS_COMPROBANTE)[keyof typeof TIPOS_COMPROBANTE];

/* ================================================================
   Áreas de aprobación
   ================================================================ */
export const AREAS_APROBACION = {
  LEGAL: "legal",
  LOGISTICA: "logistica",
  EVENTOS: "eventos",
} as const;

export type AreaAprobacion = (typeof AREAS_APROBACION)[keyof typeof AREAS_APROBACION];

/* ================================================================
   Estados de aprobación individual
   ================================================================ */
export const RESULTADOS_APROBACION = {
  PENDIENTE: "pendiente",
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
} as const;

export type ResultadoAprobacion = (typeof RESULTADOS_APROBACION)[keyof typeof RESULTADOS_APROBACION];

/* ================================================================
   Estados de interoperabilidad (facturación)
   ================================================================ */
export const ESTADOS_INTEROP = {
  ENVIADO: "enviado",
  CONFIRMADO: "confirmado",
  ERROR: "error",
} as const;

export type EstadoInterop = (typeof ESTADOS_INTEROP)[keyof typeof ESTADOS_INTEROP];

/* ================================================================
   Monedas
   ================================================================ */
export const MONEDAS = {
  USD: "USD",
  PEN: "PEN",
} as const;

export type Moneda = (typeof MONEDAS)[keyof typeof MONEDAS];
