# Migración de identidad de usuarios a UUID — Plan QA

> **Para agentes:** ejecutar exclusivamente en `qa`. No tocar `main` ni producción sin autorización. No hacer commit ni push sin autorización.

**Objetivo:** reemplazar los `userId = "user|<correo>"` por UUID inmutables, sin perder solicitudes, documentos, alertas ni archivos, y con rollback mediante `initialUserId`.

**Decisión:** no se crea `user_account`. Se conserva `user_role` como almacén de la cuenta, pero `user_role.user_id` pasa a ser el UUID estable. Los roles siguen siendo filas de `user_role`; cambiar o agregar roles no cambia la identidad.

**Stack:** Next.js, Prisma 7, PostgreSQL/Aurora, Vitest, migraciones SQL versionadas.

## Estado verificado en QA

QA ya tiene los datos de producción:

- `user_role`: 201 filas, 201 IDs distintos.
- `solicitud`: 102 filas, 66 IDs; 0 nulos.
- `solicitud_documento`: 498 filas, 66 IDs; 93 nulos (documentos del sistema/admin).
- `alerta`: 1,112 filas, 63 IDs; 0 nulos.
- `gess_stand`: 991 filas, 65 IDs; 803 nulos.
- `error_log`: 6 filas, 4 IDs; 2 nulos.

### Hallazgos de orfandad en QA

La auditoría de IDs encontró estos valores que no existen en `user_role`:

- `alerta.user_id = "admin"`: 60 filas. Es una identidad de sistema (`ADMIN_USER_ID`), no una cuenta de login.
- `alerta.user_id` de dos usuarios eliminados: 1 fila cada uno.
- `solicitud_documento.user_id = "cliente-test-sub"`: 1 fila de prueba.
- `gess_stand.user_id` de dos usuarios eliminados: 4 filas.

Estos registros no se borran ni se reasignan automáticamente. La migración los deja intactos con `initial_user_id`. Solo las cuentas existentes en `user_role` reciben UUID. Antes de producción, negocio debe decidir si esos registros históricos se reasignan o quedan como legado; no deben bloquear la migración de las cuentas activas.

No existe FK de `solicitud`, `solicitud_documento`, `alerta` ni `gess_stand` hacia `user_role.user_id`; la relación es lógica. Sí existe:

- índice `user_role_user_id_idx`;
- unique `user_role_user_id_role_id_key` (user_id + role_id);
- índice `alerta_user_id_idx` y `alerta_user_id_leida_idx`.

## Dónde se replica el ID

Actualizar:

- `user_role.user_id` (todas las filas de roles de la cuenta).
- `solicitud.user_id`.
- `solicitud_documento.user_id`.
- `alerta.user_id`.
- `gess_stand.user_id`.
- `error_log.user_id` (histórico; se migra para no dejar IDs viejos, no es una relación de negocio).

No actualizar:

- `solicitud.email`: snapshot de contacto.
- `solicitud_documento.uploaded_by`: correo/actor histórico.
- `revision.created_by`, `revision.updated_by`.
- `facturacion.created_by`, `facturacion_historial.created_by`.
- `reevaluacion.created_by`, `reevaluacion.updated_by`.
- `portal_config.updated_by`.
- `stand_montajista_historial.created_by`.
- `gess_stand_backup_20261018`: tabla de respaldo, no es data operativa.

Los `created_by`/`updated_by`/`uploaded_by` son correos de auditoría, no IDs de propiedad. No se deben usar para autorizar.

## Documentos y archivos

Los documentos no se tocan:

- `solicitud_documento.url` no cambia.
- `solicitud_documento.nombre` no cambia.
- `solicitud_documento.estado`, `flg_activo`, `sha256`, `requisito`, `categoria` no cambian.
- `solicitud.documentos` (JSON legacy) no cambia.
- Los archivos no usan `userId` en el nombre: se generan con `Date.now() + random + extensión` (`src/app/api/upload/route.ts`).
- La migración solo actualiza `user_id` y agrega `initial_user_id`.

Se debe comprobar antes/después:

```sql
SELECT count(*) FROM solicitud_documento;
SELECT count(*) FROM solicitud_documento WHERE flg_activo = true;
SELECT count(*) FROM solicitud_documento WHERE user_id IS NOT NULL;
SELECT count(*) FROM solicitud_documento WHERE url LIKE '/uploads/%';
```

Los conteos y una muestra de URLs deben ser idénticos antes y después.

## Columnas de rollback

Agregar en todas las tablas afectadas:

```prisma
initialUserId String? @map("initial_user_id") @db.VarChar(100)
```

Tablas:

- `UserRole`
- `Solicitud`
- `SolicitudDocumento`
- `Alerta`
- `GessStand`
- `ErrorLog`

Regla: `initialUserId` guarda el valor original `user|<correo>`. No se usa para permisos ni consultas normales. Solo sirve para rollback y auditoría de la migración.

## Fase 0 — Preflight obligatorio

Ejecutar en QA antes de cualquier migración:

```sql
-- Cuentas lógicas
SELECT count(DISTINCT user_id) FROM user_role;

-- Correos duplicados entre cuentas distintas: debe devolver 0 filas
SELECT lower(trim(email)) correo, count(DISTINCT user_id) cuentas
FROM user_role
GROUP BY 1
HAVING count(DISTINCT user_id) > 1;

-- IDs en tablas hijas que no existen en user_role.
-- Los valores conocidos (admin, usuarios eliminados, cliente-test-sub) se dejan como legado.
SELECT 'solicitud' tabla, count(*) FROM solicitud s
LEFT JOIN user_role ur ON ur.user_id = s.user_id
WHERE s.user_id IS NOT NULL AND ur.user_id IS NULL
UNION ALL
SELECT 'solicitud_documento', count(*) FROM solicitud_documento d
LEFT JOIN user_role ur ON ur.user_id = d.user_id
WHERE d.user_id IS NOT NULL AND ur.user_id IS NULL
UNION ALL
SELECT 'alerta', count(*) FROM alerta a
LEFT JOIN user_role ur ON ur.user_id = a.user_id
WHERE a.user_id IS NOT NULL AND ur.user_id IS NULL
UNION ALL
SELECT 'gess_stand', count(*) FROM gess_stand g
LEFT JOIN user_role ur ON ur.user_id = g.user_id
WHERE g.user_id IS NOT NULL AND ur.user_id IS NULL;
```

Si aparece un ID huérfano distinto de `admin`, `cliente-test-sub` o los IDs históricos ya identificados, **detenerse** y clasificarlo. No borrar ni reasignar sin autorización.

`admin` se mantiene como identidad especial del sistema; no se convierte a UUID porque no es una cuenta de login. Los IDs huérfanos conservan su valor original y su `initial_user_id`.

## Fase 1 — Migración aditiva y backfill

**Archivos:**

- Modificar: `prisma/schema.prisma`
- Crear: `prisma/migrations/20261020233000_user_id_uuid_identity/migration.sql`

### Campos Prisma

```prisma
model UserRole {
  // campos existentes...
  initialUserId String? @map("initial_user_id") @db.VarChar(100)
  @@index([initialUserId])
}

model Solicitud {
  // campos existentes...
  initialUserId String? @map("initial_user_id") @db.VarChar(100)
  @@index([initialUserId])
}

model SolicitudDocumento {
  // campos existentes...
  initialUserId String? @map("initial_user_id") @db.VarChar(100)
  @@index([initialUserId])
}

model Alerta {
  // campos existentes...
  initialUserId String? @map("initial_user_id") @db.VarChar(100)
  @@index([initialUserId])
}

model GessStand {
  // campos existentes...
  initialUserId String? @map("initial_user_id") @db.VarChar(100)
  @@index([initialUserId])
}

model ErrorLog {
  // campos existentes...
  initialUserId String? @map("initial_user_id") @db.VarChar(100)
}
```

### SQL de migración

La migración es una sola transacción; si falla, PostgreSQL revierte todo. No elimina columnas ni tablas.

```sql
ALTER TABLE "user_role" ADD COLUMN "initial_user_id" VARCHAR(100);
ALTER TABLE "solicitud" ADD COLUMN "initial_user_id" VARCHAR(100);
ALTER TABLE "solicitud_documento" ADD COLUMN "initial_user_id" VARCHAR(100);
ALTER TABLE "alerta" ADD COLUMN "initial_user_id" VARCHAR(100);
ALTER TABLE "gess_stand" ADD COLUMN "initial_user_id" VARCHAR(100);
ALTER TABLE "error_log" ADD COLUMN "initial_user_id" VARCHAR(100);

CREATE INDEX "user_role_initial_user_id_idx" ON "user_role"("initial_user_id");
CREATE INDEX "solicitud_initial_user_id_idx" ON "solicitud"("initial_user_id");
CREATE INDEX "solicitud_documento_initial_user_id_idx" ON "solicitud_documento"("initial_user_id");
CREATE INDEX "alerta_initial_user_id_idx" ON "alerta"("initial_user_id");
CREATE INDEX "gess_stand_initial_user_id_idx" ON "gess_stand"("initial_user_id");

/* Guardar el valor original antes de cambiarlo. */
UPDATE "user_role" SET "initial_user_id" = "user_id" WHERE "initial_user_id" IS NULL;
UPDATE "solicitud" SET "initial_user_id" = "user_id" WHERE "initial_user_id" IS NULL;
UPDATE "solicitud_documento" SET "initial_user_id" = "user_id" WHERE "initial_user_id" IS NULL;
UPDATE "alerta" SET "initial_user_id" = "user_id" WHERE "initial_user_id" IS NULL;
UPDATE "gess_stand" SET "initial_user_id" = "user_id" WHERE "initial_user_id" IS NULL;
UPDATE "error_log" SET "initial_user_id" = "user_id" WHERE "initial_user_id" IS NULL;

/* Un UUID por cuenta lógica, compartido por todas sus filas de rol. */
CREATE TEMP TABLE "_identity_map" AS
SELECT
  u."user_id" AS "old_user_id",
  gen_random_uuid()::text AS "new_user_id"
FROM (
  SELECT DISTINCT "user_id"
  FROM "user_role"
  WHERE "user_id" IS NOT NULL
) u;

UPDATE "user_role" ur
SET "user_id" = m."new_user_id"
FROM "_identity_map" m
WHERE ur."user_id" = m."old_user_id";

UPDATE "solicitud" s
SET "user_id" = m."new_user_id"
FROM "_identity_map" m
WHERE s."user_id" = m."old_user_id";

UPDATE "solicitud_documento" d
SET "user_id" = m."new_user_id"
FROM "_identity_map" m
WHERE d."user_id" = m."old_user_id";

UPDATE "alerta" a
SET "user_id" = m."new_user_id"
FROM "_identity_map" m
WHERE a."user_id" = m."old_user_id";

UPDATE "gess_stand" g
SET "user_id" = m."new_user_id"
FROM "_identity_map" m
WHERE g."user_id" = m."old_user_id";

UPDATE "error_log" e
SET "user_id" = m."new_user_id"
FROM "_identity_map" m
WHERE e."user_id" = m."old_user_id";

DROP TABLE "_identity_map";
```

**No tocar** `user_role.id`, `role_id`, `email`, `empresa_id`, permisos ni contraseñas.

### Validación posterior

```sql
-- Todos los user_id de cuentas deben ser UUID.
SELECT count(*) FROM user_role WHERE user_id LIKE 'user|%';

-- En tablas hijas solo pueden quedar los IDs legados ya identificados.
SELECT user_id, count(*) FROM solicitud_documento
WHERE user_id LIKE 'user|%' OR user_id = 'cliente-test-sub'
GROUP BY user_id;

SELECT user_id, count(*) FROM alerta
WHERE user_id LIKE 'user|%' OR user_id = 'admin'
GROUP BY user_id;

SELECT user_id, count(*) FROM gess_stand
WHERE user_id LIKE 'user|%'
GROUP BY user_id;
```

`solicitud` debe quedar sin IDs legacy. Los resultados de documentos/alertas/stands deben coincidir exactamente con los IDs históricos identificados; cualquier valor nuevo requiere revisión.

```sql
SELECT count(*) FROM user_role WHERE initial_user_id IS NULL;
SELECT count(*) FROM solicitud WHERE user_id IS NOT NULL AND initial_user_id IS NULL;
SELECT count(*) FROM solicitud_documento WHERE user_id IS NOT NULL AND initial_user_id IS NULL;
SELECT count(*) FROM alerta WHERE user_id IS NOT NULL AND initial_user_id IS NULL;
SELECT count(*) FROM gess_stand WHERE user_id IS NOT NULL AND initial_user_id IS NULL;
```

Todos deben ser 0.

```sql
-- Los totales no deben cambiar respecto al preflight
SELECT count(*) FROM solicitud;
SELECT count(*) FROM solicitud_documento;
SELECT count(*) FROM alerta;
SELECT count(*) FROM gess_stand;
```

## Fase 2 — Código de identidad

**Archivos:**

- `src/application/auth/auth-service.ts`
- `src/application/empresas/empresa-service.ts`
- `src/application/solicitud-cuenta/solicitud-cuenta-service.ts`
- `src/lib/server/auth.ts`
- `src/infrastructure/persistence/auth-repository.ts`
- tests de auth, empresas y solicitudes.

Cambios:

- Crear cuentas con `userId = randomUUID()`; nunca `user|${email}`.
- JWT nuevo: `sub = userRole.userId` (UUID), `email` separado.
- `getSession` rechaza `sub` que no sea UUID; esto invalida los tokens viejos y fuerza re-login.
- `hasDBPermission` y consultas por `userId` usan el UUID.
- Retirar la lógica de `actualizarEmailCuenta` que reescribe IDs; el cambio de correo solo actualizará `user_role.email`.
- Conservar `session.email` para mostrar/notificar, pero no para propiedad.
- Tests:
  - cuenta nueva nace con UUID;
  - login emite `sub` UUID;
  - token viejo `user|correo` es rechazado;
  - cambio de rol no cambia `userId`;
  - cambio de correo no modifica solicitudes/documentos.

## Fase 3 — Cambio de correo

Después de que la identidad sea UUID:

1. Solicitar correo nuevo y validar que no exista.
2. Enviar código/enlace al correo nuevo; guardar token con hash y expiración.
3. Confirmar en transacción:
   - `user_role.email = nuevoCorreo` para todas las filas del UUID;
   - no tocar `user_id`, solicitudes, documentos ni alertas;
   - reemitir JWT con el mismo `sub` UUID y nuevo email.
4. Invalidar tokens de cambio anteriores.
5. Probar que solicitudes, documentos, alertas y permisos siguen asociados.

No reutilizar `actualizarEmailCuenta` basada en `user|correo`.

## Fase 4 — QA

### Validación de viabilidad ya ejecutada

La migración se probó en una base temporal `identity_test` creada desde la copia de QA. No se aplicó aún a la base operativa de QA porque falta el código que emite JWT con UUID; aplicarla antes dejaría la app actual sin acceso a las solicitudes.

Resultado de la prueba:

- `user_role`: 201 filas migradas.
- `solicitud`: 102 filas migradas.
- `solicitud_documento`: 498 filas conservadas; 404 IDs migrados, 1 ID de prueba y 93 nulos intactos.
- `alerta`: 1,112 filas conservadas; 1,050 IDs migrados, 60 `admin` y 2 históricos intactos.
- `gess_stand`: 991 filas conservadas; 184 IDs migrados, 4 históricos y 803 nulos intactos.
- `error_log`: 6 filas; 4 migradas y 2 nulos.
- `user_role` quedó con **0 IDs legacy**.
- Rollback ejecutado en la misma base temporal: los conteos se mantuvieron y los 201 IDs de `user_role` volvieron a `user|correo`.
- La base temporal fue eliminada; QA operativo no fue modificado.

Antes de aplicar a QA real:

- [ ] Implementar código con JWT UUID y rechazo de tokens legacy.
- [ ] Aplicar la migración real con `prisma migrate deploy`.
- [ ] Ejecutar las validaciones anteriores.
- [ ] Verificar 102 solicitudes, 498 documentos, 1,112 alertas y 991 stands.
- [ ] Verificar que una muestra de URLs de documentos sigue resolviendo.
- [ ] Iniciar sesión con usuario de producción restaurado.
- [ ] Confirmar que “Mis solicitudes” y “documentos” siguen visibles.
- [ ] Confirmar que el botón Revisar no perdió documentos.
- [ ] Cambiar el correo de un usuario de prueba.
- [ ] Confirmar login con correo nuevo y rechazo del correo viejo.
- [ ] Ejecutar typecheck, lint, tests y build.
- [ ] No hacer merge a `main`.

## Fase 5 — Rollback

### Rollback automático

Si falla la migración, PostgreSQL revierte la transacción completa.

### Rollback manual inmediato

Solo mientras no existan escrituras nuevas con UUID:

```sql
UPDATE user_role SET user_id = initial_user_id WHERE initial_user_id IS NOT NULL;
UPDATE solicitud SET user_id = initial_user_id WHERE initial_user_id IS NOT NULL;
UPDATE solicitud_documento SET user_id = initial_user_id WHERE initial_user_id IS NOT NULL;
UPDATE alerta SET user_id = initial_user_id WHERE initial_user_id IS NOT NULL;
UPDATE gess_stand SET user_id = initial_user_id WHERE initial_user_id IS NOT NULL;
UPDATE error_log SET user_id = initial_user_id WHERE initial_user_id IS NOT NULL;
```

Después, revertir el código a la versión anterior y forzar re-login.

`initialUserId` no se elimina en la primera versión. Se conserva para auditoría y para rollback.

## Fase 6 — Producción

Solo con autorización explícita:

1. Snapshot Aurora.
2. Poner mantenimiento / detener escrituras.
3. Aplicar la migración con `prisma migrate deploy`.
4. Ejecutar validaciones y comparar conteos.
5. Desplegar código que emite JWT con UUID y rechaza tokens legacy.
6. Todos los usuarios vuelven a iniciar sesión.
7. Verificar login, solicitudes, documentos, alertas, stands y revisión.
8. Mantener `initial_user_id` y las columnas legacy; no borrar nada en esta fase.

## Criterios de aceptación

- `user_id` de todas las cuentas activas es UUID; no queda `user|correo` en `user_role` ni `solicitud`.
- Los IDs históricos de `admin`, documentos de prueba y dueños eliminados se conservan como legado con `initial_user_id` y quedan reportados.
- `initial_user_id` conserva el valor original en todas las filas afectadas.
- No se pierde ni se desactiva ningún documento.
- No cambian los conteos de solicitudes, documentos, alertas ni stands.
- Cambiar rol no cambia la identidad.
- Cambiar correo no requiere actualizar tablas hijas.
- Los tokens viejos se rechazan y los usuarios inician sesión una vez.
- QA pasa migración, typecheck, lint, tests y validación funcional.
- Producción no se toca sin snapshot ni autorización.
