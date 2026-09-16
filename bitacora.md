# Bitácora — ContratosStands

> Fuente de contexto para sesiones de desarrollo.  
> Fecha de última actualización: 2026-08-03
> Flujos detallados: [`docs/flujos.md`](docs/flujos.md)

---

## 1. Objetivo del Proyecto

Sistema multi-evento para **reserva de stands del IIMP** con:
- **Plano 3D isométrico interactivo** (Three.js + React Three Fiber)
- **Vinculación de datos** desde API externo KBEventos (GeneXus → REST)
- **Autenticación JWT** con roles y permisos
- **Dashboard** con KPIs reales
- **Gestión documental** por stand (contratos, imágenes)
- **Flujo de revisión por áreas** (Comunicación, Legal, Logística)
- **Notificaciones por correo** (Resend)
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
| Email | Resend API (`src/lib/email.ts`) |
| Editor WYSIWYG | `react-quill-new` (notificaciones personalizadas) |
| Formularios | `react-hook-form` 7.81 |
| Notificaciones | `sonner` 2.0 (toasts), `@nrivera-iimp/ui-kit-iimp` (Toaster) |
| Gráficos | `recharts` 3.9 |
| Utilidades | `clsx`, `framer-motion`, `next-themes`, `tailwind-merge` |
| IndexedDB | `idb` 8.0 (borradores de formulario de reserva) |

---

## 3. Arquitectura

### Backend — Hexagonal (Ports & Adapters)

```
src/
  domain/          → Entidades + interfaces (puertos)
    ports/         → IEventoRepository, IGessRepository, IRoleRepository, IAuthRepository, ISolicitudesRepository, IKbServiciosClient, IPlanogessClient
    models/        → Entity types (GessStandEntity, SolicitudRow, RevisionEntity, ReevaluacionEntity, etc.)
  application/     → Casos de uso (servicios de aplicación)
    auth/          → AuthApplicationService (login, session, seleccionarEvento, perfil, reset password)
    eventos/       → EventoApplicationService, PresalaApplicationService
    gess/          → GessApplicationService
    reservas/      → ReservaApplicationService
    solicitudes/   → SolicitudesApplicationService
  infrastructure/  → Adaptadores
    persistence/   → Prisma repositories (evento, gess, auth, role, solicitudes)
    external/      → KbServiciosClient, PlanogessClient (HTTP clients)
  controllers/     → Capa HTTP delgada (auth, eventos, gess, maestra, reserva, kbservicios, planogess, roles, solicitudes, consultas)
  validators/      → Zod schemas (eventos, gess, reserva, solicitudes)
  lib/
    services.ts    → Contenedor DI (singleton)
    router.ts      → createRouter() declarativo + error handler global
    auth.ts        → Lógica JWT (signToken, verifyToken, getSession, hasRole, hasPermission)
    api-response.ts → ApiResponse<T>, success(), error() con ApiErrorCode
    email.ts       → sendEmail() via Resend API
    email-templates.ts → buildRevisionEmail() (plantilla HTML para notificaciones)
    constants.ts   → Constantes tipadas: estados, permisos, roles, areas, verticales, maestra IDs
```

### Frontend — Service Layer + DTO + Mapper

```
src/lib/api/services/   → Servicios API tipados (internal-api.ts, auth-service.ts, eventos-service.ts, gess-service.ts, solicitudes-service.ts, etc.)
src/types/dto/           → DTOs: un archivo por request/response (auth, eventos, gess, solicitudes, maestra, reserva)
src/lib/mappers/         → snake_case ↔ camelCase
src/lib/constants.ts     → Constantes tipadas compartidas
src/lib/utils/           → Utilidades singleton (cookie, date, form-validator)
```

### Convenciones

- **URLs API estilo RPC:** `/api/solicitudes/listar`, `/api/solicitudes/revisar`, `/api/solicitudes/notificar`, `/api/solicitudes/baja`
- **Nunca strings hardcodeados:** usar constantes de `src/lib/constants.ts`
- **DTOs por dominio:** un archivo por request/response
- **Reglas obligatorias** en `.opencode/reglas/` — cargar on-demand con la tool `skill`

---

## 4. Base de Datos (24 tablas)

### Maestras
| Tabla | Descripción |
|-------|------------|
| `evento_padre` | Vertical de evento (PERUMIN, GESS, ProExplo, WMC) |
| `evento` | Versión de evento (`tipo_evento`, `codigo_evento`, año, fechas, plano). `@@unique([tipoEvento, codigoEvento])` |
| `evento_metadata` | Metadata por tipo+codigo (plano, flgVisible, imagen) |
| `tipo_stand` | Tipos de stand por evento |
| `maestra` | Diccionario jerárquico (comprobante_tipo, documento_tipo, stand_estado, solicitud_estado, revision_estado, reevaluacion_estado) |
| `role` | Roles con array de permisos |
| `user_role` | Usuarios con email+password+nombre+apellidos, FK a role. `@@unique([userId, roleId])` |

### Transaccionales
| Tabla | Descripción |
|-------|------------|
| `stand` | Stand genérico (número, monto, estado, cámara) |
| `plano_posicion` | Posición X,Y de un stand en el plano |
| `gess_stand` | Stand del plano GESS vinculado desde API externo (estado, empresa, email, userId, documentos, imágenes, bloqueId) |
| `solicitud` | Ciclo de reserva (gessStandId, userId, email, documentos, flgActivo, estado). `@@index([gessStandId])` |
| `revision` | Revisión por área (solicitudId, area, estado, comentario, createdBy, updatedBy). `@@unique([solicitudId, area])` |
| `revision_historial` | Archivo de cambios de revisión (solicitudId, area, estadoAnterior, comentarioAnterior, motivo, createdBy). `@@index([solicitudId])`, `@@index([createdAt])` |
| `reevaluacion` | Solicitud de re-evaluación (solicitudId, estado, motivo, documentos, createdBy). `@@index([solicitudId])`, `@@index([estado])` |

### Reservas (flujo futuro)
| Tabla | Descripción |
|-------|------------|
| `reserva` | Cabecera (empresa, tipo comprobante, datos facturación, responsable pago, estado) |
| `reserva_stand` | Detalle: stands seleccionados con montos |
| `cuota` | Plan de pagos |
| `aprobacion` | Aprobaciones por área (legacy) |
| `interop_facturacion` | Integración con SAP |

### Auditoría
| Tabla | Descripción |
|-------|------------|
| `audit_log` | Log genérico (tipo, entidad, actor, mensaje, metadata) |

---

## 5. Roles y Permisos

### Roles
| Rol | Permisos |
|-----|----------|
| `admin` | admin:full, dashboard:view, eventos:datos, stands:vinculacion, stands:manage, stands:plano, auspicios:view, roles:manage, events:manage, events:create, events:edit, events:toggle, read:reservas, write:reservas, approve:all, solicitudes:view, solicitudes:review:*, solicitudes:notify, solicitudes:upload |
| `logistica` | dashboard:view, eventos:datos, stands:manage, stands:plano, auspicios:view, read:reservas, approve:logistica, solicitudes:view, solicitudes:review:logistica |
| `legal` | dashboard:view, eventos:datos, stands:plano, auspicios:view, read:reservas, approve:legal, solicitudes:view, solicitudes:review:legal |
| `comunicacion` | dashboard:view, eventos:datos, stands:plano, auspicios:view, read:reservas, approve:comunicacion, solicitudes:view, solicitudes:review:comunicacion |
| `cliente` | dashboard:view, eventos:datos, stands:plano, auspicios:view, read:reservas, write:reservas, solicitudes:view |

### Secciones de Permisos (21 permisos)
| Seccion | Permisos |
|---------|----------|
| Sistema | admin:full |
| Panel de Control | dashboard:view, eventos:datos |
| Gestion de Stands | stands:vinculacion, stands:manage, stands:plano |
| Auspicios | auspicios:view |
| Solicitudes | solicitudes:view, solicitudes:review:comunicacion, solicitudes:review:legal, solicitudes:review:logistica, solicitudes:notify, solicitudes:upload |
| Reservas | read:reservas, write:reservas, approve:all, approve:logistica, approve:legal, approve:comunicacion |
| Administracion | roles:manage, events:manage |
| Eventos | events:create, events:edit, events:toggle |

### Usuarios de prueba (seed)
| Email | Rol | Contraseña |
|---|---|---|
| `admin@iimp.org.pe` | admin | admin123 |
| `logistica@iimp.org.pe` | logistica | logistica123 |
| `legal@iimp.org.pe` | legal | legal123 |
| `comunicacion@iimp.org.pe` | comunicacion | comunicacion123 |
| `cliente@iimp.org.pe` | cliente | cliente123 |
| `ext_analistaprogramador3@iimp.org.pe` | admin | admin123 |

---

## 6. API Endpoints

### Auth
| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/auth/login` | POST | Login con email+password, devuelve JWT |
| `/api/auth/logout` | POST | Logout (limpia cookie) |
| `/api/auth/session` | GET | Sesión actual (JWT payload) |
| `/api/auth/seleccionar-evento` | POST | Seleccionar evento (actualiza JWT con eventoId, tipoEvento, codigoEvento, eventoNombre, eventoPadreNombre) |
| `/api/auth/perfil` | GET/PATCH | Ver/editar perfil de usuario |
| `/api/auth/reset-password` | POST | Solicitar reset de contraseña (envía email) |
| `/api/auth/reset-password/confirm` | POST | Confirmar reset con token |

### Solicitudes (flujo principal)
| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/solicitudes/listar` | GET | Listar solicitudes (filtros: eventoId, userId, page, search) |
| `/api/solicitudes/detalle` | GET | Detalle de solicitud con revisiones y reevaluaciones |
| `/api/solicitudes/revisar` | POST | Crear/actualizar revisión de un área (archiva estado anterior en historial) |
| `/api/solicitudes/notificar` | POST | Enviar notificación por correo al cliente (modo automático o personalizado con Quill) |
| `/api/solicitudes/reevaluar` | POST | Solicitar re-evaluación (cliente adjunta docs + justificación) |
| `/api/solicitudes/atender-reevaluacion` | POST | Admin aprueba/rechaza re-evaluación. Aprobar → archiva revisiones + resetea a pendiente. Rechazar → libera stand. |
| `/api/solicitudes/baja` | POST | Dar de baja lógica (flgActivo=false + libera stand) |
| `/api/solicitudes/orden-pago` | POST | Marcar solicitud como pendiente de pago |
| `/api/solicitudes/historial` | GET | Historial de cambios de revisiones (combina revision + revision_historial) |

### Otros
| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/eventos/listar` | GET | Listar eventos (presala=1 para público) |
| `/api/eventos/crear` | POST | Crear versión de evento |
| `/api/eventos/actualizar` | PATCH | Actualizar evento |
| `/api/gess/listar` | GET | Listar stands GESS vinculados (paginado) |
| `/api/gess/sync` | POST | Sincronizar desde API externo KBEventos |
| `/api/planogess/fetch` | POST | Proxy al API externo KBEventos |
| `/api/roles/*` | CRUD | Gestión de roles y usuarios |
| `/api/maestra/listar` | GET | Diccionario de maestra por tabla |
| `/api/upload` | POST | Subir archivo (documento/imagen) |

---

## 7. Estados y Flujos

### Estados de Solicitud (`solicitud_estado` en maestra)
| itemId | Estado | Significado |
|--------|--------|-------------|
| 1 | Pendiente | Ninguna área ha respondido |
| 2 | En proceso | Al menos un área respondió, faltan otras |
| 3 | Aprobado | Todas las áreas aprobaron |
| 4 | Rechazado | Al menos un área rechazó |
| 5 | Pendiente Pago | Aprobado, el admin generó orden de pago |

### Estados de Revisión (`revision_estado` en maestra)
| itemId | Estado |
|--------|--------|
| 1 | Pendiente |
| 2 | Aprobado |
| 3 | Rechazado |

### Estados de Re-evaluación (`reevaluacion_estado` en maestra)
| itemId | Estado |
|--------|--------|
| 1 | Pendiente |
| 2 | Aprobado |
| 3 | Rechazado |

### Constantes (`src/lib/constants.ts`)
- `ESTADOS_SOLICITUD`, `ESTADOS_SOLICITUD_MAESTRA_ID`
- `ESTADOS_REVISION`, `ESTADOS_REVISION_MAESTRA_ID`
- `ESTADOS_REEVALUACION`, `ESTADOS_REEVALUACION_MAESTRA_ID`
- `RESULTADOS_APROBACION` (compatibilidad)
- `REVISION_AREAS`, `REVISION_AREA_ORDER`, `REVISION_AREA_LABELS`, `REVISION_AREA_PERMISSIONS`

---

## 8. Flujo de Solicitud de Alquiler

### Creación
1. Usuario logueado → `/plano` → selecciona stands → formulario (datos + docs + confirmar)
2. `POST /api/reservas/crear` → actualiza `gess_stand.estado = "en_evaluacion"` + guarda email + userId
3. Crea `Solicitud` (nuevo registro) + 3 `Revision` (comunicacion, legal, logistica) en estado "pendiente"
4. Envía email de confirmación al cliente + notificación al admin (Resend)

### Documentos — Single vs Multi-stand
- **Single stand** (1 stand): documentos se guardan en el campo JSON `solicitud.documentos` (subidos por el cliente al crear la solicitud).
- **Multi-stand** (2+ stands): documentos se gestionan en la tabla `solicitud_documento` (`SolicitudDocumento`). El admin sube el contrato (`uploadedBy` = admin). El cliente adjunta sus documentos (`userId` = cliente). El campo `clienteDocsAdjuntosCount` rastrea cuantos docs subio el cliente.
- En el detalle (admin y cliente): los documentos se muestran agrupados como "Administrador" y "Cliente" (o "Tus documentos") con fecha de subida e iconos Eye/Trash.
- Separacion clara: `SolicitudDocumento` (docs del ciclo normal) vs `Reevaluacion.documentos` (docs de re-evaluacion, campo JSON).

### Re-evaluacion — Documentos y Justificacion
1. Cliente en `/dashboard/mis-solicitudes` → ve solicitud rechazada → "Solicitar Re-evaluacion"
2. El modal de re-evaluacion (`ModificarSolicitudModal`) permite adjuntar nuevos documentos + escribir justificacion
   - Docs se guardan en `Reevaluacion.documentos` (JSON), NO en `SolicitudDocumento`
   - Para multi-stand: el cliente DEBE tener al menos 1 doc en `SolicitudDocumento` antes de poder solicitar re-evaluacion (aviso ambar con drop zone)
3. Admin ve historial de re-evaluaciones en el detalle con estado, docs adjuntos, fecha y autor
4. **Aprobar**: archiva revisiones actuales a `RevisionHistorial` (motivo: "aprobacion de re-evaluacion"), resetea a "pendiente", `Reevaluacion.estado = "aprobado"`
5. **Rechazar**: confirmacion → `Reevaluacion.estado = "rechazado"`, `gess_stand.estado = "disponible"`, elimina revisiones

### UI — Acordeones en Detalle
- Los modales de detalle (admin y cliente) usan secciones colapsables con animacion (`DetailSection`)
- Una sola seccion abierta a la vez (comportamiento acordeon)
- Secciones: Informacion general, Imagenes, Documentos, Accion requerida, Re-evaluacion, Estado de revision
- Titulos del acordeon: `text-sm font-semibold`, subtitulos: `text-[11px] uppercase tracking-wider` para jerarquia visual clara

### Revisión por Áreas
1. Admin/área en `/dashboard/solicitudes` → click "Revisar" → modal con steps (Comunicación → Legal → Logística)
2. Cada área puede aprobar o rechazar con justificación obligatoria (rechazar requiere texto)
3. Al guardar: crea `RevisionHistorial` con estado anterior, actualiza `Revision`
4. `estadoSolicitud` se calcula automáticamente:
   - Ninguna respondió → `pendiente`
   - Al menos una respondió → `en_proceso`
   - Todas respondieron, alguna rechazó → `rechazado`
   - Todas aprobaron → `aprobado`

### Rechazo y Notificación
1. Solicitud rechazada → admin puede notificar al cliente
2. Modal de notificación: modo automático (anexa justificaciones) o personalizado (editor Quill WYSIWYG)
3. Email HTML con diseño profesional: header IIMP, datos del stand, tabla de revisiones, badge RECHAZADA, botón "Ver estado de mi solicitud"
4. `POST /api/solicitudes/notificar` → envía via Resend API

### Rechazo y Notificación
1. Todas las áreas aprobaron → último step muestra "Generar orden de pago"
2. `POST /api/solicitudes/orden-pago` → `solicitud.estado = "pendiente_pago"`
3. Solicitud en pendiente_pago: solo iconos de historial y ver detalle, sin "Revisar"

### Baja de Solicitud
1. Admin: solicitud rechazada → icono 🗑 "Dar de baja"
2. Confirmación → `solicitud.flgActivo = false`, `gess_stand.estado = "disponible"`
3. Stand vuelve al plano disponible
4. Cliente ve solicitud con icono ℹ️ "Dada de baja" — modal informativo con link al plano

### Baja Lógica
- `solicitud.flgActivo = false` → no aparece en bandeja admin (filtro `r.flgActivo !== false`)
- Cliente la ve con icono informativo, sin acciones
- El stand asociado se libera (`gess_stand.estado = "disponible"`)
- Un stand puede tener múltiples Solicitudes (una por cada ciclo de reserva), solo la activa aparece en bandejas

---

## 9. Páginas y Rutas

### Público
| Ruta | Descripción |
|------|-------------|
| `/` (home) | Selector de eventos con colores por vertical |
| `/presala` | Selector de versión de evento → redirige a `/dashboard` o `/plano` |
| `/plano` | Plano 3D isométrico interactivo (auto-sync si BD vacía) |
| `/auth/login` | Login |

### Dashboard (requiere login + rol)
| Ruta | Roles | Descripcion |
|------|-------|-------------|
| `/dashboard` | admin, logistica, legal, comunicacion, cliente | KPIs del evento actual |
| `/dashboard/solicitudes` | admin, logistica, legal, comunicacion, cliente | Bandeja de solicitudes con revision por areas |
| `/dashboard/mis-solicitudes` | admin, logistica, legal, comunicacion, cliente | Solicitudes del usuario logueado (vista cliente) |
| `/dashboard/reservas` | admin, logistica, legal, comunicacion, cliente | Gestion de reservas (vista legacy) |
| `/dashboard/auspicios` | admin, logistica, legal, comunicacion, cliente | Busqueda y registro de auspicios (API externo KBServicios) |
| `/dashboard/vinculacion` | admin | Importar desde API KBEventos, match con bloques |
| `/dashboard/stands` | admin, logistica, legal, comunicacion | Bandeja de stands con documentos/imagenes |
| `/dashboard/eventos` | admin | CRUD de versiones de evento, selector de plano 3D |
| `/dashboard/roles` | admin | Gestion de roles/permisos y usuarios |
| `/dashboard/perfil` | todos | Perfil de usuario |
| `/dashboard/datos-evento` | todos | Datos del evento seleccionado |

---

## 10. Plano 3D

- **Auto-sync**: Si `gess_stand` está vacío para un evento, el plano automáticamente sincroniza desde el API KBEventos
- **Selección**: Click en stand → abre modal de reserva (requiere login)
- **Colores**: Verde = disponible, Gris = reservado/en evaluación
- **Formulario de reserva**: 3 steps (Datos, Docs, Confirmar) con autoguardado en IndexedDB
- **Prioridad estado**: DB (`gess_stand.estado`) tiene prioridad sobre API (refleja cambios locales)

---

## 11. Notificaciones por Correo

- **API**: Resend (`src/lib/email.ts`)
- **Template**: `src/lib/email-templates.ts` — `buildRevisionEmail()`
- **Diseño**: Header IIMP oscuro, card blanca centrada, tabla de revisiones con badges de colores, banner RECHAZADA rojo, botón "Ver estado", footer disclaimer
- **Personalizado**: Editor WYSIWYG (Quill) para mensajes personalizados
- **Automático**: Anexa justificaciones de cada área
- **Saludo**: Usa nombre del usuario desde `user_role`; fallback: "Estimad@"

---

## 12. Work State

### Completado
- [x] PostgreSQL + Prisma v7.8 con 25 tablas
- [x] 5 roles + 6 usuarios de prueba
- [x] Autenticacion JWT completa (login, logout, session, middleware)
- [x] Presala con grid de versiones, colores por vertical
- [x] Dashboard con KPIs reales
- [x] Plano 3D isometrico interactivo con auto-sync
- [x] Vinculacion de stands desde API externo
- [x] Gestion de stands con paginacion, busqueda, upload
- [x] CRUD de eventos con selector de plano
- [x] Gestion de roles/permisos con 6 secciones y 21 permisos
- [x] Flujo completo de solicitudes de alquiler
- [x] Revision por areas (Comunicacion, Legal, Logistica) con steps
- [x] Historial de cambios de revisiones (revision_historial)
- [x] Re-evaluacion con aprobacion/rechazo + documentos propios
- [x] Documentos multi-stand: SolicitudDocumento (admin + cliente) con fechas y agrupacion
- [x] Separacion clara: docs de solicitud vs docs de re-evaluacion
- [x] UI acordeon en modales de detalle (admin y cliente)
- [x] Notificaciones por correo con plantilla HTML profesional
- [x] Baja logica de solicitudes (flgActivo)
- [x] Vista "Mis solicitudes" para cliente
- [x] Orden de pago (pendiente_pago)
- [x] Permisos por item de menu del sidebar (sin items publicos)
- [x] Menu "Auspicios" con proxy a API externo KBServicios (listar + grabar)
- [x] Eventos creados on-demand desde API (sin seed hardcodeado)
- [x] IDs de evento como UUIDs reales, no sinteticos
- [x] `@@unique([tipoEvento, codigoEvento])` en tabla evento
- [x] Separacion Solicitud (ciclo) vs GessStand (stand fisico)

### Pendiente
- [ ] Integración con SAP (facturación)
- [ ] Auth0 integration
- [ ] Tests
- [ ] Plano PERUMIN/WMC/ProExplo (cuando API KBEventos tenga datos)
- [ ] Documentación OpenAPI

### Bloqueado
- API KBEventos solo tiene PERUMIN (14/1). Otros eventos → 404 o datos parciales.

---

## 13. Eventos y API Externo

### Mapeo de códigos API → DB
| Evento | API `tipoEvento` | DB `tipoEvento` | Vertical |
|--------|-----------------|-----------------|----------|
| PERUMIN | 2 | 2 | perumin |
| GESS | 14 | 14 | gess |
| ProExplo | 5 | 5 | proexplo |
| WMC | 7 | 7 | wmc |

### Presala
- Lee `tipoEvento` y `codigoEvento` desde API KBServicios
- Mapea a UUID real de `evento` vía `eventoRepo.findAll()`
- `findOrCreateEvento(tipoEvento, codigoEvento)` crea evento en BD si no existe
- `VERTICAL_BY_CODE` solo para determinar visual (colores), no para lógica de negocio

### Seed
- NO crea eventos (vienen del API on-demand)
- Solo crea: roles, usuarios, maestra (diccionarios)

---

## 14. Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `prisma/schema.prisma` | 24 modelos con índices y constraints |
| `prisma/seed.ts` | Roles, usuarios, maestra (sin eventos hardcodeados) |
| `src/lib/constants.ts` | Constantes tipadas (estados, permisos, roles, áreas, verticales, maestra IDs) |
| `src/lib/services.ts` | Contenedor DI singleton |
| `src/lib/auth.ts` | Lógica JWT (sign, verify, session, hasRole, hasPermission) |
| `src/lib/router.ts` | createRouter() declarativo con error handler |
| `src/lib/email.ts` | sendEmail() via Resend API |
| `src/lib/email-templates.ts` | buildRevisionEmail() HTML template |
| `src/lib/api/services/` | Servicios API cliente (internal-api.ts, auth, eventos, gess, solicitudes) |
| `src/controllers/solicitudes.controller.ts` | Controller de solicitudes (listar, detalle, revisar, notificar, reevaluar, baja, orden-pago, historial) |
| `src/infrastructure/persistence/solicitudes-repository.ts` | Repositorio Prisma para Solicitud + Revision + Reevaluacion |
| `src/application/reservas/reserva-service.ts` | Servicio de reserva (crea Solicitud + Revisiones) |
| `src/application/solicitudes/solicitudes-service.ts` | Servicio de solicitudes |
| `src/components/solicitudes/` | Componentes de solicitudes (manager, review, historial, notificar, modificar) |
| `src/components/plano/plano-isometrico.tsx` | Componente 3D principal con auto-sync |
| `src/middleware.ts` | Protección JWT de rutas con roles y permisos |
| `src/app/layout.tsx` | Layout raíz con Providers (Theme, Vertical, Tooltip) |

---

## 15. Comandos Útiles

```bash
npm run dev              # Next.js dev (Turbopack)
npm run clean            # Borrar .next + regenerar Prisma Client
npm run build            # Build producción
npm run lint             # ESLint
npm run db:seed          # tsx prisma/seed.ts
npm run db:studio        # prisma studio
npm run db:generate      # prisma generate
npm run db:push          # prisma db push
npm run db:reset         # Borrar .next + db push --force-reset + generate + seed
```

### Variables de entorno clave (`.env`)
```
DATABASE_URL=postgresql://ctrst:<PASSWORD>@localhost:5432/contratos_stands
PLANOGESS_API_URL=https://secure2.iimp.org:8443/KBEventosPruebas/rest/planogess
KBSERVICIOS_URL=https://secure2.iimp.org:8443/KBServiciosIIMPJavaEnvironment
KBSERVICIOS_API_KEY=<API_KEY>          # solicitar al area de sistemas / gestor de secretos
JWT_SECRET=<JWT_SECRET>                # openssl rand -base64 32
RESEND_API_KEY=<RESEND_API_KEY>        # https://resend.com/api-keys
ADMIN_EMAIL=ext_analistaprogramador3@iimp.org.pe
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> ⚠️ **Nunca versionar credenciales reales.** Los valores viven en `.env` (ignorado por git)
> y en producción en **AWS Secrets Manager**. Este documento solo lista los nombres.

---

## 16. Notas para Próximas Sesiones

1. **No hacer commits/push sin autorización explícita.**
2. **Regla de oro:** cargar skills/reglas de `.opencode/` solo cuando apliquen a la tarea.
3. **Constantes:** SIEMPRE usar `src/lib/constants.ts`, nunca strings hardcodeados.
4. **IDs de evento:** `@@unique([tipoEvento, codigoEvento])` garantiza consistencia. Los eventos se crean on-demand, no en seed.
5. **Solicitud vs GessStand:** `Solicitud` es el ciclo de reserva (puede haber varios por stand). `GessStand` es el stand físico.
6. **Historial:** cada cambio en Revision crea automáticamente `RevisionHistorial`.
7. **Baja lógica:** `flgActivo = false` — preserva datos para auditoría.
8. **Estados en maestra:** todos los estados (solicitud, revision, reevaluacion) tienen entradas en `maestra` con `itemId`.
