"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useState, useEffect, Fragment } from "react";
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label, Separator } from "@nrivera-iimp/ui-kit-iimp";
import { gessService } from "@/lib/api/services/gess-service";
import { mapGessStandFromDTO } from "@/lib/mappers/gess-mapper";
import * as THREE from "three";

/* ================================================================
   PLANO ISOMÉTRICO — coordenadas centradas en origen (eje 0).
   Cada bloque lleva un ID de debug (assigned_ids del JSON), en
   orden de generación. El ID se muestra al hacer clic (panel HTML).
   ================================================================ */

interface Dim { w: number; d: number; h: number; color: string; }

const D: Record<string, Dim> = {
  S_vert:  { w:3.2, d:2.5, h:2.4, color:"#FFD700" },
  BG:      { w:3.5, d:3.5, h:3.0, color:"#006400" },
  P:       { w:2, d:2, h:2.4, color:"#32CD32" },
  C:       { w:2, d:2, h:2.0, color:"#90EE90" },
};

type BlockType = "S" | "BG" | "P" | "C";

interface Item { id: string; dim: Dim; type: BlockType; x: number; z: number; }

const BLOCK_LABEL: Record<BlockType, { label: string; nombre: string }> = {
  S:  { label: "S",  nombre: "Columna" },
  BG: { label: "BG", nombre: "Isla Grande" },
  P:  { label: "P",  nombre: "Preferencial" },
  C:  { label: "C",  nombre: "Estándar A" },
};

/* ---------- Placement (y del JSON → z de la escena) ---------- */

/** Columna vertical CENTRADA en yCenter (anchor: center). IDs en orden de generación. */
function vColumn(type: BlockType, key: string, x: number, yCenter: number, ids: string[]): Item[] {
  const dim = D[key];
  const out: Item[] = [];
  const totalDepth = ids.length * dim.d;
  let y = yCenter + totalDepth / 2; // borde superior a partir del centro
  for (const id of ids) {
    out.push({ id, dim, type, x, z: -(y - dim.d / 2) });
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
      out.push({ id: ids[idx++] ?? `?${idx}`, dim, type: k as BlockType, x, z: -(y - dim.d / 2) });
      y -= dim.d;
    }
  }
  return out;
}

/* ---------- Layout desde clusters (con assigned_ids) ---------- */

function buildItems(): Item[] {
  const items: Item[] = [];

  // left_edge (x=-18.5)
  items.push(...vColumn("S", "S_vert", -18.5, 8.0,
    ["EXT-IZQ-01","EXT-IZQ-02","EXT-IZQ-03","EXT-IZQ-04","EXT-IZQ-05","EXT-IZQ-06"]));
  items.push(...vColumn("S", "S_vert", -18.5, -8.0,
    ["EXT-IZQ-07","EXT-IZQ-08","EXT-IZQ-09","EXT-IZQ-10"]));
  // right_edge (x=18.5)
  items.push(...vColumn("S", "S_vert", 18.5, 8.0,
    ["EXT-DER-01","EXT-DER-02","EXT-DER-03","EXT-DER-04","EXT-DER-05","EXT-DER-06"]));
  items.push(...vColumn("S", "S_vert", 18.5, -8.0,
    ["EXT-DER-07","EXT-DER-08","EXT-DER-09","EXT-DER-10"]));

  // interior_groups.left_zone
  items.push(...matrix2x4(-11.0, 10.0,
    ["INT-IZQ-A1","INT-IZQ-A2","INT-IZQ-A3","INT-IZQ-A4","INT-IZQ-A5","INT-IZQ-A6","INT-IZQ-A7","INT-IZQ-A8"]));
  items.push(...matrix2x4(-11.0, -6.0,
    ["INT-IZQ-B1","INT-IZQ-B2","INT-IZQ-B3","INT-IZQ-B4","INT-IZQ-B5","INT-IZQ-B6","INT-IZQ-B7","INT-IZQ-B8"]));

  // interior_groups.right_zone (group3 en Y=0.0 exacto)
  items.push(...matrix2x4(11.0, 2.0,
    ["INT-DER-1","INT-DER-2","INT-DER-3","INT-DER-4","INT-DER-5","INT-DER-6","INT-DER-7","INT-DER-8"]));

  // central_core islands (4 BG)
  const islands: { id: string; x: number; y: number }[] = [
    { id: "ISLA-GRANDE-1", x: -3.5, y: 6 },
    { id: "ISLA-GRANDE-2", x: 3.5, y: 6 },
    { id: "ISLA-GRANDE-3", x: -3.5, y: -6 },
    { id: "ISLA-GRANDE-4", x: 3.5, y: -6 },
  ];
  for (const isl of islands) items.push({ id: isl.id, dim: D.BG, type: "BG", x: isl.x, z: -isl.y });

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

/* ---------- Mobiliario (kioskos unicamente. Plaza = ConjuntoPlaza aparte) ---------- */
function buildFurniture(): { id:string; type:"kiosko"; x:number; z:number; rotY:number }[] {
  return [
    {id:"KIOSKO_IZQ", type:"kiosko", x:-4.9, z:-0.0, rotY:1.6},
    {id:"KIOSKO_DER", type:"kiosko", x:4.9, z:-0.0, rotY:-1.6},
  ];
}

/* ---------- 3D ---------- */
function Bloque3D({ item, selected, reserved, onSelect }: {
  item: Item; selected: boolean; reserved: boolean; onSelect: (id: string) => void;
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
function Kiosko({x,z,rotY=0}:{x:number;z:number;rotY?:number}){
  const TW=1.8, TD=1.2, TH=2.2;
  const baseH=TH*.02, cW=TW*.8, cD=TD*.4, cH=TH*.4, ctrY=baseH+cH/2, topY=baseH+cH+baseH;
  const pW=TW*.05, pD=TD*.05, postH=TH*.9, pstY=baseH+postH/2;
  const pstTop=baseH+postH, halfSpan=TW*.46, rise=TH*.16, ridgeY=pstTop+rise;
  const slopeLen=Math.sqrt(halfSpan**2+rise**2), slopeAngle=Math.atan2(rise,halfSpan);
  const midY=pstTop+rise/2, roofZ=TD*.1-TD/4, roofDepth=TD*.3;

  return(
    <group position={[x,0,z]} rotation={[0,rotY,0]}>
      {/* 1. Plataforma Base — verde oscuro mate */}
      <mesh position={[0,baseH/2,0]} receiveShadow>
        <boxGeometry args={[TW,baseH,TD]}/>
        <meshStandardMaterial color="#2d5a27" roughness={.7}/>
      </mesh>
      {/* 2. Mostrador Principal — madera clara */}
      <mesh position={[0,ctrY,TD*.28]} castShadow>
        <boxGeometry args={[cW,cH,cD]}/>
        <meshStandardMaterial color="#DEB887" roughness={.45}/>
      </mesh>
      {/* Tablón superior más oscuro */}
      <mesh position={[0,topY,TD*.28]} castShadow>
        <boxGeometry args={[cW,baseH,cD]}/>
        <meshStandardMaterial color="#8B4513" roughness={.3}/>
      </mesh>
      {/* 3. Columnas de Soporte */}
      <mesh position={[-TW*.42,pstY,-TD*.12]} castShadow>
        <boxGeometry args={[pW,postH,pD]}/>
        <meshStandardMaterial color="#5c3a1e" roughness={.55}/>
      </mesh>
      <mesh position={[TW*.42,pstY,-TD*.12]} castShadow>
        <boxGeometry args={[pW,postH,pD]}/>
        <meshStandardMaterial color="#5c3a1e" roughness={.55}/>
      </mesh>
      {/* 4. Techo a Dos Aguas — lona crema */}
      <mesh position={[0,ridgeY,roofZ]}>
        <boxGeometry args={[.06,.06,roofDepth]}/>
        <meshStandardMaterial color="#8B0000"/>
      </mesh>
      <mesh position={[-halfSpan/2,midY,roofZ]} rotation={[0,0,slopeAngle]} castShadow>
        <boxGeometry args={[slopeLen,.05,roofDepth]}/>
        <meshStandardMaterial color="#FFF8DC" roughness={.4}/>
      </mesh>
      <mesh position={[halfSpan/2,midY,roofZ]} rotation={[0,0,-slopeAngle]} castShadow>
        <boxGeometry args={[slopeLen,.05,roofDepth]}/>
        <meshStandardMaterial color="#FFF8DC" roughness={.4}/>
      </mesh>
      {/* 5. Letrero Frontal */}
      <mesh position={[0,midY,roofZ+roofDepth/2+.015]} castShadow>
        <boxGeometry args={[TW*.6,TH*.15,.03]}/>
        <meshStandardMaterial color="#FEFEFE" roughness={.3}/>
      </mesh>
      <mesh position={[0,midY,roofZ+roofDepth/2+.032]} castShadow>
        <boxGeometry args={[TW*.6+.04,TH*.15+.04,.008]}/>
        <meshStandardMaterial color="#333"/>
      </mesh>
    </group>
  )
}

/* ================================================================
   CONJUNTO PLAZA: 1 Mesa Central + 4 Sillones radiales
   ================================================================ */
function MesaCentral({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.3, 0.6]}/>
        <meshStandardMaterial color="#2d2d2d" roughness={.5}/>
      </mesh>
      <mesh position={[0, 0.325, 0]} castShadow>
        <boxGeometry args={[0.8, 0.05, 0.8]}/>
        <meshStandardMaterial color="#e8e8e8" roughness={.3}/>
      </mesh>
    </group>
  );
}

function SillonIndividual({ x, z, rotY }: { x: number; z: number; rotY: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.1, 0.8]}/>
        <meshStandardMaterial color="#1a1a1a" roughness={.6}/>
      </mesh>
      <mesh position={[0, 0.2, 0.1]} castShadow>
        <boxGeometry args={[0.6, 0.2, 0.6]}/>
        <meshStandardMaterial color="#f0f0f0" roughness={.4}/>
      </mesh>
      <mesh position={[0, 0.4, -0.3]} castShadow>
        <boxGeometry args={[0.8, 0.5, 0.2]}/>
        <meshStandardMaterial color="#f0f0f0" roughness={.4}/>
      </mesh>
      <mesh position={[-0.35, 0.3, 0]} castShadow>
        <boxGeometry args={[0.1, 0.3, 0.6]}/>
        <meshStandardMaterial color="#ffffff" roughness={.35}/>
      </mesh>
      <mesh position={[0.35, 0.3, 0]} castShadow>
        <boxGeometry args={[0.1, 0.3, 0.6]}/>
        <meshStandardMaterial color="#ffffff" roughness={.35}/>
      </mesh>
    </group>
  );
}

const CABEZA_COLORS = ["#f5d0a9", "#e0ac69", "#c68642", "#8d5524", "#d4a574", "#f0c8a0"];

function Persona({ x, z, rotY = 0, colorIdx = 0, torsoColor = "#f5f5f5", piernasColor = "#3b5998" }: {
  x: number; z: number; rotY?: number; colorIdx?: number; torsoColor?: string; piernasColor?: string;
}) {
  const headColor = CABEZA_COLORS[colorIdx % CABEZA_COLORS.length];
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

function ConjuntoPlaza() {
  const pos: [number,number][] = [[-2,-2],[2,-2],[-2,2],[2,2]];
  return (
    <group>
      {pos.map(([gx,gz], i) => (
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

function Floor({bnd}:{bnd:ReturnType<typeof computeBounds>}){const cx=(bnd.minX+bnd.maxX)/2,cz=(bnd.minZ+bnd.maxZ)/2,w=bnd.maxX-bnd.minX,d=bnd.maxZ-bnd.minZ;return(
  <group>
    <mesh rotation={[-Math.PI/2,0,0]} position={[cx,-.04,cz]} receiveShadow><planeGeometry args={[w,d]}/><meshStandardMaterial color="#E8E0D5"/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.004,0]} receiveShadow><planeGeometry args={[11,7]}/><meshStandardMaterial color="#C8BCA7"/></mesh>
  </group>
)}

/* ---------- Escena ---------- */
interface GessLinked {
  standCode: string;
  tipoStand: string | null;
  empresa: string | null;
  estado: string | null;
  medidas: string | null;
}

interface GessInfoFull extends GessLinked {
  reserved: boolean;
}

export function PlanoIsometrico({ eventoId }: { eventoId: string }) {
  const items=useMemo(()=>buildItems(),[]);
  const bnd=useMemo(()=>computeBounds(items),[items]);
  const furniture=useMemo(()=>buildFurniture(),[]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reservaOpen, setReservaOpen] = useState(false);
  const [reservaStep, setReservaStep] = useState(0);
  const [gessInfo, setGessInfo] = useState<GessLinked | null>(null);
  const [linkedMap, setLinkedMap] = useState<Map<string, GessInfoFull>>(new Map());
  const cx=(bnd.minX+bnd.maxX)/2,cz=(bnd.minZ+bnd.maxZ)/2,S=Math.max(bnd.maxX-bnd.minX,bnd.maxZ-bnd.minZ);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await gessService.list(eventoId);
        if (!cancelled && Array.isArray(json)) {
          const list = json.map(mapGessStandFromDTO);
          const map = new Map<string, GessInfoFull>();
          for (const row of list) {
            if (row.bloqueId) {
              map.set(row.bloqueId, {
                standCode: row.standCode,
                tipoStand: row.tipoStand,
                empresa: row.empresa,
                estado: row.estado,
                medidas: row.medidas,
                reserved: row.estado === "Reservado",
              });
            }
          }
          setLinkedMap(map);
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [eventoId]);

  useEffect(() => {
    if (selectedIds.length !== 1) { setGessInfo(null); return; }
    const linked = linkedMap.get(selectedIds[0]);
    setGessInfo(linked ?? null);
  }, [selectedIds, linkedMap]);

  const handleSelect = (id: string) => {
    const reserved = linkedMap.get(id)?.reserved;
    if (reserved) {
      setSelectedIds(prev => prev.length === 1 && prev[0] === id ? [] : [id]);
      return;
    }
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const selected = items.filter(it => selectedIds.includes(it.id));
  const hayReservados = selected.some(s => linkedMap.get(s.id)?.reserved);

  return (
    <div className="flex h-[calc(100vh-7rem)] w-full flex-col gap-4 lg:flex-row">
      <div className="relative flex-1 rounded-xl bg-slate-100 overflow-hidden">
        <Canvas shadows camera={{position:[cx,S*.7,cz+S*.35],fov:50,near:.1,far:300}}
        gl={{toneMapping:THREE.ACESFilmicToneMapping,outputColorSpace:THREE.SRGBColorSpace}}
        onPointerMissed={()=>setSelectedIds([])}>
        <fog attach="fog" args={["#E8E0D5",S*.9,S*2.2]}/><ambientLight intensity={.75}/>
        <directionalLight position={[cx+S*.3,S*1.2,cz]} intensity={2.5} castShadow shadow-mapSize={[2048,2048]}
          shadow-camera-left={-S} shadow-camera-right={S} shadow-camera-top={S} shadow-camera-bottom={-S}/>
        <directionalLight position={[cx-S*.2,S*.5,cz-S*.3]} intensity={.4}/>
        <Floor bnd={bnd}/>
        {items.map((it)=><Bloque3D key={it.id} item={it} selected={selectedIds.includes(it.id)} reserved={linkedMap.get(it.id)?.reserved ?? false} onSelect={handleSelect}/>)}
        {furniture.map(f=><Kiosko key={f.id} x={f.x} z={f.z} rotY={f.rotY}/>)}


        <ConjuntoPlaza />
        <Persona x={0} z={0} rotY={0.5} colorIdx={0} />
        <Persona x={0.8} z={-0.5} rotY={-1.2} colorIdx={1} />
        <Persona x={-0.7} z={0.6} rotY={2.8} colorIdx={2} />
        <Persona x={-0.4} z={-1} rotY={1.1} colorIdx={3} />
        <Persona x={-3} z={1.5} rotY={-0.3} colorIdx={4} />
        <Persona x={3.2} z={-1.5} rotY={2.0} colorIdx={5} />
        <OrbitControls makeDefault enableRotate enablePan enableZoom target={[cx,0,cz]} maxPolarAngle={Math.PI/2.1} minDistance={S*.15} maxDistance={S*1.6}/>
      </Canvas>
      </div>

      <div className="w-full shrink-0 rounded-xl border bg-white p-5 lg:w-72">
        <h3 className="mb-3 font-semibold text-slate-900"><span>Mi selección</span></h3>
        {selected.length === 0 ? (
          <p className="text-sm text-muted-foreground"><span>Haz clic en un bloque. Rota/zoom con el mouse.</span></p>
        ) : (
          <>
            <div className="space-y-2">
                  {selected.map(sel => {
                    const selReserved = linkedMap.get(sel.id)?.reserved;
                    return (
                      <div key={sel.id} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          {selReserved ? (
                            <Badge variant="destructive"><span>No disponible</span></Badge>
                          ) : (
                            <Badge variant="secondary"><span>{BLOCK_LABEL[sel.type]?.label ?? "?"}</span></Badge>
                          )}
                          <span className="text-muted-foreground">{selReserved ? "Reservado" : BLOCK_LABEL[sel.type]?.nombre ?? sel.type}</span>
                        </div>
                        <span className="font-mono text-xs text-slate-500">{sel.id}</span>
                      </div>
                    );
                  })}
            </div>
            {selectedIds.length === 1 && gessInfo && (
              <div className={`rounded-lg border p-3 text-xs ${gessInfo.estado === "Reservado" ? "border-red-200 bg-red-50/70" : "border-emerald-200 bg-emerald-50/70"}`}>
                <p className={`mb-2 font-semibold ${gessInfo.estado === "Reservado" ? "text-red-800" : "text-emerald-800"}`}>Stand vinculado</p>
                <div className="space-y-1">
                  <p className="flex justify-between"><span className="text-muted-foreground">Codigo</span><span className="font-mono font-medium">{gessInfo.standCode}</span></p>
                  {gessInfo.tipoStand && <p className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span className="font-medium">{gessInfo.tipoStand}</span></p>}
                  {gessInfo.medidas && <p className="flex justify-between"><span className="text-muted-foreground">Precio</span><span className="font-medium">{gessInfo.medidas}</span></p>}
                  {gessInfo.estado && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Estado</span>
                      <Badge variant={gessInfo.estado === "Reservado" ? "destructive" : "default"}><span>{gessInfo.estado}</span></Badge>
                    </div>
                  )}
                  {gessInfo.empresa && (
                    <div className="mt-1 rounded bg-white/70 p-2">
                      <p className="text-[10px] uppercase text-muted-foreground">Empresa</p>
                      <p className="text-xs font-medium">{gessInfo.empresa}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between border-t pt-3 text-sm font-bold">
              <span>Total</span>
              <span>{selected.length} bloques</span>
            </div>
            <Button variant="default" className="mt-2 w-full" disabled={selected.length === 0 || hayReservados}
              onClick={() => { setReservaOpen(true); setReservaStep(0); }}>
              <span>{hayReservados ? "Hay bloques no disponibles" : `Reservar (${selected.length})`}</span>
            </Button>
          </>
        )}
        <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
          <Legend color="#FFD700" label="S (Columna)" />
          <Legend color="#32CD32" label="P (Preferencial)" />
          <Legend color="#90EE90" label="C (Estándar A)" />
          <Legend color="#006400" label="BG (Isla Grande)" />
          <Legend color="#9ca3af" label="Reservado" />
        </div>
      </div>

      <Dialog open={reservaOpen} onOpenChange={setReservaOpen}>
        <DialogContent className="sm:max-w-lg">
          {/* Step Indicator */}
          <div className="mb-4 flex items-center justify-center gap-2">
            {["Datos", "Documentos", "Confirmación"].map((label, idx) => (
              <Fragment key={idx}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  reservaStep >= idx ? "bg-primary text-primary-foreground shadow-sm" : "bg-slate-200 text-slate-500"
                }`}>{idx + 1}</div>
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                  reservaStep >= idx ? "text-slate-700" : "text-slate-400"
                }`}>{label}</span>
                {idx < 2 && <div className={`h-px w-8 ${reservaStep > idx ? "bg-primary" : "bg-slate-200"}`} />}
              </Fragment>
            ))}
          </div>

          <DialogHeader>
            <DialogTitle><span>Reserva de {selected.length} stand(s)</span></DialogTitle>
            <DialogDescription>
              {reservaStep === 0 && <span>Completá los datos de la empresa para iniciar la reserva.</span>}
              {reservaStep === 1 && <span>Descargá el formato de contrato, completalo, y adjuntalo firmado.</span>}
              {reservaStep === 2 && <span>Reserva enviada al flujo de aprobaciones.</span>}
            </DialogDescription>
          </DialogHeader>
          {reservaStep === 0 && (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                <span className="font-semibold text-slate-700">Stands seleccionados:</span>{" "}
                {selected.map(s => BLOCK_LABEL[s.type]?.label ?? "?").join(", ")} · {selected.length} bloque(s)
              </div>
              <div className="space-y-1.5"><Label htmlFor="empresa"><span>Razón social</span></Label><Input id="empresa" placeholder="Ej. Corporación Minera S.A." /></div>
              <div className="flex gap-3"><div className="flex-1 space-y-1.5"><Label htmlFor="ruc"><span>RUC</span></Label><Input id="ruc" placeholder="20123456789" /></div><div className="flex-1 space-y-1.5"><Label htmlFor="contacto"><span>Persona de contacto</span></Label><Input id="contacto" placeholder="Nombre y apellido" /></div></div>
              <div className="space-y-1.5"><Label htmlFor="email"><span>Correo electrónico</span></Label><Input id="email" type="email" placeholder="contacto@empresa.pe" /></div>
            </div>
          )}
          {reservaStep === 1 && (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border bg-amber-50 p-3 text-xs text-amber-800">
                <span className="font-semibold">①</span> <span>Descargá el formato de contrato correspondiente al tipo de stand.</span>
              </div>
              <Button variant="outline" className="w-full"><span>📄 Descargar formato de contrato</span></Button>
              <Separator />
              <div className="rounded-lg border bg-amber-50 p-3 text-xs text-amber-800">
                <span className="font-semibold">②</span> <span>Completá el formato con los datos de la empresa y adjuntalo firmado.</span>
              </div>
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-muted-foreground hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors">
                <span className="text-2xl">📎</span>
                <p className="mt-1 font-medium"><span>Adjuntar contrato firmado</span></p>
                <p className="text-xs"><span>PDF, JPG o PNG — máx. 10 MB</span></p>
              </div>
              <Button className="w-full" onClick={() => setReservaStep(2)}><span>Enviar reserva</span></Button>
            </div>
          )}
          {reservaStep === 2 && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-xl">✓</div>
              <p className="text-sm font-semibold text-slate-800"><span>Reserva registrada</span></p>
              <p className="text-xs text-muted-foreground"><span>Legal → Logística → Eventos/Asociados. Seguimiento en el Dashboard.</span></p>
            </div>
          )}
          <DialogFooter>
            {reservaStep === 0 && <Button onClick={() => setReservaStep(1)} className="w-full"><span>Continuar</span></Button>}
            {reservaStep === 1 && <Button variant="secondary" onClick={() => setReservaStep(0)}><span>Volver</span></Button>}
            {reservaStep === 2 && <Button onClick={() => { setReservaOpen(false); setSelectedIds([]); }} variant="secondary" className="w-full"><span>Cerrar</span></Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm border" style={{ backgroundColor: color }} />{label}</span>;
}
