"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useState } from "react";
import * as THREE from "three";

/* ================================================================
   PLANO ISOMÉTRICO — coordenadas centradas en origen (eje 0).
   Cada bloque lleva un ID de debug (assigned_ids del JSON), en
   orden de generación. El ID se muestra al hacer clic (panel HTML).
   ================================================================ */

interface Dim { w: number; d: number; h: number; color: string; }

const D: Record<string, Dim> = {
  S_vert:  { w:2, d:2, h:2.4, color:"#FFD700" },
  BG:      { w:3.5, d:3.5, h:3.0, color:"#006400" },
  P:       { w:2, d:2, h:2.4, color:"#32CD32" },
  C:       { w:2, d:2, h:2.0, color:"#90EE90" },
};

interface Item { id: string; dim: Dim; x: number; z: number; }

/* ---------- Placement (y del JSON → z de la escena) ---------- */

/** Columna vertical CENTRADA en yCenter (anchor: center). IDs en orden de generación. */
function vColumn(key: string, x: number, yCenter: number, ids: string[]): Item[] {
  const dim = D[key];
  const out: Item[] = [];
  const totalDepth = ids.length * dim.d;
  let y = yCenter + totalDepth / 2; // borde superior a partir del centro
  for (const id of ids) {
    out.push({ id, dim, x, z: -(y - dim.d / 2) });
    y -= dim.d;
  }
  return out;
}

/** Matriz 2×4: col1 [P,C,C,P] luego col2 [P,C,C,P]. 8 IDs en ese orden. */
function matrix2x4(cx: number, cy: number, ids: string[]): Item[] {
  const col: string[] = ["P", "C", "C", "P"];
  const colDepth = col.reduce((s, k) => s + D[k].d, 0);
  const colW = D.P.w;
  const totalW = colW * 2;
  const x1 = cx - totalW / 2 + colW / 2;
  const x2 = cx + totalW / 2 - colW / 2;
  const yTop = cy + colDepth / 2;

  const out: Item[] = [];
  let idx = 0;
  for (const x of [x1, x2]) {
    let y = yTop;
    for (const k of col) {
      const dim = D[k];
      out.push({ id: ids[idx++] ?? `?${idx}`, dim, x, z: -(y - dim.d / 2) });
      y -= dim.d;
    }
  }
  return out;
}

/* ---------- Layout desde clusters (con assigned_ids) ---------- */

function buildItems(): Item[] {
  const items: Item[] = [];

  // left_edge (x=-18.5)
  items.push(...vColumn("S_vert", -18.5, 8.0,
    ["EXT-IZQ-01","EXT-IZQ-02","EXT-IZQ-03","EXT-IZQ-04","EXT-IZQ-05","EXT-IZQ-06"]));
  items.push(...vColumn("S_vert", -18.5, -8.0,
    ["EXT-IZQ-07","EXT-IZQ-08","EXT-IZQ-09","EXT-IZQ-10"]));
  // right_edge (x=18.5)
  items.push(...vColumn("S_vert", 18.5, 8.0,
    ["EXT-DER-01","EXT-DER-02","EXT-DER-03","EXT-DER-04","EXT-DER-05","EXT-DER-06"]));
  items.push(...vColumn("S_vert", 18.5, -8.0,
    ["EXT-DER-07","EXT-DER-08","EXT-DER-09","EXT-DER-10"]));

  // interior_groups.left_zone
  items.push(...matrix2x4(-11.0, 8.0,
    ["INT-IZQ-A1","INT-IZQ-A2","INT-IZQ-A3","INT-IZQ-A4","INT-IZQ-A5","INT-IZQ-A6","INT-IZQ-A7","INT-IZQ-A8"]));
  items.push(...matrix2x4(-11.0, -8.0,
    ["INT-IZQ-B1","INT-IZQ-B2","INT-IZQ-B3","INT-IZQ-B4","INT-IZQ-B5","INT-IZQ-B6","INT-IZQ-B7","INT-IZQ-B8"]));

  // interior_groups.right_zone (group3 en Y=0.0 exacto)
  items.push(...matrix2x4(11.0, 0.0,
    ["INT-DER-1","INT-DER-2","INT-DER-3","INT-DER-4","INT-DER-5","INT-DER-6","INT-DER-7","INT-DER-8"]));

  // central_core islands (4 BG)
  const islands: { id: string; x: number; y: number }[] = [
    { id: "ISLA-GRANDE-1", x: -3.5, y: 6 },
    { id: "ISLA-GRANDE-2", x: 3.5, y: 6 },
    { id: "ISLA-GRANDE-3", x: -3.5, y: -6 },
    { id: "ISLA-GRANDE-4", x: 3.5, y: -6 },
  ];
  for (const isl of islands) items.push({ id: isl.id, dim: D.BG, x: isl.x, z: -isl.y });

  return items;
}

/* ---------- Bounds ---------- */
function computeBounds(items: Item[]) {
  let minX=1/0,maxX=-1/0,minZ=1/0,maxZ=-1/0;
  for(const it of items){
    minX=Math.min(minX,it.x-it.dim.w/2); maxX=Math.max(maxX,it.x+it.dim.w/2);
    minZ=Math.min(minZ,it.z-it.dim.d/2); maxZ=Math.max(maxZ,it.z+it.dim.d/2);
  }
  const pad=4; return {minX:minX-pad,maxX:maxX+pad,minZ:minZ-pad,maxZ:maxZ+pad};
}

/* ---------- Mobiliario (PLAZA-CENTRAL en origen) ---------- */
function buildFurniture(): { id:string; type:"kiosko"|"lounge"; x:number; z:number }[] {
  const pz = 0;
  return [
    {id:"k1",type:"kiosko",x:-1,z:pz-2},
    {id:"k2",type:"kiosko",x:1,z:pz-2},
    {id:"l1",type:"lounge",x:-1,z:pz+1.5},
    {id:"l2",type:"lounge",x:1,z:pz+1.5},
    {id:"l3",type:"lounge",x:-1,z:pz},
    {id:"l4",type:"lounge",x:1,z:pz},
  ];
}

/* ---------- 3D ---------- */
function Bloque3D({ item, selected, onSelect }: {
  item: Item; selected: boolean; onSelect: (id: string) => void;
}) {
  const {w,d,h,color}=item.dim;
  return (
    <mesh
      position={[item.x, h/2, item.z]}
      castShadow receiveShadow
      onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "auto"; }}
    >
      <boxGeometry args={[w-.15, h + (selected ? 0.6 : 0), d-.15]} />
      <meshStandardMaterial
        color={selected ? "#f59e0b" : color}
        roughness={.55}
        metalness={.1}
        emissive={selected ? "#f59e0b" : "#000000"}
        emissiveIntensity={selected ? 0.3 : 0}
      />
    </mesh>
  );
}

function Kiosko({x,z}:{x:number;z:number}){return(
  <group position={[x,0,z]}>
    <mesh position={[0,.55,0]} castShadow><boxGeometry args={[1.2,1,.9]}/><meshStandardMaterial color="#8B4513" roughness={.5}/></mesh>
    <mesh position={[0,1.35,0]} rotation={[0,0,Math.PI/4]}><coneGeometry args={[1,.55,4]}/><meshStandardMaterial color="#DC143C" roughness={.4}/></mesh>
  </group>
)}

function Lounge({x,z}:{x:number;z:number}){const c:number[]=[.5,.5,-.5,.5,.5,-.5,-.5,-.5];return(
  <group position={[x,0,z]}>
    <mesh position={[0,.3,0]} castShadow><boxGeometry args={[.6,.55,.6]}/><meshStandardMaterial color="#F5F5DC" roughness={.3}/></mesh>
    {[0,1,2,3].map(i=><mesh key={i} position={[c[i*2],.3,c[i*2+1]]} castShadow><boxGeometry args={[.35,.55,.35]}/><meshStandardMaterial color="#808080" roughness={.6}/></mesh>)}
  </group>
)}

function Floor({bnd}:{bnd:ReturnType<typeof computeBounds>}){const cx=(bnd.minX+bnd.maxX)/2,cz=(bnd.minZ+bnd.maxZ)/2,w=bnd.maxX-bnd.minX,d=bnd.maxZ-bnd.minZ;return(
  <group>
    <mesh rotation={[-Math.PI/2,0,0]} position={[cx,-.04,cz]} receiveShadow><planeGeometry args={[w,d]}/><meshStandardMaterial color="#E8E0D5"/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.004,0]} receiveShadow><planeGeometry args={[5,7]}/><meshStandardMaterial color="#C8BCA7"/></mesh>
  </group>
)}

/* ---------- Escena ---------- */
export function PlanoIsometrico() {
  const items=useMemo(()=>buildItems(),[]);
  const bnd=useMemo(()=>computeBounds(items),[items]);
  const furniture=useMemo(()=>buildFurniture(),[]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cx=(bnd.minX+bnd.maxX)/2,cz=(bnd.minZ+bnd.maxZ)/2,S=Math.max(bnd.maxX-bnd.minX,bnd.maxZ-bnd.minZ);

  return (
    <div className="relative h-[calc(100vh-7rem)] w-full rounded-xl border bg-slate-100 overflow-hidden">
      <Canvas shadows camera={{position:[cx,S*.7,cz+S*.35],fov:50,near:.1,far:300}}
        gl={{toneMapping:THREE.ACESFilmicToneMapping,outputColorSpace:THREE.SRGBColorSpace}}
        onPointerMissed={()=>setSelectedId(null)}>
        <fog attach="fog" args={["#E8E0D5",S*.9,S*2.2]}/><ambientLight intensity={.75}/>
        <directionalLight position={[cx+S*.3,S*1.2,cz]} intensity={2.5} castShadow shadow-mapSize={[2048,2048]}
          shadow-camera-left={-S} shadow-camera-right={S} shadow-camera-top={S} shadow-camera-bottom={-S}/>
        <directionalLight position={[cx-S*.2,S*.5,cz-S*.3]} intensity={.4}/>
        <Floor bnd={bnd}/>
        {items.map((it)=><Bloque3D key={it.id} item={it} selected={it.id===selectedId} onSelect={setSelectedId}/>)}
        {furniture.map(f=>f.type==="kiosko"?<Kiosko key={f.id} x={f.x} z={f.z}/>:<Lounge key={f.id} x={f.x} z={f.z}/>)}
        <OrbitControls makeDefault enableRotate enablePan enableZoom target={[cx,0,cz]} maxPolarAngle={Math.PI/2.1} minDistance={S*.15} maxDistance={S*1.6}/>
      </Canvas>

      {/* Panel de debug (HTML, no texto 3D) */}
      <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-white/90 px-3 py-2 text-sm shadow-md backdrop-blur">
        {selectedId ? (
          <span className="font-mono font-semibold text-slate-800">{selectedId}</span>
        ) : (
          <span className="text-slate-500">Clic en un stand para ver su ID</span>
        )}
      </div>
    </div>
  );
}
