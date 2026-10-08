# Administración: roles, usuarios y perfil

> Fuente: `src/app/(dashboard)/dashboard/{roles,usuarios,perfil,empresas}/page.tsx`,
> `src/components/{admin/roles-mantenedor,usuarios/usuarios-manager,empresas/empresas-manager}.tsx`,
> `src/app/api/{roles,usuarios,empresas,auth}/**`, `src/application/{auth,usuarios,empresas}/**`,
> `src/proxy.ts` (Next 16 renombró `middleware.ts` a `proxy.ts`).

## 1. Propósito

Administrar roles/permisos, los usuarios del sistema (backoffice y Portal del Cliente) y
permitir a cada usuario mantener su perfil. El Portal del Cliente funciona contra
**servicio-persona** (la persona vive en la fuente): localmente solo se guardan identificadores
(`sie_code`, `id_empresa`), correo, empresa y rol.

## 2. Roles y permisos

- Gestión de roles: `roles:manage` en `/dashboard/roles` y `/api/roles`. Solo `admin`.
- Usuarios del Portal: `usuarios:manage` en `/dashboard/usuarios` y `/api/usuarios`.
- Empresas: `empresas:view` (lectura) y `empresas:manage` (escritura) en `/dashboard/empresas`
  y `/api/empresas`; `admin:full` siempre accede.
- Roles disponibles (`ROLES`): `admin`, `asociado`, `logistica`, `legal`, `comunicacion`,
  `cliente`. El rol `cliente` es el del Portal del Cliente (sin `dashboard:view`; su inicio es
  **Mi Panel**, ver §6).

## 3. Módulo Roles y Permisos

- Página `/dashboard/roles`; componente `RolesMantenedor` con pestañas **Roles y Permisos** y **Usuarios**.
- Permisos agrupados por `section` (`ALL_PERMISSIONS`, `PERMISSION_SECTION_LABELS`); toggle con
  actualización optimista → `PATCH /api/roles/update-permisos`.
- Alta de usuario: email + rol → `POST /api/roles/add-user`; baja: `DELETE /api/roles/remove-user`.
- Modelos: `Role` (`nombre` único, `permisos String[]`) y `UserRole` (perfil + tokens de reset).

| Método | Ruta | Acción |
|---|---|---|
| `GET` | `/api/roles/listar` | Roles con usuarios |
| `POST` | `/api/roles/crear` · `/api/roles/add-user` | Crear rol / asignar usuario |
| `PATCH` | `/api/roles/update-permisos` | Actualizar permisos |
| `DELETE` | `/api/roles/remove-user` | Quitar rol a usuario |

## 4. Módulo Usuarios (Portal del Cliente)

Página `/dashboard/usuarios` (`UsuariosManager`). Bandeja con **todos** los usuarios (incluye
internos sin empresa), filtro **Portal / Sin empresa**, búsqueda por correo/ID/empresa y badge
de credencial (temporal/activa).

- **Alta individual** (*Nuevo usuario*): busca/crea la persona en servicio-persona por documento
  y crea el acceso local (`sie_code` + correo + empresa SIE + rol; contraseña temporal por correo).
- **Alta por lote** (*Crear varios*): hasta 100 personas para la misma empresa y rol; una línea
  por persona (`tipoDocumento, documento, apellidos, nombres, correo, celular`).
- **Buscar persona (API)**: busca personas existentes en servicio-persona y crea la cuenta sin
  duplicar la persona.
- **Asignar empresa** (lápiz): el selector ofrece **Empresas locales** (las registradas en
  `/dashboard/empresas`, con RUC + código SIE) y **Catálogo SIE** (API de entidades). Al guardar
  se persiste el código SIE y se resuelve la **FK local por RUC** (si existe la ficha).
  Las empresas locales sin código SIE aparecen deshabilitadas.
- **Enviar accesos**: regenera la contraseña temporal y reenvía credenciales.

| Ruta | Métodos | Descripción |
|---|---|---|
| `/api/usuarios/listar` | GET | Bandeja (rol, empresa, `sieCode`, credencial temporal) |
| `/api/usuarios/personas` | GET | Busca personas en servicio-persona (`q`) |
| `/api/usuarios/crear` · `/crear-lote` · `/crear-cuenta` | POST | Altas (individual, lote o persona existente) |
| `/api/usuarios/actualizar` | POST | Asigna/cambia la empresa del acceso |
| `/api/usuarios/enviar-accesos` | POST | Regenera y reenvía credenciales |

## 5. Módulo Perfil

- Página `/dashboard/perfil`; componente cliente. Edita nombre, apellidos, teléfono,
  `tipoUsuarioId`, `idEmpresa`/`nombreEmpresa` → `PATCH /api/auth/perfil`.
- Empresa: búsqueda por RUC/nombre (API de entidades); **solo admin** ve la búsqueda/asignación.
- **Representante legal** (visible cuando la cuenta está vinculada a una empresa): DNI
  (validado contra **RENIEC** + prellenado propio de servicio-persona), nombre completo,
  partida electrónica (opcional), dirección, **correo de solo lectura** (cambiarlo requiere
  validación previa), celular y **foto** (≤5 MB; se sube como foto de la persona en la fuente).
  Se guarda en la ficha de la empresa (por FK o por `sie_code`) y se refleja en servicio-persona.
- **Gate al ingresar** (`RepresentanteGate`): si falta DNI/correo/celular/dirección del
  representante, el dashboard muestra un modal que lleva a completarlos en el perfil.
- Seguridad: `POST /api/auth/reset-password` y `/reset-password/confirm` (token de 32 chars,
  expira 30 min, enviado por correo).

## 6. Portal del Cliente

- `/dashboard` bifurca por rol: el **cliente** (sin admin) ve **Mi Panel** (resumen de reservas,
  cuotas por pagar, empresa y accesos al plano); el resto ve el Panel de Control.
- Sidebar: para cliente el primer ítem es **Inicio** → `/dashboard`.
- **Login**: `POST /api/auth/login` acepta **correo o RUC** (11 dígitos: se elige la cuenta cuya
  contraseña coincide) y devuelve directo al panel del cliente (el resto pasa por `/presala`).

## 7. Autenticación y sesión

- `POST /api/auth/login` → busca `UserRole`, compara contraseña (**scrypt**; ver §8) y firma
  **JWT HS256** (issuer `contratos-stands`, audience `contratos-stands-api`, 24 h) en cookie
  `token` HttpOnly.
- `GET /api/auth/session` devuelve roles, permisos, `eventoId`, `tipoEvento`, `codigoEvento`,
  `eventoNombre`.
- `POST /api/auth/seleccionar-evento` reemite el JWT con el evento elegido; `POST /api/auth/logout`
  limpia la cookie.
- `proxy.ts` (antes `middleware.ts`): rutas públicas exactas/prefijos + `PROTECTED` (prefijo +
  permiso). Sin token → `/auth/login?returnTo=`; sin permiso → `/403`; sin `eventoId` (no admin)
  → `/presala`; credencial temporal → `/auth/cambiar-password`.

## 8. Reglas de negocio

- `hasPermission` hace bypass para rol `admin`. `hasDBPermission` revalida contra BD (usado solo
  en `notificar`).
- Los permisos de sesión se toman del **primer rol** del usuario; cambios posteriores de
  permisos no aplican hasta re-login (JWT 24 h). Login sin rol asignado → 403.
- Contraseñas siempre **hasheadas (scrypt)**: repositorios blindados (`hashearSiHaceFalta`),
  seed y `scripts/rehash-passwords.ts` (idempotente, para limpiar texto plano legacy; en prod
  se ejecuta como tarea ECS one-off).
- El **correo** de la cuenta es a la vez login e identificador en servicio-persona: no se edita
  libremente en el perfil (solo lectura; un cambio exige validación).

## 9. Limitaciones y observaciones

- **Permisos solo del primer rol**; el JWT puede quedar desactualizado hasta re-login.
- **`JWT_SECRET` por defecto inseguro** si no se configura (`lib/server/auth.ts`).
- **Alta de usuario desde Roles** usa credencial por defecto; el alta correcta de usuarios del
  Portal es la de `/dashboard/usuarios` (servicio-persona + contraseña temporal).
- La página de roles **lee Prisma directo**, saltándose controlador/servicio (excepción a la
  arquitectura hexagonal del resto del módulo).
- El perfil de no-admin depende de tener `eventoId` seleccionado.
