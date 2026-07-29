---
name: api-design-patterns
description: Diseño de APIs REST/route handlers para Next.js (App Router). Define los patrones obligatorios: Arquitectura Hexagonal (Ports & Adapters) en backend, Fachada de Servicios API en frontend, DTO/Mapper (snake_case ↔ camelCase) con un archivo por request/response (SOLID), constantes para validación (nunca strings hardcodeados), Zod validation en backend. Cargar SIEMPRE al crear o modificar servicios, endpoints o mappers.
---

# Patrones de API y Servicios (obligatorio)

## 1. Arquitectura Hexagonal (Ports & Adapters) — Backend

**El dominio (reglas de negocio) es independiente del framework, ORM o protocolo HTTP.**

```
src/
├── domain/                    ← Núcleo puro (sin dependencias externas)
│   ├── models/entities.ts     ← Entidades de dominio (interfaces TS puras)
│   └── ports/                 ← Interfaces (contratos)
│       ├── evento-repository.ts   ← IEventoRepository
│       ├── gess-repository.ts     ← IGessRepository
│       └── role-repository.ts     ← IRoleRepository
│
├── application/               ← Casos de uso (orquestan lógica de negocio)
│   └── eventos/evento-service.ts  ← EventoApplicationService(repo)
│
├── infrastructure/            ← Adaptadores concretos
│   └── persistence/           ← Implementaciones Prisma de los puertos
│       ├── evento-repository.ts   ← EventoPrismaRepository implements IEventoRepository
│       ├── gess-repository.ts
│       └── role-repository.ts
│
├── lib/services.ts            ← DI container (wiring manual)
│
└── app/api/**/route.ts        ← Route handlers (solo HTTP, delegan a application)
```

**Reglas:**
- El dominio **NUNCA** importa de Prisma, Next.js, o cualquier framework.
- Los puertos son **interfaces puras** — definen QUÉ, no CÓMO.
- La infraestructura **implementa** los puertos usando Prisma.
- La aplicación recibe los puertos por **inyección de dependencias** (constructor).
- Las API routes solo parsean request/response, toda la lógica está en `application/`.

```ts
// ✅ Correcto — route handler delega al servicio de aplicación
export async function GET() {
  return NextResponse.json(await services.eventos.listarPresala());
}

// ❌ Prohibido — lógica de negocio en el route handler
export async function GET() {
  const rows = await prisma.evento.findMany({ ... });
  return NextResponse.json(rows.map(r => ({ ... })));
}
```

## 2. DTO — Un archivo por request/response (SOLID)

**Cada DTO vive en su propio archivo, organizado por dominio. Nunca un solo archivo con todos los DTOs.**

```
src/types/dto/
├── auth/
│   ├── login-request.dto.ts        ← LoginRequestDTO
│   ├── login-response.dto.ts       ← LoginResponseDTO
│   ├── session.dto.ts              ← SessionDTO
│   └── seleccionar-evento-request.dto.ts
├── eventos/
│   ├── presala.dto.ts              ← EventoPresalaDTO + EventoPadrePresalaDTO
│   └── create-evento-request.dto.ts
├── gess/
│   ├── gess-stand.dto.ts           ← GessStandDTO
│   └── sync-result.dto.ts          ← GessSyncResultDTO
├── roles/
│   └── user-role.dto.ts
└── models.ts                       ← Re-exports para backward compatibility
```

**Reglas:**
- Un archivo = un DTO (Single Responsibility).
- Los DTOs usan **snake_case** (forma exacta del backend).
- Barrel `index.ts` por dominio para importar todos juntos.
- El archivo `models.ts` solo hace `export type { ... } from "./auth"`.

```ts
// ✅ Correcto — import desde barrel del dominio
import type { LoginRequestDTO, SessionDTO } from "@/types/dto/auth";

// ❌ Prohibido — mega-archivo con todos los DTOs
import type { LoginRequestDTO, ..., UserRoleDTO } from "@/types/dto/models";
```

## 3. Mapper (Adapter Pattern)

**Los DTOs (snake_case) NUNCA se usan directamente en componentes. Se mapean a modelos de dominio (camelCase).**

```ts
// src/lib/mappers/gess-mapper.ts
import type { GessStandDTO } from "@/types/dto/gess";

export function mapGessStandFromDTO(dto: GessStandDTO): GessStandDomain {
  return {
    id: dto.id,
    standCode: dto.stand_code,     // snake → camel
    tipoStand: dto.tipo_stand,
    // ...
  };
}
```

**Reglas:**
- El mapper es una **función pura** (sin efectos secundarios).
- Se invoca en el **componente o servicio cliente**, no en el backend.
- Si el backend cambia un campo, solo se toca el DTO y el mapper.

## 4. Service Pattern — Frontend

**Ningún componente hace `fetch()` directo.** Todo pasa por servicios tipados.

```
src/lib/api/services/
├── internal-api.ts          ← Fetch wrapper genérico (get/post/patch/delete)
├── auth-service.ts          ← authService.login(), logout(), getSession()
├── eventos-service.ts       ← eventosServiceClient.listPresala(), create(), patch()
├── gess-service.ts          ← gessService.list(), vincular(), sync()
└── roles-service.ts         ← rolesService.addUser(), removeUser(), updatePermisos()
```

```ts
// ✅ Correcto — componente usa servicio tipado
import { authService } from "@/lib/api/services/auth-service";
const session = await authService.getSession();

// ❌ Prohibido — fetch directo en componente
const res = await fetch("/api/auth/session");
const session = await res.json();
```

## 5. Constantes (fuente única de verdad)

**NUNCA usar strings hardcodeados para validaciones, estados, roles, áreas o tipos de comprobante.**

Ver regla `constants-first` para el detalle completo.

## 6. Checklist antes de entregar

- [ ] Backend: lógica en `application/`, no en route handlers.
- [ ] Backend: adaptadores en `infrastructure/`, puertos en `domain/ports/`.
- [ ] DTOs: un archivo por request/response, organizado por dominio.
- [ ] Mapper: DTO (snake_case) → dominio (camelCase) via función pura.
- [ ] Frontend: componentes usan servicios tipados, nunca `fetch()` directo.
- [ ] Constantes: validaciones desde `@/lib/constants`, nunca strings sueltos.
- [ ] Tipado estricto: sin `any`, sin `Record<string, unknown>` como tipo final.
