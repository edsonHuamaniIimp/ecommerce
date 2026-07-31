---
name: api-design-patterns
description: Diseño de APIs REST/route handlers para Next.js (App Router). Define los patrones obligatorios: Arquitectura Hexagonal (Ports & Adapters) en backend, Capa de Controladores separada de rutas, Zod validation, DTOs explícitos de request/response por entidad, handler() wrapper global de errores, Fachada de Servicios API en frontend, Mapper (snake_case ↔ camelCase), constantes para validación (nunca strings hardcodeados). Cargar SIEMPRE al crear o modificar servicios, endpoints o mappers.
---

# Patrones de API y Servicios (obligatorio)

## 0. Estructura completa de capas

```
src/
├── domain/                    ← Núcleo puro (sin dependencias externas)
│   ├── models/entities.ts     ← Entidades de dominio (interfaces TS puras)
│   └── ports/                 ← Interfaces (contratos)
│       ├── evento-repository.ts
│       ├── gess-repository.ts
│       ├── role-repository.ts
│       ├── kbservicios-client.ts   ← Puertos para APIs externas
│       └── planogess-client.ts
│
├── application/               ← Casos de uso (orquestan lógica de negocio)
│   ├── eventos/evento-service.ts
│   ├── eventos/presala-service.ts
│   ├── gess/gess-service.ts
│   └── reservas/reserva-service.ts
│
├── infrastructure/            ← Adaptadores concretos
│   ├── persistence/           ← Implementaciones Prisma de los puertos
│   └── external/              ← Clientes HTTP para APIs externas
│       ├── kbservicios-client.ts
│       └── planogess-client.ts
│
├── controllers/               ← Capa Controlador (HTTP concern)
│   └── eventos.controller.ts  ← Un controller por entidad
│
├── validators/                ← Zod schemas (validación de request)
│   └── eventos.validator.ts
│
├── lib/
│   ├── services.ts            ← DI container (wiring manual)
│   ├── api-response.ts        ← ApiResponse<T>, ApiErrorResponse, success(), error()
│   ├── handlers.ts            ← handler() wrapper global de errores
│   └── router.ts              ← createRouter() — enrutador declarativo
│
├── types/dto/                 ← DTOs: un archivo por request/response (SOLID)
│   ├── eventos/
│   │   ├── presala.dto.ts
│   │   ├── create-evento-request.dto.ts
│   │   ├── update-evento-request.dto.ts
│   │   └── eventos-response.dto.ts  ← Tipos explícitos de respuesta por endpoint
│   ├── auth/
│   │   ├── login-request.dto.ts
│   │   ├── login-response.dto.ts
│   │   ├── session.dto.ts
│   │   └── auth-response.dto.ts
│   └── ...
│
└── app/api/                   ← Capa de Routing (solo wiring declarativo)
    └── auth/[...slug]/route.ts ← createRouter({ GET: {...}, POST: {...} })
```

## 1. Capa de Routing — `createRouter()` (Obligatorio)

**Todas las rutas usan el helper `createRouter()` de `lib/router.ts`. El archivo `route.ts` es 100% declarativo: un objeto que mapea paths a métodos del controller. Sin lógica, sin if/else, sin try/catch, sin dispatch manual.**

### 1.1 El Router Helper (`lib/router.ts`)

```ts
import { NextResponse } from "next/server";

type RouteFn = (req: Request) => Promise<NextResponse> | NextResponse;
type RouteMap = Record<string, RouteFn>;

interface RouterConfig {
  GET?: RouteMap;
  POST?: RouteMap;
  PATCH?: RouteMap;
  PUT?: RouteMap;
  DELETE?: RouteMap;
}

export function createRouter(config: RouterConfig) {
  const exports: Record<string, Function> = {};

  for (const [method, routes] of Object.entries(config)) {
    exports[method] = async (req: Request, context?: { params: Promise<{ slug: string[] }> }) => {
      const params = await context?.params;
      const path = params?.slug?.join("/") ?? "";
      const action = routes[path];

      if (!action) {
        return NextResponse.json(
          { error: `Endpoint '${method} /${path}' no encontrado` },
          { status: 404 }
        );
      }

      try {
        const result = action(req);
        return result instanceof NextResponse ? result : await result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error interno";
        return NextResponse.json(
          { success: false, error: { code: "INTERNAL", message } },
          { status: 500 }
        );
      }
    };
  }

  return exports;
}
```

### 1.2 Uso en el Route File

**El archivo de ruta es un objeto declarativo. Equivalente a `routes/api.php` de Laravel.**

```ts
// app/api/auth/[...slug]/route.ts
import { createRouter } from "@/lib/router";
import { authController } from "@/controllers/auth.controller";

export const { GET, POST, PATCH } = createRouter({
  GET: {
    session: () => authController.session(),
    perfil: (req) => authController.getPerfil(req),
  },
  POST: {
    login: (req) => authController.login(req),
    logout: () => authController.logout(),
    "seleccionar-evento": (req) => authController.seleccionarEvento(req),
    "reset-password": (req) => authController.requestReset(req),
    "reset-password/confirm": (req) => authController.confirmReset(req),
  },
  PATCH: {
    perfil: (req) => authController.updatePerfil(req),
  },
});
```

**URLs resultantes:**
| Método | URL | Controller |
|--------|-----|-----------|
| GET | `/api/auth/session` | `authController.session()` |
| GET | `/api/auth/perfil` | `authController.getPerfil(req)` |
| POST | `/api/auth/login` | `authController.login(req)` |
| POST | `/api/auth/logout` | `authController.logout()` |
| POST | `/api/auth/seleccionar-evento` | `authController.seleccionarEvento(req)` |
| POST | `/api/auth/reset-password` | `authController.requestReset(req)` |
| POST | `/api/auth/reset-password/confirm` | `authController.confirmReset(req)` |
| PATCH | `/api/auth/perfil` | `authController.updatePerfil(req)` |

### 1.3 Reglas Universales de Routing

1. **Una entidad = un archivo** `app/api/<entidad>/[...slug]/route.ts`.
2. **Nunca subcarpetas por operación** (`login/route.ts`, `logout/route.ts`). Todo en un solo `[...slug]`.
3. **Nunca `?action=` query params**. Cada operación tiene su propio path (`/login`, `/logout`).
4. **Nunca if/else ni switch en el route file**. El mapeo es un objeto declarativo.
5. **Nunca try/catch en el route file**. `createRouter()` lo maneja globalmente.
6. **Nunca `handler()` manual en el route file**. `createRouter()` ya incluye el error handler.
7. El controller **solo tiene métodos de negocio** (`login`, `listar`, `crear`). No tiene métodos `routeGet`, `routePost`, `handleGet`, `handlePost`.

## 2. Capa Controlador (`controllers/`)

**Un controlador por entidad. Su única responsabilidad es: parsear Request → DTO → llamar al servicio → retornar response.**

### 2.1 Estructura obligatoria

```ts
import { NextResponse } from "next/server";
import { services } from "@/lib/services";
import { success, error } from "@/lib/api-response";
import { API_ERROR_CODES } from "@/lib/constants";
import type { LoginRequestDTO } from "@/types/dto/auth/login-request.dto";
import type { LoginResult } from "@/types/dto/auth/login-result.dto";

export const authController = {
  /** @request LoginRequestDTO */
  async login(request: Request): Promise<NextResponse> {
    const dto: LoginRequestDTO = await request.json();
    const result: LoginResult = await services.auth.login(dto);

    if ("error" in result) {
      return error(API_ERROR_CODES.UNAUTHORIZED, result.error, 401);
    }
    return success(result);
  },
};
```

### 2.2 Reglas universales

1. **Request siempre es `Request` nativo.** Es la interfaz del framework Next.js. No se puede cambiar.
2. **Contrato de entrada documentado con JSDoc `@request`.** Indica qué DTO espera el método.
3. **Primera línea: `const dto: TipoDTO = await request.json()`.** Fuerza el tipado del request.
4. **Contrato de salida: `const result: TipoResult = await services.xxx(dto)`.** El tipo viaja desde el servicio.
5. **Retorno: `success(data)` o `error(code, msg, status)`. Nunca `NextResponse.json()` directo.**
6. **Retorno tipado: `Promise<NextResponse>`.** El `Request` y `NextResponse` son tipos del framework.
7. **Nunca `prisma`, `signToken`, `sendEmail`, `fetch` en el controlador.** Solo llama a `services`.
8. **Nunca try/catch.** El manejo de errores está en `createRouter()`.
9. **DTOs en archivos separados:** un archivo por interfaz. El nombre del archivo = nombre de la interfaz (`login-request.dto.ts` → `LoginRequestDTO`).
10. **DTOs de request vs result separados:** `login-request.dto.ts` (entrada) ≠ `login-result.dto.ts` (salida del servicio).

## 3. Zod Validation (`validators/`)

**Un archivo por entidad con los schemas de validación. Equivalente a FormRequest de Laravel o @Valid de Spring Boot.**

```ts
import { z } from "zod";

export const createEventoSchema = z.object({
  evento_padre_id: z.string().min(1),
  anio: z.string().min(1),
  fecha_inicio: z.string().optional(),
  fecha_fin: z.string().optional(),
});

export type CreateEventoInput = z.infer<typeof createEventoSchema>;
```

**Reglas:**
- Usa `schema.parse(raw)` en el controlador. Si falla, `handler()` captura `ZodError` → 400 automático.
- Los tipos se infieren con `z.infer<>`. Nunca se declaran manualmente.
- Campos requeridos usan `.min(1)`, opcionales usan `.optional()`.

## 4. DTOs de Request/Response explícitos por entidad

**Cada entidad tiene response DTOs que definen el tipo exacto de cada endpoint.**

```
src/types/dto/eventos/
├── presala.dto.ts                 ← EventoPresalaDTO, EventoPadrePresalaDTO
├── create-evento-request.dto.ts   ← CreateEventoRequestDTO
├── update-evento-request.dto.ts   ← UpdateEventoRequestDTO
└── eventos-response.dto.ts        ← Tipos de respuesta por endpoint
    ├── EventosListResponse = ApiResponse<EventoEntity[]>
    ├── EventosPresalaResponse = ApiResponse<EventoPadrePresalaDTO[]>
    ├── EventoDetalleResponse = ApiResponse<EventoEntity | null>
    ├── EventoCreateResponse = ApiResponse<EventoEntity>
    └── EventoUpdateResponse = ApiResponse<EventoEntity>
```

**Reglas:**
- El envelope `ApiResponse<T>` es genérico (igual para todos).
- Cada endpoint tiene su tipo explícito: `ApiResponse<MiDTO>`.
- Los DTOs internos usan snake_case (forma exacta del JSON).
- Barrel `index.ts` re-exporta todos los tipos del dominio.
- El controlador retorna `Promise<NextResponse<MiResponseDTO>>`.

## 5. Response Helpers (`api-response.ts`)

```ts
import { API_ERROR_CODES } from "@/lib/constants";

// Éxito
export function success<T>(data: T, init?: ResponseInit): NextResponse<ApiResponse<T>>

// Error tipado
export function error(code: ApiErrorCode, message: string, status: number): NextResponse<ApiErrorResponse>
```

**Códigos de error** (constantes, nunca strings):
```ts
export const API_ERROR_CODES = {
  VALIDATION: "VALIDATION",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
  INTERNAL: "INTERNAL",
  BAD_GATEWAY: "BAD_GATEWAY",
} as const;
```

## 6. Global Error Handler (`handlers.ts`)

**Wrapper que elimina todos los try/catch de los controladores. Equivalente a Handler.php de Laravel o @ControllerAdvice de Spring Boot.**

```ts
export function handler(fn: (req: Request) => Promise<NextResponse>): NextRouteHandler {
  return async (req) => {
    try {
      return await fn(req);
    } catch (err) {
      if (err instanceof ZodError) {
        return error(VALIDATION, err.issues.map(...).join("; "), 400);
      }
      return error(INTERNAL, err.message, 500);
    }
  };
}
```

## 7. Arquitectura Hexagonal (Ports & Adapters)

**El dominio es independiente del framework, ORM o protocolo HTTP.**

- El dominio **NUNCA** importa de Prisma, Next.js, o cualquier framework.
- Los puertos son **interfaces puras** — definen QUÉ, no CÓMO.
- La infraestructura **implementa** los puertos.
- La aplicación recibe los puertos por **inyección de dependencias** (constructor).
- `lib/services.ts` es el **DI container** — instancia y cablea todo.

## 8. Service Pattern — Frontend

**Ningún componente hace `fetch()` directo.** Todo pasa por servicios tipados en `src/lib/api/services/`.

## 9. Checklist antes de entregar

- [ ] Routing: `[...slug]/route.ts` usa `createRouter()` con objeto declarativo, sin lógica.
- [ ] Routing: una sola carpeta `[...slug]` por entidad, sin subcarpetas por operación.
- [ ] Routing: paths REST limpios (`/auth/login`, `/auth/logout`), sin `?action=`.
- [ ] Controller: solo métodos de negocio, sin `routeGet`/`routePost`/`handleGet`/dispatch.
- [ ] Zod: schemas en `validators/`, `.parse()` en controller.
- [ ] DTOs: request + response por entidad, tipos explícitos por endpoint.
- [ ] Response: `success()` y `error()` con `ApiErrorCode`, nunca `NextResponse.json()` directo.
- [ ] Backend: lógica en `application/`, puertos en `domain/ports/`, adaptadores en `infrastructure/`.
- [ ] DI: `lib/services.ts` cablea todo.
- [ ] Constantes: `API_ERROR_CODES`, `ESTADOS_STAND`, nunca strings sueltos.
- [ ] Frontend: servicios tipados, nunca `fetch()` directo.
