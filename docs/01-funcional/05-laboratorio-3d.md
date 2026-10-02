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

- Creación de mapa con código autogenerado `pab-#####` (regenerable) y validación de formato/unicidad en vivo.
- Canvas con `@react-three/fiber` + `OrbitControls` y grilla según bounds.
- **Líneas de apoyo**: rejilla de 1 m (líneas cada 5 m), ejes X=0/Z=0 y guías magnéticas al arrastrar (el objeto se alinea al centro de otro objeto o al origen cuando está a menos de `EDITOR_PLANO.UMBRAL_GUIA`). El checkbox "Lineas de apoyo" de la barra activa/desactiva rejilla, ejes y guías (solo afecta al editor).
- Bloques con dimensiones/color por tipo; mobiliario/kiosko.
- **Decoraciones opt-in**: paleta `Kiosko` / `Plaza` (preset: 4 mesas + 16 sillones) / `Mesa` / `Sillon` / `Piso` / `Persona`, drag&drop al mapa o alta en el centro, panel de propiedades (RefId, X/Z, rotación, ancho/fondo en Piso, tonos en Persona) y eliminar. No hay componentes automáticos: el plano renderiza exactamente el furniture declarado (`plano_furniture.tipo` + `config`). El piso base (`Floor`) sigue siendo parte del visor y se adapta a los bounds.
- Arrastre con snap `0.25`; creación de bloque desde panel o diálogo "Agregar bloque".
- **Creación masiva de bloques**: el diálogo "Agregar bloque" tiene campo `Cantidad` (1–100). Genera IDs consecutivos a partir del ID base (`BLOQUE-11` → `BLOQUE-11…`, `VIP4334` → `VIP4334…`, sin número final agrega correlativo `-01`) omitiendo IDs ya existentes, y los coloca en cuadrícula (5 por fila) para no superponerlos. Con cantidad 1 se conserva el comportamiento anterior (error si el ID ya existe). Validación en tres capas: preview en el modal, `handleAdd` y filtro final al insertar en el estado.
- **Rotación**: al seleccionar un bloque o decoración aparece una manija en el canvas (drag con snap 5°, Shift = 15°) y el panel permite grados exactos y giros de ±90°. El visor público respeta `rotY` de `plano_bloque` y `plano_furniture`.
- Edición del bloque: **ID** (se vincula a `gess_stand.bloqueId`), tipo, **tipología** (Complejo/Simple/Octanorm, `TIPOLOGIAS_STAND`), coordenadas X/Z, eliminar. El diálogo "Agregar bloque" ya no declara tipología: crea con `Simple` por defecto y la tipología se edita en el panel del bloque seleccionado.
- **Borrado lógico con checklist "Mostrar eliminados"**: tipos de bloque, bloques y decoraciones se marcan `flgActivo = false` en lugar de borrarse. Los eliminados se ocultan del canvas y de la paleta; al activar el checklist se muestran (atenuados/rojo) y se pueden restaurar desde su panel. Regla: un tipo en uso por bloques no se puede eliminar (hay que reasignar o eliminar esos bloques primero). El visor público y el export TS ignoran los inactivos.
- Edición de tipos de bloque (lápiz en el panel): código (con cascada a los bloques), label, nombre, W/D/H y color.
- **Tipos transversales**: existe un catálogo global `tipo_bloque_global` (migración 0027) que se activa con la env `TIPOS_BLOQUE_GLOBALES=1`. Con el flag activo, editor, visor y export leen los tipos del catálogo: un mapa nuevo ya ve todos los tipos y las altas/ediciones/bajas se propagan a todos los mapas (baja lógica bloqueada si el tipo tiene bloques en cualquier mapa). Sin el flag, el comportamiento es el actual por mapa y el botón "Traer tipos de otros mapas" importa los sugeridos. Estrategia completa en `docs/03-arquitectura/tipos-bloque-globales.md`.
- Guardar layout (`POST /api/planos/guardar-layout`), importar/exportar JSON.
- **Exportar TypeScript**: genera 4 archivos (`bloques.ts`, `tipos.ts`, `construccion.ts`, `index.ts`) + snippet para `registry.ts`, mostrados para copiar/descargar. **No escribe en disco**.

## 4. Funcionalidad — mapas macro

- Subida/cambio de fondo de pabellones: **imagen o PDF**. El PDF se renderiza a canvas con `pdfjs-dist` (pagina 1, sin el chrome del visor nativo) tanto en el editor como en `/mapa`. El worker se sirve desde `public/pdf.worker.min.mjs` (regenerar con `npm run pdf:worker` al actualizar la dependencia).
- Secciones rectangulares en coordenadas normalizadas 0-1, con mover/redimensionar/rotar (snap 5°), zoom (Ctrl+rueda) y pan.
- Edición de sección: código, nombre, color, rotación y asignación de **plano 3D hijo**.
- Guardar secciones (`POST /api/planos/guardar-secciones`).
- Regla: un plano `simple` pertenece a **un solo macro** a la vez.

## 5. Endpoints (`/api/planos/[...slug]`)

| Método | Acción | Permiso |
|---|---|---|
| `GET` | `listar`, `detalle`, `planos-evento`, `macros-de-plano`, `ocupacion`, `tipos-sugeridos` | sesión / `laboratorio:view` |
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
