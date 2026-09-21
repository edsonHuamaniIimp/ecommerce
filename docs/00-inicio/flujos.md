# Flujos y Procesos — ContratosStands

> Documentacion complementaria a bitacora.md. Describe flujos de negocio y procesos tecnicos de forma detallada.
> Ultima actualizacion: 2026-08-03

---

## 1. Flujo de Solicitud de Alquiler

### 1.1 Creacion de Solicitud

```
CLIENTE                    SISTEMA                       API EXTERNO
  │                          │                               │
  │   Selecciona stands     │                               │
  │   en el plano 3D ──────►│                               │
  │                          │  Validar sesion (JWT)         │
  │                          │  Verificar disponibilidad     │
  │                          │                               │
  │   Completa formulario   │                               │
  │   (datos + docs) ──────►│                               │
  │                          │  POST /api/reservas/crear     │
  │                          │  ├─ actualiza gess_stand      │
  │                          │  │  (email, userId, estado)   │
│                          │  ├─ crea Solicitud            │
│                          │  ├─ crea 2 Revisiones         │
│                          │  │  logistica + comunicacion  │
│                          │  │  (Legal se delega al SGC)  │
  │                          │  └─ envia email confirmacion  │
  │   Recibe confirmacion ◄──┤                               │
```

**Reglas:**
- `gess_stand.estado` cambia de "disponible" a "en_evaluacion"
- `solicitud.documentos` guarda URLs de docs subidos por el cliente (campo JSON)
- 2 `Revision` se crean: logistica y comunicacion — en "pendiente". La revisión **Legal**
  ya no es local: se delega al SGC (ver `docs/05-integraciones/integracion-sgc.md`)
- Email de confirmacion via Resend al cliente + notificacion al admin

### 1.2 Documentos — Single vs Multi-stand

```
                    ┌─────────────────────────────────────┐
                    │        TIPOS DE DOCUMENTOS          │
                    └─────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
        ┌───────────────────────┐         ┌──────────────────────────┐
        │   SINGLE STAND (1)    │         │   MULTI-STAND (2+)       │
        └───────────────────────┘         └──────────────────────────┘
                    │                                   │
                    ▼                                   ▼
        solicitud.documentos              solicitud_documento (tabla)
        (JSON array de URLs)         ┌─────────────────────────────┐
                                     │ uploadedBy │ userId │ nombre │
                                     │   admin    │ admin  │  URL   │
                                     │   cliente  │ cliente│  URL   │
                                     └─────────────────────────────┘
                                                  │
                                    ┌─────────────┴─────────────┐
                                    ▼                           ▼
                            Admin sube                    Cliente sube
                            CONTRATO                     EVIDENCIA
                            (uploadedBy)                 (userId=row.userId)
```

**Visualizacion en UI:**
- **Admin** (`/dashboard/solicitudes`): agrupado "Administrador (2)" en azul + "Cliente (1)" en verde
- **Cliente** (`/dashboard/mis-solicitudes`): "Documentos del administrador" en azul + "Tus documentos adjuntos" en verde con Trash
- Cada doc muestra: icono, nombre, fecha de subida, ojo (ver)
- Sin docs: "Pendiente: Subir Contrato" (admin) o "Esperando Contrato" (cliente)

### 1.3 Flujo de Revision por Areas

```
ADMIN / AREA
      │
      │  Click "Revisar" en bandeja
      ▼
┌──────────────────────────────────────┐
│         MODAL DE REVISION            │
│  ┌──────┬──────┬──────────┐         │
│  │ LOG  │ COM  │ SGC(Legal)│ ← steps │
│  └──────┴──────┴──────────┘         │
│                                      │
│  Step actual: Legal                  │
│  ┌────────────────────────────┐     │
│  │ Documentos del cliente (3) │     │  ← consolidados de:
│  │  - docs de solicitud       │     │     1. solicitud.documentos
│  │  - docs de adjunto         │     │     2. docsAdjuntos (userId match)
│  │  - docs de re-evaluacion   │     │     3. reevaluaciones[i].docs
│  │  (deduplicados por URL)    │     │
│  └────────────────────────────┘     │
│                                      │
│  Comentario / Justificacion         │
│  ┌────────────────────────────┐     │
│  │ [textarea]                 │     │
│  └────────────────────────────┘     │
│                                      │
│  [Rechazar]         [Aprobar]       │
│                                      │
│  ◄ Anterior        Siguiente ►      │
└──────────────────────────────────────┘
```

**Reglas de revision:**
- Cada area puede aprobar o rechazar independientemente
- Rechazar requiere justificacion obligatoria
- Al guardar: crea `RevisionHistorial` (estado anterior) + actualiza `Revision`
- `estadoSolicitud` calculado automaticamente:
  - Ninguna respondio → `pendiente`
  - Al menos una respondio → `en_proceso`
  - Todas respondieron, alguna rechazo → `rechazado`
  - Todas aprobaron → `aprobado`

### 1.4 Notificacion

```
ADMIN (solicitud rechazada)
      │
      │  Click "Notificar" (icono Send)
      ▼
┌──────────────────────────────────────┐
│       MODAL DE NOTIFICACION          │
│                                      │
│  Modo: ○ Automatico                 │
│        ○ Personalizado (Quill)      │
│                                      │
│  ┌────────────────────────────┐     │
│  │ Destinatario: cliente@...  │     │
│  └────────────────────────────┘     │
│                                      │
│         [Enviar notificacion]        │
└──────────────────────────────────────┘
      │
      ▼
  POST /api/solicitudes/notificar
      │
      ├─ modo="automatico" → anexa justificaciones de cada area
      └─ modo="personalizado" → envia HTML del editor Quill
      │
      ▼
  Resend API → email HTML profesional
  ├─ Header IIMP oscuro
  ├─ Datos del stand (codigo, bloque, tipo)
  ├─ Tabla de revisiones con badges (aprobado/rechazado)
  ├─ Banner "RECHAZADA" rojo
  ├─ Boton "Ver estado de mi solicitud"
  └─ Footer disclaimer
```

---

## 2. Flujo de Re-evaluacion

### 2.1 Solicitud de Re-evaluacion (Cliente)

```
CLIENTE (solicitud rechazada)
      │
      │  "Solicitar Re-evaluacion"
      ▼
┌──────────────────────────────────────────┐
│     MODIFICAR SOLICITUD (re-evaluacion)  │
│                                          │
│  Stand: 10, 09                           │
│                                          │
│  Documentos actuales                     │
│  ┌──────────────────────────────────┐   │
│  │ 📄 doc_anterior.docx    🗑       │   │  ← docs previos de re-evaluacion
│  └──────────────────────────────────┘   │
│                                          │
│  [Agregar documento]                     │  ← upload (PDF, DOC, DOCX, JPG, PNG)
│                                          │
│  Justificacion                           │
│  ┌──────────────────────────────────┐   │
│  │ [textarea]                       │   │
│  └──────────────────────────────────┘   │
│                                          │
│       [Cancelar]   [Solicitar]          │
└──────────────────────────────────────────┘
      │
      ▼
  POST /api/solicitudes/reevaluar
      │
      ├─ Valida: no hay reevaluacion pendiente previa
      ├─ Para multi-stand: cliente debe tener docsAdjuntos ≥ 1
      └─ Crea Reevaluacion { estado: "pendiente", motivo, documentos }
```

**Separacion de documentos:**
- `SolicitudDocumento` → docs del ciclo normal (admin + cliente, tabla relacional)
- `Reevaluacion.documentos` → docs especificos de re-evaluacion (JSON array)
- En el modal de detalle: historial de re-evaluaciones muestra docs + fecha + autor

### 2.2 Atencion de Re-evaluacion (Admin)

```
ADMIN (solicitud con reevaluacion pendiente)
      │
      │  Ve icono ⚠ en bandeja → click
      ▼
┌──────────────────────────────────────────┐
│     MODAL DE RE-EVALUACION               │
│                                          │
│  Stand: 10, 09                           │
│  Estado: Rechazado                       │
│                                          │
│  Justificacion del cliente:              │
│  "Se solicita reevaluacion..."           │
│                                          │
│  Documentos adjuntos:                    │
│  📄 doc_reevaluacion.pdf                 │
│                                          │
│  Enviada por: cliente@iimp.org.pe        │
│                                          │
│     [Aprobar]        [Rechazar]          │
└──────────────────────────────────────────┘
      │
      ├── Aprobar ──► archiveRevisiones() + resetRevisiones() + estado="aprobado"
      │
      └── Rechazar ──► ConfirmDialog → estado="rechazado" + liberarStand() + deleteRevisiones()
```

**Acciones en BD:**
| Accion | `reevaluacion.estado` | `revision` | `solicitud` | `gess_stand` |
|--------|----------------------|------------|-------------|-------------|
| Aprobar | "aprobado" | Resetea a "pendiente" las 3 areas | Sin cambios | Sin cambios |
| Rechazar | "rechazado" | Eliminadas | Sin cambios | estado="disponible" |

---

## 3. Flujo de Auspicios

```
USUARIO (con permiso auspicios:view)
      │
      │  Sidebar → "Auspicios"
      ▼
┌──────────────────────────────────────────┐
│           AUSPICIOS                      │
│                                          │
│  Codigo empresa: [____] [Buscar]         │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ Auspicios disponibles (8)        │   │
│  │                                  │   │
│  │ LEGADO               EFECTIVO US$│   │
│  │ FUTURO SOSTENIBLE    EFECTIVO US$│   │
│  │ INNOVACION SOCIAL    EFECTIVO US$│   │
│  │ ...                              │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌─── REGISTRAR AUSPICIO ──────────┐   │
│  │ Datos empresa                    │   │
│  │ Tipo doc, Nro doc, Empresa...    │   │
│  │                                  │   │
│  │ Tarifas                          │   │
│  │ LEGADO            US$ [____]     │   │
│  │ FUTURO SOSTENIBLE US$ [____]     │   │
│  │                                  │   │
│  │ Facturacion                      │   │
│  │ Tipo fact, Doc, Razon social...  │   │
│  │                                  │   │
│  │  [Registrar Auspicio]            │   │
│  └──────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

**API Proxy:**
```
POST /api/auspicios/listar
  → fetch POST https://secure2.iimp.org:8443/KBServiciosIIMPJavaEnvironment/rest/listauspicio
  Headers: x-api-key (KBSERVICIOS_API_KEY)
  Body: { code, codeEvent }

POST /api/auspicios/grabar
  → fetch POST https://secure2.iimp.org:8443/KBServiciosIIMPJavaEnvironment/rest/saveauspicio
  Headers: x-api-key (KBSERVICIOS_API_KEY)
  Body: { code, codeEvent, tipoDocumento, numDocumento, empresa, ...Tarifas[], ...facturacion }
```

**Middleware:** `/dashboard/auspicios` y `/api/auspicios` protegidos por `auspicios:view`.

---

## 4. Flujo de Permisos y Sidebar

### 4.1 Como se asignan los permisos

```
LOGIN                                  JWT                      SIDEBAR
  │                                     │                        │
  │  POST /api/auth/login              │                        │
  │  (email + password)                │                        │
  ▼                                     │                        │
  AuthApplicationService                │                        │
  ├─ busca user_role + role             │                        │
  └─ signToken({                        │                        │
       sub, email, name,                │                        │
       roles: ["cliente"],              │                        │
       permissions: flatMap(            │                        │
         ROLES_PERMISSIONS[r]           │                        │
       )                                │                        │
     })                                 ▼                        │
                              JWT en cookie httpOnly              │
                              "token" = jwt.sign(...)             │
                                        │                        │
                                        │  authService.getSession│
                                        │  GET /api/auth/session  │
                                        ▼                        │
                              permissions: [                      │
                                "dashboard:view",                │
                                "eventos:datos",                  │
                                "stands:plano",                   │
                                "read:reservas",                  │
                                "write:reservas",                 │
                                "solicitudes:view"                │
                              ]                                   │
                                        │                        │
                                        ▼                        ▼
                              canSee(perm)               navItems.filter()
                              → perm === null            cada item tiene
                              → permissions.includes()   su propio permiso
                              → permissions.includes(
                                  "admin:full")
```

### 4.2 Mapeo Sidebar ↔ Permisos

| Item del menu | Permiso | Roles con acceso |
|---|---|---|
| Panel de Control | `dashboard:view` | todos |
| Datos del Evento | `eventos:datos` | todos |
| Vinculacion de Stands | `stands:vinculacion` | admin |
| Solicitudes de alquiler | `solicitudes:view` | todos |
| Mis solicitudes | `solicitudes:view` | todos |
| Gestion de Stands | `stands:manage` | admin, logistica |
| Gestion de Reservas | `read:reservas` | todos |
| Auspicios | `auspicios:view` | todos |
| Roles y Permisos | `roles:manage` | admin |
| Gestion de Eventos | `events:manage` | admin |
| Plano de Stands | `stands:plano` | todos |

**Middleware:** cada ruta del dashboard tambien verifica el permiso correspondiente a nivel HTTP.

---

## 5. Ciclo de Vida de una Solicitud

```
                    ┌──────────────────┐
                    │   STAND DISPONIBLE│
                    │   (en el plano)   │
                    └────────┬─────────┘
                             │ Cliente selecciona y envia formulario
                             ▼
                    ┌──────────────────┐
                    │  EN EVALUACION   │
                    │  (estadoSolicitud│
                    │   = pendiente)   │
                    └────────┬─────────┘
                             │ Admin revisa por areas
                    ┌────────┴─────────┐
                    ▼                  ▼
           ┌──────────────┐   ┌──────────────┐
           │   APROBADO   │   │  RECHAZADO   │
           │ (todas areas) │   │ (alguna area)│
           └──────┬───────┘   └──────┬───────┘
                  │                   │
                  ▼                   ├── Cliente solicita re-evaluacion
           ┌──────────────┐          │    (adjunta docs + justificacion)
           │ PENDIENTE    │          ▼
           │ PAGO         │   ┌──────────────┐
           │ (admin genera │   │ RE-EVALUACION│
           │  orden pago)  │   │  PENDIENTE   │
           └──────────────┘   └──────┬───────┘
                                     │
                              ┌──────┴──────┐
                              ▼              ▼
                       ┌──────────┐   ┌──────────┐
                       │ APROBADA │   │RECHAZADA │
                       │ (vuelve a│   │(stand    │
                       │  pendiente)│  │liberado) │
                       └──────────┘   └──────────┘
```

### Transiciones de estado

| De | A | Trigger | Quien |
|---|---|---|---|
| disponible | en_evaluacion | Crear solicitud | Cliente |
| pendiente | en_proceso | Primera revision | Admin/Area |
| en_proceso | aprobado | Todas las areas aprueban | Admin/Area |
| en_proceso | rechazado | Alguna area rechaza | Admin/Area |
| rechazado | pendiente | Re-evaluacion aprobada | Admin |
| rechazado | disponible | Baja o re-evaluacion rechazada | Admin |
| aprobado | pendiente_pago | Generar orden de pago | Admin |

---

## 6. Estructura de Componentes de Solicitudes

```
src/components/solicitudes/
├── solicitudes-manager.tsx        → Admin: bandeja + detalle acordeon + revision
├── mis-solicitudes-manager.tsx    → Cliente: mis solicitudes + detalle acordeon
├── solicitud-review.tsx           → Modal de revision por areas (steps)
├── revision-step-indicator.tsx    → Indicador visual de steps
├── notificar-modal.tsx            → Modal de notificacion (auto/personalizado)
├── historial-modal.tsx            → Modal de historial de cambios
├── modificar-solicitud-modal.tsx  → Modal de re-evaluacion (docs + justificacion)
├── cliente-upload-modal.tsx       → Modal para subir docs en multi-stand
└── imagen-carousel.tsx            → Visor de imagenes del stand

src/app/api/
├── solicitudes/listar/route.ts    → GET  (eventoId, page, search, userId)
├── solicitudes/detalle/route.ts   → GET  (id)
├── solicitudes/revisar/route.ts   → POST (solicitudId, area, estado, comentario)
├── solicitudes/notificar/route.ts → POST (solicitudId, to, modo, mensaje)
├── solicitudes/reevaluar/route.ts → POST (solicitudId, motivo, documentos)
├── solicitudes/atender-reevaluacion/route.ts → POST (reevaluacionId, accion)
├── solicitudes/baja/route.ts      → POST (solicitudId)
├── solicitudes/orden-pago/route.ts → POST (solicitudId)
├── solicitudes/historial/route.ts → GET  (gessStandId)
├── solicitudes/upload-doc/route.ts → POST (solicitudId, url, nombre)
├── solicitudes/eliminar-doc/route.ts → POST (docId)
├── solicitudes/modificar/route.ts  → POST (solicitudId, documentos)
├── auspicios/listar/route.ts      → POST (code, codeEvent) → proxy KBServicios
└── auspicios/grabar/route.ts      → POST (body completo) → proxy KBServicios
```

---

## 7. Patrones de Arquitectura

### 7.1 Arquitectura Hexagonal (Backend)
```
Controller (HTTP)  →  Application Service  →  Port (interface)  →  Adapter (Prisma/HTTP)
     │                      │                       │                    │
     │                      │                       │                    │
  validators            casos de uso          IEventoRepository    EventoPrismaRepository
  Zod schemas           orquestacion          IGessRepository      GessPrismaRepository
  handler()             reglas de negocio     IKbServiciosClient   KbServiciosClient
                                              ISolicitudesRepo     SolicitudesPrismaRepo
                                              ...                  ...
```

### 7.2 Fachada de Servicios (Frontend)
```
Componente  →  solicitudesService  →  internalApi  →  fetch(/api/...)
                    │                      │
                    │                      │
              SolicitudDTO           ApiResponse<T>
              tipado fuerte          success/error
```

### 7.3 Mapper (snake_case ↔ camelCase)
- DTO usa camelCase para el frontend
- El mapper serializa/deserializa en el controller
- `success(row)` serializa el domain entity → JSON → DTO

---

## 8. Comandos de Desarrollo

```bash
# Desarrollo
npm run dev                    # Next.js dev (Turbopack) en http://localhost:3000

# Base de datos
npm run db:seed                # tsx prisma/seed.ts (roles, usuarios, maestra)
npm run db:studio              # Prisma Studio en http://localhost:5555
npm run db:generate            # Regenerar Prisma Client
npm run db:push                # Sincronizar schema con DB (sin perder datos)
npm run db:reset               # Borrar .next + db push --force-reset + generate + seed

# Calidad
npm run lint                   # ESLint
npm run build                  # Build produccion
```
