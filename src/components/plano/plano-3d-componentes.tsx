"use client";

import { PERSONA_COLORES_CABEZA, TIPOS_FURNITURE } from "@/lib/shared/constants";
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
export function Bloque3D({ item, selected, reserved, onSelect }: {
  item: PlanoItem; selected: boolean; reserved: boolean; onSelect: (id: string) => void;
}) {
  const { w, d, h, color } = item.dim;
  return (
    <mesh
      position={[item.x, h / 2, item.z]}
      rotation={[0, item.rotY ?? 0, 0]}
      castShadow receiveShadow
      onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "auto"; }}
    >
      <boxGeometry args={[w - .15, h + (selected ? 0.6 : 0), d - .15]} />
      <meshStandardMaterial
        color={reserved ? "#9ca3af" : selected ? "#f59e0b" : color}
        roughness={reserved ? .7 : .55}
        metalness={.1}
        emissive={selected ? "#f59e0b" : "#000000"}
        emissiveIntensity={selected ? 0.3 : 0}
      />
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
    default:
      return null;
  }
}
