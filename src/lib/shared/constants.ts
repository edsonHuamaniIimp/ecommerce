/**
 * Constantes compartidas FRONTEND + BACKEND.
 *
 * NUNCA usar strings hardcodeados para validaciones, estados, roles, Ã¡reas,
 * verticales ni tipos de comprobante. Siempre referenciar desde este archivo.
 *
 * Ejemplo:
 *   âŒ if (estado === "aprobado") { ... }
 *   âœ… if (estado === ESTADOS_RESERVA.APROBADA) { ... }
 *
 *   âŒ { area: "legal", ... }
 *   âœ… { area: AREAS_APROBACION.LEGAL, ... }
 */

/** Rutas publicas que el middleware no protege. */
export const PUBLIC_ROUTES = [
  "/auth/login",
  "/presala",
  "/mapa",
  "/landing",
  "/",
  "/403",
] as const;

/** Prefijos de API publicos (startsWith). */
export const PUBLIC_API_PREFIXES = [
  "/api/auth/",
  "/api/maestra/",
] as const;

/** Rutas API publicas exactas. */
export const PUBLIC_API_ROUTES = [
  "/api/maestra",
  "/api/exhibidoras",
  "/api/eventos/modal-info",
  "/api/stands/exhibidora",
  "/api/stands/contrato",
  "/api/planos/publico",
  "/api/integracion/sgc/webhook",
  "/api/cron/sgc-reconciliar",
] as const;

/** URL base de la aplicacion. En produccion se configura via variable de entorno. */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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

/** Etiquetas heredadas que devuelven GESS/KB para el estado del stand. */
export const ESTADOS_STAND_LEGACY = {
  RESERVADO: "Reservado",
  EN_EVALUACION: "En evaluacion",
  AVAILABLE: "available",
  RESERVED: "reserved",
} as const;

/** item_id en maestra (tabla stand_estado) para cada estado */
export const ESTADOS_STAND_MAESTRA_ID: Record<string, number> = {
  [ESTADOS_STAND.DISPONIBLE]: 1,
  [ESTADOS_STAND.EN_EVALUACION]: 2,
  [ESTADOS_STAND.RESERVADO]: 3,
};

/* ================================================================
   Tipologias de stand (maestra: stand_tipologia)
   Clasificacion tecnica que determina la matriz documental del
   expediente tecnico en el Sistema de Montaje (SM)
   ================================================================ */
export const TIPOLOGIAS_STAND = {
  COMPLEJO: "1",
  SIMPLE: "2",
  OCTANORM: "3",
} as const;

export type TipologiaStand = (typeof TIPOLOGIAS_STAND)[keyof typeof TIPOLOGIAS_STAND];

export const TIPOLOGIAS_STAND_LABELS: Record<string, { label: string; nombre: string }> = {
  [TIPOLOGIAS_STAND.COMPLEJO]: { label: "1", nombre: "Complejo" },
  [TIPOLOGIAS_STAND.SIMPLE]: { label: "2", nombre: "Simple" },
  [TIPOLOGIAS_STAND.OCTANORM]: { label: "3", nombre: "Octanorm simple" },
};

/** tabla maestra donde viven las tipologias */
export const MAESTRA_TABLA_STAND_TIPOLOGIA = "stand_tipologia";

/* ================================================================
   Tipos de plano (Laboratorio 3D)
   ================================================================ */
export const TIPOS_PLANO = {
  SIMPLE: "simple",
  MACRO: "macro",
} as const;

export type TipoPlano = (typeof TIPOS_PLANO)[keyof typeof TIPOS_PLANO];

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
   Tipos de documento de identidad
   ================================================================ */
export const TIPOS_DOCUMENTO = {
  RUC: "RUC",
  DNI: "DNI",
} as const;

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[keyof typeof TIPOS_DOCUMENTO];

/** Identificador del usuario/alerta reservado para administracion (no es un rol). */
export const ADMIN_USER_ID = "admin";

/* ================================================================
   Ãreas de aprobaciÃ³n
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
    "laboratorio:view",
    "laboratorio:manage",
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
  // Laboratorio 3D
  { key: "laboratorio:view", label: "Ver Laboratorio 3D", descripcion: "Ver mapas 3D guardados en el laboratorio", section: "laboratorio" },
  { key: "laboratorio:manage", label: "Editar Laboratorio 3D", descripcion: "Crear, editar, importar y exportar mapas 3D", section: "laboratorio" },
  // Facturacion
  { key: "facturacion:view", label: "Ver facturacion", descripcion: "Gestionar facturacion y pagos de solicitudes", section: "facturacion" },
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

/**
 * Claves de permisos individuales. Usar SIEMPRE estas constantes en vez de
 * strings literales ("admin:full", "solicitudes:notify", etc.).
 */
export const PERMISSIONS = {
  ADMIN_FULL: "admin:full",
  DASHBOARD_VIEW: "dashboard:view",
  EVENTOS_DATOS: "eventos:datos",
  STANDS_VINCULACION: "stands:vinculacion",
  STANDS_MANAGE: "stands:manage",
  STANDS_PLANO: "stands:plano",
  AUSPICIOS_VIEW: "auspicios:view",
  LABORATORIO_VIEW: "laboratorio:view",
  LABORATORIO_MANAGE: "laboratorio:manage",
  FACTURACION_VIEW: "facturacion:view",
  SOLICITUDES_VIEW: "solicitudes:view",
  SOLICITUDES_REVIEW_COMUNICACION: "solicitudes:review:comunicacion",
  SOLICITUDES_REVIEW_LEGAL: "solicitudes:review:legal",
  SOLICITUDES_REVIEW_LOGISTICA: "solicitudes:review:logistica",
  SOLICITUDES_NOTIFY: "solicitudes:notify",
  SOLICITUDES_UPLOAD: "solicitudes:upload",
  READ_RESERVAS: "read:reservas",
  WRITE_RESERVAS: "write:reservas",
  APPROVE_ALL: "approve:all",
  APPROVE_LOGISTICA: "approve:logistica",
  APPROVE_LEGAL: "approve:legal",
  APPROVE_COMUNICACION: "approve:comunicacion",
  ROLES_MANAGE: "roles:manage",
  EVENTS_MANAGE: "events:manage",
  EVENTS_CREATE: "events:create",
  EVENTS_EDIT: "events:edit",
  EVENTS_TOGGLE: "events:toggle",
} as const satisfies Record<string, Permission>;

export const PERMISSION_SECTIONS = {
  SISTEMA: "sistema",
  DASHBOARD: "dashboard",
  STANDS: "stands",
  AUSPICIOS: "auspicios",
  LABORATORIO: "laboratorio",
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
  [PERMISSION_SECTIONS.LABORATORIO]: "Laboratorio 3D",
  [PERMISSION_SECTIONS.SOLICITUDES]: "Solicitudes de alquiler",
  [PERMISSION_SECTIONS.RESERVAS]: "Reservas",
  [PERMISSION_SECTIONS.EVENTOS]: "Eventos",
  [PERMISSION_SECTIONS.ADMIN]: "Administracion",
};

/* ================================================================
   Flujo de revisiÃ³n (Solicitudes de alquiler)
   ================================================================ */
export const REVISION_AREAS = {
  COMUNICACION: "comunicacion",
  LEGAL: "legal",
  LOGISTICA: "logistica",
} as const;

export type RevisionArea = (typeof REVISION_AREAS)[keyof typeof REVISION_AREAS];

/**
 * Orden de las revisiones LOCALES. La revisiÃ³n **Legal** ya no es local: se delega
 * al SGC (su `internal-review`). Por eso el pipeline local termina en ComunicaciÃ³n.
 */
export const REVISION_AREA_ORDER: RevisionArea[] = [
  REVISION_AREAS.LOGISTICA,
  REVISION_AREAS.COMUNICACION,
];

/** Etiqueta del paso (visual, no local) que representa la revisiÃ³n Legal del SGC. */
export const REVISION_AREA_SGC_LABEL = "Legal (SGC)";
/**
 * Clave del paso pseudo-"area" que representa la revisiÃ³n Legal delegada al SGC.
 * Es solo de UI (no existe una revisiÃ³n local con esta Ã¡rea).
 */
export const REVISION_AREA_SGC_STEP = "__sgc__";

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

/** Rol que debe ser notificado cuando un area completa su revision.
    Si es null, significa que es la ultima area y se notifica al admin. */
export const REVISION_AREA_NEXT_ROLE: Record<RevisionArea, string | null> = {
  [REVISION_AREAS.LOGISTICA]: ROLES.COMUNICACION,
  [REVISION_AREAS.COMUNICACION]: null, // ultima area LOCAL â†’ notificar admin + delegar al SGC
  [REVISION_AREAS.LEGAL]: null, // delegada al SGC (no local)
} as const;

/* ================================================================
   Facturacion
   ================================================================ */
export const TIPOS_FACTURACION = {
  NIU_BIZZ: "niubizz",
  MANUAL: "manual",
} as const;
export type TipoFacturacion = (typeof TIPOS_FACTURACION)[keyof typeof TIPOS_FACTURACION];

export const ESTADOS_FACTURACION = {
  PENDIENTE: "pendiente",
  PAGADO: "pagado",
  ARCHIVADO: "archivado",
  CANCELADO: "cancelado",
} as const;
export type EstadoFacturacion = (typeof ESTADOS_FACTURACION)[keyof typeof ESTADOS_FACTURACION];

export const ESTADOS_CUOTA = {
  PENDIENTE: "pendiente",
  PAGADO: "pagado",
  VENCIDO: "vencido",
} as const;

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
  PAGADO: "pagado",
} as const;

export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[keyof typeof ESTADOS_SOLICITUD];

export const ESTADOS_SOLICITUD_MAESTRA_ID: Record<string, number> = {
  [ESTADOS_SOLICITUD.PENDIENTE]: 1,
  [ESTADOS_SOLICITUD.EN_PROCESO]: 2,
  [ESTADOS_SOLICITUD.APROBADO]: 3,
  [ESTADOS_SOLICITUD.RECHAZADO]: 4,
  [ESTADOS_SOLICITUD.PENDIENTE_PAGO]: 5,
  [ESTADOS_SOLICITUD.PAGADO]: 6,
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
   Estados de interoperabilidad (facturaciÃ³n)
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
  US_DOLAR: "US$",
  /** Simbolo de sol usado por la API externa de auspicios. */
  SOL: "S/",
} as const;

export type Moneda = (typeof MONEDAS)[keyof typeof MONEDAS];

/* ================================================================
   Solicitudes de cuenta de exhibidor
   ================================================================ */
export const ESTADOS_SOLICITUD_CUENTA = {
  PENDIENTE: "pendiente",
  APROBADA: "aprobada",
  RECHAZADA: "rechazada",
} as const;

export type EstadoSolicitudCuenta = (typeof ESTADOS_SOLICITUD_CUENTA)[keyof typeof ESTADOS_SOLICITUD_CUENTA];

/** Estados a los que un administrador puede llevar una solicitud de cuenta. */
export const ESTADOS_SOLICITUD_CUENTA_REVISION = [
  ESTADOS_SOLICITUD_CUENTA.APROBADA,
  ESTADOS_SOLICITUD_CUENTA.RECHAZADA,
] as const;

/** Vigencia del enlace de invitacion que recibe el exhibidor al ser aprobado. */
export const INVITACION_CUENTA_MINUTOS_VIGENCIA = 60;

/** Vigencia del enlace de restablecimiento de contrasena (minutos). */
export const RESET_PASSWORD_MINUTOS_VIGENCIA = 30;

/** Milisegundos de un minuto (conversion de vigencias expresadas en minutos). */
export const MS_POR_MINUTO = 60 * 1000;

/** Verificacion de registro de exhibidor por codigo enviado al correo. */
export const REGISTRO_CODIGO = {
  /** Longitud del codigo numerico. */
  LONGITUD: 6,
  /** Vigencia del codigo (minutos). */
  MINUTOS_VIGENCIA: 15,
  /** Intentos fallidos permitidos antes de invalidar el registro. */
  MAX_INTENTOS: 5,
} as const;

/* ================================================================
   Sesion / cookie de autenticacion
   ================================================================ */
export const SESION = {
  /** Duracion de la sesion estandar (24 horas). */
  MAX_AGE_ESTANDAR: 24 * 60 * 60,
  /** Duracion de la sesion marcada como "recordar" (30 dias). */
  MAX_AGE_RECORDADA: 30 * 24 * 60 * 60,
  /** Expiracion del JWT estandar. */
  JWT_EXPIRACION_ESTANDAR: "24h",
  /** Expiracion del JWT cuando se marca "recordar sesion". */
  JWT_EXPIRACION_RECORDADA: "30d",
} as const;

/* ================================================================
   Claves de localStorage
   ================================================================ */
export const LS_KEYS = {
  EVENTO_PUBLICO: "iimp-evento-publico",
  EVENTO_PENDIENTE: "iimp-pending-evento",
  PLANO_SELECCION: "iimp-plano-seleccion",
  PLANO_CARRITO: "iimp-plano-carrito",
  MODAL_INFO_VISTO: "iimp-modal-info-visto",
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
  FACTURACION_ESTADO: "facturacion_estado",
  FACTURACION_TIPO: "facturacion_tipo",
  CUOTA_ESTADO: "cuota_estado",
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

/* ================================================================
   Estilos de Badge (colores semanticos por estado)
   â€” Usar en lugar de strings hardcodeados para mantener consistencia visual
   â€” Formato: Tailwind classes (bg-*, text-*, border-*)
   ================================================================ */
export const BADGE_STYLES = {
  SUCCESS: "bg-green-100 text-green-800 border-green-200",
  DESTRUCTIVE: "bg-red-100 text-red-800 border-red-200",
  NEUTRAL: "bg-slate-100 text-slate-600 border-slate-200",
  WARNING: "bg-amber-100 text-amber-800 border-amber-200",
  INFO: "bg-blue-100 text-blue-800 border-blue-200",
  INDIGO: "bg-indigo-100 text-indigo-800 border-indigo-200",
} as const;

export type BadgeStyle = (typeof BADGE_STYLES)[keyof typeof BADGE_STYLES];

/* ================================================================
   Validaciones de formularios (longitudes y formatos)
   ================================================================ */
export const VALIDACIONES = {
  PASSWORD_MIN: 6,
  PASSWORD_MAX: 100,
  EMAIL_MAX: 200,
  NOMBRE_MAX: 200,
  APELLIDOS_MAX: 200,
  RAZON_SOCIAL_MAX: 200,
  TELEFONO_MIN: 6,
  TELEFONO_MAX: 20,
  CARGO_MAX: 100,
  RUC_LONGITUD: 11,
  MENSAJE_MAX: 2000,
} as const;

/** Centinelas de UI: opciones que no representan un valor persistido. */
export const UI_SENTINEL = {
  SIN_VINCULAR: "__none__",
} as const;

/** Identificadores de los campos del formulario de registro de exhibidor. */
export const CAMPOS_REGISTRO = {
  EMAIL: "email",
  PASSWORD: "password",
  NOMBRE: "nombre",
  APELLIDOS: "apellidos",
  RAZON_SOCIAL: "razonSocial",
  RUC: "ruc",
  TELEFONO: "telefono",
} as const;

export type CampoRegistro = (typeof CAMPOS_REGISTRO)[keyof typeof CAMPOS_REGISTRO];

/* ================================================================
   Categorias de imagenes de un stand
   ================================================================ */
export const CATEGORIAS_IMAGEN = {
  RENDER_3D: "render_3d",
  ISOMETRICO: "isometrico",
  PLANO: "plano",
  FOTO: "foto",
  LOGO: "logo",
  OTRO: "otro",
} as const;

export type CategoriaImagen = (typeof CATEGORIAS_IMAGEN)[keyof typeof CATEGORIAS_IMAGEN];

export const CATEGORIA_IMAGEN_LABELS: Record<CategoriaImagen, string> = {
  [CATEGORIAS_IMAGEN.RENDER_3D]: "Render 3D",
  [CATEGORIAS_IMAGEN.ISOMETRICO]: "Isometrico",
  [CATEGORIAS_IMAGEN.PLANO]: "Plano",
  [CATEGORIAS_IMAGEN.FOTO]: "Foto",
  [CATEGORIAS_IMAGEN.LOGO]: "Logo",
  [CATEGORIAS_IMAGEN.OTRO]: "Otro",
};

/** Orden de presentacion de las categorias. */
export const CATEGORIA_IMAGEN_ORDER: CategoriaImagen[] = [
  CATEGORIAS_IMAGEN.RENDER_3D,
  CATEGORIAS_IMAGEN.ISOMETRICO,
  CATEGORIAS_IMAGEN.PLANO,
  CATEGORIAS_IMAGEN.FOTO,
  CATEGORIAS_IMAGEN.LOGO,
  CATEGORIAS_IMAGEN.OTRO,
];

/** Normaliza el mapeo url -> categoria proveniente de la BD. */
export function normalizarCategoriasImagen(valor: unknown): Record<string, string> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/* ================================================================
   Filtros de catalogo / bandejas
   ================================================================ */
/** Valor de filtro "sin filtrar", reutilizable en catalogos y bandejas. */
export const FILTRO_TODOS = "todos";

export const FILTROS_EVENTO = {
  TODOS: FILTRO_TODOS,
  VIGENTES: "vigentes",
  OTRAS: "otras",
} as const;

export type FiltroEvento = (typeof FILTROS_EVENTO)[keyof typeof FILTROS_EVENTO];

/* ================================================================
   Colores del visor de stands
   â€” La leyenda del chrome los replica; si cambian en el visor, cambiar aqui.
   ================================================================ */
export const COLOR_STAND_RESERVADO = "#9ca3af";
export const COLOR_STAND_SELECCIONADO = "#f59e0b";

/* ================================================================
   Estilos de UI â€” portal de exhibidores
   ================================================================ */
export const PORTAL_UI = {
  /** Input con icono a la izquierda. */
  INPUT_CON_ICONO: "h-auto rounded-lg border-border bg-background py-2.5 pr-3 pl-10 text-sm placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary",
  /** Input con icono a la izquierda y accion a la derecha (ej. mostrar contrasena). */
  INPUT_CON_ICONO_Y_ACCION: "h-auto rounded-lg border-border bg-background py-2.5 pr-10 pl-10 text-sm placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary",
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/* ================================================================
   IntegraciÃ³n SGC (Sistema de GestiÃ³n de Contratos)
   Contrato externo: APIS_USE_HOOKS.md / docs/05-integraciones/integracion-sgc.md
   ================================================================ */
export const SGC_MODES = {
  MOCK: "mock",
  REAL: "real",
} as const;

export type SgcMode = (typeof SGC_MODES)[keyof typeof SGC_MODES];

export const SGC_EVENT_TYPES = {
  WORKFLOW_STARTED: "workflow.started",
  WORKFLOW_ADVANCED: "workflow.advanced",
  WORKFLOW_RETURNED: "workflow.returned",
  WORKFLOW_APPROVED: "workflow.approved",
  WORKFLOW_REJECTED: "workflow.rejected",
  CONTRACT_CLOSED: "contract.closed",
} as const;

export type SgcEventType = (typeof SGC_EVENT_TYPES)[keyof typeof SGC_EVENT_TYPES];

export const SGC_DOCUMENT_CATEGORIES = {
  CONTRACT: "contract",
  ANNEX: "annex",
} as const;

export type SgcDocumentCategory = (typeof SGC_DOCUMENT_CATEGORIES)[keyof typeof SGC_DOCUMENT_CATEGORIES];

export const SGC_STAGES = {
  DRAFTING: "drafting",
  INTERNAL_REVIEW: "internal-review",
  APPROVAL: "approval",
  VALIDITY: "validity",
  CLOSED: "closed",
} as const;

export type SgcStage = (typeof SGC_STAGES)[keyof typeof SGC_STAGES];

export const SGC_LIFECYCLE_STATUSES = {
  ACTIVE: "active",
  FINALIZED: "finalized",
  OBSERVED: "observed",
  REJECTED: "rejected",
} as const;

export type SgcLifecycleStatus = (typeof SGC_LIFECYCLE_STATUSES)[keyof typeof SGC_LIFECYCLE_STATUSES];

export const SGC_APPROVAL_MARKS = {
  ACKNOWLEDGEMENT: "acknowledgement",
  VISA: "visa",
  NORMAL_SIGNATURE: "normal-signature",
  STAMP: "stamp",
} as const;

export type SgcApprovalMark = (typeof SGC_APPROVAL_MARKS)[keyof typeof SGC_APPROVAL_MARKS];

export const SGC_STEP_STATUSES = {
  COMPLETED: "completed",
  CURRENT: "current",
  PENDING: "pending",
  REJECTED: "rejected",
} as const;

export type SgcStepStatus = (typeof SGC_STEP_STATUSES)[keyof typeof SGC_STEP_STATUSES];

export const SGC_VERSION_STATUS = {
  AVAILABLE: "available",
  PRESERVED: "preserved",
} as const;

export type SgcVersionStatus = (typeof SGC_VERSION_STATUS)[keyof typeof SGC_VERSION_STATUS];

export const SGC_APPROVAL_RESULT = {
  ACCEPTED: "accepted",
  REJECTED: "rejected",
} as const;

export type SgcApprovalResult = (typeof SGC_APPROVAL_RESULT)[keyof typeof SGC_APPROVAL_RESULT];

export const SGC_CREATE_STATUS = {
  CREATED: "created",
} as const;

export const SGC_FINALIZATION = {
  ACTIVE: "active",
  FINALIZED: "finalized",
} as const;

export type SgcFinalization = (typeof SGC_FINALIZATION)[keyof typeof SGC_FINALIZATION];

export const SGC_ESTADO_ENVIO = {
  PENDIENTE: "pendiente",
  CREADO: "creado",
  ERROR: "error",
} as const;

export type SgcEstadoEnvio = (typeof SGC_ESTADO_ENVIO)[keyof typeof SGC_ESTADO_ENVIO];

export const SGC_DOCUMENTO_ESTADO = {
  RESERVADO: "reservado",
  SUBIDO: "subido",
  CONFIRMADO: "confirmado",
  RECHAZADO: "rechazado",
} as const;

export type SgcDocumentoEstado = (typeof SGC_DOCUMENTO_ESTADO)[keyof typeof SGC_DOCUMENTO_ESTADO];

/** MÃ©todos HTTP (evita literales en clientes/servicios). */
export const HTTP_METHODS = {
  GET: "GET",
  POST: "POST",
  PATCH: "PATCH",
  PUT: "PUT",
  DELETE: "DELETE",
} as const;

export type HttpMethod = (typeof HTTP_METHODS)[keyof typeof HTTP_METHODS];

/** Rutas de la API de integraciÃ³n del SGC, relativas a `SGC_API_URL`. */
export const SGC_API_PATHS = {
  CONTRACTS: "/contracts",
  CONTRACT: (id: string) => `/contracts/${encodeURIComponent(id)}`,
  CONTRACT_DOCUMENTS: (id: string) => `/contracts/${encodeURIComponent(id)}/documents`,
  /** Reabre el tramite tras subir la correccion de una devolucion (subsanacion). */
  CONTRACT_RESEND: (id: string) => `/contracts/${encodeURIComponent(id)}/resend`,
  CONTRACT_TYPES: "/contract-types",
  DOCUMENT: (id: string) => `/documents/${encodeURIComponent(id)}`,
  DOCUMENT_VERSION: (id: string) => `/document-versions/${encodeURIComponent(id)}`,
  DOCUMENT_VERSION_COMPLETE: (id: string) => `/document-versions/${encodeURIComponent(id)}/complete`,
  DOCUMENT_VERSION_DOWNLOAD: (id: string) => `/document-versions/${encodeURIComponent(id)}/download`,
  TEMPLATES: "/templates",
  TEMPLATE: (code: string) => `/templates/${encodeURIComponent(code)}`,
  TEMPLATE_FILE_DOWNLOAD: (code: string, fileId: string) =>
    `/templates/${encodeURIComponent(code)}/files/${encodeURIComponent(fileId)}/download`,
} as const;

/** Outbox SGC: estados, operaciones y politica de reintentos. */
export const SGC_OUTBOX_ESTADO = {
  PENDIENTE: "pendiente",
  ENVIADO: "enviado",
  ERROR: "error",
} as const;

export type SgcOutboxEstado = (typeof SGC_OUTBOX_ESTADO)[keyof typeof SGC_OUTBOX_ESTADO];

export const SGC_OUTBOX_OPERACION = {
  SUBIR_CONTRATO: "subir-contrato",
  SUBIR_ANEXOS: "subir-anexos",
  SUBSANAR: "subsanar",
} as const;

export type SgcOutboxOperacion = (typeof SGC_OUTBOX_OPERACION)[keyof typeof SGC_OUTBOX_OPERACION];

export const SGC_OUTBOX_MAX_INTENTOS = 6;
export const SGC_OUTBOX_BACKOFF_BASE_MS = 60000;

export const SGC_API_VERSION = "2026-09-01";
export const SGC_IDEMPOTENCY_PREFIX = "stands/reserva";
/** Prefijo de la Idempotency-Key al reabrir el tramite tras subsanar (POST /resend). */
export const SGC_IDEMPOTENCY_RESEND_PREFIX = "stands/resend";
export const SGC_WEBHOOK_TOLERANCE_SECONDS = 300;
export const SGC_WEBHOOK_SIGNATURE_HEADER = "x-sgc-signature";
export const SGC_WEBHOOK_DELIVERY_HEADER = "x-sgc-delivery";
export const CRON_SECRET_HEADER = "x-cron-secret";
/**
 * Ãrea local que dispara la delegaciÃ³n al SGC. Las revisiones locales se agotan en
 * ComunicaciÃ³n; la revisiÃ³n **Legal** pasa a ser el `internal-review` del SGC.
 * Cambiar a `REVISION_AREAS.LEGAL` revierte al disparo por revisiÃ³n Legal.
 */
export const SGC_TRIGGER_REVISION_AREA = REVISION_AREAS.COMUNICACION;
export const SGC_PROCESS_ORIGIN = "ContratosStands";
export const SGC_SUBSANACION_MOTIVO = "Subsanacion solicitada por el SGC";
/**
 * Motivo obligatorio en la reserva de subida. El SGC exige `replacementReason` no
 * vacio junto con `documentId: null` incluso para la carga inicial de un documento.
 */
export const SGC_MOTIVO_CARGA_INICIAL = "Carga inicial desde ContratosStands";

/** Tipos de documento adjunto de una solicitud (clasifica contrato vs anexo). */
export const TIPOS_DOCUMENTO_SOLICITUD = {
  CONTRATO: "contrato",
  CONTRATO_FIRMADO: "contrato_firmado",
  ANEXO: "anexo",
} as const;
export type TipoDocumentoSolicitud = (typeof TIPOS_DOCUMENTO_SOLICITUD)[keyof typeof TIPOS_DOCUMENTO_SOLICITUD];

/** Tipos de alerta de la campana de notificaciones. */
export const ALERTA_TIPOS = {
  REVISION_PENDIENTE: "revision_pendiente",
  RESERVA_MULTIPLE: "reserva_multiple",
  CONTRATO_FIRMADO: "contrato_firmado",
} as const;

/** LÃ­mite de carga del SGC: 25 MB por archivo (configurable en el SGC). */
export const SGC_UPLOAD_MAX_BYTES = 26214400;
/** Formatos admitidos por el SGC para los documentos. */
export const SGC_UPLOAD_ALLOWED_EXTENSIONS = ["pdf", "docx", "xlsx", "png", "jpg", "jpeg"] as const;

/** Anexos requeridos por el SGC para la separaciÃ³n de stands. */
export const ANEXOS_REQUERIDOS: { key: string; label: string }[] = [
  { key: "ficha-ruc", label: "Ficha RUC (o equivalente, en caso de empresa extranjera)" },
  { key: "vigencia-poder", label: "Vigencia de Poder (o equivalente, en caso de empresa extranjera)" },
  { key: "dni-representante", label: "DNI o Pasaporte del Representante Legal" },
];

/**
 * Sugerencias (no cerradas) para el motivo de subsanaciÃ³n que declara el administrador cuando
 * el SGC devuelve el trÃ¡mite. La casuÃ­stica es **libre**: el admin puede escribir cualquier
 * motivo, y puede repetirse N veces (una por cada devoluciÃ³n).
 */
export const SGC_SUBSANACION_SUGERENCIAS: { titulo: string; texto: string }[] = [
  {
    titulo: "PrepararÃ© un contrato nuevo",
    texto: "SubirÃ© un contrato corregido para que el cliente lo firme.",
  },
  {
    titulo: "El cliente firmarÃ¡ el mismo contrato",
    texto: "El cliente vuelve a firmar el contrato que ya tenÃ­a.",
  },
];
export const SGC_CODE_PREFIX = "STAND";
export const SGC_EXPEDIENTE_NAME_PREFIX = "Separacion de stand";

/** Formatos admitidos por el SGC: extension â†’ mime declarado exacto */
export const SGC_MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export const SGC_MIME_TYPE_DEFAULT = "application/octet-stream";

/** Content-Type por extension para servir archivos subidos (/uploads/*). */
export const MIME_CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  txt: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const MIME_CONTENT_TYPE_DEFAULT = "application/octet-stream";

export const SGC_STEP_STATUS_LABELS: Record<string, string> = {
  [SGC_STEP_STATUSES.COMPLETED]: "Completado",
  [SGC_STEP_STATUSES.CURRENT]: "En curso",
  [SGC_STEP_STATUSES.PENDING]: "Pendiente",
  [SGC_STEP_STATUSES.REJECTED]: "Rechazado",
};

export const SGC_APPROVAL_MARK_LABELS: Record<string, string> = {
  [SGC_APPROVAL_MARKS.ACKNOWLEDGEMENT]: "Visto bueno",
  [SGC_APPROVAL_MARKS.VISA]: "Visado",
  [SGC_APPROVAL_MARKS.NORMAL_SIGNATURE]: "Firma",
  [SGC_APPROVAL_MARKS.STAMP]: "Sello",
};

export const SGC_LIFECYCLE_LABELS: Record<string, string> = {
  [SGC_LIFECYCLE_STATUSES.ACTIVE]: "Vigente",
  [SGC_LIFECYCLE_STATUSES.FINALIZED]: "Cerrado",
  [SGC_LIFECYCLE_STATUSES.OBSERVED]: "Observado",
  [SGC_LIFECYCLE_STATUSES.REJECTED]: "Rechazado",
};
