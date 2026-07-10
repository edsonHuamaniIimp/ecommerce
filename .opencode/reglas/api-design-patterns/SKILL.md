---
name: api-design-patterns
description: Diseño de APIs REST/route handlers para Next.js (App Router). Define los patrones obligatorios: Fachada de Servicios API, DTO/Mapper (snake_case ↔ camelCase), constantes para validación (nunca strings hardcodeados), Zod validation en backend, y estructura de módulos. Cargar SIEMPRE al crear o modificar servicios, endpoints o mappers.
---

# Patrones de API y Servicios (obligatorio)

## 1. Regla de constantes (fuente única de verdad)

**NUNCA usar strings hardcodeados para validaciones, estados, roles, áreas o tipos de comprobante.**

```ts
// ❌ prohibido — string suelto, sin trazabilidad
if (estado === "en_aprobacion") { ... }
if (evento.estado === "active") { ... }
{ area: "logistica", estado: "aprobado" }

// ✅ correcto — desde el único archivo de constantes
import { ESTADOS_RESERVA, ESTADOS_EVENTO, AREAS_APROBACION, RESULTADOS_APROBACION } from "@/lib/constants";

if (estado === ESTADOS_RESERVA.EN_APROBACION) { ... }
if (evento.estado === ESTADOS_EVENTO.ACTIVE) { ... }
{ area: AREAS_APROBACION.LOGISTICA, estado: RESULTADOS_APROBACION.APROBADO }
```

El archivo `src/lib/constants.ts` es la **fuente única** para frontend y backend.
Contiene objetos `as const` con todas las categorías de valores fijos del sistema
(verticales, estados de stand, estados de reserva, tipos de comprobante, áreas de
aprobación, monedas, etc.). Los tipos (`EstadoReserva`, `TipoComprobante`, etc.) se
**derivan** de estas constantes, no se redeclaran con strings literales.

## 2. Fachada de Servicios API (API Service Pattern)

**Ningún componente o página debe hacer `fetch`/`axios` directo.** Toda llamada HTTP
se centraliza en servicios, y todos los servicios se consumen desde una única fachada:

```
src/lib/api/
├── client.ts              ← Cliente HTTP base (get/post, auth, errores)
├── config.ts              ← Config (base URL, ApiError)
├── services/
│   ├── types.ts           ← Interfaces de servicio (contrato)
│   ├── mock.ts            ← Implementación mock (datos de prueba)
│   ├── http.ts            ← Implementación HTTP real (via client)
│   ├── mock-data.ts       ← Datos mock en formato DTO
│   └── facade.ts          ← Fachada: elige mock vs real según env
└── (no hay fetch en componentes, solo importan la facade)
```

**Cómo consumir desde un componente/página:**

```ts
// ✅ Componente servidor (async)
import { reservasService } from "@/lib/api/services/facade";
const reservas = await reservasService.list(eventoId);

// ✅ Componente cliente (evento)
import { reservasService } from "@/lib/api/services/facade";
const nueva = await reservasService.create(input);
```

La fachada (`facade.ts`) decide automáticamente si usar mock o HTTP real
(controlado por `NEXT_PUBLIC_API_MOCK`). Los componentes **nunca** saben cuál están
usando; solo importan `{ xService } from .../facade`.

## 3. DTO + Mapper (separación request/response del modelo de dominio)

**Los DTOs reflejan exactamente la forma del backend (snake_case). Los modelos de
dominio son la forma en que trabaja el frontend (camelCase).**

```
src/types/
├── dto/models.ts       ← interfaces DTO (snake_case, forma exacta del backend)
└── reserva.ts          ← modelos de dominio (camelCase, limpios para la UI)

src/lib/mappers/
└── reserva.ts          ← funciones puras: DTO ↔ modelo de dominio
```

**Reglas:**
- Los DTOs **nunca** se usan directamente en componentes/páginas.
- Los mappers son **funciones puras** (`dto => domain`, `input => dto`), sin efectos
  secundarios ni dependencias externas.
- El mapper se invoca **dentro del servicio** (mock o HTTP), no en el componente.
- Si el backend cambia un campo (ej. `created_at` → `fecha_creacion`), solo se toca
  el DTO y el mapper, nunca los componentes.

```ts
// Flujo correcto:
// 1. Servicio obtiene DTO del backend (o mock-data)
const dto: ReservaDTO = await fetchFromBackend();
// 2. Servicio mapea a modelo de dominio
const reserva: Reserva = mapReserva(dto);
// 3. Componente recibe modelo de dominio listo para usar
return <ReservaCard reserva={reserva} />;
```

## 4. Tipo de endpoints soportados (Next.js Route Handlers)

- **GET** → endpoints de consulta (listar, obtener por ID).
- **POST** → endpoints de creación (reservas, aprobaciones, callback de interop).

Todos los endpoints se documentan en `docs/openapi.yaml` (Swagger/OpenAPI 3.0),
que es la **fuente de verdad del contrato**.

## 5. Checklist antes de entregar un servicio

- [ ] No hay strings hardcodeados para validaciones/estados → todo usa `@/lib/constants`.
- [ ] El componente/página importa de `.../facade`, no hace fetch directo.
- [ ] Los DTOs están en `src/types/dto/` (snake_case), los modelos en `src/types/` (camelCase).
- [ ] El mapper es una función pura que transforma DTO ↔ modelo.
- [ ] El mapper se invoca **en el servicio**, nunca en el componente.
- [ ] Los tipos derivan de las constantes (`typeof ESTADOS_RESERVA`), no de literales string.
