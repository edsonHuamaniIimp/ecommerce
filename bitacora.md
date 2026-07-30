# Bitácora — ContratosStands

> Fuente de contexto para sesiones de desarrollo.  
> Fecha de última actualización: 2026-07-30

---

## 1. Objetivo del Proyecto

Sistema multi-evento para **reserva de stands del IIMP** con:
- **Plano 3D isométrico interactivo** (Three.js + React Three Fiber)
- **Vinculación de datos** desde API externo KBEventos (GeneXus → REST)
- **Autenticación JWT** con roles y permisos
- **Dashboard** con KPIs reales
- **Gestión documental** por stand (contratos, imágenes)
- **Arquitectura Hexagonal** en backend + **Service/DTO/Mapper** en frontend

**Cliente:** IIMP — John Morón (facturación/SAP), Edson Huamani (desarrollo web)  
**Contexto de negocio:** El IIMP maneja eventos como PERUMIN, GESS, ProExplo, World Mining.  
Cada evento tiene un plano con stands. Las empresas reservan stands y se genera facturación en SAP.

---

## 2. Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16.2.10 (App Router, Turbopack) |
| Runtime | React 19.2.4, TypeScript |
| Estilos | Tailwind v4 + `@nrivera-iimp/ui-kit-iimp` (shadcn/ui) |
| 3D | Three.js + `@react-three/fiber` 9.6 + `@react-three/drei` 10.7 |
| Base de datos | PostgreSQL 16 (Docker) |
| ORM | Prisma 7.8.0 (`@prisma/client`, `@prisma/adapter-pg`) |
| Autenticación | JWT con `jose` 6.2 |
| Auth0 | `@auth0/nextjs-auth0` 4.25 (instalado, integración futura) |
| Formularios | `react-hook-form` 7.81 |
| Notificaciones | `sonner` 2.0 |
| Gráficos | `recharts` 3.9 |
| Utilidades | `clsx`, `framer-motion`, `next-themes`, `tailwind-merge` |

---

## 3. Arquitectura

### Backend — Hexagonal (Ports & Adapters)

```
src/
  domain/          → Entidades + interfaces (puertos)
  application/     → Casos de uso (servicios de aplicación)
  infrastructure/  → Adaptadores (Prisma, APIs externas)
  lib/services.ts  → Contenedor DI (singleton)
```

### Frontend — Service Layer + DTO + Mapper

```
src/lib/api/services/   → Servicios API tipados (internal-api.ts, gess-service.ts, etc.)
src/types/dto/           → DTOs: un archivo por request/response (SOLID)
src/lib/mappers/         → snake_case ↔ camelCase
src/lib/constants.ts     → Constantes tipadas (estados, permisos, roles, verticales)
src/lib/utils/           → Utilidades singleton (formateo, parseo, validación)
src/lib/storage.ts       → Adaptador de almacenamiento (local/S3)
src/components/shared/   → Componentes reutilizables (Pagination, etc.)
```

### Convenciones

- **URLs API estilo RPC:** `/api/eventos/listar`, `/api/eventos/crear`, `/api/eventos/actualizar`
- **Paginación server-side:** genérica en `src/lib/pagination.ts`
- **Nunca strings hardcodeados:** usar constantes de `src/lib/constants.ts`
- **DTOs por dominio:** `src/types/dto/auth/`, `eventos/`, `gess/`, `pagination/`
- **Reglas obligatorias** en `.opencode/reglas/` — cargar on-demand con la tool `skill`

---

## 4. Base de Datos (14 tablas)

### Maestras
| Tabla | Descripción |
|-------|------------|
| `evento_padre` | Vertical de evento (PERUMIN, GESS, ProExplo, WMC) |
| `evento` | Versión de evento (`tipo_evento`, `codigo_evento`, año, fechas, plano) |
| `tipo_stand` | Tipos de stand por evento (nombre, medidas, monto) |
| `contrato_plantilla` | Plantillas de contrato por tipo de stand |
| `role` | Roles con array de permisos |
| `user_role` | Usuarios con email+password, FK a role |

### Transaccionales
| Tabla | Descripción |
|-------|------------|
| `stand` | Stand genérico (número, monto, estado, cámara) |
| `plano_posicion` | Posición X,Y de un stand en el plano |
| `gess_stand` | Stand del plano GESS vinculado desde API externo (documentos, imágenes como JSON) |

### Reservas (flujo completo)
| Tabla | Descripción |
|-------|------------|
| `reserva` | Cabecera (empresa, tipo comprobante, datos facturación, responsable pago, estado) |
| `reserva_stand` | Detalle: stands seleccionados con montos |
| `cuota` | Plan de pagos (número, porcentaje, monto, fecha) |
| `aprobacion` | Aprobaciones por área (legal, logística, eventos) |
| `interop_facturacion` | Integración con SAP (orden venta, comprobante) |

### Auditoría
| Tabla | Descripción |
|-------|------------|
| `audit_log` | Log genérico (tipo, entidad, actor, mensaje, metadata) |

---

## 5. API Endpoints

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/auth/login` | POST | Login con email+password, devuelve JWT |
| `/api/auth/logout` | POST | Logout (limpia cookie) |
| `/api/auth/me` | GET | Perfil del usuario autenticado |
| `/api/eventos/listar` | GET | Listar eventos (filtros: flgActivo, flgVisible, fechas) |
| `/api/eventos/crear` | POST | Crear versión de evento |
| `/api/eventos/actualizar` | PUT | Actualizar evento |
| `/api/eventos/[id]` | PATCH | Toggle flgVisible / flgActivo |
| `/api/gess/listar` | GET | Listar stands GESS vinculados (paginado) |
| `/api/gess/all` | GET | Todos los stands GESS (sin paginación, para vinculación) |
| `/api/gess/vincular` | POST | Vincular stand API externo ↔ bloque 3D |
| `/api/gess/sync` | POST | Sincronizar desde API externo KBEventos |
| `/api/planogess` | GET | Proxy al API externo KBEventos |
| `/api/roles/listar` | GET | Listar roles con permisos |
| `/api/roles/crear` | POST | Crear rol |
| `/api/roles/actualizar` | PUT | Actualizar permisos de rol |
| `/api/upload` | POST | Subir archivo (documento/imagen) para stand |

---

## 6. Páginas y Rutas

### Público (sin login)
| Ruta | Descripción |
|------|-------------|
| `/presala` | Selector de versión de evento → redirige a `/plano` |
| `/plano` | Plano 3D isométrico interactivo |
| `/plano-grid` | Grid de stands (vista alternativa) |
| `/` (home) | Redirige a `/presala` |
| `/api/auth/*` | Endpoints de autenticación |

### Dashboard (requiere login + rol)
| Ruta | Descripción |
|------|-------------|
| `/dashboard` | KPIs reales desde `gess_stand` (total, reservados, disponibles, monto) |
| `/dashboard/eventos` | CRUD de versiones de evento, selector de plano 3D, toggle flgVisible/Activo |
| `/dashboard/vinculacion` | Importar desde API KBEventos, match con bloques vía Combobox |
| `/dashboard/stands` | Bandeja paginada con búsqueda, subida de documentos/imágenes, preview |
| `/dashboard/datos-evento` | Datos del evento seleccionado |
| `/dashboard/roles` | Gestión de roles/permisos y usuarios (tabs separados) |

### Autenticación
- Middleware global (`src/middleware.ts`) protege rutas `/dashboard/*` y `/api/*` (excepto auth)
- JWT en cookie `token` + localStorage
- Flujo presala: público guarda eventoId en localStorage, autenticado en JWT + localStorage

---

## 7. Plano 3D

### Registry (`src/lib/planos/registry.ts`)
Estructura extensible: cada evento asigna un plano (`evento.plano` en BD).

```
planos/
  registry.ts        → Catálogo PLANOS[id], getPlano(), listPlanos()
  gess/
    bloques.ts       → GESS_BLOQUE_IDS (48 bloques)
    tipos.ts         → Item, BlockType, BLOCK_LABEL, DIMENSIONES
    construccion.ts  → buildItems(), computeBounds(), buildFurniture() (kioskos)
```

**Actualmente solo GESS implementado.** PERUMIN, ProExplo, WMC pendientes de datos del API externo.

### Componente cliente (`src/components/plano/plano-isometrico.tsx`)
- Carga `eventoId` de localStorage/JWT
- Obtiene plano desde registry
- Construye bloques 3D con colores por estado (gris = reservado, verde = disponible)
- `linkedMap` (Map<bloqueId, GessStand>) para info vinculada
- Sidebar con datos de empresa, imágenes en carrusel, documentos clickeables
- Miniaturas de imágenes con lightbox

---

## 8. Flujo de Negocio (de la conversación con John Morón)

### Reserva de stands — proceso completo

1. **Origen de datos:** John envía un Excel con stands (número, tipo, medidas, monto). Lo carga en su sistema GeneXus.
2. **Plano:** API REST de GeneXus expone el plano con coordenadas X,Y y estado de cada stand.
3. **Selección de stand:** El expositor ve el plano 3D, selecciona stand(s), ve tipo y contrato.
4. **Formulario de reserva:** Razón social, RUC, persona de contacto, tipo de comprobante (factura/boleta), número de cuotas, responsable de pago.
5. **Aprobaciones:**
   - **Legal** → revisa contrato
   - **Logística** → homologa la empresa (años activa, emite comprobantes)
   - **Eventos y Asociados** → validan datos, dan "indicar registrado"
6. **Facturación (SAP):** John recibe los datos finales, genera orden de venta → comprobante (factura/boleta). La factura se envía al correo del expositor.
7. **Estados del stand en el plano:** "parcialmente ocupado" (en evaluación) → "reservado" (verde, con nombre de empresa).

### Multi-evento con dos parámetros
John enfatizó usar siempre dos parámetros: `tipoEvento` + `codigoEvento` para identificar unívocamente un evento.  
Modelado como `evento_padre` (vertical) → `evento` (versión).

### API KBEventos
- URLs: `https://secure2.iimp.org:8443/KBEventosPruebas/rest/planogess` (pruebas) / `KBEventos/rest/planogess` (prod)
- Parámetros: `tipoEvento` + `codigoEvento`
- **Actualmente solo tiene datos para PERUMIN (14/1).** GESS, WMC, ProExplo devuelven 404.

---

## 9. Work State

### Completado
- [x] PostgreSQL + Prisma v7.8 con 14 tablas, migración `0001_init`
- [x] Seed con UUIDs generados por Prisma, upsert por clave natural
- [x] 4 roles + 4 usuarios de prueba con contraseñas
- [x] Autenticación JWT: login, middleware, logout
- [x] Presala con grid de versiones, colores por vertical, filtro fechas
- [x] Dashboard con KPIs reales desde `gess_stand`
- [x] Plano 3D isométrico con bloques, colores por estado, sidebar, carrusel
- [x] Vinculación de stands desde API externo con Combobox
- [x] Gestión de stands con paginación server-side, búsqueda, subida archivos
- [x] CRUD de eventos con selector de plano, toggle flgVisible, borrado lógico
- [x] Gestión de roles/permisos con checkboxes, asignación de usuarios
- [x] Plano registry extensible (solo GESS implementado)
- [x] DTOs reorganizados por dominio (auth, eventos, gess, pagination)
- [x] Componente Pagination genérico con elipsis
- [x] Múltiples fixes de bugs (mapper, cache, rutas, estados)

### Pendiente
- [ ] Probar flujo completo end-to-end: login → presala → dashboard → vinculación → stands → plano
- [ ] Plano PERUMIN cuando API KBEventos tenga datos
- [ ] Manejar correctamente `tipoEvento`/`codigoEvento` dinámicos (no hardcodeados 14/1)
- [ ] Auth0 integration (librería instalada, sin usar)
- [ ] Flujo de reservas (modelo de datos listo, UI pendiente)
- [ ] Interop con SAP (tabla `interop_facturacion` lista)
- [ ] Documentación OpenAPI (`docs/openapi.yaml`)
- [ ] Tests

### Bloqueado
- API KBEventos solo tiene PERUMIN. GESS, WMC, ProExplo → 404.
- Hydration warning `cz-shortcut-listen="true"` — extensión ColorZilla (cosmético).

---

## 10. Bugs Resueltos Recientes

| Bug | Causa | Solución |
|-----|-------|----------|
| `flgVisible` no reconocido por Prisma (GessStand) | Caché de Prisma Client | `npx prisma generate` + reinicio |
| `PATCH /api/eventos` 500 | Tipo débil del body (string vs boolean) | Parseo explícito a boolean |
| Loop infinito presala↔plano | Redirección mutua por estado inconsistente | Flujo unidireccional: presala selecciona → guarda en localStorage → redirige a plano |
| Mapper snake_case/camelCase inconsistente | Nombres de campo distintos entre BD y DTO | Revisión y normalización de mappers |

---

## 11. Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `prisma/schema.prisma` | 14 modelos con índices y constraints |
| `prisma/seed.ts` | Datos de prueba (roles, usuarios, eventos) |
| `src/lib/constants.ts` | Constantes tipadas (estados, permisos, roles, ÁREAS, VERTICALES) |
| `src/lib/services.ts` | Contenedor DI (singleton) |
| `src/lib/api/services/internal-api.ts` | Fetch wrapper tipado para APIs internas |
| `src/lib/api/services/gess-service.ts` | Servicio GESS (listar, vincular, sync) |
| `src/lib/planos/registry.ts` | Catálogo extensible de planos |
| `src/lib/planos/gess/` | Plano GESS (bloques, tipos, construcción, muebles) |
| `src/lib/storage.ts` | Adaptador de almacenamiento local/S3 |
| `src/lib/pagination.ts` | Utilidad genérica de paginación server-side |
| `src/lib/auth.ts` | Lógica JWT (sign, verify, hash, compare) |
| `src/lib/mappers/` | Convertidores snake_case ↔ camelCase |
| `src/types/dto/` | DTOs un archivo por request/response |
| `src/components/shared/pagination.tsx` | Componente Pagination reutilizable |
| `src/components/plano/plano-isometrico.tsx` | Componente 3D principal |
| `src/middleware.ts` | Protección JWT de rutas |
| `docker-compose.yml` | PostgreSQL 16 local |
| `AGENTS.md` | Reglas y skills del proyecto |
| `.env.example` | Variables de entorno documentadas |
| `conversacionequipotecnico.md` | Transcripción de la reunión con John Morón |

---

## 12. Comandos Útiles

```bash
npm run dev              # Next.js dev (Turbopack)
npm run build            # Build producción
npm run lint             # ESLint
npm run db:migrate       # prisma migrate dev
npm run db:migrate:deploy # prisma migrate deploy
npm run db:seed          # tsx prisma/seed.ts
npm run db:studio        # prisma studio
npm run db:generate      # prisma generate
npm run db:push          # prisma db push
```

### Docker PostgreSQL
```bash
docker compose up -d     # Levantar PostgreSQL 16
docker compose down      # Detener
```

### Variables de entorno clave (`.env`)
```
DATABASE_URL=postgresql://ctrst:ctrst_dev@localhost:5432/contratos_stands
PLANOGESS_API_URL=https://secure2.iimp.org:8443/KBEventosPruebas/rest/planogess
JWT_SECRET=dev-secret-cambiar-en-produccion
STORAGE_PROVIDER=local
NEXT_PUBLIC_API_MOCK=1
```

---

## 13. Notas para Próximas Sesiones

1. **No hacer commits/push sin autorización explícita.**
2. **API KBEventos:** `tipoEvento=14, codigoEvento=1` es PERUMIN. Para otros eventos (GESS, ProExplo, WMC), preguntar a John cuándo estarán disponibles en la API.
3. **Regla de oro:** cargar skills/reglas de `.opencode/` solo cuando apliquen a la tarea, no "por si acaso".
4. **Arquitectura Hexagonal:** al tocar backend, cargar `api-design-patterns`.
5. **UI:** al tocar componentes o páginas, cargar `iimp-ui-kit`.
6. **BD:** al tocar schema/migraciones, cargar `lineamientos-bd`.
7. **Constantes:** SIEMPRE usar `src/lib/constants.ts`, nunca strings hardcodeados.
8. **Plano registry:** para agregar un nuevo plano, seguir el patrón de `src/lib/planos/gess/` y registrarlo en `registry.ts`.
9. **El documento `conversacionequipotecnico.md`** contiene la transcripción completa de la reunión con John Morón — es la fuente de verdad del negocio.
