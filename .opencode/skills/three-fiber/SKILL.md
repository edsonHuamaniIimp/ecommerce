---
name: three-fiber
description: React Three Fiber + Drei para animaciones 3D en Next.js — Canvas, useFrame, shaders, post-processing, modelos GLTF, física, scroll 3D y rendering performance
---

# React Three Fiber — Animaciones 3D en Next.js

## Summary

React Three Fiber (v9+) es el renderer de React para Three.js. Junto con Drei (v10+), proporciona un ecosistema declarativo completo para escenas 3D: geometrías, materiales, iluminación, shaders, post-processing, modelos GLTF/GLB, física, controles de cámara, y animación por frame con `useFrame`. En Next.js App Router, los Canvas deben ser Client Components con `dynamic(() => import(...), { ssr: false })`.

## When to Use

**Best for:**
- Fondos 3D interactivos y hero sections inmersivas
- Visualizaciones de datos 3D (mapas, gráficos volumétricos)
- Product configurators y showrooms 3D
- Efectos de partículas y simulaciones
- Scroll-driven 3D (cámara vinculada al scroll)
- Shaders personalizados y efectos de post-processing
- Modelos 3D con animaciones (GLTF/GLB + animaciones baked)

**Consider alternatives when:**
- Solo necesitas un efecto visual simple (usa CSS 3D transforms o Framer Motion)
- El target es mobile de gama baja sin WebGL2
- La escena 3D no es interactiva (evalúa pre-renderizar a video/image sequence)
- El bundle size es crítico (three.js añade ~140KB gzipped mínimo)

## Quick Start

```tsx
"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Box, Sphere } from "@react-three/drei";

export default function Scene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 45 }}
      style={{ width: "100%", height: "100vh" }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />

      <Box position={[-1.2, 0, 0]}>
        <meshStandardMaterial color="hotpink" />
      </Box>

      <Sphere position={[1.2, 0, 0]}>
        <meshStandardMaterial color="royalblue" metalness={0.3} roughness={0.2} />
      </Sphere>

      <OrbitControls enableDamping />
    </Canvas>
  );
}
```

---

## Core Concepts

### Canvas Setup

`Canvas` es el entry point. Configura el renderer, cámara, y contexto de Three.js:

```tsx
<Canvas
  // Performance
  dpr={[1, 2]}               // [min, max] device pixel ratio (adaptive)
  frameloop="demand"          // "always" | "demand" (solo re-render con cambios)
  performance={{ min: 0.5 }}  // Baja resolución en frames lentos

  // Renderer
  gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
  shadows

  // Cámara
  camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 1000 }}

  // Eventos
  onCreated={(state) => console.log("Renderer ready:", state.gl)}
  onPointerMissed={() => console.log("Clicked outside meshes")}
>
  {/* Children = Three.js objects */}
</Canvas>
```

### useFrame — Animación por Frame

El hook fundamental para animaciones 3D. Se ejecuta ~60fps:

```tsx
"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";

function RotatingBox() {
  const meshRef = useRef<Mesh>(null!);

  useFrame((state, delta) => {
    // state.clock — tiempo desde el inicio
    // delta — segundos desde el frame anterior
    meshRef.current.rotation.x += delta * 0.5;
    meshRef.current.rotation.y += delta * 0.8;
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.5;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="orange" wireframe />
    </mesh>
  );
}

// useFrame con prioridad de orden
useFrame((state, delta) => {
  // Early update — antes del render
}, 1); // priority: número negativo = antes, positivo = después

useFrame((state, delta) => {
  // Late update — después del render (ej: seguir cámara)
}, -1);
```

### Drei Helpers Esenciales

Drei es una colección de helpers que simplifican tareas comunes:

```tsx
import {
  OrbitControls,     // Cámara orbital (pan, zoom, rotate)
  PerspectiveCamera, // Cámara declarativa
  Environment,       // Iluminación HDR basada en imagen
  Float,             // Efecto de flotación suave
  Text,              // Texto 3D con fuente cargable
  RoundedBox,        // Box con bordes redondeados
  MeshTransmissionMaterial, // Material tipo vidrio (físicamente correcto)
  MeshDistortMaterial,      // Material con distorsión de vértices
  GradientTexture,   // Textura de gradiente procedural
  useTexture,        // Carga texturas con Suspense
  useGLTF,           // Carga modelos GLTF con Suspense
  useProgress,       // Progreso de carga de assets
} from "@react-three/drei";
```

---

## Animations & Interaction

### Float — Flotación Orgánica

```tsx
import { Float } from "@react-three/drei";

<Float
  speed={1.5}           // Velocidad de rotación
  rotationIntensity={1} // Intensidad de rotación
  floatIntensity={0.5}  // Intensidad de flotación vertical
  floatingRange={[0.1, 0.3]} // Rango de flotación [min, max]
>
  <mesh>
    <icosahedronGeometry args={[1, 0]} />
    <meshStandardMaterial color="#6366f1" />
  </mesh>
</Float>
```

### Scroll-Controlled 3D — Cámara Vinculada al Scroll

La técnica más impactante: mover la cámara 3D según el scroll de la página:

```tsx
"use client";
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useScroll as useScrollDrei, useGLTF } from "@react-three/drei";
import { useScroll as useScrollPage } from "framer-motion";

function ScrollScene() {
  const scrollData = useScrollDrei();  // Scroll de la página → progreso 0-1
  const groupRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    // scrollData.offset = valor 0→1 del progreso de scroll
    const offset = scrollData.offset;

    // Rotar grupo según scroll (0° → 360°)
    groupRef.current.rotation.y = offset * Math.PI * 2;

    // Mover cámara en Z
    scrollData.el.scroll(0, offset * 10);

    // Opacidad basada en secciones
    const section = Math.floor(offset * scrollData.pages);
    // ...
  });

  return (
    <group ref={groupRef}>
      {/* Objetos 3D que giran con el scroll */}
    </group>
  );
}

// En la página Next.js
import dynamic from "next/dynamic";

const ScrollScene = dynamic(() => import("./scroll-scene"), { ssr: false });

export default function Page() {
  return (
    <div style={{ height: "400vh" }}>
      <div style={{ position: "sticky", top: 0, height: "100vh" }}>
        <Canvas>
          <ScrollScene />
        </Canvas>
      </div>
    </div>
  );
}
```

### Particles — Sistemas de Partículas

```tsx
"use client";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial } from "three";

function ParticleField({ count = 2000 }) {
  const pointsRef = useRef<Points>(null!);

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Distribución esférica
      const radius = 2 + Math.random() * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      // Gradiente azul → púrpura
      colors[i3] = 0.2 + Math.random() * 0.3;
      colors[i3 + 1] = 0.1 + Math.random() * 0.2;
      colors[i3 + 2] = 0.6 + Math.random() * 0.4;
    }

    return { positions, colors };
  }, [count]);

  useFrame((state, delta) => {
    pointsRef.current.rotation.y += delta * 0.05;
    pointsRef.current.rotation.x += delta * 0.02;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        vertexColors
        blending={2}  // THREE.AdditiveBlending
        depthWrite={false}
        transparent
        opacity={0.8}
      />
    </points>
  );
}
```

### Post-Processing

```tsx
"use client";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette, Noise } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

function Scene() {
  return (
    <Canvas>
      <ambientLight intensity={0.5} />
      {/* objetos 3D */}

      <EffectComposer>
        <Bloom
          intensity={1.5}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Vignette
          offset={0.3}
          darkness={0.6}
          blendFunction={BlendFunction.NORMAL}
        />
        <Noise opacity={0.02} />
      </EffectComposer>
    </Canvas>
  );
}
```

### GLTF/GLB Models

```tsx
"use client";
import { useRef, Suspense } from "react";
import { useGLTF, useAnimations, useProgress, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

function Model({ url }: { url: string }) {
  const groupRef = useRef<Group>(null!);
  const { scene, animations } = useGLTF(url);
  const { actions, names } = useAnimations(animations, groupRef);

  // Reproducir animación automáticamente
  useEffect(() => {
    if (names.length > 0) {
      actions[names[0]]?.play();
    }
  }, [actions, names]);

  useFrame((state, delta) => {
    groupRef.current.rotation.y += delta * 0.2;
  });

  return <primitive ref={groupRef} object={scene} scale={1} />;
}

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="text-white text-lg">
        Loading... {Math.round(progress)}%
      </div>
    </Html>
  );
}

function Scene() {
  return (
    <Suspense fallback={<Loader />}>
      <Model url="/models/product.glb" />
      <Environment preset="studio" />
    </Suspense>
  );
}
```

---

## Next.js Integration

### SSR-Safe Canvas Loading

El Canvas **siempre** debe cargarse con `ssr: false` porque Three.js necesita WebGL (solo disponible en browser):

```tsx
import dynamic from "next/dynamic";

const Scene3D = dynamic(() => import("./scene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  ),
});

export default function Page() {
  return <Scene3D />;
}
```

### Adaptive Resolution con DPR

```tsx
<Canvas
  dpr={[1, 2]}
  performance={{ min: 0.3, max: 0.8 }} // Escala resolución en frames lentos
  frameloop="demand"
>
```

### Full-Page 3D Background

```tsx
"use client";
import { Canvas } from "@react-three/fiber";

export function ThreeBackground() {
  return (
    <div className="fixed inset-0 -z-10">
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true }}
        camera={{ position: [0, 0, 3], fov: 60 }}
      >
        <ambientLight intensity={0.5} />
        {/* Objetos 3D de fondo */}
      </Canvas>
    </div>
  );
}
```

---

## Anti-Patterns (Prohibited)

- ❌ Crear geometrías/materiales/texturas dentro de `useFrame` — se crean cada frame (memory leak).
- ❌ No memoizar geometrías reutilizables con `useMemo`.
- ❌ No usar `useLoader` o `<Suspense>` para texturas/modelos — las promesas sin Suspense rompen el render loop.
- ❌ Usar `frameloop="always"` cuando no hay animación continua — usa `"demand"`.
- ❌ `antialias: true` + `dpr: [1, 2]` + mobile = GPU bottleneck. Ajusta según target.
- ❌ No limpiar event listeners, intervals, o animaciones en el cleanup de `useFrame`.
- ❌ Cargar modelos de 50MB+ sin compresión (usa `gltf-transform` para optimizar).
- ❌ No usar `depthWrite={false}` en partículas y transparencias.
- ❌ Ignorar `prefers-reduced-motion` en escenas 3D con mucho movimiento.
- ❌ `new THREE.TextureLoader()` dentro de un componente — usa `useTexture` de Drei.

---

## Performance

### Instancing para Muchos Objetos Iguales

```tsx
"use client";
import { useRef, useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Matrix4, Color } from "three";

function InstancedCubes({ count = 1000 }) {
  const meshRef = useRef<InstancedMesh>(null!);
  const tempMatrix = new Matrix4();
  const tempColor = new Color();

  useFrame((state, delta) => {
    for (let i = 0; i < count; i++) {
      tempMatrix.compose(
        /* position */ { x: /* ... */, y: /* ... */, z: /* ... */ },
        /* quaternion */ undefined,
        /* scale */ { x: 1, y: 1, z: 1 }
      );
      meshRef.current.setMatrixAt(i, tempMatrix);
      tempColor.setHSL((i / count + state.clock.elapsedTime * 0.01) % 1, 0.8, 0.5);
      meshRef.current.setColorAt(i, tempColor);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.instanceColor!.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.1, 0.1, 0.1]} />
      <meshStandardMaterial />
    </instancedMesh>
  );
}
```

### Level of Detail (LOD)

```tsx
import { useGLTF } from "@react-three/drei";

// Prepara 3 versiones del modelo: high, medium, low poly
// Usa la apropiada según distancia a la cámara
<LOD>
  <mesh geometry={highPolyGeo} distance={0} />
  <mesh geometry={mediumPolyGeo} distance={15} />
  <mesh geometry={lowPolyGeo} distance={30} />
</LOD>
```

### Adaptive Quality

```tsx
import { AdaptiveDpr, AdaptiveEvents } from "@react-three/drei";

<Canvas dpr={[1, 2]} performance={{ min: 0.5 }}>
  <AdaptiveDpr pixelated />  {/* Baja DPR en frames lentos, sin blur */}
  <AdaptiveEvents />         {/* Desactiva eventos en frames lentos */}
  {/* ... */}
</Canvas>
```

---

## Scroll-Driven 3D (Integration con Framer Motion)

Combinar Framer Motion scroll con Three.js para parallax 3D avanzado:

```tsx
"use client";
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useScroll, useTransform, motion } from "framer-motion";

function ScrollLinked3D() {
  const { scrollYProgress } = useScroll(); // Framer Motion
  const cameraRef = useRef<THREE.PerspectiveCamera>(null!);

  // Vincular scroll a rotación
  const rotationY = useTransform(scrollYProgress, [0, 1], [0, Math.PI * 2]);

  useFrame(() => {
    if (cameraRef.current) {
      // Leer valor actual de useTransform
      // (requiere subscribirse al motion value)
    }
  });

  return (
    <Canvas>
      <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 0, 5]} />
      {/* escena 3D */}
    </Canvas>
  );
}
```

---

## Reference

### Geometry Primitives (three.js)

```tsx
<boxGeometry args={[width, height, depth, widthSegments, heightSegments]} />
<sphereGeometry args={[radius, widthSegments, heightSegments]} />
<cylinderGeometry args={[radiusTop, radiusBottom, height, segments]} />
<torusGeometry args={[radius, tube, radialSegments, tubularSegments]} />
<torusKnotGeometry args={[radius, tube, tubularSegments, radialSegments, p, q]} />
<planeGeometry args={[width, height]} />
<icosahedronGeometry args={[radius, detail]} />
<ringGeometry args={[innerRadius, outerRadius, segments]} />
<coneGeometry args={[radius, height, segments]} />
<dodecahedronGeometry args={[radius, detail]} />
<extrudeGeometry args={[shape, extrudeSettings]} />
<latheGeometry args={[points, segments]} />
```

### Materials (quick reference)

| Material | Uso |
|----------|-----|
| `meshStandardMaterial` | PBR estándar (roughness, metalness) |
| `meshPhysicalMaterial` | PBR avanzado (clearcoat, transmission, ior) |
| `meshPhongMaterial` | Blinn-Phong (más barato, menos realista) |
| `meshToonMaterial` | Cel-shading / toon shading |
| `meshNormalMaterial` | Debug: colores por normal |
| `meshBasicMaterial` | Sin iluminación (color plano) |
| `meshMatcapMaterial` | Textura de iluminación baked |
| `shaderMaterial` | Shaders GLSL personalizados |

### Drei Essentials Quick Reference

| Component | Uso |
|-----------|-----|
| `OrbitControls` | Cámara orbital interactiva |
| `Float` | Flotación orgánica suave |
| `Text` | Texto 3D con fuentes |
| `Environment` | Iluminación HDR |
| `useGLTF` | Cargar modelos GLTF/GLB |
| `useTexture` | Cargar texturas |
| `useProgress` | Tracking de carga |
| `useAnimations` | Control de animaciones de GLTF |
| `PresentationControls` | Rotación restringida (product viewer) |
| `Sky` | Cielo procedural |
| `Stars` | Fondo de estrellas |
| `Sparkles` | Partículas brillantes |
| `Shadow` | Sombra proyectada desde plano |
| `ScreenSpace` | Objeto siempre frente a cámara |
| `Billboard` | Siempre mira a cámara |
| `GradientTexture` | Gradiente procedural |
| `RoundedBox` | Box con esquinas redondeadas |
| `Decal` | Decal proyectado sobre mesh |
| `Reflector` | Plano reflectante |
