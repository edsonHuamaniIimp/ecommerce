"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, Sheet, SheetContent, SheetHeader, SheetTitle } from "@nrivera-iimp/ui-kit-iimp";
import { FileText, Eye, X, Image, ScrollText, Upload, ClipboardCheck, Bell, Check, Layers, Loader2, Trash2, ShoppingBag, ChevronLeft, ChevronRight, MousePointerClick, ArrowUpRight } from "lucide-react";
import { gessService } from "@/lib/client/api/services/gess-service";
import { loadPlanoDefinition } from "@/lib/shared/planos/registry";
import type { PlanoDefinition, PlanoItem } from "@/lib/shared/planos/registry";
import { LS_KEYS, BADGE_STYLES, ESTADOS_STAND, ESTADOS_STAND_LEGACY, MONEDAS } from "@/lib/shared/constants";
import { estadoStandBadge } from "@/lib/shared/utils/estado-stand";
import { leyendaPlano } from "@/lib/shared/utils/leyenda-plano";
import { stringUtils } from "@/lib/shared/utils/string";
import type { ReservaStep } from "@/lib/shared/constants";
import { usePlanoCarrito, totalCarrito, urlPabellon, type CarritoStandInfo } from "@/lib/client/stores/plano-carrito-store";
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

export function PlanoDinamico({ eventoId, tipoEvento, codigoEvento, planoId = "gess", openReserva, parentCodigo = null }: { eventoId: string; tipoEvento: number; codigoEvento: number; planoId?: string; openReserva?: boolean; parentCodigo?: string | null }) {
  const router = useRouter();
  const [plano, setPlano] = useState<PlanoDefinition | null>(null);
  const [planoLoading, setPlanoLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setPlanoLoading(true);
      const def = await loadPlanoDefinition(planoId);
      if (!cancelled) {
        setPlano(def ?? null);
        setPlanoLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [planoId]);

  const items=useMemo(()=>plano?.buildItems() ?? [],[plano]);
  const bnd=useMemo(()=>plano?plano.computeBounds(items):{minX:-20,maxX:20,minZ:-20,maxZ:20},[items, plano]);
  const furniture=useMemo(()=>plano?.buildFurniture() ?? [],[plano]);
  const seleccionesCarrito = usePlanoCarrito((s) => s.selecciones);
  const itemsCarrito = usePlanoCarrito((s) => s.items);
  const toggleCarrito = usePlanoCarrito((s) => s.toggle);
  const seleccionarSolo = usePlanoCarrito((s) => s.seleccionarSolo);
  const quitarCarrito = usePlanoCarrito((s) => s.quitar);
  const limpiarPlanoCarrito = usePlanoCarrito((s) => s.limpiarPlano);
  const idsPlano = useMemo(() => seleccionesCarrito[planoId] ?? [], [seleccionesCarrito, planoId]);
  const idsGlobales = useMemo(() => Object.values(seleccionesCarrito).flat(), [seleccionesCarrito]);
  const entradasCarrito = useMemo(() => Object.values(itemsCarrito), [itemsCarrito]);
  const parentsCarrito = usePlanoCarrito((s) => s.parents);
  const macroCodigo = usePlanoCarrito((s) => s.macroCodigo);

  // Registra el parent de este plano para navegar desde el carrito.
  useEffect(() => {
    usePlanoCarrito.getState().registrarPlano(planoId, parentCodigo ?? null);
  }, [planoId, parentCodigo]);
  const [linkedMap, setLinkedMap] = useState<Map<string, GessInfoFull>>(new Map());
  const [imgCarousel, setImgCarousel] = useState<{ images: string[]; idx: number } | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [detailModal, setDetailModal] = useState<GessInfoFull | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [standDocs, setStandDocs] = useState<string[]>([]);
  const [postSubmitOpen, setPostSubmitOpen] = useState(false);
  const [panelMovil, setPanelMovil] = useState(false);
  const cx=(bnd.minX+bnd.maxX)/2,cz=(bnd.minZ+bnd.maxZ)/2,S=Math.max(bnd.maxX-bnd.minX,bnd.maxZ-bnd.minZ);

  const blockLabel = (type: PlanoItem["type"]) => plano?.blockLabel[type] ?? { label: "?", nombre: "?" };
  const leyenda = leyendaPlano(items, blockLabel);

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

  const carritoInfoDe = useCallback((bloqueId: string): CarritoStandInfo => {
    const info = linkedMap.get(bloqueId);
    const item = items.find((it) => it.id === bloqueId);
    return {
      bloqueId,
      standCode: info?.standCode ?? "",
      pabellonCodigo: planoId,
      tipoLabel: item ? (plano?.blockLabel[item.type]?.label ?? null) : null,
    };
  }, [linkedMap, items, plano, planoId]);

  // Valida la seleccion persistida del plano contra los stands cargados
  // (descarta ids que desaparecieron o quedaron reservados).
  useEffect(() => {
    if (!dataReady) return;
    const { selecciones, sincronizarPlano } = usePlanoCarrito.getState();
    const ids = selecciones[planoId] ?? [];
    if (ids.length === 0) return;
    const validos: CarritoStandInfo[] = [];
    for (const id of ids) {
      const info = linkedMap.get(id);
      if (!info || info.reserved) continue;
      validos.push(carritoInfoDe(id));
    }
    sincronizarPlano(planoId, validos);
  }, [dataReady, planoId, linkedMap, carritoInfoDe]);

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
  } = useReservaForm(idsGlobales, linkedMap);

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
            const { sincronizarPlano } = usePlanoCarrito.getState();
            sincronizarPlano(planoId, valid.map(carritoInfoDe));
            setReservaOpen(true);
            setReservaStep(0);
          }
        }
      } catch { /* ignore */ }
      localStorage.removeItem(LS_KEYS.PLANO_SELECCION);
      router.replace("/plano", { scroll: false });
    })();
  }, [openReserva, dataReady, linkedMap, router, setReservaOpen, setReservaStep, planoId, carritoInfoDe]);

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
            const { sincronizarPlano } = usePlanoCarrito.getState();
            sincronizarPlano(planoId, valid.map(carritoInfoDe));
          }
        }
      } catch { /* ignore */ }
      localStorage.removeItem(LS_KEYS.PLANO_SELECCION);
      setReservaOpen(true);
      setReservaStep(0);
      router.replace(`/mapa?codigo=${planoId}`, { scroll: false });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openReserva, dataReady, planoId, router]);

  const handleSelect = (id: string) => {
    const info = linkedMap.get(id);
    if (info?.reserved) {
      if (idsPlano.length === 1 && idsPlano[0] === id) {
        limpiarPlanoCarrito(planoId);
      } else {
        seleccionarSolo(planoId, carritoInfoDe(id));
      }
      return;
    }
    toggleCarrito(planoId, carritoInfoDe(id));
  };
  const hayReservados = idsGlobales.some(id => linkedMap.get(id)?.reserved);
  const haySinStand = idsGlobales.some(id => !linkedMap.get(id)?.dbId);

  const selectedLabels = entradasCarrito
    .map(c => `${c.standCode || c.bloqueId}${c.pabellonCodigo !== planoId ? ` (${c.pabellonCodigo})` : ""}`)
    .join(", ");
  const singleId = idsGlobales.length === 1 ? idsGlobales[0] : undefined;
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

  // Navegacion del carrusel con las flechas del teclado mientras esta abierto.
  useEffect(() => {
    if (!imgCarousel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setImgCarousel((prev) => prev ? { ...prev, idx: Math.max(0, prev.idx - 1) } : null);
      if (e.key === "ArrowRight") setImgCarousel((prev) => prev ? { ...prev, idx: Math.min(prev.images.length - 1, prev.idx + 1) } : null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [imgCarousel]);

  // Contenido del panel "Mi seleccion": se monta en el aside (desktop) y en el
  // bottom sheet (mobile) sin duplicar el markup. Muestra el carrito global
  // (todos los pabellones).
  const totalCarritoCount = totalCarrito(seleccionesCarrito);
  const pabellonesConItems = new Set(entradasCarrito.map((c) => c.pabellonCodigo)).size;
  const contenidoPanel = (
    <>
      <div className="flex items-center justify-between border-b border-border bg-secondary px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-bold tracking-tight text-primary uppercase">
          <ShoppingBag className="h-4 w-4 text-primary" />
          <span>Mi seleccion</span>
        </h3>
        <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-extrabold text-primary-foreground">
          {totalCarritoCount} {totalCarritoCount === 1 ? "stand" : "stands"}
        </span>
      </div>

      {entradasCarrito.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-6 text-center">
          <MousePointerClick className="h-5 w-5 text-muted-foreground/60" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span>Haz clic en un stand del plano para agregarlo.<br />Arrastra para rotar y usa la rueda para acercar.</span>
          </p>
        </div>
      ) : (
        <>
          {pabellonesConItems > 1 && (
            <p className="border-b border-border bg-secondary px-4 py-1.5 text-center text-[10px] font-medium text-muted-foreground">
              Carrito de {pabellonesConItems} pabellones
            </p>
          )}
          <div className="flex-1 divide-y divide-border overflow-y-auto">
            {entradasCarrito.map((c) => {
              const info = linkedMap.get(c.bloqueId);
              const esPlanoActual = c.pabellonCodigo === planoId;
              return (
                <div
                  key={c.bloqueId}
                  className="group flex cursor-pointer items-start justify-between gap-2 px-4 py-3 transition-colors hover:bg-secondary"
                  onClick={() => info && setDetailModal(info)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-primary">{c.standCode || c.bloqueId}</span>
                      {!esPlanoActual && (
                        <Badge className="pointer-events-none border-transparent bg-info/10 text-[10px] text-info">
                          <span>{c.pabellonCodigo}</span>
                        </Badge>
                      )}
                      {info?.estado && <BadgeEstadoStand estado={info.estado} />}
                      {!info?.dbId && (
                        <Badge
                          className="pointer-events-none border-transparent bg-warning/10 text-[10px] text-warning"
                          title="Este bloque no tiene un stand vinculado en el evento"
                        >
                          <span>sin stand</span>
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                      {c.tipoLabel ?? ""}
                      {info?.tipoStand ? ` • ${info.tipoStand}` : ""}
                      {info?.medidas ? ` • ${info.medidas}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!esPlanoActual && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 p-0 text-info hover:bg-info/10 hover:text-info"
                        title={`Ver pabellon ${c.pabellonCodigo}`}
                        onClick={(e) => { e.stopPropagation(); router.push(urlPabellon(c.pabellonCodigo, parentsCarrito, macroCodigo)); }}
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); quitarCarrito(c.bloqueId); }}
                      title="Quitar de la seleccion"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2.5 border-t border-border bg-secondary px-4 py-3.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-primary">Total</span>
              <span className="font-bold text-primary">{totalCarritoCount} {totalCarritoCount === 1 ? "stand" : "stands"}</span>
            </div>
            <Button
              variant="default"
              className="w-full gap-2 bg-gold font-bold text-gold-foreground shadow-md hover:bg-gold/90"
              disabled={totalCarritoCount === 0 || hayReservados || haySinStand}
              onClick={() => {
                setReservaOpen(true);
                setReservaStep(0);
              }}
            >
              <span>{hayReservados ? "Hay bloques no disponibles" : haySinStand ? "Hay bloques sin stand vinculado" : `Continuar con la Reserva (${totalCarritoCount})`}</span>
              {!hayReservados && !haySinStand && <ChevronRight className="h-4 w-4" />}
            </Button>
            {haySinStand && (
              <p className="text-center text-[10px] text-warning">
                Los bloques marcados &quot;sin stand&quot; no tienen un stand vinculado en este evento. El administrador debe vincularlos desde Vinculacion de Stands.
              </p>
            )}
          </div>
        </>
      )}
    </>
  );

  return (
    <div className="flex h-[calc(100vh-7rem)] w-full flex-col gap-4 lg:flex-row">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <h1 className="flex items-center gap-2 text-base font-bold text-primary">
              <Layers className="h-4 w-4 text-primary" />
              <span>Plano de stands</span>
            </h1>
            {totalCarritoCount > 0 && (
              <Badge className="pointer-events-none border-transparent bg-primary/10 text-primary">
                <span>{totalCarritoCount} {totalCarritoCount === 1 ? "stand seleccionado" : "stands seleccionados"}</span>
              </Badge>
            )}
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">
            Arrastra para rotar y usa la rueda para acercar
          </span>
        </div>

        <div className="relative min-h-0 flex-1 bg-slate-100">
          {planoLoading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-slate-100/90">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Cargando plano 3D...</p>
            </div>
          )}
        <Canvas shadows camera={{position:[cx,S*.7,cz+S*.35],fov:50,near:.1,far:300}}
        gl={{toneMapping:THREE.ACESFilmicToneMapping,outputColorSpace:THREE.SRGBColorSpace}}>
        <fog attach="fog" args={["#E8E0D5",S*.9,S*2.2]}/><ambientLight intensity={.75}/>
        <directionalLight position={[cx+S*.3,S*1.2,cz]} intensity={2.5} castShadow shadow-mapSize={[2048,2048]}
          shadow-camera-left={-S} shadow-camera-right={S} shadow-camera-top={S} shadow-camera-bottom={-S}/>
        <directionalLight position={[cx-S*.2,S*.5,cz-S*.3]} intensity={.4}/>
        <Floor bnd={bnd}/>
        {items.map((it)=><Bloque3D key={it.id} item={it} selected={idsPlano.includes(it.id)} reserved={linkedMap.get(it.id)?.reserved ?? false} onSelect={handleSelect}/>)}
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

        <div className="border-t border-border bg-secondary px-4 py-3">
          {/* Desktop: leyenda siempre visible */}
          <div className="hidden flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:flex">
            <span className="font-bold text-primary">Leyenda:</span>
            {leyenda.map((l) => (
              <Legend key={l.label} color={l.color} label={l.label} />
            ))}
          </div>
          {/* Mobile: toggle + leyenda */}
          <div className="sm:hidden">
            {!legendOpen ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-auto gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-primary"
                onClick={() => setLegendOpen(true)}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Leyenda</span>
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary">Leyenda</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 p-0 text-muted-foreground hover:bg-transparent hover:text-primary"
                    title="Cerrar leyenda"
                    onClick={() => setLegendOpen(false)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                  {leyenda.map((l) => (
                    <Legend key={l.label} color={l.color} label={l.label} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile: abre el panel "Mi seleccion" como bottom sheet */}
        <div className="border-t border-border bg-card px-4 py-3 lg:hidden">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between border-border"
            onClick={() => setPanelMovil(true)}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-primary">
              <ShoppingBag className="h-4 w-4" />
              <span>Mi seleccion</span>
            </span>
            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
              {totalCarritoCount}
            </span>
          </Button>
        </div>
      </section>

      <aside className="hidden w-80 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:flex">
        {contenidoPanel}
      </aside>

      <Sheet open={panelMovil} onOpenChange={setPanelMovil}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto p-0 pt-10 lg:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Mi seleccion</SheetTitle>
          </SheetHeader>
          {contenidoPanel}
        </SheetContent>
      </Sheet>

      {/* Detail Modal */}
      <Dialog open={detailModal !== null} onOpenChange={() => setDetailModal(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md max-sm:bottom-0 max-sm:top-auto max-sm:max-h-[85vh] max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl sm:top-1/2 sm:translate-y-[-50%]">
          {/* Asa del bottom sheet (solo mobile) */}
          <span className="mx-auto mb-1 block h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" />
          <DialogHeader>
            <DialogTitle>
              <span>{tituloDetalle(detailModal, linkedMap, items, blockLabel)}</span>
            </DialogTitle>
          </DialogHeader>
          {detailModal && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-lg border border-border bg-secondary p-3 text-xs">
                <div><span className="text-muted-foreground">Codigo</span><p className="font-mono font-semibold text-primary">{detailModal.standCode}</p></div>
                <div><span className="text-muted-foreground">Tipo</span><p className="font-medium">{detailModal.tipoStand ?? "—"}</p></div>
                <div><span className="text-muted-foreground">Medidas</span><p className="font-medium">{detailModal.medidas ?? "—"}</p></div>
                <div>
                  <span className="text-muted-foreground">Estado</span>
                  <div className="mt-0.5">
                    <BadgeEstadoStand estado={detailModal.estado} />
                  </div>
                </div>
                {detailModal.empresa && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Empresa</span>
                    <p className="font-medium">{detailModal.empresa}</p>
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image className="h-3.5 w-3.5" />
                    <span>Imagenes y renders del stand</span>
                  </p>
                  {detailModal.imagenes.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto gap-1.5 p-0 text-[11px] font-medium text-primary hover:bg-transparent hover:underline"
                      onClick={() => setImgCarousel({ images: detailModal.imagenes, idx: 0 })}
                    >
                      <span>Ver carrusel completo ({detailModal.imagenes.length} {detailModal.imagenes.length === 1 ? "foto" : "fotos"})</span>
                      <Eye className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {detailModal.imagenes.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border bg-secondary px-3 py-3 text-center text-[11px] text-muted-foreground">
                    Sin imagenes cargadas para este stand.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {detailModal.imagenes.slice(0, 3).map((url, i) => (
                      <Button
                        key={`${url}-${i}`}
                        type="button"
                        variant="ghost"
                        className="group h-auto overflow-hidden rounded-lg border border-border p-0 hover:border-primary/40"
                        onClick={() => setImgCarousel({ images: detailModal.imagenes, idx: i })}
                        title={`Ver imagen ${i + 1}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Imagen ${i + 1} del stand ${detailModal.standCode}`} className="h-20 w-full object-cover transition-transform group-hover:scale-105" />
                      </Button>
                    ))}
                    {detailModal.imagenes.length > 3 && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto rounded-lg border border-dashed border-border p-0 text-muted-foreground hover:border-primary/40 hover:text-primary"
                        onClick={() => setImgCarousel({ images: detailModal.imagenes, idx: 3 })}
                      >
                        <span className="flex h-20 w-full items-center justify-center text-xs font-semibold">
                          +{detailModal.imagenes.length - 3}
                        </span>
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {detailModal.documentos.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-primary">Documentos ({detailModal.documentos.length})</p>
                  <div className="space-y-0.5 rounded-lg border border-border p-2">
                    {detailModal.documentos.map((url, i) => (
                      <a key={i} href={url} target="_blank" className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs text-primary transition-colors hover:bg-primary/5">
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
        selectedItems={entradasCarrito.map(c => {
          const info = linkedMap.get(c.bloqueId);
          return {
            id: c.bloqueId,
            typeLabel: c.pabellonCodigo !== planoId ? `${c.tipoLabel ?? "?"} (${c.pabellonCodigo})` : (c.tipoLabel ?? "?"),
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
            const enviados = [...idsGlobales];
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
              for (const id of enviados) {
                const info = next.get(id);
                if (info) next.set(id, { ...info, reserved: true, estado: ESTADOS_STAND_LEGACY.EN_EVALUACION });
              }
              return next;
            });
            for (const id of enviados) {
              quitarCarrito(id);
            }
            resetForm();
          }
          return result === true;
        }}
      />

      {imgCarousel && (
        <Dialog open={true} onOpenChange={() => setImgCarousel(null)}>
          <DialogContent className="max-w-4xl border-border/20 bg-black/95 p-3 sm:p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 pr-8">
                <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  {imgCarousel.idx + 1} / {imgCarousel.images.length}
                </span>
                <span className="truncate text-[11px] text-white/60">
                  {stringUtils.nombreArchivo(imgCarousel.images[imgCarousel.idx])}
                </span>
              </div>

              <div className="relative flex items-center justify-center px-12">
                {imgCarousel.images.length > 1 && (
                  <Button type="button" variant="ghost" size="icon"
                    className="absolute left-1 z-10 h-10 w-10 rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/25 hover:text-white disabled:opacity-30"
                    onClick={() => setImgCarousel((prev) => prev ? { ...prev, idx: Math.max(0, prev.idx - 1) } : null)}
                    disabled={imgCarousel.idx === 0}
                    title="Anterior (flecha izquierda)"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgCarousel.images[imgCarousel.idx]}
                  alt={`Imagen ${imgCarousel.idx + 1} de ${imgCarousel.images.length}`}
                  className="max-h-[65vh] w-full rounded-lg object-contain"
                />
                {imgCarousel.images.length > 1 && (
                  <Button type="button" variant="ghost" size="icon"
                    className="absolute right-1 z-10 h-10 w-10 rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/25 hover:text-white disabled:opacity-30"
                    onClick={() => setImgCarousel((prev) => prev ? { ...prev, idx: Math.min(prev.images.length - 1, prev.idx + 1) } : null)}
                    disabled={imgCarousel.idx === imgCarousel.images.length - 1}
                    title="Siguiente (flecha derecha)"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                )}
              </div>

              {imgCarousel.images.length > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {imgCarousel.images.map((url, i) => (
                    <Button key={`${url}-${i}`} type="button" variant="ghost"
                      className={`h-12 w-16 overflow-hidden rounded-md border p-0 transition-all ${
                        i === imgCarousel.idx ? "border-white ring-2 ring-white/50" : "border-white/20 opacity-60 hover:opacity-100"
                      }`}
                      onClick={() => setImgCarousel((prev) => prev ? { ...prev, idx: i } : null)}
                      title={`Ir a la imagen ${i + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Post-submit modal — multi-stand flow explanation */}
      <Dialog open={postSubmitOpen} onOpenChange={setPostSubmitOpen}>
        <DialogContent className="rounded-xl border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle><span>Solicitud multiple enviada</span></DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-center">
              <Check className="mx-auto mb-2 h-8 w-8 text-success" />
              <p className="text-sm font-bold text-foreground">Tu solicitud ha sido registrada con exito</p>
              <p className="mt-1 text-xs text-muted-foreground">Sigue estos pasos para completar el proceso:</p>
            </div>

            <div className="space-y-0">
              {[
                { icon: ScrollText, color: "bg-success/10 text-success", title: "Solicitud creada", desc: "El administrador del IIMP ha sido notificado y revisara tu solicitud multiple." },
                { icon: Upload, color: "bg-gold/15 text-gold", title: "El admin sube el contrato", desc: "El administrador adjuntara el contrato oficial. Recibiras un correo cuando este listo para que puedas continuar." },
                { icon: FileText, color: "bg-info/10 text-info", title: "Adjunta tus documentos", desc: "Ingresa a Mis solicitudes en el dashboard y adjunta los documentos requeridos para tu solicitud." },
                { icon: ClipboardCheck, color: "bg-primary/10 text-primary", title: "Revision por areas", desc: "Tres areas (Comunicacion, Legal y Logistica) revisaran tu documentacion y emitiran su veredicto." },
                { icon: Bell, color: "bg-secondary text-muted-foreground", title: "Resultado final", desc: "Recibiras un correo con el resultado. Si es rechazada, podras solicitar una re-evaluacion." },
              ].map((s, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.color}`}>
                      <s.icon className="h-4 w-4" />
                    </div>
                    {i < 4 && <div className="my-0.5 w-0.5 flex-1 bg-border" />}
                  </div>
                  <div className="pb-2">
                    <p className="text-xs font-semibold text-foreground">{s.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-secondary p-3 text-center">
              <p className="text-[11px] text-muted-foreground">
                Monitorea el estado en <span className="font-medium text-primary">Mis solicitudes</span> desde el menu lateral del dashboard.
              </p>
            </div>

            <Button className="w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90" onClick={() => setPostSubmitOpen(false)}>
              <span>Entendido</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BadgeEstadoStand({ estado }: { estado: string | null }) {
  const badge = estadoStandBadge(estado);
  return (
    <Badge className={`pointer-events-none text-[10px] ${badge?.clase ?? BADGE_STYLES.NEUTRAL}`}>
      <span>{badge?.texto ?? estado ?? "-"}</span>
    </Badge>
  );
}

/** Titulo del modal de detalle: "Detalles: <tipo> - <id del bloque>". */
function tituloDetalle(
  detalle: GessInfoFull | null,
  linkedMap: Map<string, GessInfoFull>,
  items: PlanoItem[],
  blockLabel: (type: PlanoItem["type"]) => { label: string; nombre: string },
): string {
  if (!detalle) return "Detalles";
  const bloqueId = [...linkedMap.entries()].find(([, v]) => v === detalle)?.[0];
  const item = items.find((it) => it.id === bloqueId);
  const label = item ? blockLabel(item.type).label : "";
  return `Detalles: ${label} - ${bloqueId ?? detalle.standCode}`;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: color }} />
      <span className="font-medium text-muted-foreground">{label}</span>
    </span>
  );
}
