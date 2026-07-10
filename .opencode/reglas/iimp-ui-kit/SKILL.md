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

## 7. Checklist antes de dar una tarea de UI por terminada

- [ ] Todos los controles vienen del UI Kit (no HTML puro).
- [ ] Texto en Select/Popover/Dropdown envuelto en `<span>`.
- [ ] Sin `any`, sin hardcodeos; `tsc --noEmit` y lint en cero errores.
- [ ] Colores vía tokens semánticos (respeta la vertical activa).
- [ ] Funciona en light y dark.
