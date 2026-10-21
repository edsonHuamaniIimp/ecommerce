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

/** Rutas publicas que el middleware no protege. */
export const PUBLIC_ROUTES = [
  "/auth/login",
  "/presala",
  "/",
  "/403",
  "/manual",
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
  "/api/planos/ubicacion",
  "/api/integracion/sgc/webhook",
  "/api/integracion/factura",
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
  /** Bloqueo temporal del cliente mientras completa el wizard. */
  EN_PROCESO: "en_proceso",
  EN_EVALUACION: "en_evaluacion",
  RESERVADO: "reservado",
  /** Bloqueo con empresa (sin solicitud ni contrato); en UI se comporta como reservado. */
  PRE_RESERVADO: "pre_reservado",
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

/** Codigo unico de plano (columna plano.codigo): minusculas, numeros y guiones. */
export const PLANO_CODIGO_REGEX = /^[a-z0-9-]+$/;

/** Codigo de tipo de bloque del Laboratorio 3D: mayusculas, numeros, guion y guion bajo. */
export const PLANO_TIPO_CODIGO_REGEX = /^[A-Z0-9_-]+$/;

/** Longitud maxima del codigo de tipo de bloque (coincide con plano_tipo_bloque.codigo). */
export const PLANO_TIPO_CODIGO_MAX = 20;

/** Prefijo de los codigos de mapa autogenerados en el Laboratorio 3D. */
export const PLANO_CODIGO_PREFIJO = "pab";

/* ================================================================
   Componentes decorativos del plano 3D (PlanoFurniture)
   Se colocan por plano; no hay componentes automaticos.
   ================================================================ */
export const TIPOS_FURNITURE = {
  KIOSKO: "kiosko",
  PLAZA: "plaza",
  MESA: "mesa",
  SILLON: "sillon",
  PISO: "piso",
  PERSONA: "persona",
  ARBOL: "arbol",
  BANDERA: "bandera",
  TOTEM: "totem",
  BANCA: "banca",
  PERGOLA: "pergola",
  CAMION: "camion",
  PERFORADORA: "perforadora",
  POSTE_LUZ: "poste-luz",
  BARANDA: "baranda",
  BASURERO: "basurero",
  FOOD_TRUCK: "food-truck",
  PANTALLA_LED: "pantalla-led",
  AMBULANCIA: "ambulancia",
  CARPA: "carpa",
  BANOS: "banos-portatiles",
  BUS: "bus",
} as const;

export type TipoFurniture = (typeof TIPOS_FURNITURE)[keyof typeof TIPOS_FURNITURE];

export const FURNITURE_LABELS: Record<string, { label: string; nombre: string }> = {
  [TIPOS_FURNITURE.KIOSKO]: { label: "Kiosko", nombre: "Kiosko rustico" },
  [TIPOS_FURNITURE.PLAZA]: { label: "Plaza", nombre: "Plaza (4 mesas + 16 sillones)" },
  [TIPOS_FURNITURE.MESA]: { label: "Mesa", nombre: "Mesa individual" },
  [TIPOS_FURNITURE.SILLON]: { label: "Sillon", nombre: "Sillon individual" },
  [TIPOS_FURNITURE.PISO]: { label: "Piso", nombre: "Parche de piso (tamano configurable)" },
  [TIPOS_FURNITURE.PERSONA]: { label: "Persona", nombre: "Figura humana decorativa" },
  [TIPOS_FURNITURE.ARBOL]: { label: "Arbol", nombre: "Arbol mediano" },
  [TIPOS_FURNITURE.BANDERA]: { label: "Bandera", nombre: "Bandera con asta" },
  [TIPOS_FURNITURE.TOTEM]: { label: "Totem", nombre: "Totem de pabellon" },
  [TIPOS_FURNITURE.BANCA]: { label: "Banca", nombre: "Banca de plaza" },
  [TIPOS_FURNITURE.PERGOLA]: { label: "Pergola", nombre: "Pergola de descanso (4 x 3 m)" },
  [TIPOS_FURNITURE.CAMION]: { label: "Camion", nombre: "Camion minero decorativo" },
  [TIPOS_FURNITURE.PERFORADORA]: { label: "Perforadora", nombre: "Perforadora minera decorativa" },
  [TIPOS_FURNITURE.POSTE_LUZ]: { label: "Poste", nombre: "Poste de luz (4.5 m)" },
  [TIPOS_FURNITURE.BARANDA]: { label: "Baranda", nombre: "Baranda modular (2 m)" },
  [TIPOS_FURNITURE.BASURERO]: { label: "Basurero", nombre: "Basurero con tapa" },
  [TIPOS_FURNITURE.FOOD_TRUCK]: { label: "Food truck", nombre: "Food truck gastronomico" },
  [TIPOS_FURNITURE.PANTALLA_LED]: { label: "Pantalla LED", nombre: "Pantalla LED sobre base" },
  [TIPOS_FURNITURE.AMBULANCIA]: { label: "Ambulancia", nombre: "Ambulancia de emergencia" },
  [TIPOS_FURNITURE.CARPA]: { label: "Carpa", nombre: "Carpa de evento (6 x 4 m)" },
  [TIPOS_FURNITURE.BANOS]: { label: "Baños", nombre: "Modulo de banos portatiles" },
  [TIPOS_FURNITURE.BUS]: { label: "Bus", nombre: "Bus de acercamiento" },
};

/** Dimensiones iniciales del parche de piso (metros). */
export const PISO_FURNITURE_DEFAULT = { w: 11, d: 7 } as const;

export interface PisoFurnitureConfig {
  w: number;
  d: number;
}

/** Huella aproximada (metros) de cada componente decorativo, para el editor. */
export const FURNITURE_FOOTPRINT: Record<string, { w: number; d: number }> = {
  [TIPOS_FURNITURE.KIOSKO]: { w: 1.8, d: 1.2 },
  [TIPOS_FURNITURE.PLAZA]: { w: 7, d: 7 },
  [TIPOS_FURNITURE.MESA]: { w: 0.8, d: 0.8 },
  [TIPOS_FURNITURE.SILLON]: { w: 0.8, d: 0.8 },
  [TIPOS_FURNITURE.PISO]: { w: PISO_FURNITURE_DEFAULT.w, d: PISO_FURNITURE_DEFAULT.d },
  [TIPOS_FURNITURE.PERSONA]: { w: 0.5, d: 0.5 },
  [TIPOS_FURNITURE.ARBOL]: { w: 1.6, d: 1.6 },
  [TIPOS_FURNITURE.BANDERA]: { w: 1, d: 0.4 },
  [TIPOS_FURNITURE.TOTEM]: { w: 1, d: 0.5 },
  [TIPOS_FURNITURE.BANCA]: { w: 1.9, d: 0.6 },
  [TIPOS_FURNITURE.PERGOLA]: { w: 4, d: 3 },
  [TIPOS_FURNITURE.CAMION]: { w: 5.6, d: 3 },
  [TIPOS_FURNITURE.PERFORADORA]: { w: 4.0, d: 2.6 },
  [TIPOS_FURNITURE.POSTE_LUZ]: { w: 0.7, d: 0.7 },
  [TIPOS_FURNITURE.BARANDA]: { w: 2, d: 0.3 },
  [TIPOS_FURNITURE.BASURERO]: { w: 0.7, d: 0.7 },
  [TIPOS_FURNITURE.FOOD_TRUCK]: { w: 4.2, d: 2.4 },
  [TIPOS_FURNITURE.PANTALLA_LED]: { w: 2.6, d: 0.9 },
  [TIPOS_FURNITURE.AMBULANCIA]: { w: 5.6, d: 2.4 },
  [TIPOS_FURNITURE.CARPA]: { w: 6.2, d: 4.2 },
  [TIPOS_FURNITURE.BANOS]: { w: 2.4, d: 1.5 },
  [TIPOS_FURNITURE.BUS]: { w: 8, d: 2.8 },
};

/** Tonos de cabeza disponibles para el componente Persona. */
export const PERSONA_COLORES_CABEZA = ["#f5d0a9", "#e0ac69", "#c68642", "#8d5524", "#d4a574", "#f0c8a0"] as const;

/** Config inicial del componente Persona (colorIdx indexa PERSONA_COLORES_CABEZA). */
export const PERSONA_FURNITURE_DEFAULT = {
  colorIdx: 0,
  torsoColor: "#f5f5f5",
  piernasColor: "#3b5998",
} as const;

export interface PersonaFurnitureConfig {
  colorIdx: number;
  torsoColor: string;
  piernasColor: string;
}

/* ================================================================
   Ambito de un tipo de bloque (Laboratorio 3D)
   ================================================================ */
export const AMBITOS_TIPO_BLOQUE = {
  INTERNO: "interno",
  EXTERNO: "externo",
} as const;

export type AmbitoTipoBloque = (typeof AMBITOS_TIPO_BLOQUE)[keyof typeof AMBITOS_TIPO_BLOQUE];

export const AMBITO_TIPO_BLOQUE_LABELS: Record<string, { label: string; nombre: string }> = {
  [AMBITOS_TIPO_BLOQUE.INTERNO]: { label: "Interno", nombre: "Bloque interno (dentro del pabellon)" },
  [AMBITOS_TIPO_BLOQUE.EXTERNO]: { label: "Externo", nombre: "Bloque externo (perimetro / exterior)" },
};

/* ================================================================
   Forma visual del tipo de bloque (misma entidad en BD; cambia el render)
   ================================================================ */
export const FORMAS_BLOQUE = {
  BLOQUE: "bloque",
  TRACTOR_ORUGAS: "tractor-orugas",
  CARGADOR_FRONTAL: "cargador-frontal",
  MOTONIVELADORA: "motoniveladora",
} as const;

export type FormaBloque = (typeof FORMAS_BLOQUE)[keyof typeof FORMAS_BLOQUE];

export const FORMA_BLOQUE_LABELS: Record<string, string> = {
  [FORMAS_BLOQUE.BLOQUE]: "Bloque 3D",
  [FORMAS_BLOQUE.TRACTOR_ORUGAS]: "Tractor de orugas",
  [FORMAS_BLOQUE.CARGADOR_FRONTAL]: "Cargador frontal",
  [FORMAS_BLOQUE.MOTONIVELADORA]: "Motoniveladora",
};

/* ================================================================
   Catalogo global de tipos de bloque
   false = lectura por mapa (comportamiento actual)
   true  = lectura/escritura desde tipo_bloque_global
   Override local/CI: env TIPOS_BLOQUE_GLOBALES=1
   ================================================================ */
export const TIPOS_BLOQUE_GLOBALES = {
  USAR_CATALOGO: process.env.TIPOS_BLOQUE_GLOBALES === "1",
} as const;

/* ================================================================
   Editor 3D del Laboratorio (snap y guias de apoyo)
   ================================================================ */
export const EDITOR_PLANO = {
  /** Snap de posicion al arrastrar (metros). */
  SNAP_POSICION: 0.25,
  /** Snap de rotacion al girar (grados). */
  SNAP_ROTACION_GRADOS: 5,
  /** Snap de rotacion con Shift (grados). */
  SNAP_ROTACION_MAYOR_GRADOS: 15,
  /** Distancia maxima para que una guia magnetica alinee el objeto (metros). */
  UMBRAL_GUIA: 0.35,
  /** Umbral en pixeles para iniciar un arrastre (evita movimientos involuntarios al hacer clic). */
  UMBRAL_ARRASTRE_PX: 4,
} as const;

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

/**
 * Extensiones aceptadas para el comprobante fiscal (boleta/factura) que adjunta
 * Facturacion en la bandeja de cuotas.
 */
export const COMPROBANTE_FISCAL_EXTENSIONES = [".pdf", ".jpg", ".jpeg", ".png"] as const;

/** Valor del atributo `accept` para el input de archivo del comprobante fiscal. */
export const COMPROBANTE_FISCAL_ACCEPT = COMPROBANTE_FISCAL_EXTENSIONES.join(",");

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
  ASOCIADO: "asociado",
  LOGISTICA: "logistica",
  LEGAL: "legal",
  COMUNICACION: "comunicacion",
  CLIENTE: "cliente",
} as const;

export type Rol = (typeof ROLES)[keyof typeof ROLES];

export const ROLES_PERMISSIONS: Record<Rol, string[]> = {
  [ROLES.ADMIN]: [
    "admin:full",
    "empresas:view",
    "empresas:manage",
    "dashboard:view",
    "eventos:datos",
    "stands:vinculacion",
    "stands:manage",
    "stands:pre_reservar",
    "stands:plano",
    "roles:manage",
    "usuarios:manage",
    "events:manage",
    "events:create",
    "events:edit",
    "events:toggle",
    "read:reservas",
    "mis-reservas:view",
    "write:reservas",
    "approve:all",
    "solicitudes:view",
    "solicitudes:gestion",
    "solicitudes:review:asociado",
    "solicitudes:review:legal",
    "solicitudes:notify",
    "solicitudes:upload",
    "auspicios:view",
    "laboratorio:view",
    "laboratorio:manage",
    "facturacion:view",
    "pagos:view",
    "pagos:manage",
    "portal:manage",
    "dd:ver",
    "dd:formulario",
    "dd:revision",
    "dd:legal",
    "dd:reputacion",
    "dd:panel",
  ],
  [ROLES.ASOCIADO]: ["dashboard:view", "eventos:datos", "stands:plano", "auspicios:view", "read:reservas", "solicitudes:view", "solicitudes:gestion", "solicitudes:review:asociado"],
  [ROLES.LOGISTICA]: ["dashboard:view", "eventos:datos", "stands:manage", "stands:pre_reservar", "stands:plano", "auspicios:view", "read:reservas", "approve:logistica", "solicitudes:view", "solicitudes:gestion", "dd:ver", "dd:panel", "dd:revision"],
  [ROLES.LEGAL]: ["dashboard:view", "eventos:datos", "stands:plano", "auspicios:view", "read:reservas", "approve:legal", "solicitudes:view", "solicitudes:gestion", "solicitudes:review:legal", "dd:ver", "dd:legal"],
  [ROLES.COMUNICACION]: ["dashboard:view", "eventos:datos", "stands:plano", "auspicios:view", "read:reservas", "approve:comunicacion", "solicitudes:view", "solicitudes:gestion", "dd:ver", "dd:reputacion"],
  [ROLES.CLIENTE]: ["eventos:datos", "solicitudes:view", "stands:plano", "mis-reservas:view", "write:reservas", "pagos:view", "pagos:manage", "dd:formulario"],
};

export const ALL_PERMISSIONS = [
  { key: "admin:full", label: "Acceso total", descripcion: "Control completo del sistema", section: "sistema" },
  { key: "portal:manage", label: "Configuracion del portal", descripcion: "Editar los enlaces y contactos publicos del portal (login/presala)", section: "sistema" },
  // Dashboard general
  { key: "dashboard:view", label: "Panel de Control", descripcion: "Acceder al panel de control principal", section: "dashboard" },
  { key: "eventos:datos", label: "Datos del Evento", descripcion: "Ver datos y precios de la version del evento", section: "dashboard" },
  // Stands
  { key: "stands:vinculacion", label: "Vinculacion de Stands", descripcion: "Vincular stands de GESS como disponibles", section: "stands" },
  { key: "stands:manage", label: "Gestion de Stands", descripcion: "Administrar y editar stands del evento", section: "stands" },
  { key: "stands:pre_reservar", label: "Pre-reservas", descripcion: "Pre-reservar y liberar stands en lote a nombre de una empresa (sin solicitud ni contrato)", section: "stands" },
  { key: "stands:plano", label: "Plano de Stands", descripcion: "Ver el plano interactivo de stands del evento", section: "stands" },
  // Auspicios
  { key: "auspicios:view", label: "Ver auspicios", descripcion: "Ver listado y registrar auspicios", section: "auspicios" },
  // Laboratorio 3D
  { key: "laboratorio:view", label: "Ver Laboratorio 3D", descripcion: "Ver mapas 3D guardados en el laboratorio", section: "laboratorio" },
  { key: "laboratorio:manage", label: "Editar Laboratorio 3D", descripcion: "Crear, editar, importar y exportar mapas 3D", section: "laboratorio" },
  // Facturacion
  { key: "facturacion:view", label: "Ver facturacion", descripcion: "Gestionar facturacion y pagos de solicitudes", section: "facturacion" },
  // Pagos del exhibidor (vista cliente)
  { key: "pagos:view", label: "Ver mis pagos", descripcion: "Ver el plan de pagos (cuotas) de sus solicitudes", section: "facturacion" },
  { key: "pagos:manage", label: "Configurar mis pagos", descripcion: "Agregar, editar y eliminar cuotas de sus solicitudes", section: "facturacion" },
  // Solicitudes de alquiler
  { key: "solicitudes:view", label: "Ver solicitudes", descripcion: "Acceder a Mis solicitudes (propias) y a la API de solicitudes", section: "solicitudes" },
  { key: "solicitudes:gestion", label: "Bandeja de Solicitudes", descripcion: "Ver la bandeja administrativa de solicitudes de alquiler", section: "solicitudes" },
  { key: "solicitudes:review:asociado", label: "Revisar Asociado", descripcion: "Aprobar/rechazar como Asociado (unifica Logistica + Comunicacion; previo a Legal)", section: "solicitudes" },
  { key: "solicitudes:review:legal", label: "Revisar Legal", descripcion: "Aprobar/rechazar desde area Legal", section: "solicitudes" },
  { key: "solicitudes:notify", label: "Notificar solicitudes", descripcion: "Enviar notificacion al cliente cuando todas las areas revisaron", section: "solicitudes" },
  { key: "solicitudes:upload", label: "Subir documentos", descripcion: "Subir documentos a solicitudes de alquiler", section: "solicitudes" },
  // Reservas (legacy)
  { key: "mis-reservas:view", label: "Mis reservas", descripcion: "Ver Mis reservas (solicitudes de reserva propias del exhibidor)", section: "reservas" },
  { key: "read:reservas", label: "Reservas", descripcion: "Ver la bandeja de reservas de stands (/dashboard/reservas)", section: "reservas" },
  { key: "write:reservas", label: "Crear reservas", descripcion: "Registrar nuevas reservas de stands", section: "reservas" },
  { key: "approve:all", label: "Aprobar todo", descripcion: "Aprobar en cualquier area", section: "reservas" },
  { key: "approve:logistica", label: "Aprobar Logistica", descripcion: "Resolver aprobaciones del area de Logistica", section: "reservas" },
  { key: "approve:legal", label: "Aprobar Legal", descripcion: "Resolver aprobaciones del area Legal", section: "reservas" },
  { key: "approve:comunicacion", label: "Aprobar Comunicacion", descripcion: "Resolver aprobaciones del area de Comunicacion", section: "reservas" },
  // Empresas (Portal del Cliente)
  { key: "empresas:view", label: "Ver empresas", descripcion: "Ver la bandeja de empresas registradas", section: "empresas" },
  { key: "empresas:manage", label: "Gestionar empresas", descripcion: "Registrar y editar empresas (alta individual y masiva)", section: "empresas" },
  // Roles y Eventos
  { key: "roles:manage", label: "Roles y Permisos", descripcion: "Administrar roles, usuarios y permisos del sistema", section: "admin" },
  { key: "usuarios:manage", label: "Usuarios", descripcion: "Crear cuentas del Portal del Cliente (persona en servicio-persona) y asignar empresa y rol", section: "admin" },
  { key: "events:manage", label: "Gestion de Eventos", descripcion: "Administrar eventos y sus versiones", section: "admin" },
  { key: "events:create", label: "Crear eventos", descripcion: "Crear nuevas versiones de eventos", section: "eventos" },
  { key: "events:edit", label: "Editar eventos", descripcion: "Modificar fechas e informacion de eventos", section: "eventos" },
  { key: "events:toggle", label: "Activar/Cerrar eventos", descripcion: "Alternar estado activo/cerrado de versiones", section: "eventos" },
  // Modulo Debida Diligencia (reglas y permisos propios del modulo)
  { key: "dd:ver", label: "Ver Debida Diligencia", descripcion: "Acceder al modulo de Debida Diligencia", section: "debida_diligencia" },
  { key: "dd:formulario", label: "Completar mi debida diligencia", descripcion: "Completar el formulario de debida diligencia de la empresa", section: "debida_diligencia" },
  { key: "dd:revision", label: "Bandeja de Debida Diligencia", descripcion: "Revisar documentos y resolver expedientes de debida diligencia (Logistica)", section: "debida_diligencia" },
  { key: "dd:legal", label: "Revisión legal de Debida Diligencia", descripcion: "Revisar expedientes derivados a Legal, adjuntar informe y resolver (Legal)", section: "debida_diligencia" },
  { key: "dd:reputacion", label: "Revision reputacional", descripcion: "Evaluar imagen y reputacion de los nombres derivados por Logistica (Comunicaciones)", section: "debida_diligencia" },
  { key: "dd:panel", label: "Panel de Debida Diligencia", descripcion: "Ver KPIs, vigencias y matriz de empresas del modulo", section: "debida_diligencia" },
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
  STANDS_PRE_RESERVAR: "stands:pre_reservar",
  STANDS_PLANO: "stands:plano",
  AUSPICIOS_VIEW: "auspicios:view",
  LABORATORIO_VIEW: "laboratorio:view",
  LABORATORIO_MANAGE: "laboratorio:manage",
  FACTURACION_VIEW: "facturacion:view",
  PAGOS_VIEW: "pagos:view",
  PAGOS_MANAGE: "pagos:manage",
  SOLICITUDES_VIEW: "solicitudes:view",
  SOLICITUDES_GESTION: "solicitudes:gestion",
  SOLICITUDES_REVIEW_ASOCIADO: "solicitudes:review:asociado",
  SOLICITUDES_REVIEW_LEGAL: "solicitudes:review:legal",
  SOLICITUDES_NOTIFY: "solicitudes:notify",
  SOLICITUDES_UPLOAD: "solicitudes:upload",
  READ_RESERVAS: "read:reservas",
  MIS_RESERVAS_VIEW: "mis-reservas:view",
  WRITE_RESERVAS: "write:reservas",
  APPROVE_ALL: "approve:all",
  APPROVE_LOGISTICA: "approve:logistica",
  APPROVE_LEGAL: "approve:legal",
  APPROVE_COMUNICACION: "approve:comunicacion",
  ROLES_MANAGE: "roles:manage",
  USUARIOS_MANAGE: "usuarios:manage",
  EVENTS_MANAGE: "events:manage",
  EVENTS_CREATE: "events:create",
  EVENTS_EDIT: "events:edit",
  EVENTS_TOGGLE: "events:toggle",
  EMPRESAS_VIEW: "empresas:view",
  EMPRESAS_MANAGE: "empresas:manage",
  PORTAL_MANAGE: "portal:manage",
  /* Modulo Debida Diligencia: permisos propios, separados del resto de modulos. */
  DD_VER: "dd:ver",
  DD_FORMULARIO: "dd:formulario",
  DD_REVISION: "dd:revision",
  DD_LEGAL: "dd:legal",
  DD_REPUTACION: "dd:reputacion",
  DD_PANEL: "dd:panel",
} as const satisfies Record<string, Permission>;

/**
 * Permisos que habilitan `/api/solicitudes` (API compartida):
 * staff con `solicitudes:view` o cliente con `mis-reservas:view`. El controller
 * aplica el scoping de dueno; este arreglo solo controla el paso por el proxy.
 */
export const API_SOLICITUDES_PERMISOS = [
  PERMISSIONS.SOLICITUDES_VIEW,
  PERMISSIONS.MIS_RESERVAS_VIEW,
] as const;

export const PERMISSION_SECTIONS = {
  SISTEMA: "sistema",
  DASHBOARD: "dashboard",
  STANDS: "stands",
  AUSPICIOS: "auspicios",
  LABORATORIO: "laboratorio",
  FACTURACION: "facturacion",
  SOLICITUDES: "solicitudes",
  RESERVAS: "reservas",
  EVENTOS: "eventos",
  ADMIN: "admin",
  EMPRESAS: "empresas",
  DEBIDA_DILIGENCIA: "debida_diligencia",
} as const;

export const ROLES_USUARIOS_PER_PAGE_DEFAULT = 10;
export const ROLES_USUARIOS_PER_PAGE_MAX = 100;

export const PERMISSION_SECTION_LABELS: Record<string, string> = {
  [PERMISSION_SECTIONS.SISTEMA]: "Sistema",
  [PERMISSION_SECTIONS.DASHBOARD]: "Panel de Control",
  [PERMISSION_SECTIONS.STANDS]: "Gestion de Stands",
  [PERMISSION_SECTIONS.AUSPICIOS]: "Auspicios",
  [PERMISSION_SECTIONS.LABORATORIO]: "Laboratorio 3D",
  [PERMISSION_SECTIONS.FACTURACION]: "Facturacion",
  [PERMISSION_SECTIONS.SOLICITUDES]: "Solicitudes de alquiler",
  [PERMISSION_SECTIONS.RESERVAS]: "Reservas",
  [PERMISSION_SECTIONS.EVENTOS]: "Eventos",
  [PERMISSION_SECTIONS.ADMIN]: "Administracion",
  [PERMISSION_SECTIONS.EMPRESAS]: "Empresas",
  [PERMISSION_SECTIONS.DEBIDA_DILIGENCIA]: "Debida Diligencia",
};

/* ================================================================
   Flujo de revisión (Solicitudes de alquiler)
   ================================================================ */
export const REVISION_AREAS = {
  ASOCIADO: "asociado",
  LEGAL: "legal",
} as const;

export type RevisionArea = (typeof REVISION_AREAS)[keyof typeof REVISION_AREAS];

/**
 * Orden de las revisiones LOCALES. "Asociado" unifica Logistica + Comunicacion
 * (RF-14/15). La revision **Legal** ya no es local: se delega al SGC (su
 * `internal-review`), por eso el pipeline local tiene un solo nivel.
 */
export const REVISION_AREA_ORDER: RevisionArea[] = [
  REVISION_AREAS.ASOCIADO,
];

/** Etiqueta del paso (visual, no local) que representa la revisión Legal del SGC. */
export const REVISION_AREA_SGC_LABEL = "Legal (SGC)";
/**
 * Clave del paso pseudo-"area" que representa la revisión Legal delegada al SGC.
 * Es solo de UI (no existe una revisión local con esta área).
 */
export const REVISION_AREA_SGC_STEP = "__sgc__";

export const REVISION_AREA_LABELS: Record<RevisionArea, string> = {
  [REVISION_AREAS.ASOCIADO]: "Asociado",
  [REVISION_AREAS.LEGAL]: "Legal",
};

export const REVISION_AREA_PERMISSIONS: Record<RevisionArea, string> = {
  [REVISION_AREAS.ASOCIADO]: "solicitudes:review:asociado",
  [REVISION_AREAS.LEGAL]: "solicitudes:review:legal",
};

/** Rol que debe ser notificado cuando un area completa su revision.
    Si es null, significa que es la ultima area y se notifica al admin. */
export const REVISION_AREA_NEXT_ROLE: Record<RevisionArea, string | null> = {
  [REVISION_AREAS.ASOCIADO]: null, // unico nivel LOCAL → notificar admin + delegar al SGC
  [REVISION_AREAS.LEGAL]: null, // delegada al SGC (no local)
} as const;

/**
 * Rol que atiende el nivel local "Asociado" (unifica Logistica + Comunicacion;
 * RF-14/15). Se usa para alertar a los revisores al crear la solicitud.
 */
export const ROLES_REVISION_ASOCIADO: string[] = [ROLES.ASOCIADO];

/* ================================================================
   Facturacion
   ================================================================ */
export const TIPOS_FACTURACION = {
  NIU_BIZZ: "niubizz",
  MANUAL: "manual",
} as const;
export type TipoFacturacion = (typeof TIPOS_FACTURACION)[keyof typeof TIPOS_FACTURACION];

/**
 * Interruptor global de la pasarela Niubiz.
 * `false` = deshabilitada: la UI oculta los botones de pago y los endpoints
 * `/api/facturacion/niubizz/*` responden 503. El codigo se conserva para reactivar.
 */
export const NIUBIZ_HABILITADO = false;

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
  ASOCIADO: 0,
  LEGAL: 1,
} as const;

export type RevisionStep = (typeof REVISION_STEPS)[keyof typeof REVISION_STEPS];

/* ================================================================
   Estados de aprobacion individual
   ================================================================ */
export const RESULTADOS_APROBACION = {
  PENDIENTE: "pendiente",
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
  /** El Asociado observo documentos (no rechaza): el cliente reemplaza y reenvia. */
  OBSERVADO: "observado",
} as const;

export type ResultadoAprobacion = (typeof RESULTADOS_APROBACION)[keyof typeof RESULTADOS_APROBACION];

export const RESULTADOS_APROBACION_LABELS: Record<ResultadoAprobacion, string> = {
  [RESULTADOS_APROBACION.PENDIENTE]: "Pendiente",
  [RESULTADOS_APROBACION.APROBADO]: "Aprobado",
  [RESULTADOS_APROBACION.RECHAZADO]: "Rechazado",
  [RESULTADOS_APROBACION.OBSERVADO]: "Observado",
};

/** Estado de un documento de la solicitud (baja logica por estado; nunca se borra fisicamente). */
export const ESTADOS_DOCUMENTO_SOLICITUD = {
  ACTIVO: "activo",
  /** Observado por el revisor: el cliente debe subir una nueva version. */
  OBSERVADO: "observado",
  /** Version anterior reemplazada por una nueva del mismo requisito/categoria. */
  REEMPLAZADO: "reemplazado",
  /** Baja logica manual (no se muestra como documento vigente). */
  BAJA: "baja",
} as const;

export type EstadoDocumentoSolicitud = (typeof ESTADOS_DOCUMENTO_SOLICITUD)[keyof typeof ESTADOS_DOCUMENTO_SOLICITUD];

/** Etiquetas por defecto de los estados de documento (la maestra puede sobreescribirlas). */
export const ESTADOS_DOCUMENTO_SOLICITUD_LABELS: Record<EstadoDocumentoSolicitud, string> = {
  [ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO]: "Activo",
  [ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO]: "Observado",
  [ESTADOS_DOCUMENTO_SOLICITUD.REEMPLAZADO]: "Reemplazado",
  [ESTADOS_DOCUMENTO_SOLICITUD.BAJA]: "Baja",
};

/** item_id de cada estado en la maestra `documento_estado`. */
export const ESTADOS_DOCUMENTO_SOLICITUD_MAESTRA_ID: Record<string, number> = {
  [ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO]: 1,
  [ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO]: 2,
  [ESTADOS_DOCUMENTO_SOLICITUD.REEMPLAZADO]: 3,
  [ESTADOS_DOCUMENTO_SOLICITUD.BAJA]: 4,
};

/* ================================================================
   Estados de solicitud (pipeline de revision)
   ================================================================ */
export const ESTADOS_SOLICITUD = {
  PENDIENTE: "pendiente",
  EN_PROCESO: "en_proceso",
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
  /** El revisor Asociado observo documentos: el cliente debe reemplazarlos y reenviar. */
  OBSERVADO: "observado",
  PENDIENTE_PAGO: "pendiente_pago",
  PAGADO: "pagado",
} as const;

export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[keyof typeof ESTADOS_SOLICITUD];

/** Etiquetas por defecto de los estados de solicitud (la maestra puede sobreescribirlas). */
export const ESTADOS_SOLICITUD_LABELS: Record<EstadoSolicitud, string> = {
  [ESTADOS_SOLICITUD.PENDIENTE]: "Pendiente",
  [ESTADOS_SOLICITUD.EN_PROCESO]: "En proceso",
  [ESTADOS_SOLICITUD.APROBADO]: "Aprobado",
  [ESTADOS_SOLICITUD.RECHAZADO]: "Rechazado",
  [ESTADOS_SOLICITUD.OBSERVADO]: "Observado",
  [ESTADOS_SOLICITUD.PENDIENTE_PAGO]: "Pendiente Pago",
  [ESTADOS_SOLICITUD.PAGADO]: "Pagado",
};

/** Filtro por situacion del expediente SGC en la bandeja de solicitudes. */
export const SOLICITUDES_FILTRO_SGC = {
  CON: "con",
  SIN: "sin",
  OBSERVADO: "observado",
  RECHAZADO: "rechazado",
} as const;

export type SolicitudesFiltroSgc = (typeof SOLICITUDES_FILTRO_SGC)[keyof typeof SOLICITUDES_FILTRO_SGC];

export const SOLICITUDES_FILTRO_SGC_LABELS: Record<SolicitudesFiltroSgc, string> = {
  [SOLICITUDES_FILTRO_SGC.CON]: "Con expediente SGC",
  [SOLICITUDES_FILTRO_SGC.SIN]: "Sin expediente SGC",
  [SOLICITUDES_FILTRO_SGC.OBSERVADO]: "Observado por SGC",
  [SOLICITUDES_FILTRO_SGC.RECHAZADO]: "Rechazado por SGC",
};

/** Orden de la bandeja de solicitudes. */
export const SOLICITUDES_ORDEN = {
  RECIENTES: "recientes",
  ANTIGUOS: "antiguos",
} as const;

export type SolicitudesOrden = (typeof SOLICITUDES_ORDEN)[keyof typeof SOLICITUDES_ORDEN];

export const SOLICITUDES_ORDEN_LABELS: Record<SolicitudesOrden, string> = {
  [SOLICITUDES_ORDEN.RECIENTES]: "Mas recientes primero",
  [SOLICITUDES_ORDEN.ANTIGUOS]: "Mas antiguas primero",
};

/** Limite de filas para exportar la bandeja filtrada (CSV/Excel). */
export const SOLICITUDES_EXPORT_MAX_FILAS = 2000;

export const ESTADOS_SOLICITUD_MAESTRA_ID: Record<string, number> = {
  [ESTADOS_SOLICITUD.PENDIENTE]: 1,
  [ESTADOS_SOLICITUD.EN_PROCESO]: 2,
  [ESTADOS_SOLICITUD.APROBADO]: 3,
  [ESTADOS_SOLICITUD.RECHAZADO]: 4,
  [ESTADOS_SOLICITUD.PENDIENTE_PAGO]: 5,
  [ESTADOS_SOLICITUD.PAGADO]: 6,
  [ESTADOS_SOLICITUD.OBSERVADO]: 7,
};

/* ================================================================
   Estados de revision (por area)
   ================================================================ */
export const ESTADOS_REVISION = {
  PENDIENTE: "pendiente",
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
  OBSERVADO: "observado",
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
  US_DOLAR: "US$",
  /** Simbolo de sol usado por la API externa de auspicios. */
  SOL: "S/",
} as const;

export type Moneda = (typeof MONEDAS)[keyof typeof MONEDAS];

/* ================================================================
   Idiomas (español por defecto / inglés)
   ================================================================ */

/** Idiomas soportados por el sistema. */
export const IDIOMAS = {
  ES: "es",
  EN: "en",
} as const;

export type Idioma = (typeof IDIOMAS)[keyof typeof IDIOMAS];

/** Idioma por defecto del sistema (español). */
export const IDIOMA_DEFAULT: Idioma = IDIOMAS.ES;

export const IDIOMAS_DISPONIBLES: Idioma[] = [IDIOMAS.ES, IDIOMAS.EN];

export const IDIOMA_LABELS: Record<Idioma, string> = {
  [IDIOMAS.ES]: "Español",
  [IDIOMAS.EN]: "English",
};

/** Etiqueta corta del selector (ES / EN). */
export const IDIOMA_LABELS_CORTOS: Record<Idioma, string> = {
  [IDIOMAS.ES]: "ES",
  [IDIOMAS.EN]: "EN",
};

/** Cookie con la preferencia de idioma (público y usuarios; no httpOnly). */
export const IDIOMA_COOKIE = "iimp_idioma";

/** Cookie del Website Translator de Google (`/es/en` traduce, `/es/es` vuelve al original). */
export const GOOGTRANS_COOKIE = "googtrans";

/** Vigencia de la cookie de idioma (segundos): 1 año. */
export const IDIOMA_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/** Clave de sessionStorage para sincronizar `googtrans` una sola vez por sesión. */
export const IDIOMA_SYNC_SESSION_KEY = "iimp_gt_idioma_sync";

/** Valor de la cookie googtrans para cada idioma (origen siempre español). */
export const GOOGTRANS_VALUES: Record<Idioma, string> = {
  [IDIOMAS.ES]: "/es/es",
  [IDIOMAS.EN]: "/es/en",
};

/** Locale para formateo de fechas y montos según idioma. */
export const IDIOMA_LOCALES: Record<Idioma, string> = {
  [IDIOMAS.ES]: "es-PE",
  [IDIOMAS.EN]: "en-US",
};

/**
 * Precios por tipo de stand (USD).
 *
 * Catalogo provisional mientras no exista una tarifa oficial por evento
 * (`tipo_stand.monto_base`). Es la unica fuente de precios para:
 *  - la sincronizacion/mockup y el plano (texto de `medidas`, formato "XXXX.XX US$"),
 *  - la resolucion del precio mostrado en las bandejas,
 *  - el `montoTotal` de la orden de pago (`marcarOrdenPago`).
 */
export const PRECIOS_STAND_POR_TIPO: Record<string, number> = {
  PREFERENCIAL: 3000,
  PREREFERENCIAL: 3000,
  ESTANDAR_01: 2000,
  ESTANDAR_02: 2500,
  ISLAS: 12000,
  ISLA: 12000,
  INSTITUCIONAL: 2000,
  ALAMEDA: 1500,
  ESTANDAR: 2000,
};
/** Precio por defecto cuando el tipo de stand no esta en el catalogo. */
export const PRECIO_STAND_DEFAULT = 2000;

/**
 * Modalidades de pago del contrato (Anexo 2): pago completo (100% a 30 dias) o
 * en cuotas (50% a 30 dias + 50% a los 45 dias del primero). Mismos valores que
 * `facturacion.modo_pago`.
 */
export const MODOS_PAGO = {
  COMPLETO: "completo",
  CUOTAS: "cuotas",
  /** Modalidad 3: tres cuotas fijas 40/30/30. */
  TRES_CUOTAS: "tres_cuotas",
  /** Modalidad 4: plan configurado libremente (legacy/administrado). */
  PERSONALIZADO: "personalizado",
} as const;

export type ModoPago = (typeof MODOS_PAGO)[keyof typeof MODOS_PAGO];

/** Cantidad de cuotas de las modalidades que ofrece el wizard. */
export const MODALIDADES_CUOTAS = {
  UNA: 1,
  DOS: 2,
  TRES: 3,
} as const;

export type ModalidadCuotas = (typeof MODALIDADES_CUOTAS)[keyof typeof MODALIDADES_CUOTAS];

/** Porcentajes fijos por modalidad del wizard. */
export const PORCENTAJES_POR_MODALIDAD: Record<ModalidadCuotas, readonly number[]> = {
  [MODALIDADES_CUOTAS.UNA]: [100],
  [MODALIDADES_CUOTAS.DOS]: [50, 50],
  [MODALIDADES_CUOTAS.TRES]: [40, 30, 30],
};

/**
 * Hitos del cronograma PERUMIN 38 (fechas ISO, hora Lima). Las cuotas nuevas se
 * asignan al primer cronograma cuyas fechas sean estrictamente posteriores a la reserva.
 */
export const HITOS_CUOTAS = {
  PRIMERA_2026: "2026-11-15",
  PRIMERA_2027: "2027-01-15",
  SEGUNDA_2026: "2027-02-15",
  SEGUNDA_2027: "2027-03-15",
  ULTIMA: "2027-06-15",
} as const;

/** Porcentaje de IGV aplicado a las facturas (18%). */
export const IGV_PORCENTAJE = 0.18;

/** Maximo de cuotas del plan contractual (1..3). */
export const MAX_CUOTAS_PAGO = 3;

/** Maximo de cuotas para un cronograma personalizado por empresa (limite del IIMP). */
export const MAX_CUOTAS_PERSONALIZADAS = 9;

/** Tolerancia al validar que los porcentajes de las cuotas suman 100%. */
export const CUOTAS_SUMA_TOLERANCIA = 0.01;

/** Paso permitido del porcentaje de una cuota (hasta 2 decimales). */
export const CUOTAS_PORCENTAJE_PASO = 0.01;

/** Monto minimo (USD) que debe tener cada cuota; si el redondeo da 0 se rechaza. */
export const CUOTA_MONTO_MINIMO = 0.01;

/** Regla de fechas: la cuota N vence como maximo N meses despues de la solicitud de reserva. */
export const CUOTAS_MESES_MAX_POR_CUOTA = 1;

/** Minimo de dias que debe distanciar cada cuota de la anterior (orden estricto). */
export const CUOTAS_DIAS_MIN_ENTRE = 1;

/** Tope absoluto del cronograma de cuotas (fecha ISO yyyy-mm-dd). */
export const CUOTAS_FECHA_MAXIMA = "2027-07-15";

/** Maximo de bytes para la foto de una persona en servicio-persona (5 MB). */
export const FOTO_PERSONA_MAX_BYTES = 5 * 1024 * 1024;

/** Maximo de cuotas por reserva que acepta el API del IIMP. */
export const MAX_CUOTAS_IIMP = 9;

/** Maximo de stands por operacion de reserva que acepta el API del IIMP. */
export const MAX_STANDS_IIMP = 50;

/** Porcentaje total (entero) que deben sumar las cuotas enviadas al IIMP. */
export const CUOTAS_PORCENTAJE_TOTAL = 100;

/** Prefijo del `NumeroSolicitud` (PK de la solicitud en la web) que viaja al IIMP. */
export const IIMP_NUMERO_SOLICITUD_PREFIJO = "CTRS-";

/** Longitud maxima de `NumeroSolicitud` que acepta el API del IIMP. */
export const IIMP_NUMERO_SOLICITUD_MAX = 30;

/** Tipos de archivo de la cuenta corriente del IIMP (doc API-RESERVA-STAND-INTEGRACION.md v4, seccion 8). */
export const TIPOS_ARCHIVO_IIMP = {
  OC: "OC",
  HES: "HES",
  DETRACCION: "DETRACCION",
  DIFERENCIA: "DIFERENCIA",
  /** Constancia del pago total (v4): sin cuota = total de la cuenta; con cuota = total de esa cuota. */
  PAGO_TOTAL: "PAGO_TOTAL",
  /** Valorizacion / cotizacion del servicio (v5): cuota opcional (sin cuota = de toda la cuenta). */
  VALORIZACION_COTIZACION: "VALORIZACION_COTIZACION",
} as const;

export type TipoArchivoIImp = (typeof TIPOS_ARCHIVO_IIMP)[keyof typeof TIPOS_ARCHIVO_IIMP];

/** Tipos de archivo que exigen numero de cuota (pagos de detraccion y de diferencia). */
export const TIPOS_ARCHIVO_IIMP_CON_CUOTA: TipoArchivoIImp[] = [TIPOS_ARCHIVO_IIMP.DETRACCION, TIPOS_ARCHIVO_IIMP.DIFERENCIA];

/** Maximo de archivos por llamada al API de archivos del IIMP. */
export const MAX_ARCHIVOS_IIMP_POR_LLAMADA = 20;

/** Longitud maxima del link de un archivo de cuenta corriente (API del IIMP). */
export const MAX_LINK_ARCHIVO_IIMP = 2048;

/** Longitud maxima del nombre de un archivo de cuenta corriente (API del IIMP). */
export const MAX_NOMBRE_ARCHIVO_IIMP = 150;

/** Maximo de stands por operacion de pre-reserva/liberacion en lote. */
export const MAX_PRE_RESERVA_LOTE = 500;

/**
 * Catalogo canonico de tipos de stand para la imagen referencial (RF-08).
 * `key` = clave normalizada que se persiste en `tipo_stand_imagen`; `alias` agrupa
 * variantes del API externo ("ISLA" → ISLAS, "PREREFERENCIAL" → PREFERENCIAL).
 */
export const TIPOS_STAND_CATALOGO: { key: string; label: string; alias: string[] }[] = [
  { key: "PREFERENCIAL", label: "Preferencial", alias: ["PREREFERENCIAL"] },
  { key: "ESTANDAR_01", label: "Estandar", alias: ["ESTANDAR"] },
  { key: "ESTANDAR_02", label: "Estandar 02", alias: [] },
  { key: "ISLAS", label: "Isla", alias: ["ISLA"] },
  { key: "INSTITUCIONAL", label: "Institucional", alias: [] },
  { key: "ALAMEDA", label: "Alameda", alias: [] },
];

/* ================================================================
   Solicitudes de cuenta de exhibidor
   ================================================================ */
export const ESTADOS_SOLICITUD_CUENTA = {
  PENDIENTE: "pendiente",
  APROBADA: "aprobada",
  RECHAZADA: "rechazada",
} as const;

export type EstadoSolicitudCuenta = (typeof ESTADOS_SOLICITUD_CUENTA)[keyof typeof ESTADOS_SOLICITUD_CUENTA];

/* ================================================================
   Empresas (backoffice / Portal del Cliente)
   ================================================================ */

/** Estado de una empresa registrada por el backoffice. */
export const ESTADOS_EMPRESA = {
  ACTIVA: "activa",
  INACTIVA: "inactiva",
} as const;

export type EstadoEmpresa = (typeof ESTADOS_EMPRESA)[keyof typeof ESTADOS_EMPRESA];

/** Estado de acceso de un usuario (user_role.flg_activo). */
export const ESTADOS_ACCESO_USUARIO = {
  ACTIVO: true,
  DESHABILITADO: false,
} as const;

/** Estado de una cuenta dentro de la desactivacion masiva de usuarios (previsualizacion o resultado). */
export const ESTADOS_DESACTIVACION_LOTE = {
  DESACTIVADO: "desactivado",
  POR_DESACTIVAR: "por_desactivar",
  YA_DESACTIVADO: "ya_desactivado",
  OMITIDO: "omitido",
} as const;

export type EstadoDesactivacionLote = (typeof ESTADOS_DESACTIVACION_LOTE)[keyof typeof ESTADOS_DESACTIVACION_LOTE];

/** Estado de una cuenta dentro de la habilitacion masiva (programar su activacion). */
export const ESTADOS_ACTIVACION_LOTE = {
  PROGRAMADO: "programado",
  POR_PROGRAMAR: "por_programar",
  YA_ACTIVA: "ya_activa",
  OMITIDO: "omitido",
} as const;

export type EstadoActivacionLote = (typeof ESTADOS_ACTIVACION_LOTE)[keyof typeof ESTADOS_ACTIVACION_LOTE];

/** Motivos por los que una cuenta se omite en la desactivacion masiva. */
export const MOTIVOS_OMISION_DESACTIVACION = {
  ADMIN: "Cuenta admin (no se desactiva en lote)",
  PROPIA: "Es tu propia cuenta",
} as const;

/** Maximo de filas por lote al desactivar usuarios (una linea = correo del login o RUC de la empresa). */
export const USUARIOS_LOTE_MAX_FILAS = 200;

/** Filtro de la bandeja de Usuarios por vinculo con empresa (omitido = todos). */
export const FILTROS_USUARIO_EMPRESA = {
  PORTAL: "portal",
  SIN_EMPRESA: "sin-empresa",
} as const;

export type FiltroUsuarioEmpresa = (typeof FILTROS_USUARIO_EMPRESA)[keyof typeof FILTROS_USUARIO_EMPRESA];

/* ================================================================
   Debida Diligencia (DD)
   Modulo con reglas propias: vigencia de 6 meses, formulario de 4
   pasos, revision de Logistica, revision reputacional de
   Comunicaciones y panel/matriz del modulo. Los permisos `dd:*`
   mantienen el modulo separado del resto del sistema.
   ================================================================ */

/** Vigencia de una debida diligencia aprobada (meses). */
export const DD_VIGENCIA_MESES = 6;

/** Dias de anticipacion para marcar una debida diligencia "por vencer". */
export const DD_DIAS_POR_VENCER = 30;

/** Maximo de registros por pagina en las bandejas del modulo. */
export const DD_PER_PAGE_MAX = 100;

/** Registros por pagina por defecto en las bandejas del modulo. */
export const DD_PER_PAGE_DEFAULT = 10;

/** Cantidad de bytes en un megabyte (para limites de archivos). */
export const BYTES_POR_MB = 1024 * 1024;

/** Prefijo y digitos del codigo visible del expediente (DD-AAAA-NNNN). */
export const DD_CODIGO_PREFIJO = "DD";
export const DD_CODIGO_DIGITOS = 4;

/** Maximo de beneficiarios finales declarables. */
export const DD_MAX_BENEFICIARIOS = 20;

/** Maximo de observaciones por revision. */
export const DD_MAX_OBSERVACIONES = 20;

/** Porcentaje maximo de participacion de un beneficiario. */
export const DD_PORCENTAJE_MAX = 100;

/** País de constitución por defecto en el formulario. */
export const DD_PAIS_DEFAULT = "Perú";

/** Valor del filtro "todas" en las bandejas del modulo. */
export const DD_FILTRO_TODAS = "todas";

/** Usuario tecnico que registra la migracion masiva. */
export const DD_IMPORTACION_REVISOR = "importacion_masiva";
export const DD_IMPORTACION_REVISOR_LABEL = "Importación masiva";

/** Filtros de presencia de documentos en la bandeja. */
export const DD_DOCUMENTOS_FILTRO = {
  CON: "con",
  SIN: "sin",
} as const;

/** Filtro de reputacion pendiente (casos por revisar o en analisis). */
export const DD_REPUTACION_FILTRO_PENDIENTE = "pendiente";

/** Filtros de asignacion de la bandeja. */
export const DD_ASIGNACION_FILTRO = {
  IMPORTACION: DD_IMPORTACION_REVISOR,
  SIN_ASIGNAR: "sin_asignar",
  REVISOR: "revisor",
} as const;

/** Valor del filtro calculado de vigencias proximas a vencer. */
export const DD_FILTRO_POR_VENCER = "por_vencer";

/** Rutas propias del modulo Debida Diligencia. */
export const DD_RUTAS = {
  BASE: "/dashboard/debida-diligencia",
  FORMULARIO: "/dashboard/debida-diligencia/formulario",
  BANDEJA: "/dashboard/debida-diligencia/bandeja",
  LEGAL: "/dashboard/debida-diligencia/legal",
  REPUTACION: "/dashboard/debida-diligencia/reputacion",
} as const;

/** Etiqueta para empresas sin expediente de debida diligencia. */
export const DD_ESTADO_SIN_INICIAR_LABEL = "Sin iniciar";

/** Valor del filtro de empresas sin expediente. */
export const DD_FILTRO_SIN_INICIAR = "sin_iniciar";

/** Maximo de empresas por pagina en la matriz/exportacion del panel. */
export const DD_MATRIZ_PER_PAGE_MAX = 500;

/** Mensajes de validacion reutilizados por frontend y backend. */
export const DD_MENSAJES = {
  CONSENT_DATOS: "Debe aceptar el tratamiento de datos personales y derechos ARCO.",
  CONSENT_VERIFICACION: "Debe aceptar la debida diligencia reforzada.",
  DECLARACION_VERACIDAD: "Debe aceptar la declaración jurada de veracidad.",
  ACTIVIDAD_OTRO: "Indique cuál es la actividad económica.",
  DOCUMENTOS_OBLIGATORIOS: "Cargue los cuatro documentos obligatorios.",
} as const;

export const DD_ESTADOS = {
  BORRADOR: "borrador",
  PENDIENTE: "pendiente",
  EN_REVISION: "en_revision",
  EN_LEGAL: "en_legal",
  OBSERVADA: "observada",
  APROBADA: "aprobada",
  RECHAZADA: "rechazada",
} as const;

/** Origen de un registro de Debida Diligencia. */
export const DD_ORIGENES = {
  FLUJO_REGULAR: "flujo_regular",
  IMPORTADO: "importado",
} as const;

export type DdOrigen = (typeof DD_ORIGENES)[keyof typeof DD_ORIGENES];

export const DD_ORIGEN_LABELS: Record<string, string> = {
  [DD_ORIGENES.FLUJO_REGULAR]: "Flujo regular",
  [DD_ORIGENES.IMPORTADO]: "Importado",
};

export type DdEstado = (typeof DD_ESTADOS)[keyof typeof DD_ESTADOS];

export const DD_ESTADO_LABELS: Record<string, string> = {
  [DD_ESTADOS.BORRADOR]: "Borrador",
  [DD_ESTADOS.PENDIENTE]: "Pendiente",
  [DD_ESTADOS.EN_REVISION]: "En revisión",
  [DD_ESTADOS.EN_LEGAL]: "En revisión legal",
  [DD_ESTADOS.OBSERVADA]: "Observada",
  [DD_ESTADOS.APROBADA]: "Aprobada",
  [DD_ESTADOS.RECHAZADA]: "Rechazada",
};

/** Resultado de la evaluacion de debida diligencia (correo institucional). */
export const DD_RESULTADOS = {
  APTO: "apto",
  APTO_CON_OBSERVACIONES: "apto_con_observaciones",
  NO_APTO: "no_apto",
  PENDIENTE: "pendiente",
} as const;

export type DdResultado = (typeof DD_RESULTADOS)[keyof typeof DD_RESULTADOS];

/** Decision final de Legal sobre un expediente derivado. */
export const DD_ACCIONES_LEGAL = {
  APROBAR: "aprobar",
  RECHAZAR: "rechazar",
} as const;

export type DdAccionLegal = (typeof DD_ACCIONES_LEGAL)[keyof typeof DD_ACCIONES_LEGAL];

export const DD_RESULTADO_LABELS: Record<DdResultado, string> = {
  [DD_RESULTADOS.APTO]: "APTO",
  [DD_RESULTADOS.APTO_CON_OBSERVACIONES]: "APTO CON OBSERVACIONES",
  [DD_RESULTADOS.NO_APTO]: "NO APTO",
  [DD_RESULTADOS.PENDIENTE]: "PENDIENTE",
};

/** Estado de vigencia de una evaluacion concluida. */
export const DD_ESTADOS_EVALUACION = {
  VIGENTE: "vigente",
  REQUIERE_NUEVA_EVALUACION: "requiere_nueva_evaluacion",
} as const;

export type DdEstadoEvaluacion = (typeof DD_ESTADOS_EVALUACION)[keyof typeof DD_ESTADOS_EVALUACION];

export const DD_ESTADO_EVALUACION_LABELS: Record<DdEstadoEvaluacion, string> = {
  [DD_ESTADOS_EVALUACION.VIGENTE]: "VIGENTE",
  [DD_ESTADOS_EVALUACION.REQUIERE_NUEVA_EVALUACION]: "REQUIERE NUEVA EVALUACIÓN",
};

/** Pasos del formulario de Debida Diligencia (misma fuente para stepper y wizard). */
export const DD_PASOS: { numero: number; label: string; corto: string }[] = [
  { numero: 1, label: "Consentimientos", corto: "Consentimientos" },
  { numero: 2, label: "Empresa", corto: "Empresa" },
  { numero: 3, label: "Representante y beneficiarios", corto: "Representante" },
  { numero: 4, label: "Documentos", corto: "Documentos" },
];

/** Filtros de la bandeja de Logística (mismo orden visual del mockup). */
export const DD_BANDEJA_FILTROS: { value: string; label: string }[] = [
  { value: DD_FILTRO_TODAS, label: "Todas" },
  { value: DD_ESTADOS.PENDIENTE, label: "Pendientes" },
  { value: DD_ESTADOS.EN_REVISION, label: "En revisión" },
  { value: DD_ESTADOS.OBSERVADA, label: "Observadas" },
  { value: DD_ESTADOS.APROBADA, label: "Aprobadas" },
  { value: DD_ESTADOS.RECHAZADA, label: "Rechazadas" },
  { value: DD_FILTRO_POR_VENCER, label: "Por vencer" },
];

/** Filtros de estado de la matriz del panel (incluye empresas sin expediente). */
export const DD_MATRIZ_ESTADO_FILTROS: { value: string; label: string }[] = [
  { value: DD_FILTRO_TODAS, label: "Todos" },
  { value: DD_FILTRO_SIN_INICIAR, label: "Sin iniciar" },
  { value: DD_ESTADOS.PENDIENTE, label: "Pendientes" },
  { value: DD_ESTADOS.EN_REVISION, label: "En revisión" },
  { value: DD_ESTADOS.OBSERVADA, label: "Observadas" },
  { value: DD_ESTADOS.APROBADA, label: "Aprobadas" },
  { value: DD_ESTADOS.RECHAZADA, label: "Rechazadas" },
  { value: DD_FILTRO_POR_VENCER, label: "Por vencer" },
];

export const DD_VINCULOS = {
  AUSPICIADOR: "auspiciador",
  EXHIBIDOR: "exhibidor",
  ASOCIADO_ADHERENTE: "asociado_adherente",
  MEDIA_PARTNER: "media_partner",
  PROVEEDOR: "proveedor",
  ALQUILERES: "alquileres",
  OTRO: "otro",
} as const;

export type DdVinculo = (typeof DD_VINCULOS)[keyof typeof DD_VINCULOS];

export const DD_VINCULO_LABELS: Record<string, string> = {
  [DD_VINCULOS.AUSPICIADOR]: "Auspiciador",
  [DD_VINCULOS.EXHIBIDOR]: "Exhibidor",
  [DD_VINCULOS.ASOCIADO_ADHERENTE]: "Asociado Adherente",
  [DD_VINCULOS.MEDIA_PARTNER]: "Media Partner",
  [DD_VINCULOS.PROVEEDOR]: "Proveedor",
  [DD_VINCULOS.ALQUILERES]: "Alquileres",
  [DD_VINCULOS.OTRO]: "Otro",
};

/** Catalogo de actividad economica del formulario vigente. */
export const DD_ACTIVIDADES_ECONOMICAS = [
  "Combustibles, gases y productos químicos",
  "Productos y materiales semiacabados",
  "Productos y equipos manufacturados",
  "Alimentos, bebidas y consumibles",
  "Producción de energía y servicios públicos",
  "Electrónica y telecomunicaciones",
  "Papel y embalajes",
  "Productos terminados",
  "Servicios",
  "Servicios de construcción",
  "Ingeniería y servicios asociados",
  "Mantenimiento, reparación y gestión de instalaciones",
  "Servicios de consultoría",
  "Servicios ferroviarios",
  "Servicios de extracción y refinamiento de recursos",
  "Servicios de transporte, almacenamiento y logística",
  "Servicios llave en mano",
  "Servicios públicos y asociados",
  "Gestión de residuos y limpieza",
  "Servicios de salud, seguridad y protección",
  "Servicios de telecomunicaciones",
  "Productos de Ocio",
  "Otro",
] as const;

/** Valor del catalogo que habilita el campo "indicar cuál". */
export const DD_ACTIVIDAD_OTRO = "Otro";

export type DdActividadEconomica = (typeof DD_ACTIVIDADES_ECONOMICAS)[number];

export const DD_TIPOS_DOCUMENTO_REPRESENTANTE = {
  DNI: "DNI",
  CARNE_EXTRANJERIA: "Carnet de extranjería",
  PASAPORTE: "Pasaporte",
} as const;

export type DdTipoDocumentoRepresentante =
  (typeof DD_TIPOS_DOCUMENTO_REPRESENTANTE)[keyof typeof DD_TIPOS_DOCUMENTO_REPRESENTANTE];

export const DD_DOCUMENTOS = {
  FICHA_RUC: "ficha_ruc",
  PODERES: "poderes",
  IDENTIDAD_REPRESENTANTE: "identidad_representante",
  DECLARACION_JURADA: "declaracion_jurada",
} as const;

export type DdDocumentoTipo = (typeof DD_DOCUMENTOS)[keyof typeof DD_DOCUMENTOS];

/** Documentos obligatorios del expediente (mismo orden del formulario). */
export const DD_DOCUMENTOS_REQUERIDOS: {
  tipo: DdDocumentoTipo;
  titulo: string;
  ayuda: string;
  permiteFormato: boolean;
}[] = [
  {
    tipo: DD_DOCUMENTOS.FICHA_RUC,
    titulo: "Ficha RUC o identificación fiscal",
    ayuda: "Antigüedad menor a 3 meses.",
    permiteFormato: false,
  },
  {
    tipo: DD_DOCUMENTOS.PODERES,
    titulo: "Vigencia de poderes del representante legal",
    ayuda: "Antigüedad menor a 3 meses.",
    permiteFormato: false,
  },
  {
    tipo: DD_DOCUMENTOS.IDENTIDAD_REPRESENTANTE,
    titulo: "Documento de identidad del representante legal",
    ayuda: "Ambos lados en un solo documento.",
    permiteFormato: false,
  },
  {
    tipo: DD_DOCUMENTOS.DECLARACION_JURADA,
    titulo: "Declaración jurada de compromiso de actualización de información",
    ayuda: "Descargue el formato vigente y fírmelo antes de cargarlo.",
    permiteFormato: true,
  },
];

/** Extensiones admitidas para los documentos del expediente. */
export const DD_DOCUMENTO_EXTENSIONES = ["pdf", "jpg", "jpeg", "png"] as const;

/** Valor de `accept` del input de archivo de documentos DD. */
export const DD_DOCUMENTO_ACCEPT = DD_DOCUMENTO_EXTENSIONES.map((e) => `.${e}`).join(",");

/** Tamaño máximo de cada documento del expediente (10 MB). */
export const DD_DOCUMENTO_MAX_BYTES = 10 * BYTES_POR_MB;

export const DD_DOCUMENTO_ESTADOS = {
  PENDIENTE: "pendiente",
  CARGADO: "cargado",
  OBSERVADO: "observado",
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
} as const;

export type DdDocumentoEstado = (typeof DD_DOCUMENTO_ESTADOS)[keyof typeof DD_DOCUMENTO_ESTADOS];

export const DD_DOCUMENTO_ESTADO_LABELS: Record<string, string> = {
  [DD_DOCUMENTO_ESTADOS.PENDIENTE]: "Pendiente",
  [DD_DOCUMENTO_ESTADOS.CARGADO]: "Cargado",
  [DD_DOCUMENTO_ESTADOS.OBSERVADO]: "Observado",
  [DD_DOCUMENTO_ESTADOS.APROBADO]: "Aprobado",
  [DD_DOCUMENTO_ESTADOS.RECHAZADO]: "Rechazado",
};

export const DD_OBSERVACION_AREAS = {
  LOGISTICA: "logistica",
  LEGAL: "legal",
  COMUNICACION: "comunicacion",
} as const;

export type DdObservacionArea = (typeof DD_OBSERVACION_AREAS)[keyof typeof DD_OBSERVACION_AREAS];

export const DD_OBSERVACION_AREA_LABELS: Record<string, string> = {
  [DD_OBSERVACION_AREAS.LOGISTICA]: "Logística",
  [DD_OBSERVACION_AREAS.LEGAL]: "Legal",
  [DD_OBSERVACION_AREAS.COMUNICACION]: "Comunicaciones",
};

export const DD_OBSERVACION_ESTADOS = {
  ABIERTA: "abierta",
  RESUELTA: "resuelta",
} as const;

/** Acciones que puede tomar Logística al revisar un expediente. */
export const DD_ACCIONES_REVISION = {
  APROBAR: "aprobar",
  OBSERVAR: "observar",
  RECHAZAR: "rechazar",
} as const;

export type DdAccionRevision = (typeof DD_ACCIONES_REVISION)[keyof typeof DD_ACCIONES_REVISION];

export const DD_REPUTACION_ESTADOS = {
  POR_REVISAR: "por_revisar",
  EN_ANALISIS: "en_analisis",
  SIN_HALLAZGOS: "sin_hallazgos",
  CON_HALLAZGOS: "con_hallazgos",
  REQUIERE_INFORMACION: "requiere_informacion",
  CERRADA: "cerrada",
} as const;

export type DdReputacionEstado = (typeof DD_REPUTACION_ESTADOS)[keyof typeof DD_REPUTACION_ESTADOS];

export const DD_REPUTACION_ESTADO_LABELS: Record<string, string> = {
  [DD_REPUTACION_ESTADOS.POR_REVISAR]: "Por revisar",
  [DD_REPUTACION_ESTADOS.EN_ANALISIS]: "En análisis",
  [DD_REPUTACION_ESTADOS.SIN_HALLAZGOS]: "Sin hallazgos",
  [DD_REPUTACION_ESTADOS.CON_HALLAZGOS]: "Con hallazgos",
  [DD_REPUTACION_ESTADOS.REQUIERE_INFORMACION]: "Requiere información",
  [DD_REPUTACION_ESTADOS.CERRADA]: "Cerrada",
};

export const DD_REPUTACION_RESULTADOS = {
  SIN_HALLAZGOS: "sin_hallazgos",
  CON_HALLAZGOS: "con_hallazgos",
  REQUIERE_INFORMACION: "requiere_informacion",
} as const;

export type DdReputacionResultado =
  (typeof DD_REPUTACION_RESULTADOS)[keyof typeof DD_REPUTACION_RESULTADOS];

export const DD_REPUTACION_RESULTADO_LABELS: Record<string, string> = {
  [DD_REPUTACION_RESULTADOS.SIN_HALLAZGOS]: "Sin hallazgos",
  [DD_REPUTACION_RESULTADOS.CON_HALLAZGOS]: "Con hallazgos",
  [DD_REPUTACION_RESULTADOS.REQUIERE_INFORMACION]: "Requiere información adicional",
};

/** Origen del nombre derivado a revision reputacional. */
export const DD_REPUTACION_TIPOS = {
  EMPRESA: "empresa",
  REPRESENTANTE: "representante",
  BENEFICIARIO: "beneficiario",
  NOMBRE: "nombre",
} as const;

export type DdReputacionTipo = (typeof DD_REPUTACION_TIPOS)[keyof typeof DD_REPUTACION_TIPOS];

export const DD_REPUTACION_TIPO_LABELS: Record<DdReputacionTipo, string> = {
  [DD_REPUTACION_TIPOS.EMPRESA]: "Empresa",
  [DD_REPUTACION_TIPOS.REPRESENTANTE]: "Representante legal",
  [DD_REPUTACION_TIPOS.BENEFICIARIO]: "Beneficiario final",
  [DD_REPUTACION_TIPOS.NOMBRE]: "Nombre derivado",
};

/** Mapeo unico resultado -> estado persistido del caso reputacional. */
export const DD_REPUTACION_RESULTADO_A_ESTADO: Record<DdReputacionResultado, DdReputacionEstado> = {
  [DD_REPUTACION_RESULTADOS.SIN_HALLAZGOS]: DD_REPUTACION_ESTADOS.SIN_HALLAZGOS,
  [DD_REPUTACION_RESULTADOS.CON_HALLAZGOS]: DD_REPUTACION_ESTADOS.CON_HALLAZGOS,
  [DD_REPUTACION_RESULTADOS.REQUIERE_INFORMACION]: DD_REPUTACION_ESTADOS.REQUIERE_INFORMACION,
};

/** Filtros de la bandeja de revision reputacional (mismo orden visual del mockup). */
export const DD_REPUTACION_FILTROS: { value: string; label: string }[] = [
  { value: DD_FILTRO_TODAS, label: "Todas" },
  { value: DD_REPUTACION_ESTADOS.POR_REVISAR, label: "Por revisar" },
  { value: DD_REPUTACION_ESTADOS.EN_ANALISIS, label: "En análisis" },
  { value: DD_REPUTACION_ESTADOS.SIN_HALLAZGOS, label: "Sin hallazgos" },
  { value: DD_REPUTACION_ESTADOS.CON_HALLAZGOS, label: "Con hallazgos" },
  { value: DD_REPUTACION_ESTADOS.CERRADA, label: "Cerradas" },
];

/** Porcentaje minimo de participacion para declarar un beneficiario final. */
export const DD_PORCENTAJE_PARTICIPACION_MIN = 10;

/** Opciones de registros por pagina en bandejas con paginacion server-side. */
export const PER_PAGE_OPCIONES = [10, 15, 50] as const;

/** Etiquetas legibles del tipo de comprobante (ver TIPOS_COMPROBANTE). */
export const TIPO_COMPROBANTE_LABELS: Record<string, string> = {
  [TIPOS_COMPROBANTE.FACTURA]: "Factura",
  [TIPOS_COMPROBANTE.BOLETA]: "Boleta",
};

/** RUC peruano: 11 digitos. */
export const REGEX_RUC = /^\d{11}$/;

/** DNI peruano: 8 digitos (boleta a persona natural en el API del IIMP). */
export const REGEX_DNI = /^\d{8}$/;

/** Correo electronico simple (validacion de formularios). */
export const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Vigencia y longitud del codigo para verificar el correo de notificaciones. */
export const NOTIFICACION_EMAIL_CODIGO_MINUTOS = 10;
export const NOTIFICACION_EMAIL_CODIGO_LONGITUD = 6;

/** Nacionalidad: solo letras, espacios, apóstrofes, puntos y guiones. */
export const REGEX_NACIONALIDAD = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'-]+$/;

/** Fecha ISO sin hora (AAAA-MM-DD) que exige el IIMP en el plan de cuotas. */
export const REGEX_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Tipos de documento de persona en servicio-persona (`id_tipo_documento`). */
export const TIPOS_DOCUMENTO_PERSONA = {
  DNI: "1",
  CARNE_EXTRANJERIA: "4",
  PASAPORTE: "7",
} as const;

export type TipoDocumentoPersona = (typeof TIPOS_DOCUMENTO_PERSONA)[keyof typeof TIPOS_DOCUMENTO_PERSONA];

export const TIPOS_DOCUMENTO_PERSONA_LABELS: Record<string, string> = {
  [TIPOS_DOCUMENTO_PERSONA.DNI]: "DNI",
  [TIPOS_DOCUMENTO_PERSONA.CARNE_EXTRANJERIA]: "Carne de extranjeria",
  [TIPOS_DOCUMENTO_PERSONA.PASAPORTE]: "Pasaporte",
};

/** Tipos de documento de empresa en servicio-persona (`id_tipo_documento`). */
export const TIPOS_DOCUMENTO_EMPRESA = {
  RUC: "6",
  NO_DOMICILIADO: "0",
} as const;

export type TipoDocumentoEmpresa = (typeof TIPOS_DOCUMENTO_EMPRESA)[keyof typeof TIPOS_DOCUMENTO_EMPRESA];

/** Formato del documento de una empresa no domiciliada (RUT/extranjera): alfanumerico hasta 20. */
export const REGEX_DOCUMENTO_EMPRESA = /^[A-Z0-9]{1,20}$/;

export const TIPOS_DOCUMENTO_EMPRESA_LABELS: Record<string, string> = {
  [TIPOS_DOCUMENTO_EMPRESA.RUC]: "RUC",
  [TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO]: "No domiciliado",
};

/** Codigo de PERU en el catalogo de ubigeo de servicio-persona. */
export const UBIGEO_PAIS_PERU = 75;

/** Codigos del API de reserva del IIMP (doc API-RESERVA-STAND-INTEGRACION.md). */
export const FACTURACION_IIMP = {
  FACTURA: "01",
  BOLETA: "03",
} as const;

export const TIPOS_DOCUMENTO_FACTURACION_IIMP = {
  RUC: "6",
  EXTRANJERA: "0",
  DNI: "1",
  CARNE_EXTRANJERIA: "4",
  PASAPORTE: "7",
} as const;

/** Cargo con el que se registra el contacto de contrato ante el IIMP. */
export const IIMP_CARGO_REPRESENTANTE = "Representante Legal";

/** Acciones registradas en el historial de facturacion (facturacion_historial.accion). */
export const ACCIONES_FACTURACION = {
  AGREGAR_CUOTA: "agregar_cuota",
  ACTUALIZAR_CUOTA: "actualizar_cuota",
  ADJUNTAR_VOUCHER: "adjuntar_voucher",
  PAGAR_CUOTA: "pagar_cuota",
  ADJUNTAR_COMPROBANTE: "adjuntar_comprobante",
  DOCUMENTO_IIMP: "documento_iimp",
  ACTUALIZAR: "actualizar",
  ELIMINAR: "eliminar",
  ELIMINAR_CUOTA: "eliminar_cuota",
} as const;

/** Autores tecnicos que firman movimientos automaticos del sistema. */
export const AUTORES_SISTEMA = {
  SISTEMA: "sistema",
  IIMP: "iimp",
} as const;

/** Estados de pago que notifica el sistema de facturacion externo (API entrante M2M). */
export const ESTADOS_PAGO_EXTERNO = {
  /** El documento quedo con saldo 0 (pago vinculado). */
  PAGADA: 0,
  /** El documento se emitio y aun no esta pagado. */
  PENDIENTE: 1,
  /** El documento se anulo y la cuota vuelve a pendiente de documento. */
  ANULADA: 2,
} as const;

export type EstadoPagoExterno = (typeof ESTADOS_PAGO_EXTERNO)[keyof typeof ESTADOS_PAGO_EXTERNO];

/** Longitud maxima del nombre del documento en la notificacion de facturacion. */
export const MAX_DOCUMENTO_FACTURACION = 250;

/** Longitud maxima de la justificacion de anulacion/rechazo notificada por el sistema de facturacion. */
export const MAX_JUSTIFICACION_FACTURACION = 500;

/* ================================================================
   Carga masiva de empresas (Excel / CSV)
   ================================================================ */

/** Estado de una fila tras la validacion previa de la carga masiva. */
export const ESTADOS_FILA_CARGA = {
  LISTA: "lista",
  ADVERTENCIA: "advertencia",
  ERROR: "error",
} as const;

export type EstadoFilaCarga = (typeof ESTADOS_FILA_CARGA)[keyof typeof ESTADOS_FILA_CARGA];

export type CampoPlantillaEmpresa =
  | "tipoDocumento"
  | "ruc"
  | "razonSocial"
  | "nombreComercial"
  | "direccionFiscal"
  | "telefono"
  | "emailContacto"
  | "emailFacturacion"
  | "representanteLegalNombre"
  | "representanteLegalDni"
  | "tipoComprobante"
  | "sitioWeb";

/** Columnas de la plantilla de carga masiva (orden = columnas del archivo). */
export const CAMPOS_CARGA_EMPRESA: { campo: CampoPlantillaEmpresa; header: string; requerido: boolean; alias?: string[] }[] = [
  { campo: "tipoDocumento", header: "TIPO DOCUMENTO", requerido: false, alias: ["TIPO DOC", "TIPO"] },
  { campo: "ruc", header: "RUC/RUT", requerido: true, alias: ["RUC", "RUT", "RUC EMPRESA", "NUMERO DOC", "NUMERO DOCUMENTO", "NUMERO DE DOCUMENTO", "NRO DOC", "N DOCUMENTO", "DOCUMENTO"] },
  { campo: "razonSocial", header: "RAZON SOCIAL", requerido: false, alias: ["RAZON SOCIAL EMPRESA", "EMPRESA"] },
  { campo: "nombreComercial", header: "NOMBRE COMERCIAL", requerido: false },
  { campo: "direccionFiscal", header: "DIRECCION FISCAL", requerido: false, alias: ["DIRECCION"] },
  { campo: "telefono", header: "TELEFONO", requerido: false, alias: ["CELULAR"] },
  { campo: "emailContacto", header: "CORREO CONTACTO", requerido: false, alias: ["EMAIL CONTACTO", "CORREO"] },
  { campo: "emailFacturacion", header: "CORREO FACTURACION", requerido: false, alias: ["EMAIL FACTURACION"] },
  { campo: "representanteLegalNombre", header: "REPRESENTANTE LEGAL", requerido: false, alias: ["REPRESENTANTE LEGAL NOMBRE"] },
  { campo: "representanteLegalDni", header: "DNI REPRESENTANTE", requerido: false, alias: ["DNI REPRESENTANTE LEGAL", "DNI"] },
  { campo: "tipoComprobante", header: "TIPO COMPROBANTE", requerido: false, alias: ["COMPROBANTE"] },
  { campo: "sitioWeb", header: "SITIO WEB", requerido: false, alias: ["WEB"] },
];

export const CARGA_MASIVA_MAX_FILAS = 500;
export const CARGA_MASIVA_MAX_BYTES = 5 * 1024 * 1024;
export const CARGA_MASIVA_EXTENSIONES = ["xlsx", "csv"] as const;

/* ================================================================
   Credenciales del Portal del Cliente
   ================================================================ */

/**
 * Dominio interno del correo provisional de las cuentas creadas solo con RUC:
 * el usuario ingresa con su RUC y completa su correo real en el primer acceso.
 * A este dominio nunca se envian correos.
 */
export const EMAIL_PROVISIONAL_DOMINIO = "acceso.iimp";

/** Longitud minima de la contrasena al cambiarla (credencial temporal -> definitiva). */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Rutas permitidas mientras el usuario tiene una credencial temporal
 * (`debeCambiarPassword`): cambiar contrasena, validar datos y cerrar sesion.
 */
export const RUTAS_PERMITIDAS_CAMBIO_PASSWORD = [
  "/auth/cambiar-password",
  "/auth/validar-datos",
  "/api/auth",
  "/api/portal",
  "/403",
] as const;

/**
 * Rutas permitidas mientras la empresa del Portal tiene el primer ingreso pendiente
 * (validacion de datos): bloqueo duro en el proxy hasta completar el formulario.
 * No aplica a credenciales temporales (esas pasan primero por cambiar contrasena).
 */
export const RUTAS_PERMITIDAS_VALIDAR_DATOS = [
  "/auth/validar-datos",
  "/api/auth",
  "/api/portal",
  "/403",
] as const;

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

/** Modos de visualizacion de una bandeja (cuadricula o lista). */
export const VISTAS_BANDEJA = {
  GRID: "grid",
  ROW: "row",
} as const;

export type VistaBandeja = (typeof VISTAS_BANDEJA)[keyof typeof VISTAS_BANDEJA];

/* ================================================================
   Steps del modal de reserva
   ================================================================ */
export const RESERVA_STEPS = {
  DATOS: 0,
  CUOTAS: 1,
  CONTRATO: 2,
  CONFIRMACION: 3,
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
  DOCUMENTO_ESTADO: "documento_estado",
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
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

/* ================================================================
   Estilos de Badge (colores semanticos por estado)
   — Usar en lugar de strings hardcodeados para mantener consistencia visual
   — Formato: Tailwind classes (bg-*, text-*, border-*)
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
  DNI_LONGITUD: 8,
  MENSAJE_MAX: 2000,
} as const;

/** Centinelas de UI: opciones que no representan un valor persistido. */
export const UI_SENTINEL = {
  SIN_VINCULAR: "__none__",
  TODOS: "__all__",
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

/** Normaliza un mapeo url -> categoria proveniente de la BD. */
export function normalizarCategorias(valor: unknown): Record<string, string> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/** Alias retrocompatible para categorias de imagenes. */
export const normalizarCategoriasImagen = normalizarCategorias;

/* ================================================================
   Categorias de documentos de un stand
   ================================================================ */
export const CATEGORIAS_DOCUMENTO = {
  CONTRATO: "contrato",
  ANEXO: "anexo",
  OTRO: "otro",
} as const;

export type CategoriaDocumento = (typeof CATEGORIAS_DOCUMENTO)[keyof typeof CATEGORIAS_DOCUMENTO];

export const CATEGORIA_DOCUMENTO_LABELS: Record<CategoriaDocumento, string> = {
  [CATEGORIAS_DOCUMENTO.CONTRATO]: "Contrato",
  [CATEGORIAS_DOCUMENTO.ANEXO]: "Anexo",
  [CATEGORIAS_DOCUMENTO.OTRO]: "Otro",
};

/** Orden de presentacion de las categorias de documento. */
export const CATEGORIA_DOCUMENTO_ORDER: CategoriaDocumento[] = [
  CATEGORIAS_DOCUMENTO.CONTRATO,
  CATEGORIAS_DOCUMENTO.ANEXO,
  CATEGORIAS_DOCUMENTO.OTRO,
];

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
   — La leyenda del chrome los replica; si cambian en el visor, cambiar aqui.
   ================================================================ */
export const COLOR_STAND_RESERVADO = "#9ca3af";
export const COLOR_STAND_SELECCIONADO = "#f59e0b";

/* ================================================================
   Estilos de UI — portal de exhibidores
   ================================================================ */
export const PORTAL_UI = {
  /** Input con icono a la izquierda. */
  INPUT_CON_ICONO: "h-auto rounded-lg border-border bg-background py-2.5 pr-3 pl-10 text-sm placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary",
  /** Input con icono a la izquierda y accion a la derecha (ej. mostrar contrasena). */
  INPUT_CON_ICONO_Y_ACCION: "h-auto rounded-lg border-border bg-background py-2.5 pr-10 pl-10 text-sm placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary",
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/* ================================================================
   Integración SGC (Sistema de Gestión de Contratos)
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

/** Métodos HTTP (evita literales en clientes/servicios). */
export const HTTP_METHODS = {
  GET: "GET",
  POST: "POST",
  PATCH: "PATCH",
  PUT: "PUT",
  DELETE: "DELETE",
} as const;

export type HttpMethod = (typeof HTTP_METHODS)[keyof typeof HTTP_METHODS];

/** Rutas de la API de integración del SGC, relativas a `SGC_API_URL`. */
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

/**
 * Maximo de expedientes que el cron de reconciliacion consulta por corrida
 * (limite del SGC: 120 solicitudes/min por clave; guia §1.1). La lista se rota
 * por `lastSyncedAt` ascendente para no quedarse siempre con los primeros.
 */
export const SGC_RECONCILIAR_MAX_POR_CORRIDA = 50;

export const SGC_API_VERSION = "2026-09-01";
export const SGC_IDEMPOTENCY_PREFIX = "stands/reserva";
/** Prefijo de la Idempotency-Key en los POST documentales (reserve/complete), guia v5. */
export const SGC_IDEMPOTENCY_DOC_PREFIX = "stands/documento";
/** Prefijo de la Idempotency-Key al reabrir el tramite tras subsanar (POST /resend). */
export const SGC_IDEMPOTENCY_RESEND_PREFIX = "stands/resend";
export const SGC_WEBHOOK_TOLERANCE_SECONDS = 300;
export const SGC_WEBHOOK_SIGNATURE_HEADER = "x-sgc-signature";
export const SGC_WEBHOOK_DELIVERY_HEADER = "x-sgc-delivery";
export const CRON_SECRET_HEADER = "x-cron-secret";
/**
 * Área local que dispara la delegación al SGC. La revision local tiene un solo
 * nivel ("Asociado", RF-14/15); la revisión **Legal** pasa a ser el
 * `internal-review` del SGC. Cambiar a `REVISION_AREAS.LEGAL` revierte al
 * disparo por revisión Legal.
 */
export const SGC_TRIGGER_REVISION_AREA = REVISION_AREAS.ASOCIADO;
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

/** Origen de un contrato adjunto: `generado` = plantilla del sistema (firmable digitalmente) | `personalizado` = PDF subido a mano. */
export const ORIGENES_DOCUMENTO = {
  GENERADO: "generado",
  PERSONALIZADO: "personalizado",
} as const;
export type OrigenDocumento = (typeof ORIGENES_DOCUMENTO)[keyof typeof ORIGENES_DOCUMENTO];

/** Tipos de alerta de la campana de notificaciones. */
export const ALERTA_TIPOS = {
  REVISION_PENDIENTE: "revision_pendiente",
  RESERVA_MULTIPLE: "reserva_multiple",
  CONTRATO_FIRMADO: "contrato_firmado",
  DOCUMENTOS_OBSERVADOS: "documentos_observados",
  DD_REPUTACION: "debida_diligencia_reputacion",
  DD_LEGAL: "debida_diligencia_legal",
} as const;

/** Modos de la notificacion manual al cliente desde la bandeja de solicitudes. */
export const MODOS_NOTIFICACION = {
  AUTOMATICO: "automatico",
  PERSONALIZADO: "personalizado",
} as const;

export type ModoNotificacion = (typeof MODOS_NOTIFICACION)[keyof typeof MODOS_NOTIFICACION];

/** Límite de carga del SGC: 25 MB por archivo (configurable en el SGC). */
export const SGC_UPLOAD_MAX_BYTES = 26214400;
/** Formatos admitidos por el SGC para los documentos. */
export const SGC_UPLOAD_ALLOWED_EXTENSIONS = ["pdf", "docx", "xlsx", "png", "jpg", "jpeg"] as const;

/** Subida generica de archivos (/api/upload): extensiones admitidas y tamano maximo. */
export const UPLOAD_ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg", "webp", "gif", "json", "txt", "csv"] as const;
export const UPLOAD_MAX_BYTES = 26214400;

/** Formatos del contrato firmado del cliente (wizard de reserva) y tope de peso de los anexos. */
export const CONTRATO_FIRMADO_EXTENSIONES = ["pdf"] as const;
export const ANEXOS_UPLOAD_MAX_BYTES = 10485760;

/** Firma digital del usuario (Perfil y wizard de reserva): imagen PNG o JPG. */
export const FIRMA_PERFIL_EXTENSIONES = ["png", "jpg"] as const;
export const FIRMA_PERFIL_MAX_BYTES = 10485760;

/** Claves de los anexos requeridos; tambien son la clave de `docsRequisitos` en el wizard. */
export const ANEXOS_KEYS = {
  FICHA_RUC: "ficha-ruc",
  VIGENCIA_PODER: "vigencia-poder",
  DNI_REPRESENTANTE: "dni-representante",
} as const;
export type AnexoKey = (typeof ANEXOS_KEYS)[keyof typeof ANEXOS_KEYS];

/**
 * Formatos permitidos por requisito (RF-13): la Ficha RUC y la Vigencia de Poder
 * son documentos escaneados en PDF; el DNI o Pasaporte tambien acepta imagen (PNG/JPG).
 */
export const ANEXOS_UPLOAD_EXTENSIONES_POR_REQUISITO: Record<string, readonly string[]> = {
  [ANEXOS_KEYS.FICHA_RUC]: ["pdf"],
  [ANEXOS_KEYS.VIGENCIA_PODER]: ["pdf"],
  [ANEXOS_KEYS.DNI_REPRESENTANTE]: ["pdf", "png", "jpg"],
};

/** Formatos de los anexos sin requisito ("otros documentos" del SGC). */
export const ANEXOS_OTROS_EXTENSIONES = ["pdf", "jpg", "jpeg", "png", "docx"] as const;

/** Union de todos los formatos aceptados por los anexos requeridos (atributo `accept` por defecto). */
export const ANEXOS_UPLOAD_EXTENSIONES_TODAS: readonly string[] = [
  ...new Set(Object.values(ANEXOS_UPLOAD_EXTENSIONES_POR_REQUISITO).flat()),
];

/** Fallback seguro (el mas restrictivo) si un requisito no tiene lista propia. */
export const ANEXOS_UPLOAD_EXTENSIONES_DEFAULT = ["pdf"] as const;

/**
 * Formatos admitidos para un requisito de anexo. Sin requisito devuelve los de
 * "otros documentos"; con un requisito desconocido, el fallback mas restrictivo.
 */
export function extensionesPermitidasAnexo(requisito: string | null | undefined): readonly string[] {
  if (!requisito) return ANEXOS_OTROS_EXTENSIONES;
  return ANEXOS_UPLOAD_EXTENSIONES_POR_REQUISITO[requisito] ?? ANEXOS_UPLOAD_EXTENSIONES_DEFAULT;
}

/** Anexos requeridos por el SGC para la separación de stands. */
export const ANEXOS_REQUERIDOS: { key: string; label: string }[] = [
  { key: ANEXOS_KEYS.FICHA_RUC, label: "Ficha RUC (o equivalente, en caso de empresa extranjera)" },
  { key: ANEXOS_KEYS.VIGENCIA_PODER, label: "Vigencia de Poder (o equivalente, en caso de empresa extranjera)" },
  { key: ANEXOS_KEYS.DNI_REPRESENTANTE, label: "DNI o Pasaporte del Representante Legal" },
];

/**
 * Anexos que **bloquean** el envío a revisión Legal (SGC) si faltan
 * (decisión RF-13). La Ficha RUC se exige pero no bloquea.
 */
export const ANEXOS_BLOQUEANTES: string[] = [ANEXOS_KEYS.VIGENCIA_PODER, ANEXOS_KEYS.DNI_REPRESENTANTE];

/**
 * Modos de subsanación que declara el administrador cuando el SGC devuelve el trámite:
 *  - `nuevo_contrato`: el admin subirá una versión corregida; el cliente **espera** a que
 *    el contrato nuevo esté adjunto antes de poder firmarlo.
 *  - `mismo_contrato`: el cliente vuelve a firmar el contrato que ya tenía (puede firmar de inmediato).
 */
export const SGC_SUBSANACION_MODOS = {
  NUEVO_CONTRATO: "nuevo_contrato",
  MISMO_CONTRATO: "mismo_contrato",
} as const;
export type SgcSubsanacionModo = (typeof SGC_SUBSANACION_MODOS)[keyof typeof SGC_SUBSANACION_MODOS];

/**
 * Sugerencias (no cerradas) para el motivo de subsanación que declara el administrador cuando
 * el SGC devuelve el trámite. La casuística es **libre**: el admin puede escribir cualquier
 * motivo, y puede repetirse N veces (una por cada devolución). El `modo` define si el cliente
 * debe esperar a un contrato corregido del admin (`nuevo_contrato`) o puede firmar el vigente.
 */
export const SGC_SUBSANACION_SUGERENCIAS: { modo: SgcSubsanacionModo; titulo: string; texto: string }[] = [
  {
    modo: SGC_SUBSANACION_MODOS.NUEVO_CONTRATO,
    titulo: "Prepararé un contrato nuevo",
    texto: "Subiré un contrato corregido para que el cliente lo firme.",
  },
  {
    modo: SGC_SUBSANACION_MODOS.MISMO_CONTRATO,
    titulo: "El cliente firmará el mismo contrato",
    texto: "El cliente vuelve a firmar el contrato que ya tenía.",
  },
];
export const SGC_CODE_PREFIX = "STAND";
export const SGC_EXPEDIENTE_NAME_PREFIX = "Separacion de stand";

/** Formatos admitidos por el SGC: extension → mime declarado exacto */
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

/** Tipo de documento en el registro externo de Debida Diligencia. */
export const DD_TIPOS_DOCUMENTO_EMPRESA = {
  RUC: "RUC",
  RUT: "RUT",
  DNI: "DNI",
  EXTRANJERO: "EXTRANJERO",
  OTRO: "OTRO",
} as const;

export type DdTipoDocumentoEmpresa =
  (typeof DD_TIPOS_DOCUMENTO_EMPRESA)[keyof typeof DD_TIPOS_DOCUMENTO_EMPRESA];
