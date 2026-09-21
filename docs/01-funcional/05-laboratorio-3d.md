# Laboratorio 3D (planos)

> Fuente: `src/app/(dashboard)/dashboard/laboratorio/page.tsx`,
> `src/components/laboratorio/**`, `src/app/api/planos/**`, `src/application/planos/**`,
> `src/infrastructure/persistence/plano-repository.ts`.

## 1. Propósito

Editor visual de mapas 3D de pabellones para eventos, con dos tipos:

- **`simple`**: plano 3D con bloques (stands) y mobiliario.
- **`macro`**: mapa de pabellones con imagen de fondo y secciones que referencian planos `simple`.

`TIPOS_PLANO = { SIMPLE: "simple", MACRO: "macro" }` (`constants.ts:123-128`).

## 2. Roles y permisos

- Lectura: `laboratorio:view` en `/dashboard/laboratorio` y `/api/planos` (`middleware.ts:22-23`).
- Escritura: `laboratorio:manage` (o `admin:full`) validado en `planosController.requireAdmin` (`planos.controller.ts:8-15`).
- Solo `admin` tiene ambos permisos en `ROLES_PERMISSIONS`.

## 3. Funcionalidad — planos simples

- Canvas con `@react-three/fiber` + `OrbitControls` y grilla según bounds.
- Bloques con dimensiones/color por tipo; mobiliario/kiosko.
- Arrastre con snap `0.25`; creación de bloque desde panel o diálogo "Agregar bloque".
- Edición del bloque: **ID** (se vincula a `gess_stand.bloqueId`), tipo, **tipología** (Complejo/Simple/Octanorm, `TIPOLOGIAS_STAND`), coordenadas X/Z, eliminar.
- Creación de tipos de bloque personalizados (código, label, dimensiones, color).
- Guardar layout (`POST /api/planos/guardar-layout`), importar/exportar JSON.
- **Exportar TypeScript**: genera 4 archivos (`bloques.ts`, `tipos.ts`, `construccion.ts`, `index.ts`) + snippet para `registry.ts`, mostrados para copiar/descargar. **No escribe en disco**.

## 4. Funcionalidad — mapas macro

- Subida de imagen de fondo de pabellones.
- Secciones rectangulares en coordenadas normalizadas 0-1, con mover/redimensionar/rotar (snap 5°), zoom (Ctrl+rueda) y pan.
- Edición de sección: código, nombre, color, rotación y asignación de **plano 3D hijo**.
- Guardar secciones (`POST /api/planos/guardar-secciones`).
- Regla: un plano `simple` pertenece a **un solo macro** a la vez.

## 5. Endpoints (`/api/planos/[...slug]`)

| Método | Acción | Permiso |
|---|---|---|
| `GET` | `listar`, `detalle`, `planos-evento`, `macros-de-plano`, `ocupacion` | sesión / `laboratorio:view` |
| `GET` | `exportar`, `exportar-ts` | `laboratorio:manage` |
| `POST` | `crear`, `guardar-layout`, `guardar-secciones`, `asignar-macro`, `quitar-macro`, `eliminar`, `importar` | `laboratorio:manage` |
| `PATCH` | `actualizar-meta` | `laboratorio:manage` |
| `GET` | `/api/planos/publico` | público (consumo del plano) |

## 6. Persistencia

Modelos Prisma (`prisma/schema.prisma:537-633`): `Plano`, `PlanoSeccion`, `PlanoTipoBloque`,
`PlanoBloque`, `PlanoFurniture`. `PlanoBloque.bloqueId` es la clave de unión con
`gess_stand.bloque_id`; `PlanoSeccion.planoHijoId` referencia el plano simple del macro.

- `guardarLayout` / `guardarSecciones` **reemplazan** (delete + create) en transacción, sin versionado.
- `eliminar` es borrado duro, bloqueado si el plano está asignado a un evento.

## 7. Reglas de negocio

- `codigo` de plano: `^[a-z0-9-]+$`, único.
- `bloqueId` sin duplicados; tipos deben existir.
- Solo un `macro` tiene secciones; un `macro` no puede anidarse en otro.
- Un plano hijo pertenece a un solo macro a la vez.
- Un plano no se elimina si está asignado a un evento.
- Coordenadas de sección normalizadas 0..1.

## 8. Limitaciones y observaciones

- **La UI no oculta controles de edición** a usuarios con solo `laboratorio:view`; el servidor los rechaza con 403 (UX inconsistente).
- **Sin versionado ni auditoría** de layout/secciones.
- Borrado de plano duro (solo protegido si está asignado a un evento).
- **Exportar TS no escribe archivos**; el snippet de `registry.ts` se aplica a mano.
- `Plano.config` (floor/camera/legend) existe en schema pero **no se edita en la UI**.
- `listar` no filtra por `flgActivo`.
- Sin tests dedicados para planos.
