"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { useState } from "react";
import type { PlanoStand } from "@/types/reserva";
import { ESTADOS_STAND } from "@/lib/constants";

/* ================================================================
   Plano 3D estilo GESS — basado en análisis de planogess.png:
   - Piso beige (suelo)
   - Bloques de stands en terracota/naranja
   - Zona verde central (jardín/atrio)
   - Pasillos blancos entre bloques
   ================================================================ */

const W = 14;
const D = 12;

const STAND_COLORS: Record<string, string> = {
  [ESTADOS_STAND.DISPONIBLE]: "#e8d5c4",
  [ESTADOS_STAND.EN_EVALUACION]: "#d4a574",
  [ESTADOS_STAND.RESERVADO]: "#c44536",
};

const SELECTED_COLOR = "#f59e0b";

function Block({
  position,
  stands,
  color,
  onSelect,
  selectedId,
}: {
  position: [number, number, number];
  stands: { id: string; label: string; estado: string }[];
  color: string;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  const blockW = 1.8;
  const blockD = 0.9;
  const gap = 0.15;

  return (
    <group position={position}>
      {stands.map((st, i) => {
        const isSelected = st.id === selectedId;
        const standColor = isSelected ? SELECTED_COLOR : color;
        const z = (i % 2) * (blockD + gap);
        const x = Math.floor(i / 2) * (blockW + gap);

        return (
          <group key={st.id} position={[x - 0.9, 0, z - 0.4]}>
            <mesh
              onClick={() => onSelect(st.id)}
              onPointerOver={() => { document.body.style.cursor = "pointer"; }}
              onPointerOut={() => { document.body.style.cursor = "auto"; }}
              position={[0, 0.25, 0]}
              castShadow
            >
              <boxGeometry args={[blockW * 0.85, 0.5, blockD * 0.85]} />
              <meshStandardMaterial color={standColor} />
            </mesh>
            <Text
              position={[0, 0.55, 0]}
              fontSize={0.25}
              color={isSelected ? "#ffffff" : "#5c4033"}
              anchorX="center"
              anchorY="bottom"
            >
              {st.label}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

function Floor() {
  return (
    <group>
      {/* Suelo principal — beige */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#f5e6d3" />
      </mesh>
      {/* Jardín central — verde */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[3, 3]} />
        <meshStandardMaterial color="#7a9a5c" />
      </mesh>
      {/* Borde del jardín */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[1.4, 1.7, 64]} />
        <meshStandardMaterial color="#d4a574" />
      </mesh>
      {/* Árboles decorativos en el jardín */}
      {[[-0.8, 0.8], [0.8, -0.6], [0.5, 0.5], [-0.5, -0.5]].map(([tx, tz], i) => (
        <group key={i} position={[tx, 0, tz]}>
          <mesh position={[0, 0.1, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.1, 0.2, 8]} />
            <meshStandardMaterial color="#8b6914" />
          </mesh>
          <mesh position={[0, 0.35, 0]} castShadow>
            <sphereGeometry args={[0.2, 8, 6]} />
            <meshStandardMaterial color="#5a8f3c" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

interface PlanoGess3DProps {
  stands: PlanoStand[];
}

export function PlanoGess3D({ stands }: PlanoGess3DProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = stands.find((s) => s.id === selectedId);

  // Agrupar stands en 4 bloques alrededor del jardín central
  const total = stands.length;
  const perBlock = Math.ceil(total / 4);

  const blocksStands = [
    stands.slice(0, perBlock),
    stands.slice(perBlock, perBlock * 2),
    stands.slice(perBlock * 2, perBlock * 3),
    stands.slice(perBlock * 3),
  ];

  const blockPositions: [number, number, number][] = [
    [-4.5, 0, -3.5],
    [4.5, 0, -3.5],
    [-4.5, 0, 3.5],
    [4.5, 0, 3.5],
  ];

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="min-h-[550px] flex-1 rounded-xl border bg-slate-100 overflow-hidden">
        <Canvas camera={{ position: [0, 15, 0], fov: 55 }} shadows>
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 15, 5]} intensity={1.2} castShadow />
          <Floor />
          {blocksStands.map((blockStands, bi) => (
            <Block
              key={bi}
              position={blockPositions[bi]}
              stands={blockStands.map((s) => ({
                id: s.id,
                label: s.numero,
                estado: s.estado,
              }))}
              color={
                bi % 2 === 0
                  ? STAND_COLORS[ESTADOS_STAND.DISPONIBLE]
                  : "#d9b99b"
              }
              onSelect={setSelectedId}
              selectedId={selectedId}
            />
          ))}
          <OrbitControls
            maxPolarAngle={Math.PI / 2.5}
            minDistance={6}
            maxDistance={30}
            target={[0, 0, 0]}
          />
        </Canvas>
      </div>

      <div className="w-full rounded-xl border bg-white p-5 lg:w-72">
        {selected ? (
          <div className="space-y-2 text-sm">
            <h3 className="text-lg font-bold text-slate-900">
              <span>Stand {selected.numero}</span>
            </h3>
            <p className="text-muted-foreground">
              <span>Tipo: {selected.tipoStand}</span>
            </p>
            <p className="text-muted-foreground">
              <span>Medidas: {selected.medidas}</span>
            </p>
            <p className="text-muted-foreground">
              <span>Monto: {selected.monto.toLocaleString("en-US")} {selected.moneda}</span>
            </p>
            <p className="text-muted-foreground">
              <span>Estado: {selected.estado}</span>
            </p>
            <p className="text-muted-foreground">
              <span>Bloque: {blocksStands.findIndex((b) => b.some((s) => s.id === selected.id)) !== -1 ? ["Noroeste", "Noreste", "Suroeste", "Sureste"][blocksStands.findIndex((b) => b.some((s) => s.id === selected.id))] : "-"}</span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            <span>Haz clic en un stand. Rota/zoom con el mouse.</span>
          </p>
        )}
        <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
          <Legend color="#e8d5c4" border label="Disponible" />
          <Legend color="#d4a574" border label="En evaluación" />
          <Legend color="#c44536" border label="Reservado" />
          <Legend color={SELECTED_COLOR} border label="Seleccionado" />
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label, border = false }: { color: string; label: string; border?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block h-3 w-3 rounded-sm ${border ? "border border-slate-300" : ""}`} style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}
