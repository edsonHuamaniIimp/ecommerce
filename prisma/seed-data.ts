/**
 * Datos del seed (roles + usuarios). Autocontenido: NO importa de `src/`, para poder
 * ejecutarse dentro de la imagen ECS standalone (`Dockerfile.ecs`) que no copia `src/`.
 */
export const ROLES_SEED: { nombre: string; descripcion: string; permisos: string[] }[] = [
  { nombre: "admin", descripcion: "Administrador del sistema", permisos: ["admin:full", "dashboard:view", "eventos:datos", "stands:vinculacion", "stands:manage", "stands:plano", "roles:manage", "events:manage", "events:create", "events:edit", "events:toggle", "read:reservas", "mis-reservas:view", "write:reservas", "approve:all", "solicitudes:view", "solicitudes:gestion", "solicitudes:review:comunicacion", "solicitudes:review:legal", "solicitudes:review:logistica", "solicitudes:notify", "solicitudes:upload", "auspicios:view", "laboratorio:view", "laboratorio:manage", "facturacion:view", "pagos:view", "pagos:manage"] },
  { nombre: "logistica", descripcion: "Area de Logistica", permisos: ["dashboard:view", "eventos:datos", "stands:manage", "stands:plano", "auspicios:view", "read:reservas", "approve:logistica", "solicitudes:view", "solicitudes:gestion", "solicitudes:review:logistica"] },
  { nombre: "legal", descripcion: "Area Legal", permisos: ["dashboard:view", "eventos:datos", "stands:plano", "auspicios:view", "read:reservas", "approve:legal", "solicitudes:view", "solicitudes:gestion", "solicitudes:review:legal"] },
  { nombre: "comunicacion", descripcion: "Area de Comunicacion", permisos: ["dashboard:view", "eventos:datos", "stands:plano", "auspicios:view", "read:reservas", "approve:comunicacion", "solicitudes:view", "solicitudes:gestion", "solicitudes:review:comunicacion"] },
  { nombre: "cliente", descripcion: "Cliente expositor", permisos: ["eventos:datos", "solicitudes:view", "stands:plano", "mis-reservas:view", "write:reservas", "pagos:view", "pagos:manage"] },
];

export const USUARIOS_SEED: { email: string; role: string; password: string; nombre: string; apellidos: string }[] = [
  { email: "admin@iimp.org.pe", role: "admin", password: "admin123", nombre: "Admin", apellidos: "IIMP" },
  { email: "test.admin@iimp.org.pe", role: "admin", password: "test123", nombre: "Admin", apellidos: "Test" },
  { email: "logistica@iimp.org.pe", role: "logistica", password: "logistica123", nombre: "Carlos", apellidos: "Logistica" },
  { email: "test.logistica@iimp.org.pe", role: "logistica", password: "test123", nombre: "Carlos", apellidos: "Test Logistica" },
  { email: "legal@iimp.org.pe", role: "legal", password: "legal123", nombre: "Maria", apellidos: "Legal" },
  { email: "comunicacion@iimp.org.pe", role: "comunicacion", password: "comunicacion123", nombre: "Pedro", apellidos: "Comunicacion" },
  { email: "test.comunicacion@iimp.org.pe", role: "comunicacion", password: "test123", nombre: "Pedro", apellidos: "Test Comunicacion" },
  { email: "cliente@iimp.org.pe", role: "cliente", password: "cliente123", nombre: "Cliente", apellidos: "General" },
  { email: "test.cliente@iimp.org.pe", role: "cliente", password: "test123", nombre: "Cliente", apellidos: "Test" },
  { email: "ext_analistaprogramador3@iimp.org.pe", role: "admin", password: "admin123", nombre: "Edson", apellidos: "Huamani" },
];
