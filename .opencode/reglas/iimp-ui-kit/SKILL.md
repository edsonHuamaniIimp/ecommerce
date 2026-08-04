---
name: iimp-ui-kit
description: Lineamientos de estilo y frontend obligatorios para proyectos IIMP. Usar SIEMPRE al construir UI (páginas, componentes, formularios, tablas) con Next.js + Tailwind. Cubre el design system @nrivera-iimp/ui-kit-iimp (shadcn), verticales/theming (proexplo, wmc, gess, perumin), reglas de tipado estricto y compatibilidad con Google Translate/Radix.
---

# Lineamientos IIMP — UI Kit y Frontend

Fuente: paquete `@nrivera-iimp/ui-kit-iimp` (npm) + repo `iimp-projects/multieventos`
(`RULES.MD`, `bible.md`). Estas reglas son **obligatorias** para todo el frontend.

## 1. Regla de oro de componentes

- ✅ **SIEMPRE** usar componentes de `@nrivera-iimp/ui-kit-iimp` (está basado en shadcn/ui).
- ❌ **NUNCA** usar HTML puro para componentes de UI (`div/input/button` como controles,
  botones, inputs, selects, etc.). Tailwind se usa **solo para maquetación/layout**.
- El diseño debe ser: **limpio, moderno, corporativo y consistente**.

## 2. Tipado (deploy = ZERO ERRORS)

- Tipado fuerte y estricto en todo. ❌ **Prohibido `any`**.
- ❌ No usar `""` ni `Record<string, any>` como tipo; modelar tipos verídicos.
- Nada hardcodeado. El pipeline de despliegue es **cero errores** de ESLint y TypeScript.
- No ejecutar `npm run build` como verificación de rutina (lo maneja el owner);
  verificar con `tsc --noEmit` y lint.

## 3. Compatibilidad Google Translate + Radix (CRÍTICO)

En cualquier componente flotante/portal de shadcn/Radix (`Select`, `Popover`,
`Dropdown`, `Tooltip`, etc.), **envolver el texto hijo en `<span>`**:

```tsx
// ✅ correcto
<SelectItem value="x"><span>{label}</span></SelectItem>
// ❌ incorrecto  -> crash "Failed to execute 'removeChild' on 'Node'"
<SelectItem value="x">{label}</SelectItem>
```

Google Translate inyecta `<font>` mutando el DOM y corrompe la referencia de React.

## 4. Verticales y theming

Motor HSL dinámico. Verticales soportadas y su color primario:

| Vertical   | Primario (HSL)        | Radius   |
| ---------- | --------------------- | -------- |
| `proexplo` | `hsl(24 83% 50%)` 🟠  | 0.75rem  |
| `wmc`      | `hsl(191 100% 43%)` 🔵| 0.3rem   |
| `gess`     | `hsl(140 66% 32%)` 🟢 | 1rem     |
| `perumin`  | `hsl(34 69% 43%)`     | 0.5rem   |

- La vertical se aplica como clase `vert-<vertical>` + atributo `data-vertical` en `<html>`.
- Persistencia en `localStorage` con la clave `iimp-vertical`.
- Cambio dinámico por URL: `?theme=wmc` (el provider lo guarda y limpia la URL).
- Usar tokens semánticos: `bg-primary`, `text-primary-foreground`, `bg-secondary`,
  `bg-muted`, `bg-card`, `border-border`, etc. **No** colores hardcodeados.
- Componentes de theming: `VerticalProvider`, `useVertical`, `VerticalSwitcher`,
  tipo `Vertical`.

## 5. Setup del proyecto (Next.js + Tailwind v4)

Dependencias: `@nrivera-iimp/ui-kit-iimp lucide-react clsx tailwind-merge next-themes`.

`tailwind.config.ts` (preset con colores/animaciones/shadcn):

```ts
import { iimpPreset } from "@nrivera-iimp/ui-kit-iimp/preset";
const config = {
  presets: [iimpPreset],
  content: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/@nrivera-iimp/ui-kit-iimp/dist/**/*.{js,mjs}",
  ],
};
export default config;
```

`src/app/globals.css` (Tailwind v4 — el `@source` es imprescindible):

```css
@import "tailwindcss";
@import "@nrivera-iimp/ui-kit-iimp/styles.css";
@config "../../tailwind.config.ts";
@source "../../node_modules/@nrivera-iimp/ui-kit-iimp/dist";
```

`layout.tsx`: `<html lang="es" suppressHydrationWarning>`, script **anti-flash** en
`<head>` (lee `iimp-vertical`/`?theme` y aplica `vert-*` + `data-vertical` antes de
hidratar) y envolver la app con `ThemeProvider` (next-themes, `attribute="class"`) +
`VerticalProvider defaultVertical="proexplo"`.

## 6. Dark mode

Nativo vía clase `.dark`. Usar prefijos `dark:` de Tailwind. `next-themes` gestiona
la clase; `suppressHydrationWarning` en `<html>` es obligatorio.

## 7. Responsive Design — Reglas para Bandejas y Tablas

Estas reglas aplican a toda bandeja de datos (tablas con paginacion, busqueda y filtros).

### 7.1 Layout — Padding unico desde el layout

- **El padding horizontal lo define el layout**, NO cada pagina.
- Layout del dashboard: `p-4 sm:p-6 lg:p-10` en el `<main>` o wrapper principal.
- Cada pagina usa `flex-1 py-6` (solo padding vertical). **Sin `px-*` en paginas.**
- Esto evita **doble padding** en mobile que desperdicia espacio horizontal.

```
// ✅ layout.tsx
<main className="flex-1 p-4 sm:p-6 lg:p-10">{children}</main>

// ✅ page.tsx
<main className="flex-1 py-6">
  <div className="mx-auto w-full max-w-7xl space-y-4">...</div>
</main>

// ❌ page.tsx — doble padding
<main className="flex-1 px-6 py-6 lg:px-10">...</main>
```

### 7.2 Tablas — Columnas responsive

- Columnas secundarias se ocultan progresivamente con `hidden sm:table-cell`, `hidden md:table-cell`, `hidden lg:table-cell`.
- La columna principal (identificador) y la de estado **nunca** se ocultan.
- El `overflow-x-auto` en el wrapper de tabla permite scroll horizontal cuando es inevitable.
- Las etiquetas de columna usan `text-[10px] uppercase` para ahorrar espacio.
- Contenido de celdas: `whitespace-nowrap` + `max-w-[Xpx] truncate` para evitar que una celda larga rompa el layout.

### 7.3 Barra de busqueda + Per-page

- En desktop: `flex gap-2` con busqueda `flex-1` y selector `shrink-0`.
- En mobile: `flex flex-col sm:flex-row gap-2`. La busqueda toma `w-full`.

```
<div className="flex flex-col sm:flex-row gap-2">
  <div className="relative w-full sm:flex-1">
    <Search ... />
    <Input ... />
  </div>
  <Select ...>
    <SelectTrigger className="w-[70px] h-8 shrink-0" />
  </Select>
</div>
```

### 7.4 Paginacion responsive

- Botones de "primera" y "ultima" pagina: `hidden sm:inline-flex` (solo visibles en desktop).
- Numeros de pagina mas chicos en mobile: `h-6 w-6 sm:h-7 sm:w-7 text-[10px] sm:text-xs`.
- Espaciado reducido: `gap-0.5 sm:gap-1`.
- El contenedor de paginacion y el texto de resultados: `flex-col sm:flex-row` para que se apilen en mobile.

### 7.5 Iconos de accion

- Solo iconos (sin texto) con tooltip `side="top"`.
- Tamaño uniforme: `h-7 w-7 p-0` en todas las resoluciones.
- Agrupados con `flex gap-0.5 justify-end`.

### 7.6 Prevent horizontal overflow

- El contenedor `flex-1` siempre necesita `min-w-0` para que elementos hijos no expandan el layout mas alla del viewport.
- Las tablas dentro de `max-w-7xl` deben tener `overflow-x-auto` en su wrapper directo.

## 8. Checklist antes de dar una tarea de UI por terminada

- [ ] Todos los controles vienen del UI Kit (no HTML puro).
- [ ] Texto en Select/Popover/Dropdown envuelto en `<span>`.
- [ ] Sin `any`, sin hardcodeos; `tsc --noEmit` y lint en cero errores.
- [ ] Colores via tokens semanticos (respeta la vertical activa).
- [ ] Badges de estado usan `pointer-events-none` + colores explicitos, sin `variant="default"`.
- [ ] Tooltips con `side="top"`.
- [ ] Layout: padding solo en layout (`p-4 sm:p-6 lg:p-10`), paginas solo `py-6`.
- [ ] Tablas: columnas responsive (`hidden sm:table-cell`, etc.), `overflow-x-auto`.
- [ ] Busqueda + per-page: `flex-col sm:flex-row`.
- [ ] Paginacion: compacta en mobile (`h-6 w-6`, sin primera/ultima).
- [ ] `min-w-0` en `flex-1` para evitar overflow horizontal.
- [ ] Funciona en light y dark.
