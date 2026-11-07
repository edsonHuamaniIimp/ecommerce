# Ambiente DD v2 — Segundo ambiente de desarrollo

Este worktree está dedicado **exclusivamente** al módulo de Debida Diligencia (DD v2).

## Datos del ambiente

| Elemento       | Valor                                                        |
| -------------- | ------------------------------------------------------------ |
| Branch         | `feature/dd-v2` (desde `qa`)                                  |
| Worktree       | `C:\Proyectos\IIMP\ContratosStands-dd-v2`                     |
| Base de datos  | `contratos_dd` (PostgreSQL del contenedor `ctrst-db`, puerto 5433) |
| Puerto app     | `3008`                                                        |
| Env            | `.env` local del worktree (no se versiona)                    |

El ambiente principal (`C:\Proyectos\IIMP\ContratosStands`) sigue usando `contratos_stands` en el puerto 3001.

## Comandos

```powershell
# Desarrollo en el puerto 3008
npm run dev:dd

# Producción local
npm run start:dd

# Base de datos de este ambiente
npx prisma migrate deploy
npx prisma studio

# Crear una migración del contexto DD
npx prisma migrate dev --name dd_<descripcion>
```

## Reglas de convivencia con el ambiente principal

1. **Migraciones aditivas**: solo nuevas tablas/columnas nullable (`CREATE`, `ADD COLUMN`).
   Nada de `DROP`, `RENAME` o `ALTER` destructivo sobre tablas fuera del contexto DD.
2. **Separación por contexto**: las tablas del módulo usan prefijo `dd_` y viven en sus
   propias migraciones; no mezclar cambios de DD con tablas core
   (empresas, solicitudes, facturación, sgc).
3. **DD solo escribe en sus tablas**; las entidades core se leen por puertos.
4. **Nunca** ejecutar `prisma db push --accept-data-loss` ni `db:reset` contra
   `contratos_stands`.
5. Cada ambiente aplica sus migraciones con `prisma migrate deploy` sobre su propia BD.

## Estado inicial

- Migraciones aplicadas: todas (58 tablas; paridad con `contratos_stands`, que además
  tiene 2 tablas de respaldo de pruebas: `dd_empresa_estado_bak_ddtest`, `empresa_bak_ddtest`).
- Seeds: pendientes de ejecutar si se requieren datos base (`npm run db:seed:auth`).
