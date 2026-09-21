# Seeders (datos iniciales) — qué crea cada uno y cómo limpiar

> Los seeders son **idempotentes** (upsert). En producción están **bloqueados por defecto**
> (`NEXT_PUBLIC_APP_ENV=production` y `SEED_ALLOW_PROD != 1`).

## 1. Qué crea cada seeder

| Seeder | Contenido | Tipo | ¿Borrar en prod? |
|---|---|---|---|
| `prisma/seed.ts` → roles | `admin`, `logistica`, `legal`, `comunicacion`, `cliente` (permisos) | **NECESARIO** | No |
| `prisma/seed.ts` → maestra | `comprobante_tipo`, `documento_tipo`, `usuario_tipo`, `stand_estado`, `solicitud_estado`, `revision_estado`, `reevaluacion_estado`, `facturacion_estado`, `facturacion_tipo`, `cuota_estado`, `stand_tipologia` | **NECESARIO** (catálogos) | No |
| `prisma/seed.ts` → usuarios | `admin@iimp.org.pe`, `logistica@…`, `legal@…`, `comunicacion@…`, `cliente@…`, `ext_analistaprogramador3@…` | **SOLO PRUEBA** | **Sí** (al ir a real) |
| `prisma/seed.ts` → `seedPlanoGess` | Plano GESS + 52 bloques + kioskos | Demo / maqueta | Opcional |
| `prisma/seed.ts` → `seedPlanoMacroPerumin` | Plano macro PERUMIN (pabellones) | Demo / maqueta | Opcional |
| `prisma/seed-auth.ts` | Solo roles + usuarios (autocontenido, sin `src/`) | Mixto (roles necesarios, usuarios de prueba) | Usuarios sí |
| `prisma/seed-cleanup.ts` | **Elimina** los usuarios de prueba | Limpieza | — |

> Credenciales de prueba (mismas de local): `admin@iimp.org.pe / admin123`,
> `logistica… / logistica123`, `legal… / legal123`, `comunicacion… / comunicacion123`,
> `cliente… / cliente123`.

## 2. Ejecutar seeders

```bash
# Completo (roles + maestra + usuarios + planos demo). Requiere src/ (local/EC2).
SEED_ALLOW_PROD=1 npm run db:seed

# Solo roles + usuarios (autocontenido; apto para la imagen ECS standalone).
SEED_ALLOW_PROD=1 npm run db:seed:auth
```

## 3. Limpiar los usuarios de prueba (antes de producción real)

```bash
# Elimina los usuarios de prueba (y los que empiezan con "test.").
# NO toca roles, maestra ni datos de negocio.
SEED_ALLOW_PROD=1 npm run db:seed:cleanup
```

> ⚠️ También borra `admin@iimp.org.pe`. Crea primero tu **usuario real** (o quítalo de
> `USUARIOS_SEED` en `prisma/seed-data.ts`) antes de correrlo en producción.

## 4. ¿El deploy siembra automáticamente?

**No por defecto.** Los gates:

| Despliegue | Condición para sembrar |
|---|---|
| ECS (dominio) | `RUN_SEED=true` en el task (usa `seed-auth.ts`) |
| EC2 (docker/entrypoint.sh) | primer arranque **y** `SEED_ALLOW_PROD=1` |
| GitHub Actions (`deploy.yml`) | secret `SEED_ON_DEPLOY=1` (corre `db:seed`) |

Recomendación: sembrar **una vez** al crear el ambiente y luego **no** dejar el gate activo;
si sembraste los usuarios de prueba, córrelos a limpio con `db:seed:cleanup`.
