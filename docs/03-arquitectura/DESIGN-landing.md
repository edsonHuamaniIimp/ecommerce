# DESIGN.md — Landing `/landing` (solo para esa página)

> Fuente: [designmd.app](https://designmd.app/library/minimalism-swiss-style) — *Minimalism & Swiss Style*.
> **Alcance:** este diseño aplica **únicamente** a la página `/landing`. El resto de la app
> sigue el UI Kit IIMP (`@nrivera-iimp/ui-kit-iimp`) y los tokens semánticos.

```markdown
---
version: "alpha"
name: "Minimalism & Swiss Style"
description: "Minimalist landing page. Ideal for b2b saas, enterprise apps, design saas, professional tools. AI-ready template."
colors:
  primary: "#000000"
  secondary: "#FFFFFF"
  tertiary: "#F5F1E8"
  neutral: "#808080"
  surface: "#B38B6D"
typography:
  h1:
    fontFamily: sans-serif
    fontSize: 2.25rem
    fontWeight: 700
  body-md:
    fontFamily: sans-serif
    fontSize: 1rem
    fontWeight: 400
  label-caps:
    fontFamily: sans-serif
    fontSize: 0.75rem
    fontWeight: 500
rounded:
  sm: 2px
  md: 4px
  lg: 8px
spacing:
  sm: 2.0rem
  md: 4.0rem
  lg: 8.0rem
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    rounded: "{rounded.sm}"
    padding: 12px
---

## Overview
Minimalist landing page. Clean, geometric, functional, grid-based. High contrast,
spacious, essential elements only. Density 3/10 (airy), variance 2/10 (structured),
motion 4/10 (subtle).

## Colors
- Black (#000000): dark surface, primary background.
- White (#FFFFFF): light surface, cards.
- Beige (#F5F1E8): extended palette, decorative.
- Grey (#808080): secondary text, borders, muted.
- Taupe (#B38B6D): extended palette, decorative.

## Typography
- Display/Hero: sans-serif, 700, tight tracking.
- Body: sans-serif, 400, 16px/1.6, max 72ch.
- Labels/Captions: 0.875rem, 500, slight letter-spacing, uppercase for section labels.
- Scale: Hero clamp(2.5rem,5vw,4rem) · H1 2.25rem · H2 1.5rem · Body 1rem.

## Layout
- CSS Grid base. Max-width 1280px centrado, padding lateral 1.5rem.
- Base unit 0.5rem (8px). Section gaps clamp(4rem, 8vw, 8rem).
- Hero split-screen (texto izq, visual der). Secciones zig-zag / grid asimétrico.
- Colapso a 1 columna < 768px. Sin overflow horizontal.
- z-index: base 0 / sticky-nav 100 / overlay 200 / modal 300 / toast 500.

## Elevation & Depth
- Hover 200-250ms ease-out. Transform + opacity únicamente.
- Entrada: fade + translateY(16px→0) 420ms. Stagger 80ms.
- Sombras nulas o muy sutiles; sin gradientes.

## Shapes
- Radio base 0px. Ver escala `rounded` en el front matter.

## Components
- Primary Button: bordes rectos (0px), relleno accent, hover 8% darken + lift sutil, sin glows.
- Secondary/Ghost: outline 1.5px muted, texto en primario, hover fill sutil.
- Cards: bordes rectos, surface, 1px border, sombra sutil (0 2px 12px rgba(0,0,0,.06)).
- Inputs: label arriba, border 1px, focus ring 2px accent.
- Navigation: activo con indicador accent, font-weight 500.

## Do's and Don'ts
- No emojis: usar iconos (Lucide).
- No #000 puro para texto largo: usar off-black/charcoal.
- No 3 columnas iguales: zig-zag o grid asimétrico.
- No `h-screen`: usar `min-h-[100dvh]`.
- No clichés: "Elevate", "Seamless", "Unleash", "Next-Gen".
- Sí: grid 12-16 col, jerarquía clara, sin decoración innecesaria, WCAG AAA, responsive.
```

## Cómo se aplicó en `/landing`
- `src/app/(public)/landing/page.tsx` (Server Component) con secciones: Hero, beneficios,
  "cómo funciona" (pasos del flujo real de reserva), capacidades, CTA final y footer.
- Paleta y formas tomadas del front matter (blanco/negro/beige/taupe, bordes rectos).
- Item nuevo en el menú horizontal (`src/components/layout/header.tsx`): **"Reserva de Stands"** → `/landing`.
