# Administración: roles, usuarios y perfil

> Fuente: `src/app/(dashboard)/dashboard/{roles,perfil}/page.tsx`,
> `src/components/admin/roles-mantenedor.tsx`, `src/app/api/roles/**`,
> `src/app/api/auth/**`, `src/application/auth/**`.

## 1. Propósito

Administrar roles, permisos y usuarios del sistema, y permitir a cada usuario mantener su
perfil (datos personales, tipo de usuario y empresa vinculada).

## 2. Roles y permisos

- Gestión de roles: `roles:manage` en `/dashboard/roles` y `/api/roles` (`middleware.ts:24,26`). Solo `admin`.
- Perfil: sin permiso propio; cae en la ruta genérica `/dashboard`, que exige `eventoId` salvo admin (`middleware.ts:36,63-68`).

## 3. Módulo Roles y Permisos

- Página `/dashboard/roles` (server component): lee `role.findMany({include:{usuarios}})` y pasa `initialRows` a la UI.
- Componente `RolesMantenedor` con dos pestañas: **Roles y Permisos** y **Usuarios**.
- Permisos agrupados por `section` (`ALL_PERMISSIONS`, `PERMISSION_SECTION_LABELS`); toggle con actualización optimista → `PATCH /api/roles/update-permisos`.
- Alta de usuario: email + rol → `POST /api/roles/add-user`.
- Baja de usuario: `DELETE /api/roles/remove-user`.
- Modelos: `Role` (`nombre` único, `permisos String[]`) y `UserRole` (`userId`, `roleId`, `email`, `password`, perfil, tokens de reset); `@@unique([userId, roleId])`.

### Endpoints

| Método | Ruta | Acción |
|---|---|---|
| `GET` | `/api/roles/listar` | Roles con usuarios |
| `POST` | `/api/roles/crear` · `/api/roles/add-user` | Crear rol / asignar usuario |
| `PATCH` | `/api/roles/update-permisos` | Actualizar permisos |
| `DELETE` | `/api/roles/remove-user` | Quitar rol a usuario |

## 4. Módulo Perfil

- Página `/dashboard/perfil`; componente cliente.
- Edita nombre, apellidos, teléfono, `tipoUsuarioId`, `idEmpresa`, `nombreEmpresa` → `PATCH /api/auth/perfil`.
- Empresa: búsqueda por RUC/nombre (`entidadesService.searchEmpresa`); **solo admin** ve la búsqueda/asignación; no-admin ve "Solo el administrador puede asignar tu empresa".
- Seguridad: `POST /api/auth/reset-password` y `POST /api/auth/reset-password/confirm` (token de 32 chars, expira 30 min, enviado por correo).

## 5. Autenticación y sesión

- `POST /api/auth/login` `{email, password}` → busca `UserRole`, compara contraseña y firma **JWT HS256** (issuer `contratos-stands`, audience `contratos-stands-api`, expiración 24 h) en cookie `token` HttpOnly.
- `GET /api/auth/session` devuelve roles, permisos, `eventoId`, `tipoEvento`, `codigoEvento`, `eventoNombre`.
- `POST /api/auth/seleccionar-evento` reemite el JWT con el evento elegido.
- `POST /api/auth/logout` limpia la cookie.
- Middleware: rutas públicas exactas/prefijos + `PROTECTED` (prefijo + permiso). Sin token → `/auth/login?returnTo=`; sin permiso → `/403`; sin `eventoId` (no admin) → `/presala`.

## 6. Reglas de negocio

- `hasPermission` hace bypass para rol `admin`. `hasDBPermission` revalida contra BD (usado solo en `notificar`).
- Los permisos de sesión se toman del **primer rol** del usuario; cambios posteriores de permisos no aplican hasta re-login (JWT 24 h).
- Login sin rol asignado → 403.

## 7. Limitaciones y observaciones

- **Contraseñas en texto plano** (`auth-service.ts:24`, campo `password` sin hash).
- **`JWT_SECRET` por defecto inseguro** si no se configura (`lib/server/auth.ts:10`).
- **Permisos solo del primer rol**; JWT puede quedar desactualizado.
- **Baja de usuario de rol probablemente rota** (DELETE por querystring vs. `request.json()`).
- **Alta de usuario con contraseña por defecto `123456`** sin UI para cambiarla.
- La página de roles **lee Prisma directo**, saltándose controlador/servicio (excepción a la arquitectura hexagonal del resto del módulo).
- El perfil de no-admin depende de tener `eventoId` seleccionado.
