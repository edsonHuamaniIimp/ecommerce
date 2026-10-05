"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { FORMAS_BLOQUE, PERSONA_COLORES_CABEZA, TIPOS_FURNITURE } from "@/lib/shared/constants";
import { furnitureUtils } from "@/lib/shared/utils/furniture";
import type { PlanoBounds, PlanoItem } from "@/lib/shared/planos/registry";

export interface FurnitureRenderItem {
  id: string;
  type: string;
  x: number;
  z: number;
  rotY: number;
  config?: unknown;
}

/* ---------- Bloque ---------- */

/**
 * Carga la imagen del logo y la dibuja en un canvas con la proporcion de la cara
 * (contain + margen), para que no se estire. Genera dos texturas: frontal (ancho x alto)
 * y lateral (fondo x alto). Devuelve null mientras carga o si falla (queda color solido).
 */
function useLogoTextures(
  url: string,
  dim: { w: number; d: number; h: number },
): { frontal: THREE.Texture | null; lateral: THREE.Texture | null } {
  const [cargada, setCargada] = useState<{ url: string; img: HTMLImageElement } | null>(null);

  useEffect(() => {
    let vivo = true;
    const img = new Image();
    img.onload = () => { if (vivo) setCargada({ url, img }); };
    img.onerror = () => { /* se mantiene el color solido */ };
    img.src = url;
    return () => { vivo = false; };
  }, [url]);

  const imagen = cargada && cargada.url === url ? cargada.img : null;

  return useMemo(() => {
    if (!imagen) return { frontal: null, lateral: null };
    const construir = (ancho: number, alto: number): THREE.Texture | null => {
      const canvas = document.createElement("canvas");
      const escala = 512 / Math.max(ancho, alto, 0.01);
      canvas.width = Math.max(32, Math.round(ancho * escala));
      canvas.height = Math.max(32, Math.round(alto * escala));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const margen = 0.1;
      const maxW = canvas.width * (1 - margen * 2);
      const maxH = canvas.height * (1 - margen * 2);
      const escalaImg = Math.min(maxW / imagen.width, maxH / imagen.height);
      const dw = imagen.width * escalaImg;
      const dh = imagen.height * escalaImg;
      ctx.drawImage(imagen, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
      const textura = new THREE.CanvasTexture(canvas);
      textura.colorSpace = THREE.SRGBColorSpace;
      textura.anisotropy = 4;
      return textura;
    };
    return { frontal: construir(dim.w, dim.h), lateral: construir(dim.d, dim.h) };
  }, [imagen, dim.w, dim.d, dim.h]);
}

/** Materiales del bloque reservado con logo: caras laterales con textura, tapa/base solidas. */
function MaterialesLogo({ url, colorFondo, dim }: { url: string; colorFondo: string; dim: { w: number; d: number; h: number } }) {
  const { frontal, lateral } = useLogoTextures(url, dim);
  /*
   * Se construye el array de 6 materiales y se asigna directo a `mesh.material`.
   * Caras del box: 0=+X, 1=-X, 2=+Y (tapa), 3=-Y (base), 4=+Z, 5=-Z.
   * (Con attach="material-N" sobre un mesh que ya tenia material unico, el renderer
   * seguia usando el material viejo y la textura nunca se veia.)
   */
  const materiales = useMemo(() => {
    const cara = (map: THREE.Texture | null) =>
      new THREE.MeshStandardMaterial({
        map: map ?? undefined,
        color: map ? "#ffffff" : colorFondo,
        roughness: 0.7,
        metalness: 0.05,
      });
    const tapa = new THREE.MeshStandardMaterial({ color: colorFondo, roughness: 0.7, metalness: 0.05 });
    const base = new THREE.MeshStandardMaterial({ color: colorFondo, roughness: 0.7, metalness: 0.05 });
    return [cara(lateral), cara(lateral), tapa, base, cara(frontal), cara(frontal)];
  }, [frontal, lateral, colorFondo]);

  useEffect(() => {
    return () => { materiales.forEach((m) => m.dispose()); };
  }, [materiales]);

  useEffect(() => {
    return () => { frontal?.dispose(); lateral?.dispose(); };
  }, [frontal, lateral]);

  return <primitive object={materiales} attach="material" />;
}

export function Bloque3D({ item, selected, reserved, hoverText, logoUrl, onSelect, onHover }: {
  item: PlanoItem; selected: boolean; reserved: boolean;
  /** Texto a mostrar al pasar el cursor (razon social de la empresa que reservo; RF-09). */
  hoverText?: string | null;
  /** Logo de la empresa/usuario a pintar en las caras del bloque reservado. */
  logoUrl?: string | null;
  onSelect: (id: string) => void;
  onHover?: (info: { x: number; y: number; text: string } | null) => void;
}) {
  const { w, d, h, color } = item.dim;
  const formaMaquina = item.forma && item.forma !== FORMAS_BLOQUE.BLOQUE ? item.forma : null;
  if (formaMaquina) {
    return (
      <group
        onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}
        onPointerOver={(e) => {
          document.body.style.cursor = "pointer";
          if (hoverText && onHover) onHover({ x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, text: hoverText });
        }}
        onPointerMove={(e) => {
          if (hoverText && onHover) onHover({ x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, text: hoverText });
        }}
        onPointerOut={() => { document.body.style.cursor = "auto"; onHover?.(null); }}
      >
        <MaquinariaBloque forma={formaMaquina} x={item.x} z={item.z} rotY={item.rotY ?? 0} footprint={{ w, d }} />
        {/* Huella de seleccion/picking de la unidad */}
        <mesh position={[item.x, h / 2, item.z]} rotation={[0, item.rotY ?? 0, 0]}>
          <boxGeometry args={[w, h + 0.1, d]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={selected ? 0.14 : 0} depthWrite={false} />
        </mesh>
      </group>
    );
  }
  return (
    <mesh
      position={[item.x, h / 2, item.z]}
      rotation={[0, item.rotY ?? 0, 0]}
      castShadow receiveShadow
      onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}
      onPointerOver={(e) => {
        document.body.style.cursor = "pointer";
        if (hoverText && onHover) onHover({ x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, text: hoverText });
      }}
      onPointerMove={(e) => {
        if (hoverText && onHover) onHover({ x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, text: hoverText });
      }}
      onPointerOut={() => { document.body.style.cursor = "auto"; onHover?.(null); }}
    >
      <boxGeometry args={[w - .15, h + (selected ? 0.6 : 0), d - .15]} />
      {reserved && logoUrl ? (
        <MaterialesLogo url={logoUrl} colorFondo="#9ca3af" dim={{ w, d, h }} />
      ) : (
        <meshStandardMaterial
          color={reserved ? "#9ca3af" : selected ? "#f59e0b" : color}
          roughness={reserved ? .7 : .55}
          metalness={.1}
          emissive={selected ? "#f59e0b" : "#000000"}
          emissiveIntensity={selected ? 0.3 : 0}
        />
      )}
    </mesh>
  );
}

/* ================================================================
   KIOSKO RÚSTICO — CSG de 5 piezas. Pivote base inferior centro.
   TW=1.8m(X) × TD=1.2m(Z) × TH=2.2m(Y).
   ================================================================ */
export function Kiosko({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  const TW = 1.8, TD = 1.2, TH = 2.2;
  const baseH = TH * .02, cW = TW * .8, cD = TD * .4, cH = TH * .4, ctrY = baseH + cH / 2, topY = baseH + cH + baseH;
  const pW = TW * .05, pD = TD * .05, postH = TH * .9, pstY = baseH + postH / 2;
  const pstTop = baseH + postH, halfSpan = TW * .46, rise = TH * .16, ridgeY = pstTop + rise;
  const slopeLen = Math.sqrt(halfSpan ** 2 + rise ** 2), slopeAngle = Math.atan2(rise, halfSpan);
  const midY = pstTop + rise / 2, roofZ = TD * .1 - TD / 4, roofDepth = TD * .3;

  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      {/* 1. Plataforma Base — verde oscuro mate */}
      <mesh position={[0, baseH / 2, 0]} receiveShadow>
        <boxGeometry args={[TW, baseH, TD]} />
        <meshStandardMaterial color="#2d5a27" roughness={.7} />
      </mesh>
      {/* 2. Mostrador Principal — madera clara */}
      <mesh position={[0, ctrY, TD * .28]} castShadow>
        <boxGeometry args={[cW, cH, cD]} />
        <meshStandardMaterial color="#DEB887" roughness={.45} />
      </mesh>
      {/* Tablón superior más oscuro */}
      <mesh position={[0, topY, TD * .28]} castShadow>
        <boxGeometry args={[cW, baseH, cD]} />
        <meshStandardMaterial color="#8B4513" roughness={.3} />
      </mesh>
      {/* 3. Columnas de Soporte */}
      <mesh position={[-TW * .42, pstY, -TD * .12]} castShadow>
        <boxGeometry args={[pW, postH, pD]} />
        <meshStandardMaterial color="#5c3a1e" roughness={.55} />
      </mesh>
      <mesh position={[TW * .42, pstY, -TD * .12]} castShadow>
        <boxGeometry args={[pW, postH, pD]} />
        <meshStandardMaterial color="#5c3a1e" roughness={.55} />
      </mesh>
      {/* 4. Techo a Dos Aguas — lona crema */}
      <mesh position={[0, ridgeY, roofZ]}>
        <boxGeometry args={[.06, .06, roofDepth]} />
        <meshStandardMaterial color="#8B0000" />
      </mesh>
      <mesh position={[-halfSpan / 2, midY, roofZ]} rotation={[0, 0, slopeAngle]} castShadow>
        <boxGeometry args={[slopeLen, .05, roofDepth]} />
        <meshStandardMaterial color="#FFF8DC" roughness={.4} />
      </mesh>
      <mesh position={[halfSpan / 2, midY, roofZ]} rotation={[0, 0, -slopeAngle]} castShadow>
        <boxGeometry args={[slopeLen, .05, roofDepth]} />
        <meshStandardMaterial color="#FFF8DC" roughness={.4} />
      </mesh>
      {/* 5. Letrero Frontal */}
      <mesh position={[0, midY, roofZ + roofDepth / 2 + .015]} castShadow>
        <boxGeometry args={[TW * .6, TH * .15, .03]} />
        <meshStandardMaterial color="#FEFEFE" roughness={.3} />
      </mesh>
      <mesh position={[0, midY, roofZ + roofDepth / 2 + .032]} castShadow>
        <boxGeometry args={[TW * .6 + .04, TH * .15 + .04, .008]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  );
}

/* ================================================================
   MESA Y SILLÓN — piezas individuales (también usadas por Plaza).
   Pivote en el centro de la pieza.
   ================================================================ */
function MesaCentral({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.3, 0.6]} />
        <meshStandardMaterial color="#2d2d2d" roughness={.5} />
      </mesh>
      <mesh position={[0, 0.325, 0]} castShadow>
        <boxGeometry args={[0.8, 0.05, 0.8]} />
        <meshStandardMaterial color="#e8e8e8" roughness={.3} />
      </mesh>
    </group>
  );
}

function SillonIndividual({ x, z, rotY }: { x: number; z: number; rotY: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.1, 0.8]} />
        <meshStandardMaterial color="#1a1a1a" roughness={.6} />
      </mesh>
      <mesh position={[0, 0.2, 0.1]} castShadow>
        <boxGeometry args={[0.6, 0.2, 0.6]} />
        <meshStandardMaterial color="#f0f0f0" roughness={.4} />
      </mesh>
      <mesh position={[0, 0.4, -0.3]} castShadow>
        <boxGeometry args={[0.8, 0.5, 0.2]} />
        <meshStandardMaterial color="#f0f0f0" roughness={.4} />
      </mesh>
      <mesh position={[-0.35, 0.3, 0]} castShadow>
        <boxGeometry args={[0.1, 0.3, 0.6]} />
        <meshStandardMaterial color="#ffffff" roughness={.35} />
      </mesh>
      <mesh position={[0.35, 0.3, 0]} castShadow>
        <boxGeometry args={[0.1, 0.3, 0.6]} />
        <meshStandardMaterial color="#ffffff" roughness={.35} />
      </mesh>
    </group>
  );
}

export function Mesa({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <MesaCentral x={0} z={0} />
    </group>
  );
}

export function Sillon({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <SillonIndividual x={0} z={0} rotY={0} />
    </group>
  );
}

/* ================================================================
   PLAZA — preset: 4 mesas con 4 sillones cada una.
   El piso es un componente aparte (Piso).
   ================================================================ */
export function Plaza({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  const pos: [number, number][] = [[-2, -2], [2, -2], [-2, 2], [2, 2]];
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      {pos.map(([gx, gz], i) => (
        <group key={i}>
          <MesaCentral x={gx} z={gz} />
          {/* 2 sillones arriba, mirando hacia abajo (mesa al sur) */}
          <SillonIndividual x={gx - 0.55} z={gz - 1.0} rotY={0} />
          <SillonIndividual x={gx + 0.55} z={gz - 1.0} rotY={0} />
          {/* 2 sillones abajo, mirando hacia arriba (mesa al norte) */}
          <SillonIndividual x={gx - 0.55} z={gz + 1.0} rotY={Math.PI} />
          <SillonIndividual x={gx + 0.55} z={gz + 1.0} rotY={Math.PI} />
        </group>
      ))}
    </group>
  );
}

/* ================================================================
   PISO — parche de piso configurable (w x d) en metros.
   ================================================================ */
export function Piso({ x, z, rotY = 0, w, d }: { x: number; z: number; rotY?: number; w: number; d: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#C8BCA7" />
      </mesh>
    </group>
  );
}

/* ---------- Persona ---------- */
export function Persona({ x, z, rotY = 0, colorIdx = 0, torsoColor = "#f5f5f5", piernasColor = "#3b5998" }: {
  x: number; z: number; rotY?: number; colorIdx?: number; torsoColor?: string; piernasColor?: string;
}) {
  const headColor = PERSONA_COLORES_CABEZA[colorIdx % PERSONA_COLORES_CABEZA.length];
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh position={[-0.06, 0.3, 0]} castShadow>
        <capsuleGeometry args={[0.04, 0.52, 4, 8]} />
        <meshStandardMaterial color={piernasColor} roughness={.6} />
      </mesh>
      <mesh position={[0.06, 0.3, 0]} castShadow>
        <capsuleGeometry args={[0.04, 0.52, 4, 8]} />
        <meshStandardMaterial color={piernasColor} roughness={.6} />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.26, 4, 8]} />
        <meshStandardMaterial color={torsoColor} roughness={.4} />
      </mesh>
      <mesh position={[-0.12, 0.72, 0]} castShadow>
        <capsuleGeometry args={[0.04, 0.3, 4, 8]} />
        <meshStandardMaterial color={torsoColor} roughness={.4} />
      </mesh>
      <mesh position={[0.12, 0.72, 0]} castShadow>
        <capsuleGeometry args={[0.04, 0.3, 4, 8]} />
        <meshStandardMaterial color={torsoColor} roughness={.4} />
      </mesh>
      <mesh position={[0, 1.0, 0]} castShadow>
        <capsuleGeometry args={[0.09, 0.07, 8, 12]} />
        <meshStandardMaterial color={headColor} roughness={.3} />
      </mesh>
    </group>
  );
}

/* ---------- Arbol ---------- */
export function Arbol({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.18, 1.1, 8]} />
        <meshStandardMaterial color="#8B5A2B" roughness={.8} />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <sphereGeometry args={[0.75, 12, 10]} />
        <meshStandardMaterial color="#2f7d32" roughness={.7} />
      </mesh>
      <mesh position={[0.35, 1.95, -0.2]} castShadow>
        <sphereGeometry args={[0.45, 10, 8]} />
        <meshStandardMaterial color="#3a9d40" roughness={.7} />
      </mesh>
      <mesh position={[-0.32, 1.85, 0.22]} castShadow>
        <sphereGeometry args={[0.4, 10, 8]} />
        <meshStandardMaterial color="#276b2a" roughness={.7} />
      </mesh>
    </group>
  );
}

/* ---------- Bandera ---------- */
export function Bandera({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[0.4, 0.1, 0.4]} />
        <meshStandardMaterial color="#475569" roughness={.7} />
      </mesh>
      <mesh position={[0, 2.0, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.045, 4, 8]} />
        <meshStandardMaterial color="#cbd5e1" roughness={.4} metalness={.4} />
      </mesh>
      <mesh position={[0.48, 3.55, 0]} castShadow>
        <boxGeometry args={[0.9, 0.6, 0.02]} />
        <meshStandardMaterial color="#dc2626" roughness={.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ---------- Totem ---------- */
export function Totem({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[1.0, 0.1, 0.5]} />
        <meshStandardMaterial color="#475569" roughness={.7} />
      </mesh>
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[0.85, 2.3, 0.35]} />
        <meshStandardMaterial color="#0f172a" roughness={.5} />
      </mesh>
      <mesh position={[0, 1.25, 0.19]}>
        <boxGeometry args={[0.7, 1.9, 0.02]} />
        <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={.25} />
      </mesh>
    </group>
  );
}

/* ---------- Banca ---------- */
export function Banca({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[1.8, 0.1, 0.5]} />
        <meshStandardMaterial color="#8B5A2B" roughness={.6} />
      </mesh>
      <mesh position={[0, 0.78, -0.21]} castShadow>
        <boxGeometry args={[1.8, 0.5, 0.08]} />
        <meshStandardMaterial color="#8B5A2B" roughness={.6} />
      </mesh>
      <mesh position={[-0.75, 0.22, 0]}>
        <boxGeometry args={[0.1, 0.44, 0.5]} />
        <meshStandardMaterial color="#475569" roughness={.6} />
      </mesh>
      <mesh position={[0.75, 0.22, 0]}>
        <boxGeometry args={[0.1, 0.44, 0.5]} />
        <meshStandardMaterial color="#475569" roughness={.6} />
      </mesh>
    </group>
  );
}

/* ---------- Pergola ---------- */
export function Pergola({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  const postes: Array<[number, number]> = [[-1.85, -1.35], [1.85, -1.35], [-1.85, 1.35], [1.85, 1.35]];
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      {postes.map(([px, pz], i) => (
        <mesh key={i} position={[px, 1.3, pz]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 2.6, 8]} />
          <meshStandardMaterial color="#5c3a1e" roughness={.6} />
        </mesh>
      ))}
      <mesh position={[0, 2.66, 0]} castShadow>
        <boxGeometry args={[4, 0.12, 3]} />
        <meshStandardMaterial color="#e5e7eb" roughness={.8} />
      </mesh>
      <mesh position={[0, 2.78, 0]} castShadow>
        <boxGeometry args={[4.2, 0.08, 3.2]} />
        <meshStandardMaterial color="#9ca3af" roughness={.7} />
      </mesh>
    </group>
  );
}

/* ---------- Camion minero ---------- */
export function CamionMinero({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  const ruedas: Array<{ px: number; pz: number; r: number; ancho: number }> = [
    { px: 1.7, pz: -1.0, r: 0.78, ancho: 0.6 },
    { px: 1.7, pz: 1.0, r: 0.78, ancho: 0.6 },
    { px: -1.35, pz: -1.0, r: 0.95, ancho: 0.95 },
    { px: -1.35, pz: 1.0, r: 0.95, ancho: 0.95 },
  ];
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      {ruedas.map((w, i) => (
        <group key={i}>
          <mesh position={[w.px, w.r, w.pz]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[w.r, w.r, w.ancho, 18]} />
            <meshStandardMaterial color="#111827" roughness={.95} />
          </mesh>
          <mesh position={[w.px, w.r, w.pz]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[w.r * 0.45, w.r * 0.45, w.ancho + 0.04, 12]} />
            <meshStandardMaterial color="#94a3b8" roughness={.4} metalness={.5} />
          </mesh>
        </group>
      ))}
      {/* Chasis */}
      <mesh position={[0, 1.02, 0]} castShadow>
        <boxGeometry args={[4.4, 0.4, 1.6]} />
        <meshStandardMaterial color="#374151" roughness={.7} />
      </mesh>
      {/* Cabina */}
      <mesh position={[1.55, 2.0, 0]} castShadow>
        <boxGeometry args={[1.35, 1.05, 2.0]} />
        <meshStandardMaterial color="#f5c518" roughness={.45} />
      </mesh>
      {/* Techo de cabina */}
      <mesh position={[1.55, 2.6, 0]} castShadow>
        <boxGeometry args={[1.5, 0.12, 2.1]} />
        <meshStandardMaterial color="#eab308" roughness={.45} />
      </mesh>
      {/* Parabrisas */}
      <mesh position={[2.24, 2.15, 0]}>
        <boxGeometry args={[0.05, 0.5, 1.7]} />
        <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.18} roughness={.2} />
      </mesh>
      {/* Ventanas laterales */}
      {[-1.02, 1.02].map((pz) => (
        <mesh key={pz} position={[1.5, 2.12, pz]}>
          <boxGeometry args={[1.0, 0.45, 0.05]} />
          <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.12} roughness={.2} />
        </mesh>
      ))}
      {/* Radiador / frente */}
      <mesh position={[2.4, 1.55, 0]} castShadow>
        <boxGeometry args={[0.45, 0.8, 1.7]} />
        <meshStandardMaterial color="#4b5563" roughness={.7} />
      </mesh>
      {/* Faros */}
      {[-0.6, 0.6].map((pz) => (
        <mesh key={pz} position={[2.66, 1.9, pz]}>
          <boxGeometry args={[0.06, 0.18, 0.3]} />
          <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={.6} />
        </mesh>
      ))}
      {/* Tolva: piso */}
      <mesh position={[-0.75, 1.38, 0]} castShadow>
        <boxGeometry args={[3.4, 0.35, 2.3]} />
        <meshStandardMaterial color="#fbbf24" roughness={.5} />
      </mesh>
      {/* Tolva: laterales */}
      {[-1.15, 1.15].map((pz) => (
        <mesh key={pz} position={[-0.75, 2.0, pz]} castShadow>
          <boxGeometry args={[3.4, 0.95, 0.12]} />
          <meshStandardMaterial color="#f5c518" roughness={.5} />
        </mesh>
      ))}
      {/* Tolva: compuerta trasera */}
      <mesh position={[-2.45, 2.0, 0]} castShadow>
        <boxGeometry args={[0.12, 0.95, 2.3]} />
        <meshStandardMaterial color="#f5c518" roughness={.5} />
      </mesh>
      {/* Tolva: pared frontal inclinada */}
      <mesh position={[0.95, 2.25, 0]} rotation={[0, 0, -0.32]} castShadow>
        <boxGeometry args={[0.14, 1.7, 2.3]} />
        <meshStandardMaterial color="#f5c518" roughness={.5} />
      </mesh>
      {/* Visera de proteccion sobre la cabina */}
      <mesh position={[0.75, 3.0, 0]} rotation={[0, 0, -0.32]} castShadow>
        <boxGeometry args={[1.4, 0.12, 2.3]} />
        <meshStandardMaterial color="#eab308" roughness={.5} />
      </mesh>
      {/* Escapes */}
      {[-0.7, 0.7].map((pz) => (
        <mesh key={pz} position={[1.0, 2.95, pz]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 0.9, 8]} />
          <meshStandardMaterial color="#1f2937" roughness={.6} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- Perforadora ---------- */
export function Perforadora({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  const ruedasOruga = [-1.4, 1.4];
  const orugas = [-0.95, 0.95];
  const rungsY = [1.5, 2.3, 3.1, 3.9, 4.7];
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      {/* Orugas: cadenas con ruedas motrices */}
      {orugas.map((pz) => (
        <group key={pz}>
          {ruedasOruga.map((px) => (
            <group key={px}>
              <mesh position={[px, 0.34, pz]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.34, 0.34, 0.78, 16]} />
                <meshStandardMaterial color="#111827" roughness={.95} />
              </mesh>
              <mesh position={[px, 0.34, pz]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.18, 0.18, 0.82, 12]} />
                <meshStandardMaterial color="#6b7280" roughness={.5} metalness={.4} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.64, pz]} castShadow>
            <boxGeometry args={[2.9, 0.14, 0.78]} />
            <meshStandardMaterial color="#1f2937" roughness={.9} />
          </mesh>
          <mesh position={[0, 0.06, pz]}>
            <boxGeometry args={[2.9, 0.12, 0.78]} />
            <meshStandardMaterial color="#1f2937" roughness={.9} />
          </mesh>
        </group>
      ))}
      {/* Plataforma */}
      <mesh position={[0, 0.88, 0]} castShadow>
        <boxGeometry args={[3.5, 0.22, 2.4]} />
        <meshStandardMaterial color="#334155" roughness={.7} />
      </mesh>
      {/* Caseta de maquinas */}
      <mesh position={[-0.8, 1.72, 0]} castShadow>
        <boxGeometry args={[1.7, 1.35, 2.2]} />
        <meshStandardMaterial color="#eab308" roughness={.5} />
      </mesh>
      {/* Radiador trasero con aletas */}
      <mesh position={[-1.66, 1.75, 0]}>
        <boxGeometry args={[0.08, 1.0, 1.9]} />
        <meshStandardMaterial color="#1f2937" roughness={.8} />
      </mesh>
      {[0.45, 0.15, -0.15, -0.45].map((pz) => (
        <mesh key={pz} position={[-1.72, 1.75, pz]}>
          <boxGeometry args={[0.04, 0.95, 0.12]} />
          <meshStandardMaterial color="#94a3b8" roughness={.5} metalness={.3} />
        </mesh>
      ))}
      {/* Rejillas laterales de la caseta */}
      {[1.06, -1.06].map((pz) => (
        <group key={pz}>
          {[1.95, 1.72, 1.49].map((py) => (
            <mesh key={py} position={[-0.8, py, pz]}>
              <boxGeometry args={[1.3, 0.05, 0.04]} />
              <meshStandardMaterial color="#1f2937" roughness={.8} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Escapes con tapa de lluvia */}
      {[-0.75, 0.75].map((pz) => (
        <group key={pz}>
          <mesh position={[-0.7, 2.72, pz]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 0.75, 10]} />
            <meshStandardMaterial color="#1f2937" roughness={.6} />
          </mesh>
          <mesh position={[-0.7, 3.12, pz]}>
            <cylinderGeometry args={[0.1, 0.1, 0.05, 10]} />
            <meshStandardMaterial color="#374151" roughness={.6} />
          </mesh>
        </group>
      ))}
      {/* Cabina: vidrios, visera y baliza */}
      <mesh position={[0.5, 1.62, -0.6]} castShadow>
        <boxGeometry args={[1.05, 1.05, 1.05]} />
        <meshStandardMaterial color="#f5c518" roughness={.45} />
      </mesh>
      <mesh position={[1.04, 1.72, -0.6]}>
        <boxGeometry args={[0.05, 0.55, 0.85]} />
        <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.18} roughness={.2} />
      </mesh>
      <mesh position={[0.5, 1.7, -1.14]}>
        <boxGeometry args={[0.75, 0.55, 0.05]} />
        <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.12} roughness={.2} />
      </mesh>
      <mesh position={[0.5, 2.2, -0.6]} castShadow>
        <boxGeometry args={[1.15, 0.1, 1.15]} />
        <meshStandardMaterial color="#eab308" roughness={.45} />
      </mesh>
      <mesh position={[1.13, 2.16, -0.6]} rotation={[0, 0, 0.18]} castShadow>
        <boxGeometry args={[0.5, 0.07, 1.1]} />
        <meshStandardMaterial color="#eab308" roughness={.45} />
      </mesh>
      <mesh position={[0.5, 2.32, -0.6]}>
        <cylinderGeometry args={[0.07, 0.07, 0.12, 10]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={.8} />
      </mesh>
      {/* Mastil reticulado */}
      {[1.37, 1.73].map((px) => (
        <group key={px}>
          {[-0.24, 0.24].map((pz) => (
            <mesh key={pz} position={[px, 3.3, pz]} castShadow>
              <boxGeometry args={[0.07, 4.4, 0.07]} />
              <meshStandardMaterial color="#f5c518" roughness={.5} />
            </mesh>
          ))}
        </group>
      ))}
      {rungsY.map((py) => (
        <group key={py}>
          <mesh position={[1.55, py, 0.24]}>
            <boxGeometry args={[0.43, 0.06, 0.06]} />
            <meshStandardMaterial color="#eab308" roughness={.5} />
          </mesh>
          <mesh position={[1.55, py, -0.24]}>
            <boxGeometry args={[0.43, 0.06, 0.06]} />
            <meshStandardMaterial color="#eab308" roughness={.5} />
          </mesh>
        </group>
      ))}
      {/* Tope y polea superior */}
      <mesh position={[1.55, 5.68, 0]} castShadow>
        <boxGeometry args={[0.55, 0.14, 0.66]} />
        <meshStandardMaterial color="#eab308" roughness={.5} />
      </mesh>
      <mesh position={[1.55, 5.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.4, 16]} />
        <meshStandardMaterial color="#1f2937" roughness={.6} />
      </mesh>
      {/* Cabeza rotatoria con mangueras */}
      <mesh position={[1.55, 2.35, 0]} castShadow>
        <boxGeometry args={[0.6, 0.75, 0.8]} />
        <meshStandardMaterial color="#374151" roughness={.6} />
      </mesh>
      {[-0.28, 0.28].map((pz) => (
        <mesh key={pz} position={[1.32, 1.75, pz]} rotation={[0, 0, 0.55]}>
          <cylinderGeometry args={[0.04, 0.04, 1.1, 8]} />
          <meshStandardMaterial color="#0f172a" roughness={.7} />
        </mesh>
      ))}
      {/* Barra de perforacion con acoples y broca */}
      <mesh position={[1.9, 2.2, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 1.3, 10]} />
        <meshStandardMaterial color="#cbd5e1" roughness={.35} metalness={.6} />
      </mesh>
      <mesh position={[1.9, 1.5, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.1, 10]} />
        <meshStandardMaterial color="#64748b" roughness={.4} metalness={.5} />
      </mesh>
      <mesh position={[1.9, 0.85, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 1.2, 10]} />
        <meshStandardMaterial color="#cbd5e1" roughness={.35} metalness={.6} />
      </mesh>
      <mesh position={[1.9, 0.22, 0]}>
        <coneGeometry args={[0.14, 0.34, 12]} />
        <meshStandardMaterial color="#94a3b8" roughness={.4} metalness={.5} />
      </mesh>
      {/* Soporte en A y cilindros de inclinacion */}
      {[-0.5, 0.5].map((pz) => (
        <mesh key={pz} position={[0.45, 2.7, pz]} rotation={[0, 0, 0.62]} castShadow>
          <boxGeometry args={[2.0, 0.11, 0.11]} />
          <meshStandardMaterial color="#334155" roughness={.7} />
        </mesh>
      ))}
      {[-0.85, 0.85].map((pz) => (
        <mesh key={pz} position={[0.7, 1.9, pz]} rotation={[0, 0, 0.95]}>
          <cylinderGeometry args={[0.06, 0.06, 1.6, 10]} />
          <meshStandardMaterial color="#94a3b8" roughness={.4} metalness={.4} />
        </mesh>
      ))}
      {/* Baranda trasera */}
      {[-0.9, 0.9].map((pz) => (
        <mesh key={pz} position={[-1.62, 1.42, pz]}>
          <cylinderGeometry args={[0.03, 0.03, 0.9, 8]} />
          <meshStandardMaterial color="#94a3b8" roughness={.5} metalness={.3} />
        </mesh>
      ))}
      <mesh position={[-1.62, 1.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.8, 8]} />
        <meshStandardMaterial color="#94a3b8" roughness={.5} metalness={.3} />
      </mesh>
    </group>
  );
}
/* ---------- Poste de luz ---------- */
export function PosteLuz({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[0.4, 0.12, 0.4]} />
        <meshStandardMaterial color="#475569" roughness={.7} />
      </mesh>
      <mesh position={[0, 2.3, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 4.5, 10]} />
        <meshStandardMaterial color="#64748b" roughness={.5} metalness={.3} />
      </mesh>
      <mesh position={[0.3, 4.5, 0]} castShadow>
        <boxGeometry args={[0.6, 0.08, 0.08]} />
        <meshStandardMaterial color="#64748b" roughness={.5} metalness={.3} />
      </mesh>
      <mesh position={[0.6, 4.4, 0]}>
        <boxGeometry args={[0.5, 0.16, 0.3]} />
        <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={.7} />
      </mesh>
    </group>
  );
}

/* ---------- Baranda ---------- */
export function Baranda({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      {[-0.95, 0.95].map((px) => (
        <mesh key={px} position={[px, 0.55, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 1.1, 8]} />
          <meshStandardMaterial color="#475569" roughness={.6} />
        </mesh>
      ))}
      {[0.98, 0.6].map((py) => (
        <mesh key={py} position={[0, py, 0]} castShadow>
          <boxGeometry args={[2, 0.06, 0.06]} />
          <meshStandardMaterial color="#94a3b8" roughness={.5} metalness={.3} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- Basurero ---------- */
export function Basurero({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.24, 0.8, 14]} />
        <meshStandardMaterial color="#374151" roughness={.7} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.29, 0.29, 0.18, 14]} />
        <meshStandardMaterial color="#16a34a" roughness={.6} />
      </mesh>
      <mesh position={[0, 0.84, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.08, 14]} />
        <meshStandardMaterial color="#1f2937" roughness={.6} />
      </mesh>
    </group>
  );
}

/* ---------- Food truck ---------- */
export function FoodTruck({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  const ruedas: Array<[number, number]> = [[1.45, -0.95], [1.45, 0.95], [-1.3, -0.95], [-1.3, 0.95]];
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      {ruedas.map(([px, pz], i) => (
        <group key={i}>
          <mesh position={[px, 0.4, pz]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.4, 0.4, 0.34, 14]} />
            <meshStandardMaterial color="#111827" roughness={.9} />
          </mesh>
          <mesh position={[px, 0.4, pz]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.36, 10]} />
            <meshStandardMaterial color="#94a3b8" roughness={.4} metalness={.5} />
          </mesh>
        </group>
      ))}
      {/* Chasis */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <boxGeometry args={[4.0, 0.3, 1.8]} />
        <meshStandardMaterial color="#334155" roughness={.7} />
      </mesh>
      {/* Caja del food truck */}
      <mesh position={[-0.55, 1.75, 0]} castShadow>
        <boxGeometry args={[3.0, 1.5, 1.95]} />
        <meshStandardMaterial color="#f8fafc" roughness={.45} />
      </mesh>
      {/* Franja decorativa */}
      <mesh position={[-0.55, 2.12, 0]}>
        <boxGeometry args={[3.02, 0.26, 1.97]} />
        <meshStandardMaterial color="#dc2626" roughness={.5} />
      </mesh>
      {/* Ventana de atencion, toldo y barra */}
      <mesh position={[-0.5, 1.8, -0.99]}>
        <boxGeometry args={[1.4, 0.8, 0.06]} />
        <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.12} roughness={.3} />
      </mesh>
      <mesh position={[-0.5, 2.35, -1.25]} rotation={[0.28, 0, 0]} castShadow>
        <boxGeometry args={[1.6, 0.06, 0.6]} />
        <meshStandardMaterial color="#dc2626" roughness={.6} />
      </mesh>
      <mesh position={[-0.5, 1.38, -1.06]} castShadow>
        <boxGeometry args={[1.5, 0.06, 0.24]} />
        <meshStandardMaterial color="#e2e8f0" roughness={.5} />
      </mesh>
      {/* Cabina */}
      <mesh position={[1.6, 1.55, 0]} castShadow>
        <boxGeometry args={[0.95, 1.0, 1.85]} />
        <meshStandardMaterial color="#e2e8f0" roughness={.45} />
      </mesh>
      <mesh position={[2.09, 1.75, 0]}>
        <boxGeometry args={[0.05, 0.45, 1.5]} />
        <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.15} roughness={.2} />
      </mesh>
      {[-0.94, 0.94].map((pz) => (
        <mesh key={pz} position={[1.55, 1.75, pz]}>
          <boxGeometry args={[0.6, 0.4, 0.04]} />
          <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.1} roughness={.2} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- Pantalla LED ---------- */
export function PantallaLed({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[2.2, 0.16, 0.8]} />
        <meshStandardMaterial color="#334155" roughness={.7} />
      </mesh>
      {[-0.9, 0.9].map((px) => (
        <mesh key={px} position={[px, 0.45, 0]} castShadow>
          <boxGeometry args={[0.12, 0.6, 0.12]} />
          <meshStandardMaterial color="#475569" roughness={.6} />
        </mesh>
      ))}
      {/* Marco */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[2.5, 1.55, 0.14]} />
        <meshStandardMaterial color="#1f2937" roughness={.6} />
      </mesh>
      {/* Panel encendido */}
      <mesh position={[0, 1.5, 0.09]}>
        <boxGeometry args={[2.3, 1.35, 0.04]} />
        <meshStandardMaterial color="#0ea5e9" emissive="#38bdf8" emissiveIntensity={.55} roughness={.3} />
      </mesh>
    </group>
  );
}

/* ---------- Ambulancia ---------- */
export function Ambulancia({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  const ruedas: Array<[number, number]> = [[2.35, -0.98], [2.35, 0.98], [-1.4, -0.98], [-1.4, 0.98]];
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      {ruedas.map(([px, pz], i) => (
        <group key={i}>
          <mesh position={[px, 0.42, pz]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.32, 16]} />
            <meshStandardMaterial color="#111827" roughness={.9} />
          </mesh>
          <mesh position={[px, 0.42, pz]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.34, 12]} />
            <meshStandardMaterial color="#94a3b8" roughness={.4} metalness={.5} />
          </mesh>
        </group>
      ))}
      {/* Chasis y faldon inferior */}
      <mesh position={[0.1, 0.62, 0]} castShadow>
        <boxGeometry args={[5.1, 0.34, 1.9]} />
        <meshStandardMaterial color="#334155" roughness={.7} />
      </mesh>
      {/* Caja sanitaria (mas alta) */}
      <mesh position={[-0.9, 1.75, 0]} castShadow>
        <boxGeometry args={[3.2, 1.8, 2.0]} />
        <meshStandardMaterial color="#f8fafc" roughness={.4} />
      </mesh>
      {/* Cabina */}
      <mesh position={[1.5, 1.6, 0]} castShadow>
        <boxGeometry args={[1.6, 1.45, 2.0]} />
        <meshStandardMaterial color="#f8fafc" roughness={.4} />
      </mesh>
      {/* Capo */}
      <mesh position={[2.6, 1.15, 0]} castShadow>
        <boxGeometry args={[0.8, 0.7, 1.9]} />
        <meshStandardMaterial color="#f8fafc" roughness={.4} />
      </mesh>
      {/* Parabrisas inclinado */}
      <mesh position={[2.44, 1.9, 0]} rotation={[0, 0, 0.42]}>
        <boxGeometry args={[0.07, 0.9, 1.75]} />
        <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.15} roughness={.2} />
      </mesh>
      {/* Ventanas laterales de cabina y caja */}
      {[-1.03, 1.03].map((pz) => (
        <group key={pz}>
          <mesh position={[1.5, 1.8, pz]}>
            <boxGeometry args={[0.8, 0.55, 0.05]} />
            <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.1} roughness={.2} />
          </mesh>
          <mesh position={[-0.6, 1.95, pz]}>
            <boxGeometry args={[0.7, 0.5, 0.05]} />
            <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.1} roughness={.2} />
          </mesh>
        </group>
      ))}
      {/* Franja roja longitudinal */}
      <mesh position={[0.25, 1.3, 0]}>
        <boxGeometry args={[5.5, 0.32, 2.04]} />
        <meshStandardMaterial color="#dc2626" roughness={.5} />
      </mesh>
      {/* Cruces sobre circulo blanco (laterales de la caja) */}
      {[-1.03, 1.03].map((pz) => (
        <group key={pz}>
          <mesh position={[-1.8, 1.95, pz]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.36, 0.36, 0.03, 20]} />
            <meshStandardMaterial color="#ffffff" roughness={.4} />
          </mesh>
          <mesh position={[-1.8, 1.95, pz + (pz > 0 ? 0.02 : -0.02)]}>
            <boxGeometry args={[0.46, 0.13, 0.03]} />
            <meshStandardMaterial color="#dc2626" roughness={.5} />
          </mesh>
          <mesh position={[-1.8, 1.95, pz + (pz > 0 ? 0.02 : -0.02)]}>
            <boxGeometry args={[0.13, 0.46, 0.03]} />
            <meshStandardMaterial color="#dc2626" roughness={.5} />
          </mesh>
        </group>
      ))}
      {/* Puertas traseras con ventanas y manijas */}
      {[-0.5, 0.5].map((pz) => (
        <group key={pz}>
          <mesh position={[-2.51, 1.75, pz]}>
            <boxGeometry args={[0.03, 1.7, 0.92]} />
            <meshStandardMaterial color="#e2e8f0" roughness={.45} />
          </mesh>
          <mesh position={[-2.53, 2.2, pz]}>
            <boxGeometry args={[0.03, 0.5, 0.6]} />
            <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.1} roughness={.2} />
          </mesh>
          <mesh position={[-2.54, 1.45, pz + (pz > 0 ? -0.3 : 0.3)]}>
            <boxGeometry args={[0.03, 0.14, 0.1]} />
            <meshStandardMaterial color="#334155" roughness={.5} />
          </mesh>
        </group>
      ))}
      {/* Paragolpes, parrilla y faros */}
      <mesh position={[3.03, 0.68, 0]} castShadow>
        <boxGeometry args={[0.12, 0.38, 2.0]} />
        <meshStandardMaterial color="#1f2937" roughness={.7} />
      </mesh>
      <mesh position={[3.02, 1.15, 0]}>
        <boxGeometry args={[0.06, 0.42, 1.62]} />
        <meshStandardMaterial color="#1f2937" roughness={.7} />
      </mesh>
      {[-0.72, 0.72].map((pz) => (
        <mesh key={pz} position={[3.07, 1.32, pz]}>
          <boxGeometry args={[0.06, 0.2, 0.42]} />
          <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={.55} />
        </mesh>
      ))}
      {/* Espejos */}
      {[-1.12, 1.12].map((pz) => (
        <group key={pz}>
          <mesh position={[2.15, 1.95, pz]}>
            <boxGeometry args={[0.18, 0.05, 0.05]} />
            <meshStandardMaterial color="#334155" roughness={.6} />
          </mesh>
          <mesh position={[2.1, 1.85, pz + (pz > 0 ? 0.07 : -0.07)]}>
            <boxGeometry args={[0.06, 0.28, 0.12]} />
            <meshStandardMaterial color="#0f172a" roughness={.4} />
          </mesh>
        </group>
      ))}
      {/* Equipo de techo */}
      <mesh position={[-1.2, 2.72, 0]} castShadow>
        <boxGeometry args={[0.9, 0.18, 1.3]} />
        <meshStandardMaterial color="#cbd5e1" roughness={.6} />
      </mesh>
      {/* Barra de luces sobre la cabina */}
      <mesh position={[1.5, 2.38, 0]}>
        <boxGeometry args={[1.4, 0.08, 0.45]} />
        <meshStandardMaterial color="#1f2937" roughness={.5} />
      </mesh>
      <mesh position={[1.05, 2.47, 0]}>
        <boxGeometry args={[0.4, 0.16, 0.4]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={.85} />
      </mesh>
      <mesh position={[1.5, 2.46, 0]}>
        <boxGeometry args={[0.42, 0.14, 0.34]} />
        <meshStandardMaterial color="#1f2937" roughness={.5} />
      </mesh>
      <mesh position={[1.95, 2.47, 0]}>
        <boxGeometry args={[0.4, 0.16, 0.4]} />
        <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={.85} />
      </mesh>
    </group>
  );
}
/* ---------- Carpa de evento ---------- */
export function Carpa({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  const patas: Array<[number, number]> = [[-2.8, -1.8], [2.8, -1.8], [-2.8, 1.8], [2.8, 1.8]];
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      {patas.map(([px, pz], i) => (
        <mesh key={i} position={[px, 1.15, pz]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 2.3, 10]} />
          <meshStandardMaterial color="#64748b" roughness={.5} metalness={.3} />
        </mesh>
      ))}
      {/* Faldon perimetral */}
      {[-2.05, 2.05].map((pz) => (
        <mesh key={pz} position={[0, 2.42, pz]} castShadow>
          <boxGeometry args={[6.1, 0.28, 0.05]} />
          <meshStandardMaterial color="#e7e5e4" roughness={.8} />
        </mesh>
      ))}
      {[-3.05, 3.05].map((px) => (
        <mesh key={px} position={[px, 2.42, 0]} castShadow>
          <boxGeometry args={[0.05, 0.28, 4.1]} />
          <meshStandardMaterial color="#e7e5e4" roughness={.8} />
        </mesh>
      ))}
      {/* Techo a dos aguas */}
      <mesh position={[0, 2.72, -1.05]} rotation={[0.42, 0, 0]} castShadow>
        <boxGeometry args={[6.2, 0.07, 2.4]} />
        <meshStandardMaterial color="#f1f5f9" roughness={.85} />
      </mesh>
      <mesh position={[0, 2.72, 1.05]} rotation={[-0.42, 0, 0]} castShadow>
        <boxGeometry args={[6.2, 0.07, 2.4]} />
        <meshStandardMaterial color="#f1f5f9" roughness={.85} />
      </mesh>
      <mesh position={[0, 3.12, 0]}>
        <boxGeometry args={[6.2, 0.06, 0.24]} />
        <meshStandardMaterial color="#cbd5e1" roughness={.8} />
      </mesh>
    </group>
  );
}

/* ---------- Banos portatiles ---------- */
export function BanosPortatiles({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[2.35, 0.12, 1.35]} />
        <meshStandardMaterial color="#334155" roughness={.8} />
      </mesh>
      <mesh position={[0, 1.18, 0]} castShadow>
        <boxGeometry args={[2.2, 2.2, 1.25]} />
        <meshStandardMaterial color="#15803d" roughness={.6} />
      </mesh>
      <mesh position={[0, 2.33, 0]} castShadow>
        <boxGeometry args={[2.3, 0.12, 1.35]} />
        <meshStandardMaterial color="#e2e8f0" roughness={.6} />
      </mesh>
      {/* Puertas */}
      {[-0.55, 0.55].map((px) => (
        <group key={px}>
          <mesh position={[px, 1.12, 0.64]}>
            <boxGeometry args={[0.92, 1.95, 0.05]} />
            <meshStandardMaterial color="#166534" roughness={.6} />
          </mesh>
          <mesh position={[px + 0.32, 1.05, 0.68]}>
            <boxGeometry args={[0.06, 0.18, 0.03]} />
            <meshStandardMaterial color="#e2e8f0" roughness={.5} />
          </mesh>
          <mesh position={[px, 1.85, 0.675]}>
            <boxGeometry args={[0.3, 0.22, 0.02]} />
            <meshStandardMaterial color="#0f172a" roughness={.6} />
          </mesh>
          <mesh position={[px, 2.08, 0.675]}>
            <boxGeometry args={[0.12, 0.12, 0.03]} />
            <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------- Bus de acercamiento ---------- */
export function Bus({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  const ruedas: Array<[number, number]> = [[2.8, -1.1], [2.8, 1.1], [-1.6, -1.1], [-1.6, 1.1], [-2.7, -1.1], [-2.7, 1.1]];
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      {ruedas.map(([px, pz], i) => (
        <group key={i}>
          <mesh position={[px, 0.5, pz]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.5, 0.5, 0.4, 16]} />
            <meshStandardMaterial color="#111827" roughness={.9} />
          </mesh>
          <mesh position={[px, 0.5, pz]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.42, 12]} />
            <meshStandardMaterial color="#94a3b8" roughness={.4} metalness={.5} />
          </mesh>
        </group>
      ))}
      {/* Chasis */}
      <mesh position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[7.6, 0.4, 2.4]} />
        <meshStandardMaterial color="#334155" roughness={.7} />
      </mesh>
      {/* Carroceria */}
      <mesh position={[0, 2.0, 0]} castShadow>
        <boxGeometry args={[7.8, 2.2, 2.5]} />
        <meshStandardMaterial color="#f1f5f9" roughness={.45} />
      </mesh>
      {/* Franja azul */}
      <mesh position={[0, 1.55, 0]}>
        <boxGeometry args={[7.82, 0.35, 2.52]} />
        <meshStandardMaterial color="#1d4ed8" roughness={.5} />
      </mesh>
      {/* Parabrisas y ventanas */}
      <mesh position={[3.92, 2.35, 0]} rotation={[0, 0, -0.12]}>
        <boxGeometry args={[0.06, 1.05, 2.2]} />
        <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.15} roughness={.2} />
      </mesh>
      {[-1.27, 1.27].map((pz) => (
        <group key={pz}>
          {[-2.6, -1.4, -0.2, 1.0, 2.2].map((px) => (
            <mesh key={px} position={[px, 2.35, pz]}>
              <boxGeometry args={[1.0, 0.75, 0.04]} />
              <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.1} roughness={.2} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Puerta lateral y frente trasero */}
      <mesh position={[2.95, 1.7, -1.27]}>
        <boxGeometry args={[0.04, 1.6, 0.8]} />
        <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.08} roughness={.2} />
      </mesh>
      <mesh position={[-3.92, 1.9, 0]}>
        <boxGeometry args={[0.05, 1.0, 1.9]} />
        <meshStandardMaterial color="#334155" roughness={.7} />
      </mesh>
      {/* Faros */}
      {[-0.9, 0.9].map((pz) => (
        <mesh key={pz} position={[3.92, 1.0, pz]}>
          <boxGeometry args={[0.05, 0.2, 0.36]} />
          <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={.6} />
        </mesh>
      ))}
      {/* Equipos de techo */}
      {[-1.5, 0.6].map((px) => (
        <mesh key={px} position={[px, 3.22, 0]} castShadow>
          <boxGeometry args={[1.5, 0.24, 1.5]} />
          <meshStandardMaterial color="#cbd5e1" roughness={.6} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- Maquinaria (tipo de bloque con forma) ---------- */

/** Tractor de orugas D6/D8: cadena con zapatas, capo con rejilla, cabina vidriada, cuchilla curva y ripper. */
export function TractorOrugas({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  const lados = [-0.95, 0.95];
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      {lados.map((pz) => (
        <group key={pz}>
          {/* Ruedas guia y motriz */}
          <mesh position={[1.35, 0.4, pz]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.36, 0.36, 0.72, 18]} />
            <meshStandardMaterial color="#111827" roughness={.95} />
          </mesh>
          <mesh position={[-1.35, 0.4, pz]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.36, 0.36, 0.72, 18]} />
            <meshStandardMaterial color="#111827" roughness={.95} />
          </mesh>
          {/* Banda: tramos y envolventes */}
          <mesh position={[0, 0.05, pz]}>
            <boxGeometry args={[2.85, 0.11, 0.76]} />
            <meshStandardMaterial color="#1f2937" roughness={.9} />
          </mesh>
          <mesh position={[0, 0.75, pz]}>
            <boxGeometry args={[2.65, 0.11, 0.76]} />
            <meshStandardMaterial color="#1f2937" roughness={.9} />
          </mesh>
          {[-75, -45, -15, 15, 45, 75].map((g) => {
            const rad = (g * Math.PI) / 180;
            return (
              <mesh key={`w1-${g}`} position={[1.35 + 0.4 * Math.cos(rad), 0.4 + 0.4 * Math.sin(rad), pz]} rotation={[0, 0, rad]}>
                <boxGeometry args={[0.44, 0.11, 0.76]} />
                <meshStandardMaterial color="#1f2937" roughness={.9} />
              </mesh>
            );
          })}
          {[105, 135, 165, 195, 225, 255].map((g) => {
            const rad = (g * Math.PI) / 180;
            return (
              <mesh key={`w2-${g}`} position={[-1.35 + 0.4 * Math.cos(rad), 0.4 + 0.4 * Math.sin(rad), pz]} rotation={[0, 0, rad]}>
                <boxGeometry args={[0.44, 0.11, 0.76]} />
                <meshStandardMaterial color="#1f2937" roughness={.9} />
              </mesh>
            );
          })}
          {/* Zapatas (grousers) */}
          {[-1.1, -0.73, -0.36, 0, 0.36, 0.73, 1.1].map((px) => (
            <mesh key={`b${px}`} position={[px, -0.01, pz]}>
              <boxGeometry args={[0.2, 0.07, 0.8]} />
              <meshStandardMaterial color="#374151" roughness={.8} />
            </mesh>
          ))}
          {[-0.9, -0.45, 0, 0.45, 0.9].map((px) => (
            <mesh key={`t${px}`} position={[px, 0.82, pz]}>
              <boxGeometry args={[0.2, 0.05, 0.72]} />
              <meshStandardMaterial color="#374151" roughness={.8} />
            </mesh>
          ))}
          {/* Bastidor lateral */}
          <mesh position={[0, 0.4, pz]}>
            <boxGeometry args={[2.5, 0.42, 0.62]} />
            <meshStandardMaterial color="#4b5563" roughness={.7} />
          </mesh>
          <mesh position={[0.75, 0.4, pz]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.66, 14]} />
            <meshStandardMaterial color="#6b7280" roughness={.5} metalness={.4} />
          </mesh>
          {/* Guardafango */}
          <mesh position={[0, 0.94, pz]} castShadow>
            <boxGeometry args={[3.0, 0.07, 0.92]} />
            <meshStandardMaterial color="#eab308" roughness={.5} />
          </mesh>
        </group>
      ))}
      {/* Plataforma y capo */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[2.85, 0.22, 1.8]} />
        <meshStandardMaterial color="#334155" roughness={.7} />
      </mesh>
      <mesh position={[0.95, 1.36, 0]} castShadow>
        <boxGeometry args={[1.5, 0.62, 1.7]} />
        <meshStandardMaterial color="#eab308" roughness={.45} />
      </mesh>
      <mesh position={[1.72, 1.32, 0]} rotation={[0, 0, -0.16]} castShadow>
        <boxGeometry args={[0.95, 0.52, 1.6]} />
        <meshStandardMaterial color="#eab308" roughness={.45} />
      </mesh>
      {/* Rejilla frontal con barras */}
      <mesh position={[2.18, 1.28, 0]}>
        <boxGeometry args={[0.08, 0.55, 1.5]} />
        <meshStandardMaterial color="#1f2937" roughness={.7} />
      </mesh>
      {[-0.5, -0.25, 0, 0.25, 0.5].map((pz) => (
        <mesh key={pz} position={[2.23, 1.28, pz]}>
          <boxGeometry args={[0.02, 0.48, 0.12]} />
          <meshStandardMaterial color="#6b7280" roughness={.5} metalness={.4} />
        </mesh>
      ))}
      {/* Paneles laterales del motor */}
      {[-0.87, 0.87].map((pz) => (
        <mesh key={pz} position={[0.95, 1.3, pz]}>
          <boxGeometry args={[1.4, 0.5, 0.05]} />
          <meshStandardMaterial color="#d97706" roughness={.5} />
        </mesh>
      ))}
      {/* Filtro de aire y escape con escudo termico */}
      <mesh position={[0.75, 1.82, 0.52]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 0.32, 12]} />
        <meshStandardMaterial color="#1f2937" roughness={.6} />
      </mesh>
      <mesh position={[1.35, 1.95, 0.6]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.8, 12]} />
        <meshStandardMaterial color="#111827" roughness={.6} />
      </mesh>
      <mesh position={[1.35, 2.1, 0.6]}>
        <cylinderGeometry args={[0.09, 0.09, 0.28, 12]} />
        <meshStandardMaterial color="#9ca3af" roughness={.4} metalness={.5} />
      </mesh>
      {/* Cabina con pilares y vidrios */}
      <mesh position={[-0.35, 1.72, 0]} castShadow>
        <boxGeometry args={[1.05, 0.95, 1.6]} />
        <meshStandardMaterial color="#f5c518" roughness={.45} />
      </mesh>
      {([[0.18, 0.78], [0.18, -0.78], [-0.88, 0.78], [-0.88, -0.78]] as Array<[number, number]>).map(([px, pz], i) => (
        <mesh key={i} position={[px, 1.75, pz]}>
          <boxGeometry args={[0.09, 0.95, 0.09]} />
          <meshStandardMaterial color="#d97706" roughness={.5} />
        </mesh>
      ))}
      <mesh position={[0.16, 1.82, 0]}>
        <boxGeometry args={[0.04, 0.7, 1.42]} />
        <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.16} roughness={.2} />
      </mesh>
      <mesh position={[-0.9, 1.82, 0]}>
        <boxGeometry args={[0.04, 0.7, 1.42]} />
        <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.1} roughness={.2} />
      </mesh>
      {[-0.81, 0.81].map((pz) => (
        <mesh key={pz} position={[-0.35, 1.82, pz]}>
          <boxGeometry args={[0.88, 0.62, 0.04]} />
          <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.12} roughness={.2} />
        </mesh>
      ))}
      {/* Techo, baliza y luces de trabajo */}
      <mesh position={[-0.35, 2.28, 0]} castShadow>
        <boxGeometry args={[1.2, 0.1, 1.72]} />
        <meshStandardMaterial color="#eab308" roughness={.45} />
      </mesh>
      <mesh position={[-0.35, 2.4, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.14, 10]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={.8} />
      </mesh>
      {[-0.5, 0.5].map((pz) => (
        <mesh key={pz} position={[-0.9, 2.24, pz]}>
          <boxGeometry args={[0.12, 0.1, 0.14]} />
          <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={.6} />
        </mesh>
      ))}
      {/* Cuchilla curva con cantoneras, canto y brazos */}
      <mesh position={[2.32, 0.62, 0]} rotation={[0, 0, 0.12]} castShadow>
        <boxGeometry args={[0.16, 0.6, 2.7]} />
        <meshStandardMaterial color="#f5c518" roughness={.5} />
      </mesh>
      <mesh position={[2.26, 1.06, 0]} rotation={[0, 0, 0.38]} castShadow>
        <boxGeometry args={[0.16, 0.5, 2.7]} />
        <meshStandardMaterial color="#eab308" roughness={.5} />
      </mesh>
      <mesh position={[2.08, 1.34, 0]} rotation={[0, 0, 0.66]} castShadow>
        <boxGeometry args={[0.12, 0.34, 2.7]} />
        <meshStandardMaterial color="#eab308" roughness={.5} />
      </mesh>
      <mesh position={[2.44, 0.34, 0]}>
        <boxGeometry args={[0.22, 0.12, 2.7]} />
        <meshStandardMaterial color="#374151" roughness={.6} metalness={.3} />
      </mesh>
      {[-1.34, 1.34].map((pz) => (
        <mesh key={pz} position={[2.3, 0.92, pz]} rotation={[0, 0, 0.3]}>
          <boxGeometry args={[0.55, 0.6, 0.08]} />
          <meshStandardMaterial color="#d97706" roughness={.5} />
        </mesh>
      ))}
      {[-0.72, 0.72].map((pz) => (
        <mesh key={pz} position={[1.5, 0.78, pz]} castShadow>
          <boxGeometry args={[1.6, 0.18, 0.2]} />
          <meshStandardMaterial color="#4b5563" roughness={.7} />
        </mesh>
      ))}
      {[-1.0, 1.0].map((pz) => (
        <group key={pz}>
          <mesh position={[1.55, 1.0, pz]} rotation={[0, 0, 0.5]}>
            <cylinderGeometry args={[0.08, 0.08, 1.1, 12]} />
            <meshStandardMaterial color="#6b7280" roughness={.4} metalness={.5} />
          </mesh>
          <mesh position={[1.9, 1.22, pz]} rotation={[0, 0, 0.5]}>
            <cylinderGeometry args={[0.045, 0.045, 0.6, 10]} />
            <meshStandardMaterial color="#cbd5e1" roughness={.3} metalness={.6} />
          </mesh>
        </group>
      ))}
      {/* Ripper trasero: viga, vastagos y unas */}
      <mesh position={[-1.7, 0.86, 0]} castShadow>
        <boxGeometry args={[0.7, 0.2, 1.8]} />
        <meshStandardMaterial color="#374151" roughness={.7} />
      </mesh>
      {[-0.6, 0, 0.6].map((pz) => (
        <group key={pz}>
          <mesh position={[-2.0, 0.6, pz]} rotation={[0, 0, 0.5]} castShadow>
            <boxGeometry args={[0.16, 0.85, 0.16]} />
            <meshStandardMaterial color="#4b5563" roughness={.7} />
          </mesh>
          <mesh position={[-2.26, 0.26, pz]} rotation={[0, 0, 0.5]}>
            <boxGeometry args={[0.34, 0.12, 0.14]} />
            <meshStandardMaterial color="#94a3b8" roughness={.4} metalness={.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Cargador frontal articulado: neumaticos con rines y tacos, boom anclado con cilindros y balde soldado con dientes. */
export function CargadorFrontal({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  const ruedas: Array<[number, number]> = [[1.85, -1.05], [1.85, 1.05], [-1.75, -1.05], [-1.75, 1.05]];
  /* Geometria del conjunto frontal (anclajes reales) */
  const P = { x: 0.75, y: 1.55 };            // pivote del boom en el chasis
  const B = { x: 2.95, y: 1.42 };            // pivote del balde
  const largoBoom = Math.hypot(B.x - P.x, B.y - P.y) + 0.3;
  const angBoom = Math.atan2(B.y - P.y, B.x - P.x);
  const boomCx = (P.x + B.x) / 2;
  const boomCy = (P.y + B.y) / 2;
  const cruce = { x: P.x + 0.62 * (B.x - P.x), y: P.y + 0.62 * (B.y - P.y) };
  const lift = { ax: 1.0, ay: 1.0, bx: 1.75, by: 1.52 };
  const angLift = Math.atan2(lift.by - lift.ay, lift.bx - lift.ax);
  const tilt = { ax: 2.5, ay: 1.5, bx: 3.02, by: 1.86 };
  const angTilt = Math.atan2(tilt.by - tilt.ay, tilt.bx - tilt.ax);
  const avance = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
  const liftBarril = avance({ x: lift.ax, y: lift.ay }, { x: lift.bx, y: lift.by }, 0.35);
  const liftVastago = avance({ x: lift.ax, y: lift.ay }, { x: lift.bx, y: lift.by }, 0.8);
  const tiltBarril = avance({ x: tilt.ax, y: tilt.ay }, { x: tilt.bx, y: tilt.by }, 0.35);
  const tiltVastago = avance({ x: tilt.ax, y: tilt.ay }, { x: tilt.bx, y: tilt.by }, 0.8);
  /* Balde: puntos soldados (respaldo top->base, fondo base->labio) */
  const respaldoTop = { x: 3.02, y: 1.88 };
  const respaldoBase = { x: 3.2, y: 0.88 };
  const labio = { x: 4.08, y: 0.58 };
  const angRespaldo = Math.atan2(respaldoBase.y - respaldoTop.y, respaldoBase.x - respaldoTop.x);
  const angFondo = Math.atan2(labio.y - respaldoBase.y, labio.x - respaldoBase.x);
  const angLateral = Math.atan2(labio.y - respaldoTop.y, labio.x - respaldoTop.x);
  const largoLateral = Math.hypot(labio.x - respaldoTop.x, labio.y - respaldoTop.y) + 0.25;
  const centroLateral = { x: (respaldoTop.x + labio.x) / 2, y: (respaldoTop.y + labio.y) / 2 };
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      {ruedas.map(([px, pz], i) => (
        <group key={i}>
          <mesh position={[px, 0.9, pz]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.9, 0.9, 0.6, 20]} />
            <meshStandardMaterial color="#111827" roughness={.95} />
          </mesh>
          <mesh position={[px, 0.9, pz]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.42, 0.42, 0.64, 16]} />
            <meshStandardMaterial color="#94a3b8" roughness={.4} metalness={.5} />
          </mesh>
          <mesh position={[px, 0.9, pz]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.68, 12]} />
            <meshStandardMaterial color="#374151" roughness={.5} metalness={.4} />
          </mesh>
          {[0, 60, 120, 180, 240, 300].map((g) => (
            <mesh key={g} position={[px + 0.86 * Math.cos((g * Math.PI) / 180), 0.9 + 0.86 * Math.sin((g * Math.PI) / 180), pz]} rotation={[0, 0, (g * Math.PI) / 180]}>
              <boxGeometry args={[0.26, 0.18, 0.62]} />
              <meshStandardMaterial color="#1f2937" roughness={.9} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Chasis delantero, articulacion y trasero */}
      <mesh position={[1.65, 1.15, 0]} castShadow>
        <boxGeometry args={[1.7, 0.5, 1.7]} />
        <meshStandardMaterial color="#334155" roughness={.7} />
      </mesh>
      <mesh position={[0.35, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.26, 0.62, 16]} />
        <meshStandardMaterial color="#1f2937" roughness={.6} />
      </mesh>
      <mesh position={[-1.6, 1.15, 0]} castShadow>
        <boxGeometry args={[2.0, 0.5, 1.55]} />
        <meshStandardMaterial color="#334155" roughness={.7} />
      </mesh>
      {/* Soporte del pivote del boom (placas + pasador) */}
      {[-0.68, 0.68].map((pz) => (
        <mesh key={pz} position={[P.x, P.y - 0.05, pz]} castShadow>
          <boxGeometry args={[0.4, 0.6, 0.16]} />
          <meshStandardMaterial color="#374151" roughness={.7} />
        </mesh>
      ))}
      <mesh position={[P.x, P.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 1.62, 12]} />
        <meshStandardMaterial color="#6b7280" roughness={.4} metalness={.5} />
      </mesh>
      {/* Motor trasero con capo inclinado y rejilla */}
      <mesh position={[-1.5, 2.0, 0]} castShadow>
        <boxGeometry args={[2.0, 1.05, 2.15]} />
        <meshStandardMaterial color="#f5c518" roughness={.45} />
      </mesh>
      <mesh position={[-2.5, 2.12, 0]} rotation={[0, 0, 0.16]} castShadow>
        <boxGeometry args={[0.9, 0.62, 2.0]} />
        <meshStandardMaterial color="#eab308" roughness={.45} />
      </mesh>
      <mesh position={[-2.78, 1.9, 0]}>
        <boxGeometry args={[0.07, 0.7, 1.9]} />
        <meshStandardMaterial color="#1f2937" roughness={.7} />
      </mesh>
      {[-0.6, -0.2, 0.2, 0.6].map((pz) => (
        <mesh key={pz} position={[-2.83, 1.9, pz]}>
          <boxGeometry args={[0.02, 0.6, 0.12]} />
          <meshStandardMaterial color="#6b7280" roughness={.5} metalness={.4} />
        </mesh>
      ))}
      <mesh position={[-2.85, 1.25, 0]} castShadow>
        <boxGeometry args={[0.5, 0.7, 2.2]} />
        <meshStandardMaterial color="#374151" roughness={.8} />
      </mesh>
      {/* Capo delantero del motor */}
      <mesh position={[0.55, 1.95, 0]} castShadow>
        <boxGeometry args={[1.15, 0.8, 1.9]} />
        <meshStandardMaterial color="#f5c518" roughness={.45} />
      </mesh>
      {/* Cabina vidriada con pilares, techo y baliza */}
      <mesh position={[-0.75, 2.42, 0]} castShadow>
        <boxGeometry args={[1.15, 1.1, 1.7]} />
        <meshStandardMaterial color="#eab308" roughness={.45} />
      </mesh>
      {([[-0.15, 0.83], [-0.15, -0.83], [-1.33, 0.83], [-1.33, -0.83]] as Array<[number, number]>).map(([px, pz], i) => (
        <mesh key={i} position={[px, 2.45, pz]}>
          <boxGeometry args={[0.09, 1.1, 0.09]} />
          <meshStandardMaterial color="#d97706" roughness={.5} />
        </mesh>
      ))}
      <mesh position={[-0.16, 2.55, 0]}>
        <boxGeometry args={[0.04, 0.8, 1.5]} />
        <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.16} roughness={.2} />
      </mesh>
      {[-0.86, 0.86].map((pz) => (
        <mesh key={pz} position={[-0.75, 2.55, pz]}>
          <boxGeometry args={[0.95, 0.7, 0.04]} />
          <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.12} roughness={.2} />
        </mesh>
      ))}
      <mesh position={[-0.75, 3.02, 0]} castShadow>
        <boxGeometry args={[1.3, 0.1, 1.85]} />
        <meshStandardMaterial color="#f5c518" roughness={.45} />
      </mesh>
      <mesh position={[-0.75, 3.14, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.14, 10]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={.8} />
      </mesh>
      {[-0.6, 0.6].map((pz) => (
        <mesh key={pz} position={[-1.32, 2.98, pz]}>
          <boxGeometry args={[0.12, 0.1, 0.16]} />
          <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={.6} />
        </mesh>
      ))}
      <mesh position={[-1.1, 2.72, 0.7]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.7, 12]} />
        <meshStandardMaterial color="#111827" roughness={.6} />
      </mesh>
      <mesh position={[-1.1, 2.9, 0.7]}>
        <cylinderGeometry args={[0.1, 0.1, 0.22, 12]} />
        <meshStandardMaterial color="#9ca3af" roughness={.4} metalness={.5} />
      </mesh>
      {/* Boom doble anclado pivote chasis -> pivote balde */}
      {[-0.68, 0.68].map((pz) => (
        <mesh key={pz} position={[boomCx, boomCy, pz]} rotation={[0, 0, angBoom]} castShadow>
          <boxGeometry args={[largoBoom, 0.4, 0.24]} />
          <meshStandardMaterial color="#eab308" roughness={.5} />
        </mesh>
      ))}
      <mesh position={[cruce.x, cruce.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 1.5, 14]} />
        <meshStandardMaterial color="#d97706" roughness={.5} />
      </mesh>
      {/* Mangueras a lo largo del boom */}
      {[-0.45, 0.45].map((pz) => (
        <mesh key={pz} position={[boomCx, boomCy + 0.26, pz]} rotation={[0, 0, angBoom]}>
          <cylinderGeometry args={[0.035, 0.035, largoBoom * 0.92, 8]} />
          <meshStandardMaterial color="#0f172a" roughness={.7} />
        </mesh>
      ))}
      {/* Cilindros de elevacion (chasis -> boom) */}
      {[-0.68, 0.68].map((pz) => (
        <group key={pz}>
          <mesh position={[liftBarril.x, liftBarril.y, pz]} rotation={[0, 0, angLift]}>
            <cylinderGeometry args={[0.1, 0.1, 0.6, 12]} />
            <meshStandardMaterial color="#6b7280" roughness={.4} metalness={.5} />
          </mesh>
          <mesh position={[liftVastago.x, liftVastago.y, pz]} rotation={[0, 0, angLift]}>
            <cylinderGeometry args={[0.055, 0.055, 0.55, 10]} />
            <meshStandardMaterial color="#cbd5e1" roughness={.3} metalness={.6} />
          </mesh>
        </group>
      ))}
      {/* Cilindros de inclinacion (boom -> balde) */}
      {[-0.68, 0.68].map((pz) => (
        <group key={pz}>
          <mesh position={[tiltBarril.x, tiltBarril.y, pz]} rotation={[0, 0, angTilt]}>
            <cylinderGeometry args={[0.075, 0.075, 0.42, 12]} />
            <meshStandardMaterial color="#6b7280" roughness={.4} metalness={.5} />
          </mesh>
          <mesh position={[tiltVastago.x, tiltVastago.y, pz]} rotation={[0, 0, angTilt]}>
            <cylinderGeometry args={[0.04, 0.04, 0.4, 10]} />
            <meshStandardMaterial color="#cbd5e1" roughness={.3} metalness={.6} />
          </mesh>
        </group>
      ))}
      {/* Balde soldado: pasador, respaldo, fondo, laterales, canto, dientes y guarda */}
      <mesh position={[B.x, B.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 1.5, 12]} />
        <meshStandardMaterial color="#6b7280" roughness={.4} metalness={.5} />
      </mesh>
      <mesh position={[(respaldoTop.x + respaldoBase.x) / 2, (respaldoTop.y + respaldoBase.y) / 2, 0]} rotation={[0, 0, angRespaldo]} castShadow>
        <boxGeometry args={[Math.hypot(respaldoBase.x - respaldoTop.x, respaldoBase.y - respaldoTop.y) + 0.22, 0.14, 2.7]} />
        <meshStandardMaterial color="#374151" roughness={.8} />
      </mesh>
      <mesh position={[(respaldoBase.x + labio.x) / 2, (respaldoBase.y + labio.y) / 2, 0]} rotation={[0, 0, angFondo]} castShadow>
        <boxGeometry args={[Math.hypot(labio.x - respaldoBase.x, labio.y - respaldoBase.y) + 0.18, 0.13, 2.7]} />
        <meshStandardMaterial color="#4b5563" roughness={.8} />
      </mesh>
      {[-1.36, 1.36].map((pz) => (
        <mesh key={pz} position={[centroLateral.x, centroLateral.y, pz]} rotation={[0, 0, angLateral]} castShadow>
          <boxGeometry args={[largoLateral, 0.62, 0.09]} />
          <meshStandardMaterial color="#374151" roughness={.8} />
        </mesh>
      ))}
      <mesh position={[labio.x + 0.03, labio.y - 0.03, 0]} rotation={[0, 0, angFondo]}>
        <boxGeometry args={[0.24, 0.13, 2.7]} />
        <meshStandardMaterial color="#1f2937" roughness={.6} metalness={.3} />
      </mesh>
      {[-1.0, -0.5, 0, 0.5, 1.0].map((pz) => (
        <mesh key={pz} position={[labio.x + 0.22, labio.y - 0.1, pz]} rotation={[0, 0, angFondo]}>
          <boxGeometry args={[0.4, 0.09, 0.16]} />
          <meshStandardMaterial color="#94a3b8" roughness={.4} metalness={.5} />
        </mesh>
      ))}
      <mesh position={[respaldoTop.x, respaldoTop.y, 0]} rotation={[0, 0, -0.12]} castShadow>
        <boxGeometry args={[0.5, 0.1, 2.7]} />
        <meshStandardMaterial color="#eab308" roughness={.5} />
      </mesh>
      <mesh position={[(tilt.bx + respaldoTop.x) / 2, (tilt.by + respaldoTop.y) / 2, 0]} rotation={[0, 0, 0.35]}>
        <boxGeometry args={[0.42, 0.16, 0.95]} />
        <meshStandardMaterial color="#4b5563" roughness={.7} />
      </mesh>
      {/* Espejos y escalera */}
      {[-1.15, 1.15].map((pz) => (
        <mesh key={pz} position={[-0.15, 2.6, pz]}>
          <boxGeometry args={[0.14, 0.3, 0.06]} />
          <meshStandardMaterial color="#0f172a" roughness={.4} />
        </mesh>
      ))}
      <mesh position={[-1.55, 1.1, -0.82]}>
        <boxGeometry args={[0.5, 0.09, 0.1]} />
        <meshStandardMaterial color="#6b7280" roughness={.5} metalness={.4} />
      </mesh>
    </group>
  );
}
/** Motoniveladora: bastidor largo, hoja central con corona y cilindros, escarificador, cabina sobre el motor y tandem trasero. */
export function Motoniveladora({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  const ruedas: Array<[number, number]> = [[3.6, -0.95], [3.6, 0.95], [-1.9, -1.0], [-1.9, 1.0], [-2.9, -1.0], [-2.9, 1.0]];
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      {ruedas.map(([px, pz], i) => {
        const r = px > 0 ? 0.65 : 0.7;
        return (
          <group key={i}>
            <mesh position={[px, r, pz]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[r, r, 0.42, 16]} />
              <meshStandardMaterial color="#111827" roughness={.95} />
            </mesh>
            <mesh position={[px, r, pz]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.3, 0.3, 0.46, 12]} />
              <meshStandardMaterial color="#94a3b8" roughness={.4} metalness={.5} />
            </mesh>
            <mesh position={[px, r, pz]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.5, 10]} />
              <meshStandardMaterial color="#374151" roughness={.5} metalness={.4} />
            </mesh>
          </group>
        );
      })}
      {/* Bastidor principal y cuello delantero */}
      <mesh position={[0.3, 1.2, 0]} castShadow>
        <boxGeometry args={[6.6, 0.28, 0.55]} />
        <meshStandardMaterial color="#334155" roughness={.7} />
      </mesh>
      <mesh position={[2.55, 1.32, 0]} rotation={[0, 0, 0.04]} castShadow>
        <boxGeometry args={[2.6, 0.28, 0.5]} />
        <meshStandardMaterial color="#eab308" roughness={.5} />
      </mesh>
      <mesh position={[3.6, 1.0, 0]} castShadow>
        <boxGeometry args={[0.55, 0.45, 1.9]} />
        <meshStandardMaterial color="#f5c518" roughness={.5} />
      </mesh>
      {[-0.8, 0.8].map((pz) => (
        <mesh key={pz} position={[3.98, 1.05, pz]}>
          <boxGeometry args={[0.1, 0.18, 0.32]} />
          <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={.5} />
        </mesh>
      ))}
      {/* Corona (circle drive), drawbar y hoja con cuchilla */}
      <mesh position={[0.95, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.38, 0.38, 0.22, 16]} />
        <meshStandardMaterial color="#1f2937" roughness={.6} />
      </mesh>
      <mesh position={[0.95, 0.92, 0]} castShadow>
        <boxGeometry args={[1.6, 0.16, 0.55]} />
        <meshStandardMaterial color="#4b5563" roughness={.7} />
      </mesh>
      <mesh position={[1.15, 0.5, 0]} rotation={[0, 0, 0.14]} castShadow>
        <boxGeometry args={[0.16, 0.5, 3.7]} />
        <meshStandardMaterial color="#eab308" roughness={.5} />
      </mesh>
      <mesh position={[1.02, 0.85, 0]} rotation={[0, 0, 0.5]} castShadow>
        <boxGeometry args={[0.16, 0.45, 3.7]} />
        <meshStandardMaterial color="#eab308" roughness={.5} />
      </mesh>
      <mesh position={[0.78, 1.06, 0]} rotation={[0, 0, 0.82]} castShadow>
        <boxGeometry args={[0.12, 0.3, 3.7]} />
        <meshStandardMaterial color="#d97706" roughness={.5} />
      </mesh>
      <mesh position={[1.32, 0.22, 0]}>
        <boxGeometry args={[0.22, 0.12, 3.7]} />
        <meshStandardMaterial color="#374151" roughness={.6} metalness={.3} />
      </mesh>
      {/* Cilindros de elevacion de la hoja */}
      {[-1.8, 1.8].map((pz) => (
        <group key={pz}>
          <mesh position={[1.55, 1.05, pz]} rotation={[0, 0, 0.5]}>
            <cylinderGeometry args={[0.08, 0.08, 1.1, 12]} />
            <meshStandardMaterial color="#6b7280" roughness={.4} metalness={.5} />
          </mesh>
          <mesh position={[1.25, 0.85, pz]} rotation={[0, 0, 0.5]}>
            <cylinderGeometry args={[0.045, 0.045, 0.6, 10]} />
            <meshStandardMaterial color="#cbd5e1" roughness={.3} metalness={.6} />
          </mesh>
        </group>
      ))}
      {/* Escarificador central */}
      <mesh position={[1.95, 0.82, 0]} castShadow>
        <boxGeometry args={[0.5, 0.12, 1.4]} />
        <meshStandardMaterial color="#4b5563" roughness={.7} />
      </mesh>
      {[-0.5, 0, 0.5].map((pz) => (
        <mesh key={pz} position={[2.0, 0.55, pz]} rotation={[0, 0, 0.4]}>
          <boxGeometry args={[0.12, 0.5, 0.12]} />
          <meshStandardMaterial color="#94a3b8" roughness={.4} metalness={.5} />
        </mesh>
      ))}
      {/* Motor trasero con capo inclinado, rejilla y escape */}
      <mesh position={[-2.0, 2.0, 0]} castShadow>
        <boxGeometry args={[1.7, 1.0, 1.9]} />
        <meshStandardMaterial color="#f5c518" roughness={.45} />
      </mesh>
      <mesh position={[-1.05, 1.95, 0]} rotation={[0, 0, 0.14]} castShadow>
        <boxGeometry args={[0.75, 0.75, 1.8]} />
        <meshStandardMaterial color="#eab308" roughness={.45} />
      </mesh>
      <mesh position={[-2.9, 1.85, 0]}>
        <boxGeometry args={[0.07, 0.75, 1.75]} />
        <meshStandardMaterial color="#1f2937" roughness={.7} />
      </mesh>
      {[-0.55, -0.18, 0.18, 0.55].map((pz) => (
        <mesh key={pz} position={[-2.95, 1.85, pz]}>
          <boxGeometry args={[0.02, 0.62, 0.12]} />
          <meshStandardMaterial color="#6b7280" roughness={.5} metalness={.4} />
        </mesh>
      ))}
      <mesh position={[-1.5, 2.62, 0.55]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.7, 12]} />
        <meshStandardMaterial color="#111827" roughness={.6} />
      </mesh>
      <mesh position={[-1.5, 2.8, 0.55]}>
        <cylinderGeometry args={[0.09, 0.09, 0.22, 12]} />
        <meshStandardMaterial color="#9ca3af" roughness={.4} metalness={.5} />
      </mesh>
      {/* Cabina vidriada con pilares, techo, baliza y luces */}
      <mesh position={[-0.7, 2.35, 0]} castShadow>
        <boxGeometry args={[1.15, 1.05, 1.7]} />
        <meshStandardMaterial color="#eab308" roughness={.45} />
      </mesh>
      {([[-0.15, 0.83], [-0.15, -0.83], [-1.25, 0.83], [-1.25, -0.83]] as Array<[number, number]>).map(([px, pz], i) => (
        <mesh key={i} position={[px, 2.4, pz]}>
          <boxGeometry args={[0.09, 1.05, 0.09]} />
          <meshStandardMaterial color="#d97706" roughness={.5} />
        </mesh>
      ))}
      <mesh position={[-0.11, 2.48, 0]}>
        <boxGeometry args={[0.04, 0.72, 1.5]} />
        <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.16} roughness={.2} />
      </mesh>
      <mesh position={[-1.31, 2.48, 0]}>
        <boxGeometry args={[0.04, 0.72, 1.5]} />
        <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.1} roughness={.2} />
      </mesh>
      {[-0.86, 0.86].map((pz) => (
        <mesh key={pz} position={[-0.7, 2.48, pz]}>
          <boxGeometry args={[0.95, 0.66, 0.04]} />
          <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={.12} roughness={.2} />
        </mesh>
      ))}
      <mesh position={[-0.7, 2.93, 0]} castShadow>
        <boxGeometry args={[1.3, 0.1, 1.85]} />
        <meshStandardMaterial color="#f5c518" roughness={.45} />
      </mesh>
      <mesh position={[-0.7, 3.05, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.14, 10]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={.8} />
      </mesh>
      {[-0.55, 0.55].map((pz) => (
        <mesh key={pz} position={[-1.25, 2.89, pz]}>
          <boxGeometry args={[0.12, 0.1, 0.16]} />
          <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={.6} />
        </mesh>
      ))}
      {/* Espejos */}
      {[-1.12, 1.12].map((pz) => (
        <mesh key={pz} position={[-0.12, 2.55, pz]}>
          <boxGeometry args={[0.14, 0.3, 0.06]} />
          <meshStandardMaterial color="#0f172a" roughness={.4} />
        </mesh>
      ))}
    </group>
  );
}
/** Dimensiones reales (metros) que ocupa cada maquina, para escalarla a la huella del tipo. */
const MAQUINA_EXTENT: Record<string, { w: number; d: number }> = {
  [FORMAS_BLOQUE.TRACTOR_ORUGAS]: { w: 5.0, d: 2.8 },
  [FORMAS_BLOQUE.CARGADOR_FRONTAL]: { w: 7.5, d: 2.8 },
  [FORMAS_BLOQUE.MOTONIVELADORA]: { w: 7.3, d: 3.8 },
};

/** Renderiza la maquinaria segun la forma del tipo de bloque (null = bloque normal).
 * Si se recibe la huella del tipo, la maquina se escala uniformemente para ocupar ~80% de W/D. */
export function MaquinariaBloque({ forma, x, z, rotY = 0, footprint }: { forma?: string | null; x: number; z: number; rotY?: number; footprint?: { w: number; d: number } }) {
  if (forma !== FORMAS_BLOQUE.TRACTOR_ORUGAS && forma !== FORMAS_BLOQUE.CARGADOR_FRONTAL && forma !== FORMAS_BLOQUE.MOTONIVELADORA) return null;
  const extent = MAQUINA_EXTENT[forma]!;
  const escala = footprint && footprint.w > 0 && footprint.d > 0
    ? Math.max(0.1, Math.min((footprint.w * 0.8) / extent.w, (footprint.d * 0.8) / extent.d))
    : 1;
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]} scale={escala}>
      {forma === FORMAS_BLOQUE.TRACTOR_ORUGAS && <TractorOrugas x={0} z={0} rotY={0} />}
      {forma === FORMAS_BLOQUE.CARGADOR_FRONTAL && <CargadorFrontal x={0} z={0} rotY={0} />}
      {forma === FORMAS_BLOQUE.MOTONIVELADORA && <Motoniveladora x={0} z={0} rotY={0} />}
    </group>
  );
}

/* ---------- Piso ---------- */
export function Floor({ bnd }: { bnd: PlanoBounds }) {
  const cx = (bnd.minX + bnd.maxX) / 2, cz = (bnd.minZ + bnd.maxZ) / 2;
  const w = bnd.maxX - bnd.minX, d = bnd.maxZ - bnd.minZ;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -.04, cz]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color="#E8E0D5" />
    </mesh>
  );
}

/* ---------- Renderer por tipo ---------- */
export function FurnitureRenderer({ item }: { item: FurnitureRenderItem }) {
  switch (item.type) {
    case TIPOS_FURNITURE.KIOSKO:
      return <Kiosko x={item.x} z={item.z} rotY={item.rotY} />;
    case TIPOS_FURNITURE.PLAZA:
      return <Plaza x={item.x} z={item.z} rotY={item.rotY} />;
    case TIPOS_FURNITURE.MESA:
      return <Mesa x={item.x} z={item.z} rotY={item.rotY} />;
    case TIPOS_FURNITURE.SILLON:
      return <Sillon x={item.x} z={item.z} rotY={item.rotY} />;
    case TIPOS_FURNITURE.PISO: {
      const config = furnitureUtils.pisoConfig(item.config);
      return <Piso x={item.x} z={item.z} rotY={item.rotY} w={config.w} d={config.d} />;
    }
    case TIPOS_FURNITURE.PERSONA: {
      const config = furnitureUtils.personaConfig(item.config);
      return (
        <Persona
          x={item.x}
          z={item.z}
          rotY={item.rotY}
          colorIdx={config.colorIdx}
          torsoColor={config.torsoColor}
          piernasColor={config.piernasColor}
        />
      );
    }
    case TIPOS_FURNITURE.ARBOL:
      return <Arbol x={item.x} z={item.z} rotY={item.rotY} />;
    case TIPOS_FURNITURE.BANDERA:
      return <Bandera x={item.x} z={item.z} rotY={item.rotY} />;
    case TIPOS_FURNITURE.TOTEM:
      return <Totem x={item.x} z={item.z} rotY={item.rotY} />;
    case TIPOS_FURNITURE.BANCA:
      return <Banca x={item.x} z={item.z} rotY={item.rotY} />;
    case TIPOS_FURNITURE.PERGOLA:
      return <Pergola x={item.x} z={item.z} rotY={item.rotY} />;
    case TIPOS_FURNITURE.CAMION:
      return <CamionMinero x={item.x} z={item.z} rotY={item.rotY} />;
    case TIPOS_FURNITURE.PERFORADORA:
      return <Perforadora x={item.x} z={item.z} rotY={item.rotY} />;
    case TIPOS_FURNITURE.POSTE_LUZ:
      return <PosteLuz x={item.x} z={item.z} rotY={item.rotY} />;
    case TIPOS_FURNITURE.BARANDA:
      return <Baranda x={item.x} z={item.z} rotY={item.rotY} />;
    case TIPOS_FURNITURE.BASURERO:
      return <Basurero x={item.x} z={item.z} rotY={item.rotY} />;
    case TIPOS_FURNITURE.FOOD_TRUCK:
      return <FoodTruck x={item.x} z={item.z} rotY={item.rotY} />;
    case TIPOS_FURNITURE.PANTALLA_LED:
      return <PantallaLed x={item.x} z={item.z} rotY={item.rotY} />;
    case TIPOS_FURNITURE.AMBULANCIA:
      return <Ambulancia x={item.x} z={item.z} rotY={item.rotY} />;
    case TIPOS_FURNITURE.CARPA:
      return <Carpa x={item.x} z={item.z} rotY={item.rotY} />;
    case TIPOS_FURNITURE.BANOS:
      return <BanosPortatiles x={item.x} z={item.z} rotY={item.rotY} />;
    case TIPOS_FURNITURE.BUS:
      return <Bus x={item.x} z={item.z} rotY={item.rotY} />;
    default:
      return null;
  }
}
