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
   Ambientes de despliegue
   ================================================================ */
export const APP_ENVS = {
  LOCAL: "local",
  QA: "qa",
  PRODUCTION: "production",
} as const;

export type AppEnv = (typeof APP_ENVS)[keyof typeof APP_ENVS];

export function getAppEnv(): AppEnv {
  const env = process.env.NEXT_PUBLIC_APP_ENV;
  if (env === APP_ENVS.QA) return APP_ENVS.QA;
  if (env === APP_ENVS.PRODUCTION) return APP_ENVS.PRODUCTION;
  return APP_ENVS.LOCAL;
}

/* ================================================================
   Estados de stand (plano)
   ================================================================ */
export const ESTADOS_STAND = {
  DISPONIBLE: "disponible",
  EN_EVALUACION: "en_evaluacion",
  RESERVADO: "reservado",
} as const;

export type EstadoStand = (typeof ESTADOS_STAND)[keyof typeof ESTADOS_STAND];

/** item_id en maestra (tabla stand_estado) para cada estado */
export const ESTADOS_STAND_MAESTRA_ID: Record<string, number> = {
  [ESTADOS_STAND.DISPONIBLE]: 1,
  [ESTADOS_STAND.EN_EVALUACION]: 2,
  [ESTADOS_STAND.RESERVADO]: 3,
};

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
  LOGISTICA: "logistica",
  LEGAL: "legal",
  COMUNICACION: "comunicacion",
} as const;

export type AreaAprobacion = (typeof AREAS_APROBACION)[keyof typeof AREAS_APROBACION];

/* ================================================================
   Roles de usuario
   ================================================================ */
export const ROLES = {
  ADMIN: "admin",
  LOGISTICA: "logistica",
  LEGAL: "legal",
  COMUNICACION: "comunicacion",
  CLIENTE: "cliente",
} as const;

export type Rol = (typeof ROLES)[keyof typeof ROLES];

export const ROLES_PERMISSIONS: Record<Rol, string[]> = {
  [ROLES.ADMIN]: [
    "admin:full",
    "dashboard:view",
    "eventos:datos",
    "stands:vinculacion",
    "stands:manage",
    "stands:plano",
    "roles:manage",
    "events:manage",
    "events:create",
    "events:edit",
    "events:toggle",
    "read:reservas",
    "write:reservas",
    "approve:all",
    "solicitudes:view",
    "solicitudes:review:comunicacion",
    "solicitudes:review:legal",
    "solicitudes:review:logistica",
    "solicitudes:notify",
    "solicitudes:upload",
    "auspicios:view",
  ],
  [ROLES.LOGISTICA]: ["dashboard:view", "eventos:datos", "stands:manage", "stands:plano", "auspicios:view", "read:reservas", "approve:logistica", "solicitudes:view", "solicitudes:review:logistica"],
  [ROLES.LEGAL]: ["dashboard:view", "eventos:datos", "stands:plano", "auspicios:view", "read:reservas", "approve:legal", "solicitudes:view", "solicitudes:review:legal"],
  [ROLES.COMUNICACION]: ["dashboard:view", "eventos:datos", "stands:plano", "auspicios:view", "read:reservas", "approve:comunicacion", "solicitudes:view", "solicitudes:review:comunicacion"],
  [ROLES.CLIENTE]: ["eventos:datos", "solicitudes:view", "stands:plano", "read:reservas", "write:reservas"],
};

export const ALL_PERMISSIONS = [
  { key: "admin:full", label: "Acceso total", descripcion: "Control completo del sistema", section: "sistema" },
  // Dashboard general
  { key: "dashboard:view", label: "Panel de Control", descripcion: "Acceder al panel de control principal", section: "dashboard" },
  { key: "eventos:datos", label: "Datos del Evento", descripcion: "Ver datos y precios de la version del evento", section: "dashboard" },
  // Stands
  { key: "stands:vinculacion", label: "Vinculacion de Stands", descripcion: "Vincular stands de GESS como disponibles", section: "stands" },
  { key: "stands:manage", label: "Gestion de Stands", descripcion: "Administrar y editar stands del evento", section: "stands" },
  { key: "stands:plano", label: "Plano de Stands", descripcion: "Ver el plano interactivo de stands del evento", section: "stands" },
  // Auspicios
  { key: "auspicios:view", label: "Ver auspicios", descripcion: "Ver listado y registrar auspicios", section: "auspicios" },
  // Solicitudes de alquiler
  { key: "solicitudes:view", label: "Ver solicitudes", descripcion: "Ver bandeja de solicitudes de alquiler", section: "solicitudes" },
  { key: "solicitudes:review:comunicacion", label: "Revisar Comunicacion", descripcion: "Aprobar/rechazar desde area de Comunicacion", section: "solicitudes" },
  { key: "solicitudes:review:legal", label: "Revisar Legal", descripcion: "Aprobar/rechazar desde area Legal", section: "solicitudes" },
  { key: "solicitudes:review:logistica", label: "Revisar Logistica", descripcion: "Aprobar/rechazar desde area de Logistica", section: "solicitudes" },
  { key: "solicitudes:notify", label: "Notificar solicitudes", descripcion: "Enviar notificacion al cliente cuando todas las areas revisaron", section: "solicitudes" },
  { key: "solicitudes:upload", label: "Subir documentos", descripcion: "Subir documentos a solicitudes de alquiler", section: "solicitudes" },
  // Reservas (legacy)
  { key: "read:reservas", label: "Ver reservas", descripcion: "Consultar lista y detalle de reservas", section: "reservas" },
  { key: "write:reservas", label: "Crear reservas", descripcion: "Registrar nuevas reservas de stands", section: "reservas" },
  { key: "approve:all", label: "Aprobar todo", descripcion: "Aprobar en cualquier area", section: "reservas" },
  { key: "approve:logistica", label: "Aprobar Logistica", descripcion: "Resolver aprobaciones del area de Logistica", section: "reservas" },
  { key: "approve:legal", label: "Aprobar Legal", descripcion: "Resolver aprobaciones del area Legal", section: "reservas" },
  { key: "approve:comunicacion", label: "Aprobar Comunicacion", descripcion: "Resolver aprobaciones del area de Comunicacion", section: "reservas" },
  // Roles y Eventos
  { key: "roles:manage", label: "Roles y Permisos", descripcion: "Administrar roles, usuarios y permisos del sistema", section: "admin" },
  { key: "events:manage", label: "Gestion de Eventos", descripcion: "Administrar eventos y sus versiones", section: "admin" },
  { key: "events:create", label: "Crear eventos", descripcion: "Crear nuevas versiones de eventos", section: "eventos" },
  { key: "events:edit", label: "Editar eventos", descripcion: "Modificar fechas e informacion de eventos", section: "eventos" },
  { key: "events:toggle", label: "Activar/Cerrar eventos", descripcion: "Alternar estado activo/cerrado de versiones", section: "eventos" },
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number]["key"];

export const PERMISSION_SECTIONS = {
  SISTEMA: "sistema",
  DASHBOARD: "dashboard",
  STANDS: "stands",
  AUSPICIOS: "auspicios",
  SOLICITUDES: "solicitudes",
  RESERVAS: "reservas",
  EVENTOS: "eventos",
  ADMIN: "admin",
} as const;

export const PERMISSION_SECTION_LABELS: Record<string, string> = {
  [PERMISSION_SECTIONS.SISTEMA]: "Sistema",
  [PERMISSION_SECTIONS.DASHBOARD]: "Panel de Control",
  [PERMISSION_SECTIONS.STANDS]: "Gestion de Stands",
  [PERMISSION_SECTIONS.AUSPICIOS]: "Auspicios",
  [PERMISSION_SECTIONS.SOLICITUDES]: "Solicitudes de alquiler",
  [PERMISSION_SECTIONS.RESERVAS]: "Reservas",
  [PERMISSION_SECTIONS.EVENTOS]: "Eventos",
  [PERMISSION_SECTIONS.ADMIN]: "Administracion",
};

/* ================================================================
   Flujo de revisión (Solicitudes de alquiler)
   ================================================================ */
export const REVISION_AREAS = {
  COMUNICACION: "comunicacion",
  LEGAL: "legal",
  LOGISTICA: "logistica",
} as const;

export type RevisionArea = (typeof REVISION_AREAS)[keyof typeof REVISION_AREAS];

export const REVISION_AREA_ORDER: RevisionArea[] = [
  REVISION_AREAS.COMUNICACION,
  REVISION_AREAS.LEGAL,
  REVISION_AREAS.LOGISTICA,
];

export const REVISION_AREA_LABELS: Record<RevisionArea, string> = {
  [REVISION_AREAS.COMUNICACION]: "Comunicacion",
  [REVISION_AREAS.LEGAL]: "Legal",
  [REVISION_AREAS.LOGISTICA]: "Logistica",
};

export const REVISION_AREA_PERMISSIONS: Record<RevisionArea, string> = {
  [REVISION_AREAS.COMUNICACION]: "solicitudes:review:comunicacion",
  [REVISION_AREAS.LEGAL]: "solicitudes:review:legal",
  [REVISION_AREAS.LOGISTICA]: "solicitudes:review:logistica",
};

export const REVISION_STEPS = {
  COMUNICACION: 0,
  LEGAL: 1,
  LOGISTICA: 2,
} as const;

export type RevisionStep = (typeof REVISION_STEPS)[keyof typeof REVISION_STEPS];

/* ================================================================
   Estados de aprobacion individual
   ================================================================ */
export const RESULTADOS_APROBACION = {
  PENDIENTE: "pendiente",
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
} as const;

export type ResultadoAprobacion = (typeof RESULTADOS_APROBACION)[keyof typeof RESULTADOS_APROBACION];

/* ================================================================
   Estados de solicitud (pipeline de revision)
   ================================================================ */
export const ESTADOS_SOLICITUD = {
  PENDIENTE: "pendiente",
  EN_PROCESO: "en_proceso",
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
  PENDIENTE_PAGO: "pendiente_pago",
} as const;

export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[keyof typeof ESTADOS_SOLICITUD];

export const ESTADOS_SOLICITUD_MAESTRA_ID: Record<string, number> = {
  [ESTADOS_SOLICITUD.PENDIENTE]: 1,
  [ESTADOS_SOLICITUD.EN_PROCESO]: 2,
  [ESTADOS_SOLICITUD.APROBADO]: 3,
  [ESTADOS_SOLICITUD.RECHAZADO]: 4,
  [ESTADOS_SOLICITUD.PENDIENTE_PAGO]: 5,
};

/* ================================================================
   Estados de revision (por area)
   ================================================================ */
export const ESTADOS_REVISION = {
  PENDIENTE: "pendiente",
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
} as const;

export type EstadoRevision = (typeof ESTADOS_REVISION)[keyof typeof ESTADOS_REVISION];

export const ESTADOS_REVISION_MAESTRA_ID: Record<string, number> = {
  [ESTADOS_REVISION.PENDIENTE]: 1,
  [ESTADOS_REVISION.APROBADO]: 2,
  [ESTADOS_REVISION.RECHAZADO]: 3,
};

/* ================================================================
   Estados de re-evaluacion
   ================================================================ */
export const ESTADOS_REEVALUACION = {
  PENDIENTE: "pendiente",
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
} as const;

export type EstadoReevaluacion = (typeof ESTADOS_REEVALUACION)[keyof typeof ESTADOS_REEVALUACION];

export const ESTADOS_REEVALUACION_MAESTRA_ID: Record<string, number> = {
  [ESTADOS_REEVALUACION.PENDIENTE]: 1,
  [ESTADOS_REEVALUACION.APROBADO]: 2,
  [ESTADOS_REEVALUACION.RECHAZADO]: 3,
};

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

/* ================================================================
   Claves de localStorage
   ================================================================ */
export const LS_KEYS = {
  VERTICAL: "iimp-vertical",
  EVENTO_PUBLICO: "iimp-evento-publico",
  EVENTO_PENDIENTE: "iimp-pending-evento",
  PLANO_SELECCION: "iimp-plano-seleccion",
} as const;

/* ================================================================
   Steps del modal de reserva
   ================================================================ */
export const RESERVA_STEPS = {
  DATOS: 0,
  DOCUMENTOS: 1,
  CONFIRMACION: 2,
} as const;

export type ReservaStep = (typeof RESERVA_STEPS)[keyof typeof RESERVA_STEPS];

/* ================================================================
   Tablas de maestra (diccionario)
   ================================================================ */
export const MAESTRA_TABLAS = {
  COMPROBANTE_TIPO: "comprobante_tipo",
  DOCUMENTO_TIPO: "documento_tipo",
  USUARIO_TIPO: "usuario_tipo",
  STAND_ESTADO: "stand_estado",
  SOLICITUD_ESTADO: "solicitud_estado",
  REVISION_ESTADO: "revision_estado",
  REEVALUACION_ESTADO: "reevaluacion_estado",
} as const;

export type MaestraTabla = (typeof MAESTRA_TABLAS)[keyof typeof MAESTRA_TABLAS];

/* ================================================================
   Codigos de error API
   ================================================================ */
export const API_ERROR_CODES = {
  VALIDATION: "VALIDATION",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
  INTERNAL: "INTERNAL",
  BAD_GATEWAY: "BAD_GATEWAY",
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
