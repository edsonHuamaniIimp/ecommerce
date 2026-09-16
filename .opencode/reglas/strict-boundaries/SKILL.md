---
name: strict-boundaries
description: Límites estrictos de capas. El frontend nunca importa de server/application/infrastructure/domain. Cada nueva utilidad va en server, client o shared según su dependencia. Cargar al mover archivos entre capas o al crear nuevas utilidades.
---

# Límites Estrictos entre Capas (Strict Boundaries)

## Regla de oro

**El frontend (componentes, páginas, hooks, contexts) NUNCA importa de:**

- `src/lib/server/`
- `src/application/`
- `src/infrastructure/`
- `src/domain/`

**El backend (controllers, application services, infrastructure) NUNCA importa de:**

- `src/lib/client/`
- `src/components/`
- `src/hooks/`
- `src/contexts/`

## Estructura de `src/lib/`

```
src/lib/
├── server/          ← Solo código que requiere Node.js (Prisma, JWT, fs, NextResponse)
│   ├── db.ts
│   ├── auth.ts
│   ├── router.ts
│   ├── api-response.ts
│   ├── handlers.ts
│   ├── email.ts
│   ├── email-templates.ts
│   ├── services.ts
│   ├── storage.ts
│   ├── pagination.ts
│   └── utils/
│       └── cookie.ts
│
├── client/          ← Solo código que requiere browser APIs (localStorage, fetch, window)
│   ├── indexed-db.ts
│   └── api/
│       ├── client.ts
│       ├── config.ts
│       └── services/
│           ├── internal-api.ts
│           ├── solicitudes-service.ts
│           ├── auth-service.ts
│           └── ...
│
└── shared/          ← Código sin dependencias de entorno (funciones puras, tipos, constantes)
    ├── constants.ts
    ├── api-types.ts
    ├── utils.ts
    ├── utils/
    │   ├── date.ts
    │   └── form-validator.ts
    ├── mappers/
    │   ├── gess-mapper.ts
    │   ├── gess.ts
    │   └── reserva.ts
    └── planos/
        ├── registry.ts
        └── gess/
```

## Marcadores de seguridad

Cada archivo en `server/` debe empezar con:
```ts
import 'server-only';
```

Cada archivo en `client/` debe empezar con:
```ts
import 'client-only';
```

El compilador **rechazará** cualquier intento de importar un archivo con `server-only` desde un Client Component, y viceversa.

## Cómo clasificar una nueva utilidad

| Si la función usa... | Va en... |
|---|---|
| `prisma`, `NextResponse`, `jose`, `process.env` (sin NEXT_PUBLIC), `fs`, `cookies()` | `src/lib/server/` |
| `localStorage`, `window`, `document`, `IndexedDB`, `navigator`, `fetch` (cliente) | `src/lib/client/` |
| Solo tipos, constantes, formateo, validación pura — sin APIs de entorno | `src/lib/shared/` |
| `process.env.NEXT_PUBLIC_*` | `src/lib/shared/` o `src/lib/client/` |

## Qué capas puede importar cada capa

```
Frontend (components/pages/hooks)
  ├── ✅ src/lib/client/
  ├── ✅ src/lib/shared/
  ├── ❌ src/lib/server/
  ├── ❌ src/application/
  ├── ❌ src/infrastructure/
  └── ❌ src/domain/

Backend (controllers/application/infrastructure)
  ├── ✅ src/lib/server/
  ├── ✅ src/lib/shared/
  ├── ✅ src/domain/
  ├── ❌ src/lib/client/
  └── ❌ src/components/
```

## Verificacion

```bash
# Buscar imports prohibidos (frontend importando server)
rg "from ['\"]@/lib/server" src/components/ src/app/ src/hooks/ src/contexts/

# Buscar imports prohibidos (backend importando client)
rg "from ['\"]@/lib/client" src/controllers/ src/application/ src/infrastructure/
```

## UI Rules

- **Nunca usar `window.confirm()`** para confirmar eliminaciones. Usar un `<Dialog>` de confirmacion con botones Cancelar/Eliminar.
- **Nunca usar `alert()`**. Usar `toast` de `sonner` para notificaciones.
