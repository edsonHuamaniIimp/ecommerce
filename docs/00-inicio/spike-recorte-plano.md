# Spike — Recorte del plano por stand (RF-08)

> Objetivo: definir **cómo identificar el plano de un stand**, cómo generar el **recorte 2D**
> (pabellón + ubicación del stand) y cómo integrarlo en: (1) el preview desde *Mis solicitudes*,
> (2) la **imagen que se subirá al contrato**, y (3) un link directo al mapa con el stand preseleccionado.

## 1. Casos de uso

1. **Preview en Mis solicitudes** (`/dashboard/mis-solicitudes`): al hacer click en un stand de una
   reserva, ver un recorte del pabellón con su stand resaltado.
2. **Imagen para el contrato**: ese recorte se rasteriza (PNG) y se sube como adjunto del contrato.
3. **Link al mapa con preselección**: desde la bandeja de reservas, enlace a
   `/mapa?codigo=<pabellon>&bloque=<bloqueId>` que abre el pabellón y **selecciona el stand por defecto**.

## 2. Hallazgos (código actual)

### 2.1 Identificación del plano (stand → pabellón → macro)

| Paso | Fuente | Detalle |
|---|---|---|
| 1 | `gess_stand.bloque_id` | El stand guarda el `bloqueId` del plano (`EXT-IZQ-01`); es la **join key** (`PlanoBloque` lo documenta). |
| 2 | `plano_bloque` | `@@unique([planoId, bloqueId])` + `tipoCodigo`, `x`, `z`, `rotY`, `flgActivo`. Da el **plano (pabellón)** y la geometría del bloque. |
| 3 | `plano_seccion.planoHijoId` | Si el pabellón es hijo de un **macro**, `macrosQueContienen(planoHijoId)` da `{ id, codigo, nombre }` del macro. |
| Fallback | `gess_stand.rawData` | El sync/mockup guarda `plan`/`pabellon`; útil si el stand aún no está vinculado a un bloque. |

**Propuesta**: endpoint `GET /api/planos/ubicacion?bloqueId=...` (público, solo lectura) que resuelve:
`{ plano: { codigo, nombre }, bloque: { bloqueId, tipoCodigo, x, z, rotY }, macro: { codigo, nombre } | null }`.
Con eso el cliente no necesita conocer la BD.

### 2.2 Piezas reutilizables

- **`loadPlanoDefinition(codigo)`** (`src/lib/shared/planos/registry.ts`): ya descarga
  `/api/planos/publico?codigo=…` y produce `PlanoItem[]` (`id`, `dim {w,d,h,color}`, `type`, `x`, `z`, `rotY`)
  + `computeBounds` + `blockLabel`. **Es genérico** (planos del Laboratorio incluidos).
- **Payload público** (`/api/planos/publico`): `tipos` (dimensiones/color por código), `bloques`,
  `furniture`, `secciones` (macro), `imagenFondo`.
- **Carrito** (`plano-carrito-store`): `seleccionarSolo(planoId, info)` / `toggle` con
  `CarritoStandInfo { bloqueId, standCode, pabellonCodigo, tipoLabel }`.
- **Mapa** (`plano-dinamico`): ya acepta `?codigo=` y `?parent=`; las selecciones del carrito se
  restauran al cargar (valida que el bloque exista y no esté reservado).

### 2.3 Lo que falta

- Param `bloque` en `/mapa` + efecto que haga `seleccionarSolo` y abra el detalle del stand.
- Resolución `bloqueId → plano` en API (hoy solo se resuelve al revés: plano → bloques).
- Render del recorte (2D) y su rasterizado a PNG.

## 3. Opciones evaluadas

| Opción | Cómo | Pros | Contras |
|---|---|---|---|
| **A. Screenshot del canvas 3D** | Cámara ortográfica top-down + `canvas.toDataURL()` | “Igual” al 3D | Depende de WebGL/cámara/encuadre; frágil y pesado; difícil en headless; fondo/iluminación variables. **Descartada.** |
| **B. Render 2D desde los datos** ⭐ | Proyectar top-down `PlanoItem[]` (x,z,w,d,rotY) a **SVG** y recortar al stand | Determinista, liviano, sin deps nuevas, mismo dato que el 3D, sirve preview y contrato | Hay que definir el estilo (colores/etiquetas) |
| **C. Recorte sobre `imagenFondo`** | Si el pabellón tuviera una imagen 2D | Realista | Hoy `imagenFondo` es del **macro** (mapa de pabellones), no de pabellones; requeriría subir imágenes por pabellón. **Complementaria**, no base. |

**Recomendación: B**, con sub-opciones para el PNG:

- **B1 (cliente):** SVG inline → `Blob` → `Image` → `<canvas>` → `toBlob('image/png')` → `/api/upload`.
  Sin dependencias; sirve para preview y para “generar imagen” bajo demanda.
- **B2 (servidor, futuro):** rasterizar el mismo SVG con `sharp`/`resvg` para jobs automáticos de contrato.
  Hoy no hay ninguna de esas deps; no es necesaria para la F1.

> No se “convierte” el 3D a 2D: se **re-renderiza** el mismo modelo (bloques + tipos) en una vista
> top-down. El “recorte” es un `viewBox` del SVG centrado en el bloque objetivo con padding.

### 3.1 Diseño del recorte (SVG) — pabellón completo con el stand destacado

El objetivo es que el cliente **entienda su posición relativa**: la imagen muestra **todo el
pabellón** (o una región generosa con los stands vecinos), no un zoom apretado del bloque.

- **Vista**: bounds completos del pabellón + margen (~5–8%). Proyección top-down (x,z).
- **Destaque del stand objetivo** (lo primero que debe leerse):
  - relleno ámbar sólido `#f59e0b` + **borde grueso** oscuro + **halo/anillo** exterior;
  - etiqueta sobre el bloque: **“TU STAND”** + `bloqueId`/`standCode`;
  - si hay varios stands (reserva múltiple): todos destacados con numeración 1..n.
- **Contexto (resto de stands)**: cada bloque con el **color de su tipo** a opacidad media
  (para leer la distribución), y los **vecinos inmediatos** con etiqueta de `bloqueId` para
  orientación (los lejanos sin etiqueta si el pabellón es grande).
- **Referencias**: leyenda de tipos (color → Preferencial/Estándar/Isla/…), límites del pabellón,
  y opcional: flecha de acceso/orientación si el plano la define.
- **Opcional (pabellones grandes)**: inset en una esquina con el zoom del bloque destacado,
  manteniendo la vista general como principal.
- **Sin furniture** (claridad) o tenue; sin CSS externo (para poder rasterizar a PNG).
- **Fallback**: bloque sin tipo → color neutro; bloque no encontrado → “sin ubicación en plano”.

Rotación: rectángulo centrado en `(x, z)` con `rotate(rotY)` (mismo criterio que el 3D); las
etiquetas **no** rotan (se dibujan horizontales, centradas sobre el bloque).

## 4. Integración por caso de uso

### 4.1 Preview en Mis solicitudes
- `SolicitudDTO` ya expone `bloqueId` (simple). Para reserva múltiple, resolver cada stand vía
  `solicitud_stand → gess_stand.bloqueId` (exponer `bloqueIds[]` en el DTO si hace falta).
- Componente nuevo **`<RecortePlano bloqueId plazo? />`**: llama `/api/planos/ubicacion`,
  `loadPlanoDefinition(codigo)` y dibuja el SVG **del pabellón completo con el stand destacado**
  (vista de contexto, no zoom apretado). Se abre en un `Dialog` al click del stand
  (los chips de stand ya se renderizan en el detalle).

### 4.2 Imagen para el contrato
- El mismo componente expone `exportarPng(): Promise<Blob>` (B1). Botón “Generar imagen del recorte”
  (o generación automática en la fase de contrato) → sube a `/api/upload` → se persiste la URL.
- La imagen del contrato es la **vista de contexto del pabellón con el stand destacado**, para que
  el cliente identifique su posición respecto de los demás stands.
- Dónde persistir: campo nuevo en `solicitud` (`recorte_plano_url`) o `solicitud_documento` con
  `categoria = "anexo"` y `requisito = null` (etiqueta “Ubicación del stand”). Decidir en la fase.

### 4.3 Link al mapa con stand preseleccionado
- En la bandeja de reservas (cliente: *Mis solicitudes*; admin: bandeja de solicitudes) agregar
  link “Ver en el mapa” → `/mapa?codigo=<pabellon>&bloque=<bloqueId>&parent=<macro>`.
- En `plano-dinamico`: leer `bloque`; cuando `dataReady` y el bloque exista y **no** esté reservado,
  `seleccionarSolo(planoId, carritoInfoDe(bloque))` + `setDetailModal(info)`; opcional: centrar cámara
  (`OrbitControls` target al bloque).

## 5. Plan de implementación

| Fase | Entregable | Tamaño |
|---|---|---|
| **F1. Ubicación + render** ✅ | `GET /api/planos/ubicacion` + `<RecortePlano>` (SVG) + preview en Mis solicitudes | M |
| **F2. Imagen** ✅ | `exportarPng()` (canvas) + botón "Guardar imagen para el contrato" + `solicitud.recorte_plano_url` (`POST /api/solicitudes/recorte-plano`) | S–M |
| **F3. Mapa** ✅ | Param `bloque` + preselección/detalle (y centrado opcional pendiente) | S |
| **F4. Contrato** | Consumir `recortePlanoUrl` en el generador de contrato (depende de Fase 2 del contrato) | — |

## 6. Riesgos / edge cases

- **`bloqueId` repetido** en más de un plano: resolver por planos del **evento** del stand y preferir
  el plano vigente con macro padre; si hay ambigüedad, elegir el primero y registrar warning.
- Stand **sin `bloqueId`** o no vinculado a un plano: mostrar “Sin ubicación en plano” (no romper).
- Plano **inactivo** (`flgActivo=false`): no usar para el recorte.
- **Rotación** de bloques: el SVG debe rotar el rectángulo (no el texto/etiqueta).
- Reserva **múltiple**: preview por stand (loop) o recorte único con todos resaltados.
- **Pabellón grande** (p. ej. GESS, 52 bloques): la vista completa sigue siendo ligera en SVG;
  limitar etiquetas a los vecinos del stand y ofrecer el inset de zoom como refuerzo.
- Raster **SVG→canvas**: usar solo estilos inline (sin CSS externo) y fuentes del sistema; validar en
  Safari/iOS (a veces requiere `width/height` explícitos en el SVG).
- Privacidad: la imagen del recorte no expone razón social; el link al mapa público ya lo hace (RF-09).

## 7. Recomendación

Ejecutar **F1** (endpoint + componente + preview), luego **F3** (link al mapa, que además mejora la
navegación de la bandeja) y **F2** (PNG) cuando el contrato lo necesite. La opción B garantiza que el
recorte sea **idéntico en preview y contrato** sin depender del render 3D ni de dependencias nuevas.
