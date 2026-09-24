"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@nrivera-iimp/ui-kit-iimp";
import { FileText, Eye, X, Info, Image, ScrollText, Upload, ClipboardCheck, Bell, Check } from "lucide-react";
import { gessService } from "@/lib/client/api/services/gess-service";
import { requirePlano } from "@/lib/shared/planos/registry";
import type { PlanoDefinition, PlanoItem } from "@/lib/shared/planos/registry";
import { LS_KEYS, ESTADOS_STAND, ESTADOS_STAND_LEGACY, MONEDAS } from "@/lib/shared/constants";
import type { ReservaStep } from "@/lib/shared/constants";
import { useReservaForm } from "./reserva/use-reserva-form";
import { ReservaModal } from "./reserva/reserva-modal";
import { useSesion } from "@/hooks/use-sesion";
import { sincronizarEventoPublicoEnSesion } from "@/lib/client/sesion-evento";
import type { FormDatos } from "./reserva/interfaces";
import { toast } from "sonner";
import * as THREE from "three";

/* ================================================================
   PLANO ISOMÉTRICO — GESS edition.
   Construcción del layout en src/lib/planos/gess/construccion.ts
   ================================================================ */

/* ---------- 3D ---------- */
function Bloque3D({ item, selected, reserved, onSelect }: {
  item: PlanoItem; selected: boolean; reserved: boolean; onSelect: (id: string) => void;
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
  const plano = requirePlano("gess");
  const items=useMemo(()=>plano.buildItems(),[plano]);
  const bnd=useMemo(()=>plano.computeBounds(items),[items, plano]);
  const furniture=useMemo(()=>plano.buildFurniture(),[plano]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [linkedMap, setLinkedMap] = useState<Map<string, GessInfoFull>>(new Map());
  const [imgCarousel, setImgCarousel] = useState<{ images: string[]; idx: number } | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [detailModal, setDetailModal] = useState<GessInfoFull | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [standDocs, setStandDocs] = useState<string[]>([]);
  const [postSubmitOpen, setPostSubmitOpen] = useState(false);
  const cx=(bnd.minX+bnd.maxX)/2,cz=(bnd.minZ+bnd.maxZ)/2,S=Math.max(bnd.maxX-bnd.minX,bnd.maxZ-bnd.minZ);

  const blockLabel = (type: PlanoItem["type"]) => plano.blockLabel[type] ?? { label: "?", nombre: "?" };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dbList, apiList] = await Promise.all([
          gessService.all(eventoId),
          gessService.fetchFromApi(tipoEvento, codigoEvento).catch(() => [] as Record<string, unknown>[]),
        ]);

        if (cancelled) return;

        if (dbList.length === 0 && apiList.length > 0) {
          await gessService.sync({ eventoId, tipoEvento, codigoEvento });
          const fresh = await gessService.all(eventoId);
          dbList.splice(0, dbList.length, ...fresh);
        }

        // Index API rows by their ID (same logic as sync route: uid > UID > codigo > stand)
        const apiById = new Map<string, Record<string, unknown>>();
        for (const row of apiList) {
          const id = String((row as Record<string, unknown>).uid ?? (row as Record<string, unknown>).UID ?? (row as Record<string, unknown>).codigo ?? (row as Record<string, unknown>).stand ?? "");
          if (id) apiById.set(id, row as Record<string, unknown>);
        }

        const map = new Map<string, GessInfoFull>();
        for (const row of dbList) {
          const r: Record<string, unknown> = { ...row };
          const bloqueId = r.bloqueId ?? r.bloque_id ?? null;
          if (!bloqueId) continue;

          const standApiId = String(r.standApiId ?? r.stand_api_id ?? "");
          const apiRow = apiById.get(standApiId);

          const tipoStand = (apiRow ? (apiRow.type ?? apiRow.tipo ?? apiRow.tipo_stand) : (r.tipoStand ?? r.tipo_stand ?? null)) as string | null;
          // DB tiene prioridad sobre API para estado (refleja cambios locales como en_evaluacion)
          const estadoDb = (r.estado ?? null) as string | null;
          const estadoApi = apiRow ? (apiRow.status ?? apiRow.estado) as string | null : null;
          const estado = estadoDb ?? estadoApi;
          const empresa = (apiRow ? (apiRow.company ?? apiRow.empresa ?? apiRow.razon_social) : (r.empresa ?? null)) as string | null;
          const precio = apiRow ? String(apiRow.type ?? apiRow.tipo ?? apiRow.tipo_stand ?? "") : null;
          const medidas = precio
            ? precio.startsWith("PREFERENCIAL") ? `3000.00 ${MONEDAS.US_DOLAR}`
            : precio.startsWith("ESTANDAR_01") ? `2000.00 ${MONEDAS.US_DOLAR}`
            : precio.startsWith("ESTANDAR_02") ? `2500.00 ${MONEDAS.US_DOLAR}`
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
            reserved: (estado ?? "") === ESTADOS_STAND_LEGACY.RESERVADO || (estado ?? "") === ESTADOS_STAND_LEGACY.EN_EVALUACION || estado === ESTADOS_STAND.EN_EVALUACION,
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

  const {
    reservaOpen, setReservaOpen,
    reservaStep, setReservaStep,
    formDatos, setFormDatos,
    formDocs,
    uploading,
    submitting,
    submitError,
    selectedCount,
    singleStand,
    stepDone,
    canGoStep,
    handleOpenChange,
    addDoc,
    removeDoc,
    handleSubmit,
    reset: resetForm,
    confirmado, setConfirmado,
  } = useReservaForm(selectedIds, linkedMap);

  const { session: sesionReserva, cargando: sesionCargando, refrescar: refrescarSesion } = useSesion();

  useEffect(() => {
    if (!openReserva || !dataReady) return;
    void (async () => {
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
    })();
  }, [openReserva, dataReady, linkedMap, router, setReservaOpen, setReservaStep]);

  // Override: auto-open + restore selection from login redirect
  useEffect(() => {
    if (!openReserva || !dataReady) return;
    void (async () => {
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
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const singleId = selectedIds.length === 1 ? selectedIds[0] : undefined;
  const gessInfoForSelected = singleId ? (linkedMap.get(singleId) ?? null) : null;

  useEffect(() => {
    void (async () => {
      if (!reservaOpen) {
        setStandDocs([]);
        return;
      }
      if (!gessInfoForSelected?.dbId || !singleId) return;
      try {
        const stand = await gessService.findByBloque(singleId);
        const docs = stand?.documentos;
        setStandDocs(Array.isArray(docs) ? docs as string[] : []);
      } catch { /* ignore */ }
    })();
  }, [reservaOpen, gessInfoForSelected?.dbId, singleId]);

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

        <div className="absolute bottom-2 right-2 z-10">
          {/* Desktop: always visible */}
          <div className="hidden sm:block rounded-lg border bg-white/90 px-3 py-2 text-[10px] text-muted-foreground shadow-sm backdrop-blur-sm">
            <div className="space-y-1">
              <Legend color="#FFD700" label="S (Columna)" />
              <Legend color="#32CD32" label="P (Preferencial)" />
              <Legend color="#90EE90" label="C (Estandar A)" />
              <Legend color="#006400" label="BG (Isla Grande)" />
              <Legend color="#9ca3af" label="Reservado" />
            </div>
          </div>
          {/* Mobile: toggle button + panel */}
          <div className="sm:hidden">
            {!legendOpen ? (
              <button
                className="rounded-lg border bg-white/90 px-2 py-1.5 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm"
                onClick={() => setLegendOpen(true)}
              >
                <span>Leyenda</span>
              </button>
            ) : (
              <div className="rounded-lg border bg-white/90 px-3 py-2 text-[10px] text-muted-foreground shadow-sm backdrop-blur-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-600">Leyenda</span>
                  <button onClick={() => setLegendOpen(false)} className="text-muted-foreground hover:text-slate-700">
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="space-y-1">
                  <Legend color="#FFD700" label="S (Columna)" />
                  <Legend color="#32CD32" label="P (Preferencial)" />
                  <Legend color="#90EE90" label="C (Estandar A)" />
                  <Legend color="#006400" label="BG (Isla Grande)" />
                  <Legend color="#9ca3af" label="Reservado" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col rounded-xl border bg-white lg:w-80">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900"><span>Mi seleccion</span></h3>
          {selected.length > 0 && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{selected.length}</span>
          )}
        </div>

        {selected.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <p className="text-center text-xs text-muted-foreground leading-relaxed">
              <span>Haz clic en un bloque del plano.<br />Rota/zoom con el mouse.</span>
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 divide-y overflow-y-auto">
              {selected.map((sel) => {
                const info = linkedMap.get(sel.id);
                const selReserved = info?.reserved;
                const lbl = blockLabel(sel.type);
                return (
                  <div
                    key={sel.id}
                    className="group flex cursor-pointer items-center gap-2.5 px-4 py-2.5 text-xs transition-colors hover:bg-slate-50"
                    onClick={() => info && setDetailModal(info)}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border"
                      style={{ backgroundColor: selReserved ? "#9ca3af" : sel.dim.color }}
                    />
                    <span className="font-mono text-[11px] font-medium text-slate-700">{sel.id}</span>
                    <span className="text-[10px] text-muted-foreground">{lbl.label}</span>
                    {info?.medidas && (
                      <span className="ml-auto text-[11px] font-medium text-emerald-700">{info.medidas}</span>
                    )}
                    <span className="hidden rounded p-0.5 text-muted-foreground opacity-0 transition-all group-hover:opacity-100">
                      <Info className="h-3 w-3" />
                    </span>
                    <button
                      className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); handleSelect(sel.id); }}
                      title="Quitar de la seleccion"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="border-t px-4 py-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold text-slate-800">{selected.length} {selected.length === 1 ? "bloque" : "bloques"}</span>
              </div>
              <Button
                variant="default"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={selected.length === 0 || hayReservados}
                onClick={() => {
                  setReservaOpen(true);
                  setReservaStep(0);
                }}
              >
                <span>{hayReservados ? "Hay bloques no disponibles" : `Reservar (${selected.length})`}</span>
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Detail Modal */}
      <Dialog open={detailModal !== null} onOpenChange={() => setDetailModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {detailModal ? (() => {
                const bid = [...linkedMap.entries()].find(([, v]) => v === detailModal)?.[0];
                const item = items.find((it) => it.id === bid);
                const label = item ? blockLabel(item.type).label : "";
                return <span>Detalles: {label} — {bid ?? detailModal.standCode}</span>;
              })() : <span>Detalles</span>}
            </DialogTitle>
          </DialogHeader>
          {detailModal && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border bg-muted/20 p-3 text-xs">
                <div><span className="text-muted-foreground">Codigo</span><p className="font-mono font-medium">{detailModal.standCode}</p></div>
                <div><span className="text-muted-foreground">Tipo</span><p className="font-medium">{detailModal.tipoStand ?? "—"}</p></div>
                <div><span className="text-muted-foreground">Precio</span><p className="font-medium text-emerald-700">{detailModal.medidas ?? "—"}</p></div>
                <div>
                  <span className="text-muted-foreground">Estado</span>
                  <div className="mt-0.5">
                    <Badge variant={detailModal.estado === ESTADOS_STAND_LEGACY.RESERVADO ? "destructive" : "default"} className="text-[10px]">
                      <span>{detailModal.estado ?? "—"}</span>
                    </Badge>
                  </div>
                </div>
                {detailModal.empresa && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Empresa</span>
                    <p className="font-medium">{detailModal.empresa}</p>
                  </div>
                )}
              </div>

              {detailModal.imagenes.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Imagenes ({detailModal.imagenes.length})</p>
                  <button
                    className="group relative flex w-full items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      const imgs = detailModal.imagenes;
                      setImgCarousel({ images: imgs, idx: 0 });
                    }}
                    title="Haz clic para ver las imagenes en carrusel"
                  >
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Ver {detailModal.imagenes.length} {detailModal.imagenes.length === 1 ? "imagen" : "imagenes"}</span>
                    <Eye className="ml-auto h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" />
                  </button>
                </div>
              )}

              {detailModal.documentos.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Documentos ({detailModal.documentos.length})</p>
                  <div className="space-y-0.5 rounded-md border p-2">
                    {detailModal.documentos.map((url, i) => (
                      <a key={i} href={url} target="_blank" className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs text-primary hover:bg-primary/5 transition-colors">
                        <FileText className="h-3 w-3" />
                        <span className="truncate">{url.split("/").pop()}</span>
                        <Eye className="ml-auto h-3 w-3 opacity-50" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <Button variant="outline" size="sm" className="w-full" onClick={() => setDetailModal(null)}>
                <span>Cerrar</span>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReservaModal
        open={reservaOpen}
        onOpenChange={handleOpenChange}
        autenticado={sesionReserva?.authenticated === true}
        sesionCargando={sesionCargando}
        onAuthenticated={async () => {
          await sincronizarEventoPublicoEnSesion();
          await refrescarSesion();
        }}
        step={reservaStep as ReservaStep}
        onGoStep={(s) => setReservaStep(s)}
        stepDone={stepDone}
        canGoStep={canGoStep}
        formDatos={formDatos}
        onDatosChange={onDatosChange}
        formDocs={formDocs}
        uploading={uploading}
        submitting={submitting}
        submitError={submitError}
        selectedCount={selectedCount}
        singleStand={singleStand}
        selectedLabels={selectedLabels}
        selectedItems={selected.map(sel => {
          const info = linkedMap.get(sel.id);
          return {
            id: sel.id,
            typeLabel: blockLabel(sel.type).label,
            medidas: info?.medidas ?? null,
            reserved: info?.reserved ?? false,
          };
        })}
        existingDocs={standDocs.length > 0 ? standDocs : (gessInfoForSelected?.documentos ?? [])}
        onAddDoc={addDoc}
        onRemoveDoc={removeDoc}
        confirmado={confirmado}
        onConfirmadoChange={setConfirmado}
        onSubmit={async () => {
          const result = await handleSubmit();
          if (result === true) {
            const esMultiple = selectedCount > 1;
            if (esMultiple) {
              setPostSubmitOpen(true);
            } else {
              toast.success("Reserva enviada correctamente", {
                description: "Recibiras un correo de confirmacion. El stand pasa a estado En evaluacion.",
              });
            }
            setLinkedMap(prev => {
              const next = new Map(prev);
              for (const id of selectedIds) {
                const info = next.get(id);
                if (info) next.set(id, { ...info, reserved: true, estado: ESTADOS_STAND_LEGACY.EN_EVALUACION });
              }
              return next;
            });
            setSelectedIds([]);
            resetForm();
          }
          return result === true;
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgCarousel.images[imgCarousel.idx]} alt="" className="max-h-[70vh] w-full object-contain" />
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

      {/* Post-submit modal — multi-stand flow explanation */}
      <Dialog open={postSubmitOpen} onOpenChange={setPostSubmitOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-0 shadow-xl">
          <DialogHeader>
            <DialogTitle><span>Solicitud multiple enviada</span></DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-center">
              <Check className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-emerald-800">Tu solicitud ha sido registrada con exito</p>
              <p className="text-xs text-emerald-600 mt-1">Sigue estos pasos para completar el proceso:</p>
            </div>

            <div className="space-y-0">
              {[
                { icon: ScrollText, color: "bg-emerald-100 text-emerald-600", title: "Solicitud creada", desc: "El administrador del IIMP ha sido notificado y revisara tu solicitud multiple." },
                { icon: Upload, color: "bg-blue-100 text-blue-600", title: "El admin sube el contrato", desc: "El administrador adjuntara el contrato oficial. Recibiras un correo cuando este listo para que puedas continuar." },
                { icon: FileText, color: "bg-amber-100 text-amber-600", title: "Adjunta tus documentos", desc: "Ingresa a Mis solicitudes en el dashboard y adjunta los documentos requeridos para tu solicitud." },
                { icon: ClipboardCheck, color: "bg-purple-100 text-purple-600", title: "Revision por areas", desc: "Tres areas (Comunicacion, Legal y Logistica) revisaran tu documentacion y emitiran su veredicto." },
                { icon: Bell, color: "bg-emerald-100 text-emerald-600", title: "Resultado final", desc: "Recibiras un correo con el resultado. Si es rechazada, podras solicitar una re-evaluacion." },
              ].map((s, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.color}`}>
                      <s.icon className="h-4 w-4" />
                    </div>
                    {i < 4 && <div className="w-0.5 flex-1 bg-slate-200 my-0.5" />}
                  </div>
                  <div className="pb-2">
                    <p className="text-xs font-semibold text-slate-700">{s.title}</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
              <p className="text-[11px] text-slate-500">
                Monitorea el estado en <span className="font-mono text-emerald-600 font-medium">Mis solicitudes</span> desde el menu lateral del dashboard.
              </p>
            </div>

            <Button className="w-full rounded-full" onClick={() => setPostSubmitOpen(false)}>
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm border" style={{ backgroundColor: color }} />{label}</span>;
}
