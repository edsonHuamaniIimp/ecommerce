---
name: framer-motion
description: Framer Motion para animaciones 2D complejas en Next.js — variants, layout animations, AnimatePresence, scroll-triggered, gestures, spring physics y orquestación
---

# Framer Motion — Animaciones 2D Complejas en Next.js

## Summary

Framer Motion (v12+) es la librería standard para animaciones declarativas en React/Next.js. Proporciona `motion` components con spring physics, layout animations automáticas, orquestación con `AnimatePresence`, animaciones basadas en scroll con `useScroll`/`useTransform`, y gestos (`drag`, `hover`, `tap`, `pan`). En Next.js App Router, los componentes que usan Framer Motion deben marcarse `"use client"`.

## When to Use

**Best for:**
- Page transitions y route animations en Next.js App Router
- Animaciones de entrada/salida de componentes con `AnimatePresence`
- Layout animations suaves (reordenamiento de listas, grid responsive)
- Animaciones basadas en scroll (parallax, progress bars, sticky effects)
- Gestos interactivos (drag & drop, swipe, hover effects complejos)
- Orquestación de secuencias multi-step con `variants` + `staggerChildren`
- Micro-interacciones y feedback visual (botones, notificaciones, loaders)

**Consider alternatives (CSS animations) when:**
- Solo necesitas animaciones CSS simples (`transition`, `@keyframes`)
- La animación es puramente decorativa y no interactiva
- El elemento puede animarse con Tailwind v4 (`animate-*`, `transition-*`)

## Quick Start

```tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";

// Componente animado simple
function FadeIn({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}

// Con AnimatePresence para mount/unmount
function AnimatedList({ items, isVisible }: { items: string[]; isVisible: boolean }) {
  return (
    <AnimatePresence mode="popLayout">
      {isVisible &&
        items.map((item) => (
          <motion.div
            key={item}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            layout
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            {item}
          </motion.div>
        ))}
    </AnimatePresence>
  );
}
```

---

## Core Concepts

### motion Components

Todo elemento HTML puede convertirse en animable con el prefijo `motion.`:

```tsx
<motion.div />   // div animable
<motion.button /> // button animable
<motion.span />   // span animable
<motion.li />     // list item animable
```

Props esenciales:
- `initial` — estado inicial (antes del mount)
- `animate` — estado objetivo
- `exit` — estado al desmontar (requiere `AnimatePresence`)
- `transition` — configuración de la transición (duración, easing, spring)
- `layout` — anima cambios de posición/tamaño automáticamente
- `layoutId` — conecta layouts entre componentes diferentes (shared layout)

### Variants — Orquestación Declarativa

Las variantes permiten definir estados nombrados y orquestar hijos:

```tsx
"use client";
import { motion } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,       // Delay entre cada hijo
      delayChildren: 0.2,          // Delay antes del primer hijo
      staggerDirection: 1,         // 1 = forward, -1 = reverse
      when: "beforeChildren",      // Animar padre antes que hijos
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 260, damping: 20 },
  },
};

function StaggeredGrid({ items }: { items: Array<{ id: string; text: string }> }) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-3 gap-4"
    >
      {items.map((item) => (
        <motion.div
          key={item.id}
          variants={itemVariants}
          className="rounded-xl bg-white p-6 shadow-lg dark:bg-gray-800"
        >
          {item.text}
        </motion.div>
      ))}
    </motion.div>
  );
}
```

### AnimatePresence — Animaciones de Exit

`AnimatePresence` permite animar componentes cuando se desmontan del DOM. Esencial para modales, toasts, route transitions, y listas dinámicas.

```tsx
"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

function ModalExample() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Abrir</button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            {/* Modal */}
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div
                className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl dark:bg-gray-900"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-2xl font-bold">Modal</h2>
                <button
                  className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white"
                  onClick={() => setIsOpen(false)}
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
```

Props clave de `AnimatePresence`:
- `mode="wait"` — Espera a que termine exit antes de montar el nuevo (para page transitions)
- `mode="popLayout"` — Permite que los elementos restantes se reorganicen durante exit
- `initial={false}` — Omite animación inicial en primer render
- `onExitComplete` — Callback cuando todos los exits terminan

### Layout Animations — Reordenamientos Automáticos

La prop `layout` anima automáticamente cambios de posición y tamaño sin necesidad de calcular manualmente:

```tsx
"use client";
import { motion, LayoutGroup } from "framer-motion";
import { useState } from "react";

function ReorderableList({ items: initialItems }: { items: string[] }) {
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<string | null>(null);

  function shuffle() {
    setItems([...items].sort(() => Math.random() - 0.5));
  }

  return (
    <div>
      <button onClick={shuffle} className="mb-4 rounded bg-gray-200 px-4 py-2">
        Reordenar
      </button>

      {/* LayoutGroup sincroniza animaciones entre hermanos */}
      <LayoutGroup>
        <div className="flex flex-wrap gap-3">
          {items.map((item) => (
            <motion.div
              key={item}
              layout
              onClick={() => setSelected(selected === item ? null : item)}
              className="rounded-xl px-4 py-2"
              animate={{
                backgroundColor: selected === item ? "#3b82f6" : "#f3f4f6",
                color: selected === item ? "#ffffff" : "#111827",
                scale: selected === item ? 1.05 : 1,
                boxShadow: selected === item
                  ? "0 10px 30px rgba(59,130,246,0.3)"
                  : "0 1px 3px rgba(0,0,0,0.1)",
              }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              style={{ cursor: "pointer" }}
            >
              {item}
            </motion.div>
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}
```

### Shared Layout Animations (layoutId)

Conecta dos componentes visualmente durante transiciones de ruta o cambios de estado:

```tsx
// Componente A — thumbnail
<motion.div layoutId={`item-${id}`} className="h-40 w-40 rounded-xl bg-blue-200" />

// Componente B — expanded (en otra ruta o modal)
<motion.div layoutId={`item-${id}`} className="h-96 w-full rounded-xl bg-blue-200" />
```

Framer Motion anima automáticamente la transición de posición, tamaño y border-radius entre ambos.

---

## Advanced

### Scroll Animations — useScroll + useTransform

Para animaciones basadas en el progreso del scroll:

```tsx
"use client";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

function ParallaxSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"], // [inicio del viewport, fin del viewport]
  });

  const y = useTransform(scrollYProgress, [0, 1], ["20%", "-20%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 0.8]);

  return (
    <section ref={ref} className="relative h-screen overflow-hidden">
      <motion.div
        style={{ y, opacity, scale }}
        className="flex h-full items-center justify-center"
      >
        <h1 className="text-6xl font-bold">Parallax Content</h1>
      </motion.div>
    </section>
  );
}

// Progress bar basada en scroll de página
function ScrollProgress() {
  const { scrollYProgress } = useScroll();

  return (
    <motion.div
      style={{ scaleX: scrollYProgress }}
      className="fixed left-0 right-0 top-0 z-50 h-1 origin-left bg-blue-600"
    />
  );
}

// Sticky reveal section
function StickyRevealSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const clipPath = useTransform(
    scrollYProgress,
    [0, 1],
    ["inset(0% 0% 100% 0%)", "inset(0% 0% 0% 0%)"]
  );

  return (
    <div ref={ref} className="relative h-[200vh]">
      <div className="sticky top-0 h-screen overflow-hidden">
        <motion.div style={{ clipPath }} className="h-full w-full">
          {/* Contenido revelado progresivamente */}
        </motion.div>
      </div>
    </div>
  );
}
```

`useScroll` options:
- `target` — Ref al elemento observado
- `container` — Ref al contenedor con overflow scroll (default: window)
- `offset` — `["start end", "end start"]` define el rango de progreso (0→1)
  - `"start"`, `"center"`, `"end"` referidos al target
  - `"start"`, `"center"`, `"end"` referidos al container

### Gestures — Drag, Hover, Tap, Pan

```tsx
// Drag & Drop con constraints
<motion.div
  drag
  dragConstraints={{ left: 0, right: 300, top: 0, bottom: 300 }}
  dragElastic={0.2}
  dragTransition={{ bounceStiffness: 300, bounceDamping: 20 }}
  whileDrag={{ scale: 1.1, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}
/>

// Gestos compuestos
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  whileFocus={{ boxShadow: "0 0 0 3px rgba(59,130,246,0.5)" }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
>
  Interactive Button
</motion.button>
```

### Spring Physics — Afinando el Motion Feel

La key para animaciones "profesionales" es usar springs en vez de duration-based easing:

```tsx
// Spring suave y bounce (ideal para modales, cards)
transition={{ type: "spring", stiffness: 300, damping: 30 }}

// Spring rígido y rápido (ideal para botones, tooltips)
transition={{ type: "spring", stiffness: 500, damping: 35 }}

// Spring bouncy (ideal para listas, elementos que "aparecen")
transition={{ type: "spring", stiffness: 200, damping: 15, mass: 0.8 }}

// Spring crítico (sin bounce, lo más rápido posible sin overshoot)
transition={{ type: "spring", stiffness: 400, damping: 40 }}
```

Reglas generales:
- `stiffness` alta + `damping` bajo = más bounce
- `stiffness` baja + `damping` alto = movimiento lento sin bounce
- `mass` afecta la inercia (mayor = más pesado)

### Orchestrated Sequences — useAnimate + Timeline

Para secuencias complejas multi-step, usa `useAnimate`:

```tsx
"use client";
import { useAnimate, stagger } from "framer-motion";
import { useEffect } from "react";

function OrchestratedSequence() {
  const [scope, animate] = useAnimate();

  useEffect(() => {
    async function sequence() {
      // Paso 1: Contenedor aparece
      await animate(scope.current, { opacity: 1 }, { duration: 0.3 });

      // Paso 2: Título se desliza desde arriba
      await animate("h1", { y: 0, opacity: 1 }, { type: "spring", stiffness: 200, damping: 20 });

      // Paso 3: Cards aparecen en stagger
      await animate(
        ".card",
        { y: 0, opacity: 1, scale: 1 },
        { delay: stagger(0.08), type: "spring", stiffness: 300, damping: 25 }
      );

      // Paso 4: Badge pulsa
      await animate(
        ".badge",
        { scale: [1, 1.3, 1] },
        { type: "spring", stiffness: 500, damping: 10 }
      );
    }

    sequence();
  }, [animate, scope]);

  return (
    <div ref={scope} className="opacity-0">
      <h1 className="translate-y-[-20px] opacity-0">Título</h1>
      {[1, 2, 3].map((i) => (
        <div key={i} className="card translate-y-[30px] scale-95 opacity-0">
          Card {i}
        </div>
      ))}
      <span className="badge">New</span>
    </div>
  );
}
```

### Reduced Motion — Accessibility

Siempre respeta `prefers-reduced-motion`:

```tsx
"use client";
import { motion, useReducedMotion } from "framer-motion";

function AccessibleAnimation() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 300, damping: 30 }
      }
    >
      Content
    </motion.div>
  );
}

// Forma abreviada con variantes
const defaultVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

<AnimatePresence>
  <motion.div
    variants={defaultVariants}
    initial="hidden"
    animate="visible"
    exit="hidden"
    transition={prefersReducedMotion ? { duration: 0.001 } : undefined}
  />
</AnimatePresence>
```

---

## Next.js Integration

### "use client" Requirements

Todo componente que use Framer Motion **debe** ser Client Component:

```tsx
"use client"; // REQUERIDO — Framer Motion usa useEffect, contexto y DOM APIs
import { motion } from "framer-motion";

export function AnimatedCard() {
  return <motion.div>...</motion.div>;
}
```

### Pattern: Wrapper Client Component

Para minimizar el JS enviado al cliente, crea wrappers finos:

```tsx
// components/animation/fade-in.tsx
"use client";
import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const fadeInVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 20 },
  },
};

export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      variants={fadeInVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

Uso desde Server Component:

```tsx
// app/page.tsx (Server Component)
import { FadeIn } from "@/components/animation/fade-in";

export default function Page() {
  return (
    <FadeIn>
      <h1>Este texto se anima al hacer scroll</h1>
    </FadeIn>
  );
}
```

### Page Transitions con App Router

Las transiciones de página en App Router requieren un layout wrapper persistente:

```tsx
// app/layout.tsx (Server Component — puede permanecer server)
import { PageTransition } from "@/components/animation/page-transition";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <PageTransition>{children}</PageTransition>
      </body>
    </html>
  );
}

// components/animation/page-transition.tsx
"use client";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" onExitComplete={() => window.scrollTo(0, 0)}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, filter: "blur(4px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, filter: "blur(4px)" }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

### Suspense Boundaries

Envuelve componentes animados pesados en Suspense para evitar bloquear la navegación:

```tsx
import { Suspense } from "react";
import dynamic from "next/dynamic";

const HeavyAnimation = dynamic(
  () => import("./heavy-animation").then((mod) => mod.HeavyAnimation),
  { ssr: false, loading: () => <div className="animate-pulse h-64 bg-gray-200 rounded-xl" /> }
);

export function Page() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-gray-200" />}>
      <HeavyAnimation />
    </Suspense>
  );
}
```

---

## Anti-Patterns (Prohibited)

- ❌ Usar `useEffect` para disparar animaciones. Usa `animate` prop, `whileInView`, o `useAnimate`.
- ❌ Animar `width`, `height`, `top`, `left`. Usa `transform` (GPU-accelerated) + `layout`.
- ❌ Animar `box-shadow` sin `will-change`. Prefiere `filter: drop-shadow()` o transform-based shadows.
- ❌ Olvidar `AnimatePresence` en elementos que se desmontan (el `exit` no funciona sin él).
- ❌ No usar `key` en elementos dentro de `AnimatePresence`.
- ❌ Mezclar animaciones CSS (`transition` en Tailwind) con Framer Motion en el mismo elemento.
- ❌ Ignorar `prefers-reduced-motion` — toda animación debe tener fallback estático.
- ❌ Usar `layout` en listas de 100+ items sin virtualización.
- ❌ Pasar funciones inline como `variants` (se recrean cada render).
- ❌ No limpiar animaciones pendientes al desmontar (usar `useAnimate` con cleanup en useEffect return).

---

## Performance

### GPU-Accelerated Properties

Solo estas propiedades son GPU-accelerated. Anímalas siempre que sea posible:
- `transform` (translate, scale, rotate, skew)
- `opacity`
- `filter` (blur, brightness, contrast)

```tsx
// BUENO — GPU accelerated
<motion.div animate={{ x: 100, scale: 1.2, opacity: 0.5 }} />

// MALO — triggers layout/paint
<motion.div animate={{ width: 300, height: 200, top: 50 }} />

// ALTERNATIVA — usa layout animation
<motion.div layout /> // Anima cambios de tamaño/posición con transform internamente
```

### will-change Strategy

```tsx
<motion.div
  style={{ willChange: "transform, opacity" }}
  // O condicionalmente:
  initial={{ willChange: "auto" }}
  animate={{ willChange: "transform", opacity: 1 }}
/>
```

### Dynamic Imports para Animaciones Pesadas

```tsx
// next.config.ts
const nextConfig = {
  experimental: {
    optimizePackageImports: ["framer-motion"],
  },
};
```

```tsx
// Carga lazy de componentes con animaciones complejas
const ThreeDScene = dynamic(() => import("./three-scene"), {
  ssr: false,
  loading: () => <FallbackSkeleton />,
});
```

---

## Tailwind v4 + Framer Motion

En Tailwind v4, las animaciones CSS se definen directamente en el CSS. Combínalas sabiamente:

```css
/* globals.css — Tailwind v4 */
@theme {
  --animate-fade-in: fade-in 0.5s var(--ease-out-quint);
  --animate-slide-up: slide-up 0.6s var(--spring-smooth);
  --ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
  --spring-smooth: cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
```

Regla: Usa Tailwind `animate-*` para animaciones simples y repetitivas (loaders, attention seekers). Usa Framer Motion para todo lo interactivo, secuencial, o dependiente de estado.

---

## Reference

### Props Quick Reference

| Prop | Descripción |
|------|-------------|
| `initial` | Estado antes del primer render |
| `animate` | Estado objetivo (puede ser objeto de keyframes `[0, 0.5, 0]`) |
| `exit` | Estado al desmontar (requiere `AnimatePresence`) |
| `transition` | `{ type, stiffness, damping, mass, duration, delay, ease }` |
| `layout` | `true \| "position" \| "size" \| "preserve-aspect"` |
| `layoutId` | string para shared layout animations |
| `variants` | Objeto de variantes nombradas (orquestación con hijos) |
| `whileHover` | Estado durante hover |
| `whileTap` | Estado durante tap/click |
| `whileFocus` | Estado durante focus |
| `whileInView` | Estado cuando está en el viewport |
| `whileDrag` | Estado durante drag |
| `drag` | `true \| "x" \| "y"` |
| `dragConstraints` | `{ left, right, top, bottom }` o ref |
| `dragElastic` | 0–1, qué tanto "cede" al arrastrar fuera de constraints |
| `viewport` | `{ once, margin, amount }` (para `whileInView`) |

### Easing Functions Esenciales

```tsx
// Ease-out quint — el estándar para entradas (desacelera al final)
ease: [0.22, 1, 0.36, 1]

// Ease-in-out cubic — transiciones simétricas
ease: [0.65, 0, 0.35, 1]

// Ease-out back — slight overshoot (para elementos que "aparecen")
ease: [0.34, 1.56, 0.64, 1]

// Snappy — para elementos que desaparecen o se ocultan
ease: [0.55, 0, 1, 0.45]

// Spring (recomendado sobre duration para motion feel profesional)
type: "spring", stiffness: 300, damping: 30
```
