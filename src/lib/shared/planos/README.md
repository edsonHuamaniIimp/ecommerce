# Planos 3D — Guía completa

Cada plano 3D representa un evento y su layout espacial. Esta guía cubre la creación de planos, su integración con la capa de persistencia (`GessStand`), y el flujo completo desde la importación de datos hasta la visualización interactiva.

## Índice
1. [Estructura de un plano](#estructura-de-un-plano)
2. [Cómo crear un nuevo plano](#cómo-crear-un-nuevo-plano)
3. [Registro de planos](#registro-de-planos)
4. [Flujo de datos: API → BD → Plano 3D](#flujo-de-datos)
5. [Vinculación con GessStand](#vinculación-con-gessstand)
6. [Página `/plano`](#página-plano)
7. [Estados visuales de bloques](#estados-visuales-de-bloques)

---

## Estructura de un plano

Cada plano vive en `src/lib/planos/<nombre>/`:

```
src/lib/planos/
├── registry.ts              ← Registro central
├── README.md                ← Esta guía
└── gess/                    ← Plano del evento GESS
    ├── bloques.ts           ← IDs de los bloques
    ├── tipos.ts             ← Tipos, dimensiones, etiquetas
    ├── construccion.ts      ← Layout 3D
    └── index.ts             ← Re-exports
```

---

## Cómo crear un nuevo plano

### 1. Crear carpeta

```bash
mkdir -p src/lib/planos/perumin
```

### 2. Definir tipos y dimensiones (`tipos.ts`)

**Cada plano define sus propios tipos de bloque.** No están limitados a S/P/C/BG. Podés definir los tipos que necesite el layout del evento.

Debe exportar:

| Export | Tipo | Descripción |
|--------|------|-------------|
| `Dim` | `interface { w, d, h, color }` | Dimensiones de cada tipo de bloque |
| `DIMENSIONES` | `Record<string, Dim>` | Catálogo de tipos (S_vert, BG, P, C) |
| `BlockType` | `type` | Tipos de bloque del plano |
| `Item` | `interface { id, dim, type, x, z }` | Un bloque posicionado |
| `BLOCK_LABEL` | `Record<BlockType, { label, nombre }>` | Etiquetas para la UI |

```ts
export interface Dim { w: number; d: number; h: number; color: string; }

export const DIMENSIONES: Record<string, Dim> = {
  S_vert:  { w:3.2, d:2.5, h:2.4, color:"#FFD700" },
  BG:      { w:3.5, d:3.5, h:3.0, color:"#006400" },
  P:       { w:2, d:2, h:2.4, color:"#32CD32" },
  C:       { w:2, d:2, h:2.0, color:"#90EE90" },
};

export type BlockType = "S" | "BG" | "P" | "C";

export interface Item { id: string; dim: Dim; type: BlockType; x: number; z: number; }

export const BLOCK_LABEL: Record<BlockType, { label: string; nombre: string }> = {
  S:  { label: "S",  nombre: "Columna" },
  BG: { label: "BG", nombre: "Isla Grande" },
  P:  { label: "P",  nombre: "Preferencial" },
  C:  { label: "C",  nombre: "Estándar A" },
};
```

### 3. Definir IDs de bloques (`bloques.ts`)

Cada bloque debe tener un ID **único y estable**. Estos IDs son la clave para la vinculación con `GessStand.bloqueId`.

```ts
export const MI_PLANO_BLOQUE_IDS = [
  "BLOQUE-A1", "BLOQUE-A2",
  // ... todos los bloques
] as const;
```

### 4. Construir el layout (`construccion.ts`)

Tres funciones obligatorias:

```ts
/** Devuelve todos los bloques con sus posiciones 3D (x, z) */
export function buildItems(): Item[] { ... }

/** Devuelve mobiliario decorativo (kioskos) */
export function buildFurniture(): Furniture[] { ... }

/** Calcula los bounds del plano para la cámara */
export function computeBounds(items: Item[]): Bounds { ... }
```

### 5. Registrar (`registry.ts`)

```ts
export const PLANOS: Record<string, PlanoDefinition> = {
  perumin: {
    id: "perumin",
    nombre: "PERUMIN",
    descripcion: "Plano isometrico del evento PERUMIN",
    buildItems: peruminBuildItems,
    computeBounds: peruminComputeBounds,
    buildFurniture: peruminBuildFurniture,
    bloqueIds: PERUMIN_BLOQUE_IDS,
    blockLabel: peruminLabels,
  },
};
```

---

## Registro de planos

`src/lib/planos/registry.ts` es el catálogo central. Cada plano registrado tiene un `id` único que se guarda en `evento.plano` (BD).

```ts
export interface PlanoDefinition {
  id: string;
  nombre: string;
  descripcion: string;
  buildItems: () => Item[];
  computeBounds: (items: Item[]) => Bounds;
  buildFurniture: () => Furniture[];
  bloqueIds: readonly string[];
  blockLabel: Record<string, { label: string; nombre: string }>;
}
```

Funciones públicas:
- `getPlano(id)` → `PlanoDefinition | undefined`
- `listPlanos()` → `{ id, nombre, descripcion }[]`

---

## Flujo de datos

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. IMPORTAR DATOS                                               │
│                                                                 │
│  KBEventos API ──→ POST /api/planogess ──→ proxy ──→ datos     │
│       ↓                                                         │
│  Mantenedor: Paso 1 — seleccionar ──→ POST /api/gess/sync      │
│       ↓                                                         │
│  gess_stand (BD)                                                │
│    eventoId ──→ FK al evento seleccionado en presala            │
│    standCode ──→ "01", "02"... (uid del API)                    │
│    tipoStand ──→ PREFERENCIAL / ESTANDAR_01 / ESTANDAR_02 / ISLAS│
│    medidas ────→ "3000.00 US$", "2000.00 US$"                   │
│    empresa ────→ CETEMIN, CEMENTOS PACASMAYO...                 │
│    estado ─────→ Disponible / Reservado                         │
│    bloqueId ───→ EXT-IZQ-01, ISLA-GRANDE-1... (nullable)        │
│    rawData ────→ JSON completo del API                          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ 2. VINCULAR                                                     │
│                                                                 │
│  Mantenedor: Paso 2                                             │
│    Bloque 3D ──→ Combobox ──→ selecciona registro BD           │
│       ↓                                                         │
│    PATCH /api/gess  { id, bloqueId }                            │
│       ↓                                                         │
│    gess_stand.bloqueId = "EXT-IZQ-01"                           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ 3. VISUALIZAR EN /plano                                         │
│                                                                 │
│  GET /api/gess?eventoId=xxx ──→ devuelve todos los registros    │
│       ↓                                                         │
│  linkedMap: Map<bloqueId, { standCode, empresa, estado... }>    │
│       ↓                                                         │
│  Bloque3D: color gris si reservado, normal si disponible        │
│  Sidebar: al seleccionar, muestra código, tipo, precio, empresa │
└─────────────────────────────────────────────────────────────────┘
```

### Escalabilidad por evento

Cada registro en `gess_stand` pertenece a UN evento (`eventoId` FK). Al cambiar de evento en presala, el JWT se actualiza con el nuevo `eventoId`. Todas las consultas (API, vinculación, plano) usan ese `eventoId` como filtro. Esto aísla los datos entre versiones de evento.

---

## Vinculación con GessStand

Los bloques del plano tienen **IDs fijos** (ej. `EXT-IZQ-01`). Los registros importados del API tienen `standCode` (ej. `"01"`). La vinculación se hace a través del campo `gess_stand.bloqueId`:

```
gess_stand.bloqueId = "EXT-IZQ-01"   ← apunta a un bloque del plano 3D
```

Un mismo `bloqueId` solo puede estar asignado a UN registro por evento (validado en UI). El Combobox en Paso 2 filtra los registros ya vinculados para que no aparezcan como opción en otros bloques.

### Limpieza de vínculos

Para desvincular, seleccionar `— Sin vincular —` en el Combobox. Esto ejecuta `PATCH /api/gess { id, bloqueId: null }`.

---

## Página `/plano`

Ruta pública que muestra el plano 3D interactivo.

### Carga del evento

1. Lee `localStorage("iimp-evento-publico")` → obtiene `eventoId` (flujo público)
2. Si no existe, consulta JWT (`authService.getSession()`) → (flujo autenticado)
3. Si no hay eventoId → redirige a `/presala?returnTo=/plano`
4. Consulta `/api/eventos/publico?id=xxx` → obtiene el campo `plano` del evento
5. Usa `getPlano(plano)` del registry → carga el layout correcto
6. Si el evento no tiene plano asignado → muestra "Plano en construcción"

### Interacción con bloques

- **Clic en bloque disponible**: se agrega a la selección (multi-select con toggle)
- **Clic en bloque reservado**: muestra información (empresa, código, precio) pero no permite reservar
- **Selección múltiple**: sidebar muestra lista de bloques seleccionados, botón "Reservar"
- **Bloque reservado en selección**: botón "Reservar" se deshabilita ("Hay bloques no disponibles")

### Estados visuales

| Estado | Color | Comportamiento |
|--------|-------|----------------|
| **Disponible** | Color del tipo (verde, dorado, etc.) | Clic → agrega a selección |
| **Reservado** | Gris `#9ca3af` | Clic → muestra info, no seleccionable |
| **Seleccionado** | Ámbar `#f59e0b` con glow | Clic → deselecciona |

### Sidebar de detalle

Al seleccionar un bloque vinculado, muestra:

```
┌─ Stand vinculado ─────────────┐
│ Código    01                   │
│ Tipo      PREFERENCIAL         │
│ Precio    3000.00 US$          │
│ Estado    [Reservado]          │
│ ┌─ Empresa ──────────────────┐ │
│ │ CEMENTOS PACASMAYO S.A.A.  │ │
│ └────────────────────────────┘ │
└────────────────────────────────┘
```

Fondo verde (esmeralda) para disponibles, rojo claro para reservados.

### Leyenda

El panel lateral muestra la leyenda de colores:
- ■ S (Columna) — dorado
- ■ P (Preferencial) — verde
- ■ C (Estándar A) — verde claro
- ■ BG (Isla Grande) — verde oscuro
- ■ Reservado — gris

---

## Modelos 3D compartidos

Los modelos 3D son compartidos entre todos los planos desde `src/components/plano/plano-isometrico.tsx`:

- `Bloque3D` — bloque individual con selección y color por estado
- `Kiosko` — kiosko rústico CSG de 5 piezas
- `ConjuntoPlaza` — 4 mesas centrales + 16 sillones
- `Persona` — figura humana con capsuleGeometry (6 colores de cabeza)
- `Floor` — piso del plano

Cada plano solo define la **disposición espacial** (buildItems, buildFurniture). Los modelos se renderizan igual para todos los eventos.
