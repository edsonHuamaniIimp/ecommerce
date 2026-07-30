"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Dialog, DialogContent } from "@nrivera-iimp/ui-kit-iimp";
import { Image, FileText, Eye, X } from "lucide-react";
import { gessService } from "@/lib/api/services/gess-service";
import { authService } from "@/lib/api/services/auth-service";
import { getPlano } from "@/lib/planos/registry";
import type { PlanoDefinition } from "@/lib/planos/registry";
import type { Item } from "@/lib/planos/gess";
import { LS_KEYS, ESTADOS_STAND } from "@/lib/constants";
import type { ReservaStep } from "@/lib/constants";
import { useReservaForm } from "./reserva/use-reserva-form";
import { ReservaModal } from "./reserva/reserva-modal";
import type { GessLinkedInfo, FormDatos } from "./reserva/types";
import * as THREE from "three";

/* ================================================================
   PLANO ISOMÉTRICO — GESS edition.
   Construcción del layout en src/lib/planos/gess/construccion.ts
   ================================================================ */

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

function Floor({bnd}:{bnd:ReturnType<PlanoDefinition["computeBounds"]>}){const cx=(bnd.minX+bnd.maxX)/2,cz=(bnd.minZ+bnd.maxZ)/2,w=bnd.maxX-bnd.minX,d=bnd.maxZ-bnd.minZ;return(
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
  documentos: string[];
  imagenes: string[];
}

interface GessInfoFull extends GessLinked {
  reserved: boolean;
  dbId: string;
}

function getIdApi(row: Record<string, unknown>): string {
  return String(row.uid ?? row.UID ?? row.codigo ?? row.stand ?? row.STANDID ?? row.standId ?? row.stand_id ?? row.STAND ?? row.standCode ?? "");
}

export function PlanoIsometrico({ eventoId, tipoEvento, codigoEvento, openReserva }: { eventoId: string; tipoEvento: number; codigoEvento: number; openReserva?: boolean }) {
  const router = useRouter();
  const plano = getPlano("gess")!;
  const items=useMemo(()=>plano.buildItems(),[plano]);
  const bnd=useMemo(()=>plano.computeBounds(items),[items, plano]);
  const furniture=useMemo(()=>plano.buildFurniture(),[plano]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [gessInfo, setGessInfo] = useState<GessLinked | null>(null);
  const [linkedMap, setLinkedMap] = useState<Map<string, GessInfoFull>>(new Map());
  const [imgCarousel, setImgCarousel] = useState<{ images: string[]; idx: number } | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const cx=(bnd.minX+bnd.maxX)/2,cz=(bnd.minZ+bnd.maxZ)/2,S=Math.max(bnd.maxX-bnd.minX,bnd.maxZ-bnd.minZ);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dbList, apiList] = await Promise.all([
          gessService.all(eventoId),
          gessService.fetchFromApi(tipoEvento, codigoEvento).catch(() => [] as Record<string, unknown>[]),
        ]);

        if (cancelled) return;

        // Index API rows by their ID (same logic as sync route: uid > UID > codigo > stand)
        const apiById = new Map<string, Record<string, unknown>>();
        for (const row of apiList) {
          const id = String((row as Record<string, unknown>).uid ?? (row as Record<string, unknown>).UID ?? (row as Record<string, unknown>).codigo ?? (row as Record<string, unknown>).stand ?? "");
          if (id) apiById.set(id, row as Record<string, unknown>);
        }

        const map = new Map<string, GessInfoFull>();
        for (const row of dbList) {
          const r = row as unknown as Record<string, unknown>;
          const bloqueId = r.bloqueId ?? r.bloque_id ?? null;
          if (!bloqueId) continue;

          const standApiId = String(r.standApiId ?? r.stand_api_id ?? "");
          const apiRow = apiById.get(standApiId);

          const tipoStand = (apiRow ? (apiRow.type ?? apiRow.tipo ?? apiRow.tipo_stand) : (r.tipoStand ?? r.tipo_stand ?? null)) as string | null;
          const estado = (apiRow ? (apiRow.status ?? apiRow.estado) : (r.estado ?? null)) as string | null;
          const empresa = (apiRow ? (apiRow.company ?? apiRow.empresa ?? apiRow.razon_social) : (r.empresa ?? null)) as string | null;
          const precio = apiRow ? String(apiRow.type ?? apiRow.tipo ?? apiRow.tipo_stand ?? "") : null;
          const medidas = precio
            ? precio.startsWith("PREFERENCIAL") ? "3000.00 US$"
            : precio.startsWith("ESTANDAR_01") ? "2000.00 US$"
            : precio.startsWith("ESTANDAR_02") ? "2500.00 US$"
            : precio.startsWith("ISLAS") ? "ISLA"
            : (r.medidas ?? null) as string | null
            : (r.medidas ?? null) as string | null;

          map.set(String(bloqueId), {
            standCode: String(apiRow ? getIdApi(apiRow) : (r.standCode ?? r.stand_code ?? "")),
            tipoStand,
            empresa,
            estado,
            medidas,
            documentos: (Array.isArray(r.documentos) ? r.documentos : []) as string[],
            imagenes: (Array.isArray(r.imagenes) ? r.imagenes : []) as string[],
            reserved: (estado ?? "") === "Reservado" || (estado ?? "") === "En evaluacion" || estado === ESTADOS_STAND.EN_EVALUACION,
            dbId: String(r.id ?? ""),
          });
        }
        setLinkedMap(map);
        if (!cancelled) setDataReady(true);
      } catch {
        if (!cancelled) setDataReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [eventoId, tipoEvento, codigoEvento]);

  useEffect(() => {
    if (selectedIds.length !== 1) { setGessInfo(null); return; }
    const linked = linkedMap.get(selectedIds[0]);
    setGessInfo(linked ?? null);
  }, [selectedIds, linkedMap]);

  useEffect(() => {
    if (!openReserva || !dataReady) return;
    try {
      const raw = localStorage.getItem(LS_KEYS.PLANO_SELECCION);
      if (raw) {
        const ids = JSON.parse(raw) as string[];
        const valid = ids.filter((id) => linkedMap.has(id) && !linkedMap.get(id)?.reserved);
        if (valid.length > 0) {
          setSelectedIds(valid);
          setReservaOpen(true);
          setReservaStep(0);
        }
      }
    } catch { /* ignore */ }
    localStorage.removeItem(LS_KEYS.PLANO_SELECCION);
    router.replace("/plano", { scroll: false });
  }, [openReserva, dataReady, linkedMap, router]);

  const {
    reservaOpen, setReservaOpen,
    reservaStep, setReservaStep,
    formDatos, setFormDatos,
    formDocs,
    uploading,
    submitting,
    selectedCount,
    singleStand,
    stepDone,
    canGoStep,
    handleOpenChange,
    addDoc,
    removeDoc,
    handleSubmit,
    reset: resetForm,
  } = useReservaForm(selectedIds, linkedMap as unknown as Map<string, GessLinkedInfo>);

  // Override: auto-open + restore selection from login redirect
  useEffect(() => {
    if (!openReserva || !dataReady) return;
    try {
      const raw = localStorage.getItem(LS_KEYS.PLANO_SELECCION);
      if (raw) {
        const ids = JSON.parse(raw) as string[];
        const valid = ids.filter((id) => linkedMap.has(id) && !linkedMap.get(id)?.reserved);
        if (valid.length > 0) {
          setSelectedIds(valid);
        }
      }
    } catch { /* ignore */ }
    localStorage.removeItem(LS_KEYS.PLANO_SELECCION);
    setReservaOpen(true);
    setReservaStep(0);
    router.replace("/plano", { scroll: false });
  }, [openReserva, dataReady]);

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

  const selectedLabels = selected.map(s => plano.blockLabel[s.type]?.label ?? "?").join(", ");
  const gessInfoForSelected = selectedIds.length === 1 ? linkedMap.get(selectedIds[0]) : null;

  const onDatosChange = (update: Partial<FormDatos>) => setFormDatos(d => ({ ...d, ...update }));

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

        <div className="absolute bottom-3 right-3 rounded-lg border bg-white/90 px-3 py-2 text-[10px] text-muted-foreground shadow-sm backdrop-blur-sm">
          <div className="space-y-1">
            <Legend color="#FFD700" label="S (Columna)" />
            <Legend color="#32CD32" label="P (Preferencial)" />
            <Legend color="#90EE90" label="C (Estándar A)" />
            <Legend color="#006400" label="BG (Isla Grande)" />
            <Legend color="#9ca3af" label="Reservado" />
          </div>
        </div>
      </div>

      <div className="w-full shrink-0 rounded-xl border bg-white p-5 lg:w-72">
        <h3 className="mb-3 font-semibold text-slate-900"><span>Mi selección</span></h3>
        {selected.length === 0 ? (
          <p className="text-sm text-muted-foreground"><span>Haz clic en un bloque. Rota/zoom con el mouse.</span></p>
        ) : (
          <>
            <div className="space-y-1 max-h-48 overflow-y-auto">
                  {selected.map(sel => {
                    const selReserved = linkedMap.get(sel.id)?.reserved;
                    const info = linkedMap.get(sel.id);
                    return (
                      <div key={sel.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${selReserved ? "bg-red-50/70 border border-red-100" : "bg-muted/40 border"}`}>
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border"
                          style={{ backgroundColor: selReserved ? "#9ca3af" : sel.dim.color }}
                        />
                        <span className="font-mono font-medium text-slate-700">{sel.id}</span>
                        <span className="text-[10px] text-muted-foreground">{plano.blockLabel[sel.type]?.label ?? "?"}</span>
                        {info?.empresa && (
                          <span className="truncate text-[10px] text-slate-400" title={info.empresa}>{info.empresa}</span>
                        )}
                        <button
                          className="ml-auto shrink-0 rounded p-0.5 text-muted-foreground hover:bg-slate-200 hover:text-slate-700 transition-colors"
                          onClick={(e) => { e.stopPropagation(); handleSelect(sel.id); }}
                          title="Quitar de la seleccion"
                        >
                          <X className="h-3 w-3" />
                        </button>
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
                  {gessInfo.imagenes.length > 0 && (
                    <button
                      className="mt-1 flex w-full items-center gap-2 rounded bg-white/70 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white hover:text-foreground transition-colors"
                      onClick={() => setImgCarousel({ images: gessInfo.imagenes, idx: 0 })}
                      title="Ver imagenes"
                    >
                      <Image className="h-3.5 w-3.5" />
                      <span>{gessInfo.imagenes.length} {gessInfo.imagenes.length === 1 ? "imagen" : "imagenes"}</span>
                    </button>
                  )}
                  {gessInfo.documentos.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {gessInfo.documentos.map((url, i) => (
                        <a key={i} href={url} target="_blank" className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] text-primary hover:bg-primary/5 transition-colors">
                          <FileText className="h-3 w-3" />
                          <span className="truncate">{url.split("/").pop()}</span>
                          <Eye className="ml-auto h-3 w-3 opacity-50" />
                        </a>
                      ))}
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
              onClick={async () => {
                const session = await authService.getSession();
                if (!session.authenticated) {
                  localStorage.setItem(LS_KEYS.PLANO_SELECCION, JSON.stringify(selectedIds));
                  router.push(`/auth/login?returnTo=${encodeURIComponent("/plano?openReserva=1")}`);
                  return;
                }
                setReservaOpen(true);
                setReservaStep(0);
              }}>
              <span>{hayReservados ? "Hay bloques no disponibles" : `Reservar (${selected.length})`}</span>
            </Button>
          </>
        )}
      </div>

      <ReservaModal
        open={reservaOpen}
        onOpenChange={handleOpenChange}
        step={reservaStep as ReservaStep}
        onGoStep={(s) => setReservaStep(s)}
        stepDone={stepDone}
        canGoStep={canGoStep}
        formDatos={formDatos}
        onDatosChange={onDatosChange}
        formDocs={formDocs}
        uploading={uploading}
        submitting={submitting}
        selectedCount={selectedCount}
        singleStand={singleStand}
        selectedLabels={selectedLabels}
        existingDocs={gessInfoForSelected?.documentos ?? []}
        onAddDoc={addDoc}
        onRemoveDoc={removeDoc}
        onSubmit={async () => {
          const ok = await handleSubmit();
          if (ok) {
            setSelectedIds([]);
            resetForm();
          }
          return ok;
        }}
      />

      {imgCarousel && (
        <Dialog open={true} onOpenChange={() => setImgCarousel(null)}>
          <DialogContent className="sm:max-w-2xl bg-black/90 border-slate-700">
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 z-10"
              onClick={() => setImgCarousel((prev) => prev ? { ...prev, idx: Math.max(0, prev.idx - 1) } : null)}
              disabled={imgCarousel.idx === 0}
            >
              <span className="text-lg">‹</span>
            </button>
            <img src={imgCarousel.images[imgCarousel.idx]} className="max-h-[70vh] w-full object-contain" />
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 z-10"
              onClick={() => setImgCarousel((prev) => prev ? { ...prev, idx: Math.min(prev.images.length - 1, prev.idx + 1) } : null)}
              disabled={imgCarousel.idx === imgCarousel.images.length - 1}
            >
              <span className="text-lg">›</span>
            </button>
            <p className="text-center text-xs text-white/60">{imgCarousel.idx + 1} / {imgCarousel.images.length}</p>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm border" style={{ backgroundColor: color }} />{label}</span>;
}
