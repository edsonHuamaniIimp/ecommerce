"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, Dialog, DialogContent, DialogHeader, DialogTitle, Badge } from "@nrivera-iimp/ui-kit-iimp";
import { FlaskConical, Plus, Save, Upload, Trash2, Box, FileJson, FileCode2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { planosService } from "@/lib/client/api/services/planos-service";
import type { PlanoDTO, PlanoListItemDTO, PlanoTipoDTO, PlanoBloqueDTO, PlanoFurnitureDTO } from "@/types/dto/planos/planos-response.dto";
import { MacroEditor } from "./macro-editor";
import { TIPOLOGIAS_STAND, TIPOLOGIAS_STAND_LABELS, TIPOS_PLANO, type TipoPlano } from "@/lib/shared/constants";

/* TIPOS LOCALES DE EDICION */

type EditTipo = Omit<PlanoTipoDTO, "id">;
type EditBloque = Omit<PlanoBloqueDTO, "id">;
type EditFurniture = Omit<PlanoFurnitureDTO, "id">;

const SNAP = 0.25;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

/** Sentinel del dropdown de secciones: crea una seccion nueva en el centro */
const OPCION_NUEVA_SECCION = "__nueva";

/* COMPONENTES 3D */

interface DragState {
  kind: "bloque" | "furniture";
  id: string; // bloqueId o refId
  offsetX: number;
  offsetZ: number;
}

function EditorBloque({ bloque, dim, selected, onPointerDown }: {
  bloque: EditBloque;
  dim: { w: number; d: number; h: number; color: string };
  selected: boolean;
  onPointerDown: (e: { stopPropagation: () => void; point: { x: number; z: number } }) => void;
}) {
  return (
    <mesh
      position={[bloque.x, dim.h / 2, bloque.z]}
      onPointerDown={onPointerDown}
    >
      <boxGeometry args={[dim.w - 0.15, dim.h + (selected ? 0.6 : 0), dim.d - 0.15]} />
      <meshStandardMaterial
        color={selected ? "#f59e0b" : dim.color}
        roughness={0.55}
        metalness={0.1}
        emissive={selected ? "#f59e0b" : "#000000"}
        emissiveIntensity={selected ? 0.35 : 0}
      />
    </mesh>
  );
}

function EditorKiosko({ item, selected, onPointerDown }: {
  item: EditFurniture;
  selected: boolean;
  onPointerDown: (e: { stopPropagation: () => void; point: { x: number; z: number } }) => void;
}) {
  return (
    <group position={[item.x, 0, item.z]} rotation={[0, item.rotY, 0]} onPointerDown={onPointerDown}>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[1.8, 0.1, 1.2]} />
        <meshStandardMaterial color={selected ? "#f59e0b" : "#8B5A2B"} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[2.0, 0.12, 1.4]} />
        <meshStandardMaterial color={selected ? "#f59e0b" : "#A0522D"} />
      </mesh>
      {[[-0.85, -0.55], [0.85, -0.55], [-0.85, 0.55], [0.85, 0.55]].map(([px = 0, pz = 0], i) => (
        <mesh key={i} position={[px, 0.78, pz]}>
          <cylinderGeometry args={[0.04, 0.04, 1.45, 8]} />
          <meshStandardMaterial color="#6B4226" />
        </mesh>
      ))}
    </group>
  );
}

function DragManager({ dragging, onMove, onEnd }: {
  dragging: DragState | null;
  onMove: (x: number, z: number) => void;
  onEnd: () => void;
}) {
  const { gl, camera, raycaster } = useThree();

  useEffect(() => {
    if (!dragging) return;
    // OrbitControls se desactiva via la prop `enabled` mientras dura el drag
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pointer = new THREE.Vector2();
    const point = new THREE.Vector3();

    const onPointerMove = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(ground, point)) {
        onMove(point.x, point.z);
      }
    };
    const onPointerUp = () => {
      onEnd();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [dragging, gl, camera, raycaster, onMove, onEnd]);

  return null;
}

/** Registra un conversor de coords de pantalla → coords mundo (plano XZ) para el drop desde la paleta */
function DropCoordinator({ register }: { register: (fn: (clientX: number, clientY: number) => { x: number; z: number } | null) => void }) {
  const { gl, camera, raycaster } = useThree();

  useEffect(() => {
    register((clientX, clientY) => {
      const rect = gl.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const point = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(ground, point)) {
        return { x: snap(point.x), z: snap(point.z) };
      }
      return null;
    });
  }, [gl, camera, raycaster, register]);

  return null;
}

function GridFloor({ minX, maxX, minZ, maxZ }: { minX: number; maxX: number; minZ: number; maxZ: number }) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(minX + maxX) / 2, -0.01, (minZ + maxZ) / 2]}>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color="#f1f5f9" />
    </mesh>
  );
}

/* MANAGER */

export function LaboratorioManager() {
  const [planos, setPlanos] = useState<PlanoListItemDTO[]>([]);
  const [planoSel, setPlanoSel] = useState<PlanoDTO | null>(null);
  const [tipos, setTipos] = useState<EditTipo[]>([]);
  const [bloques, setBloques] = useState<EditBloque[]>([]);
  const [furniture, setFurniture] = useState<EditFurniture[]>([]);
  const [selected, setSelected] = useState<{ kind: "bloque" | "furniture"; id: string } | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [nuevoPlanoOpen, setNuevoPlanoOpen] = useState(false);
  const [eliminarPlanoOpen, setEliminarPlanoOpen] = useState(false);
  const [nuevoTipoOpen, setNuevoTipoOpen] = useState(false);
  const [nuevoBloqueOpen, setNuevoBloqueOpen] = useState(false);
  const [tsExportOpen, setTsExportOpen] = useState(false);
  const [tsFiles, setTsFiles] = useState<{ bloques: string; tipos: string; construccion: string; index: string; registrySnippet: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropConverterRef = useRef<((clientX: number, clientY: number) => { x: number; z: number } | null) | null>(null);

  

  const loadPlanos = useCallback(async () => {
    try {
      const data = await planosService.listar();
      setPlanos(data);
      return data;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al listar planos");
      return [];
    }
  }, []);

  const loadDetalle = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const plano = await planosService.detalle(id);
      setPlanoSel(plano);
      setTipos(plano.tipos.map(({ codigo, label, nombre, w, d, h, color }) => ({ codigo, label, nombre, w, d, h, color })));
      setBloques(plano.bloques.map(({ bloqueId, tipoCodigo, tipologia, x, z, rotY, orden, flgActivo }) => ({ bloqueId, tipoCodigo, tipologia, x, z, rotY, orden, flgActivo })));
      setFurniture(plano.furniture.map(({ refId, tipo, x, z, rotY, config }) => ({ refId, tipo, x, z, rotY, config })));
      setSelected(null);
      setDirty(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar plano");
    }
    setLoadingDetail(false);
  }, []);

  useEffect(() => {
    (async () => {
      const data = await loadPlanos();
      const first = data[0];
      if (first) await loadDetalle(first.id);
    })();
  }, [loadPlanos, loadDetalle]);

  

  const bounds = useMemo(() => {
    if (bloques.length === 0) return { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const b of bloques) {
      const dim = tipos.find((t) => t.codigo === b.tipoCodigo);
      const w = dim?.w ?? 2, d = dim?.d ?? 2;
      minX = Math.min(minX, b.x - w / 2); maxX = Math.max(maxX, b.x + w / 2);
      minZ = Math.min(minZ, b.z - d / 2); maxZ = Math.max(maxZ, b.z + d / 2);
    }
    return { minX: minX - 6, maxX: maxX + 6, minZ: minZ - 6, maxZ: maxZ + 6 };
  }, [bloques, tipos]);

  const camPos = useMemo(() => {
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const s = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
    return { position: [cx, s * 0.85, cz + s * 0.5] as [number, number, number], target: [cx, 0, cz] as [number, number, number] };
  }, [bounds]);

  

  const startDrag = (kind: "bloque" | "furniture", id: string, pointX: number, pointZ: number) => {
    const item = kind === "bloque" ? bloques.find((b) => b.bloqueId === id) : furniture.find((f) => f.refId === id);
    if (!item) return;
    setSelected({ kind, id });
    setDragging({ kind, id, offsetX: item.x - pointX, offsetZ: item.z - pointZ });
  };

  const moveDrag = (pointX: number, pointZ: number) => {
    if (!dragging) return;
    const nx = snap(pointX + dragging.offsetX);
    const nz = snap(pointZ + dragging.offsetZ);
    if (dragging.kind === "bloque") {
      setBloques((prev) => prev.map((b) => (b.bloqueId === dragging.id ? { ...b, x: nx, z: nz } : b)));
    } else {
      setFurniture((prev) => prev.map((f) => (f.refId === dragging.id ? { ...f, x: nx, z: nz } : f)));
    }
    setDirty(true);
  };

  const endDrag = () => setDragging(null);

  // Drag desde paleta o dialogo
  const addBlockAt = (tipoCodigo: string, x: number, z: number) => {
    let n = bloques.length + 1;
    let candidate = `BLOQUE-${String(n).padStart(2, "0")}`;
    while (bloques.some((b) => b.bloqueId === candidate)) {
      n++;
      candidate = `BLOQUE-${String(n).padStart(2, "0")}`;
    }
    const nuevo: EditBloque = { bloqueId: candidate, tipoCodigo, tipologia: TIPOLOGIAS_STAND.SIMPLE, x, z, rotY: 0, orden: bloques.length, flgActivo: true };
    setBloques((prev) => [...prev, nuevo]);
    setSelected({ kind: "bloque", id: candidate });
    setDirty(true);
    toast.success(`Bloque ${candidate} creado — arrastralo para posicionarlo`);
  };

  

  const bloqueSel = selected?.kind === "bloque" ? bloques.find((b) => b.bloqueId === selected.id) : null;

  const updateBloque = (patch: Partial<EditBloque>) => {
    if (!bloqueSel) return;
    setBloques((prev) => prev.map((b) => (b.bloqueId === bloqueSel.bloqueId ? { ...b, ...patch } : b)));
    setDirty(true);
  };

  const deleteBloque = () => {
    if (!bloqueSel) return;
    setBloques((prev) => prev.filter((b) => b.bloqueId !== bloqueSel.bloqueId));
    setSelected(null);
    setDirty(true);
    toast.success(`Bloque ${bloqueSel.bloqueId} eliminado (guardar para aplicar)`);
  };

  

  const handleSave = async () => {
    if (!planoSel) return;
    setSaving(true);
    try {
      await planosService.guardarLayout({
        id: planoSel.id,
        tipos,
        bloques: bloques.map((b, i) => ({ ...b, orden: i })),
        furniture,
      });
      setDirty(false);
      toast.success("Mapa guardado correctamente");
      loadDetalle(planoSel.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    }
    setSaving(false);
  };

  const handleEliminarPlano = async () => {
    if (!planoSel) return;
    try {
      await planosService.eliminar(planoSel.id);
      toast.success(`Mapa "${planoSel.nombre}" eliminado`);
      setEliminarPlanoOpen(false);
      setPlanoSel(null);
      const lista = await loadPlanos();
      const first = lista[0];
      if (first) await loadDetalle(first.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  const handleExportJson = async () => {
    if (!planoSel) return;
    try {
      const data = await planosService.exportar(planoSel.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `plano-${data.codigo}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("JSON exportado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al exportar");
    }
  };

  const handleExportTs = async () => {
    if (!planoSel) return;
    try {
      const files = await planosService.exportarTs(planoSel.id);
      setTsFiles(files);
      setTsExportOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al exportar TS");
    }
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const plano = await planosService.importar(json);
      toast.success(`Mapa "${plano.nombre}" importado`);
      await loadPlanos();
      await loadDetalle(plano.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al importar");
    }
  };

  

  return (
    <div className="flex flex-1 flex-col min-h-0 gap-3">
      {/* TOOLBAR */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-violet-600" />
          <h1 className="text-lg font-semibold text-slate-800">Laboratorio 3D</h1>
        </div>
        <Select value={planoSel?.id ?? ""} onValueChange={(v) => loadDetalle(v)}>
          <SelectTrigger className="w-[260px] h-8 text-xs"><SelectValue placeholder="Seleccionar mapa" /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mapas 3D — pabellones</SelectLabel>
              {planos.filter((p) => p.tipo !== TIPOS_PLANO.MACRO).map((p) => (
                <SelectItem key={p.id} value={p.id}><span>{p.nombre} ({p.bloquesCount} bloques)</span></SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mapas macro</SelectLabel>
              {planos.filter((p) => p.tipo === TIPOS_PLANO.MACRO).map((p) => (
                <SelectItem key={p.id} value={p.id}><span>{p.nombre} — agrupa pabellones</span></SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="rounded-full h-8 text-xs" onClick={() => setNuevoPlanoOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Nuevo mapa
        </Button>
        <Button size="sm" variant="outline" className="rounded-full h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200" disabled={!planoSel} title="Eliminar mapa"
          onClick={() => setEliminarPlanoOpen(true)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="rounded-full h-8 text-xs" disabled={!planoSel || planoSel.tipo === TIPOS_PLANO.MACRO} onClick={() => setNuevoBloqueOpen(true)} title={planoSel?.tipo === TIPOS_PLANO.MACRO ? "Los mapas macro usan secciones, no bloques" : undefined}>
            <Box className="h-3.5 w-3.5 mr-1" /> Agregar bloque
          </Button>
          <Button size="sm" variant="outline" className="rounded-full h-8 text-xs" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1" /> Importar
          </Button>
          <Button size="sm" variant="outline" className="rounded-full h-8 text-xs" disabled={!planoSel} onClick={handleExportJson}>
            <FileJson className="h-3.5 w-3.5 mr-1" /> Exportar JSON
          </Button>
          <Button size="sm" variant="outline" className="rounded-full h-8 text-xs" disabled={!planoSel} onClick={handleExportTs}>
            <FileCode2 className="h-3.5 w-3.5 mr-1" /> Exportar TS
          </Button>
          <Button size="sm" className="rounded-full h-8 text-xs bg-violet-600 hover:bg-violet-700" disabled={!planoSel || !dirty || saving} onClick={handleSave}>
            <Save className="h-3.5 w-3.5 mr-1" /> {saving ? "Guardando..." : dirty ? "Guardar *" : "Guardar"}
          </Button>
        </div>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ""; }} />
      </div>

      {/* CANVAS + PANEL (3D) o EDITOR MACRO segun tipo de plano */}
      {planoSel?.tipo === TIPOS_PLANO.MACRO ? (
        <MacroEditor
          plano={planoSel}
          planos={planos}
          onChange={(p) => setPlanoSel(p)}
        />
      ) : (
      <div className="flex min-h-0 gap-3 h-[calc(100vh-10rem)]">
        <div
          className="flex-1 min-h-0 rounded-xl border border-slate-200 bg-white overflow-hidden relative"
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
          onDrop={(e) => {
            e.preventDefault();
            const tipoCodigo = e.dataTransfer.getData("application/x-plano-tipo");
            if (!tipoCodigo || !planoSel) return;
            const pos = dropConverterRef.current?.(e.clientX, e.clientY) ?? { x: 0, z: 0 };
            addBlockAt(tipoCodigo, pos.x, pos.z);
          }}
        >
          {loadingDetail ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Cargando mapa...</div>
          ) : (
            <Canvas shadows camera={{ position: camPos.position, fov: 45 }} key={planoSel?.id ?? "empty"}>
              <color attach="background" args={["#e2e8f0"]} />
              <ambientLight intensity={0.6} />
              <directionalLight position={[15, 25, 10]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} />
              <GridFloor {...bounds} />
              <DropCoordinator register={(fn) => { dropConverterRef.current = fn; }} />
              {bloques.map((b) => {
                const dim = tipos.find((t) => t.codigo === b.tipoCodigo);
                if (!dim) return null;
                return (
                  <EditorBloque
                    key={b.bloqueId}
                    bloque={b}
                    dim={dim}
                    selected={selected?.kind === "bloque" && selected.id === b.bloqueId}
                    onPointerDown={(e) => { e.stopPropagation(); startDrag("bloque", b.bloqueId, e.point.x, e.point.z); }}
                  />
                );
              })}
              {furniture.map((f) => (
                <EditorKiosko
                  key={f.refId}
                  item={f}
                  selected={selected?.kind === "furniture" && selected.id === f.refId}
                  onPointerDown={(e) => { e.stopPropagation(); startDrag("furniture", f.refId, e.point.x, e.point.z); }}
                />
              ))}
              <DragManager dragging={dragging} onMove={moveDrag} onEnd={endDrag} />
              <OrbitControls makeDefault enabled={!dragging} target={camPos.target} maxPolarAngle={Math.PI / 2.15} minDistance={5} maxDistance={150} />
            </Canvas>
          )}
          <div className="absolute left-2 top-2 rounded-md bg-white/80 backdrop-blur px-2 py-1 text-[10px] text-slate-500 pointer-events-none">
            Arrastra un tipo desde el panel para crear un bloque — arrastra bloques para moverlos
          </div>
        </div>

        {/* PANEL DERECHO */}
        <div className="w-[280px] shrink-0 flex flex-col gap-3 overflow-y-auto">
          {/* Propiedades del bloque seleccionado */}
          {bloqueSel ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700">Bloque seleccionado</p>
                <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-200">{bloqueSel.tipoCodigo}</Badge>
              </div>
              <div>
                <Label className="text-[10px]">ID del bloque</Label>
                <Input className="h-7 text-xs font-mono" value={bloqueSel.bloqueId}
                  onChange={(e) => {
                    const nuevoId = e.target.value;
                    setBloques((prev) => prev.map((b) => (b.bloqueId === bloqueSel.bloqueId ? { ...b, bloqueId: nuevoId } : b)));
                    setSelected({ kind: "bloque", id: nuevoId });
                    setDirty(true);
                  }} />
              </div>
              <div>
                <Label className="text-[10px]">Tipo</Label>
                <Select value={bloqueSel.tipoCodigo} onValueChange={(v) => updateBloque({ tipoCodigo: v })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tipos.map((t) => (
                      <SelectItem key={t.codigo} value={t.codigo}><span>{t.label} — {t.nombre}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Tipologia (expediente tecnico)</Label>
                <Select value={bloqueSel.tipologia ?? TIPOLOGIAS_STAND.SIMPLE} onValueChange={(v) => updateBloque({ tipologia: v })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(TIPOLOGIAS_STAND).map((t) => {
                      const lbl = TIPOLOGIAS_STAND_LABELS[t];
                      if (!lbl) return null;
                      return (
                        <SelectItem key={t} value={t}><span>[{lbl.label}] {lbl.nombre}</span></SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[9px] text-slate-400 mt-0.5">Determina la matriz documental en el Sistema de Montaje</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">X</Label>
                  <Input className="h-7 text-xs" type="number" step={SNAP} value={bloqueSel.x}
                    onChange={(e) => updateBloque({ x: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-[10px]">Z</Label>
                  <Input className="h-7 text-xs" type="number" step={SNAP} value={bloqueSel.z}
                    onChange={(e) => updateBloque({ z: Number(e.target.value) })} />
                </div>
              </div>
              <Button size="sm" variant="destructive" className="w-full rounded-full h-7 text-xs" onClick={deleteBloque}>
                <Trash2 className="h-3 w-3 mr-1" /> Eliminar bloque
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              <p className="text-[11px] text-slate-400">Selecciona un bloque en el canvas para editarlo</p>
            </div>
          )}

          {/* Tipos de bloque */}
          <div className="rounded-xl border border-slate-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">Tipos de bloque ({tipos.length})</p>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setNuevoTipoOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-[10px] text-slate-400">Arrastra un tipo al mapa para crear un bloque</p>
            <div className="space-y-1">
              {tipos.map((t) => (
                <div
                  key={t.codigo}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-plano-tipo", t.codigo);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  title="Arrastra al mapa para crear un bloque"
                  className="flex items-center gap-2 rounded border border-slate-100 bg-white px-2 py-1.5 text-[11px] cursor-grab active:cursor-grabbing hover:border-violet-300 hover:bg-violet-50/50 hover:shadow-sm transition-all select-none"
                >
                  <span className="h-3 w-3 rounded-sm border shrink-0" style={{ backgroundColor: t.color }} />
                  <span className="font-mono font-medium">{t.codigo}</span>
                  <span className="text-slate-400 truncate flex-1">{t.nombre}</span>
                  <span className="text-[9px] text-slate-400">{t.w}x{t.d}x{t.h}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="rounded-xl border border-slate-200 p-3 text-[10px] text-slate-500 space-y-1">
            <p><span className="font-medium">{bloques.length}</span> bloques, <span className="font-medium">{furniture.length}</span> decoraciones</p>
            {dirty && <p className="text-amber-600 font-medium">Cambios sin guardar — presiona Guardar</p>}
          </div>

          {/* Pertenencia a macro (solo planos simples) */}
          {planoSel?.tipo === TIPOS_PLANO.SIMPLE && (
            <PertenenciaMacro planoId={planoSel.id} planos={planos} />
          )}
        </div>
      </div>
      )}

      {/* DIALOG: Nuevo plano */}
      <NuevoPlanoDialog open={nuevoPlanoOpen} onClose={() => setNuevoPlanoOpen(false)} onCreated={async (id) => { setNuevoPlanoOpen(false); await loadPlanos(); await loadDetalle(id); }} />

      {/* DIALOG: Eliminar plano */}
      <Dialog open={eliminarPlanoOpen} onOpenChange={setEliminarPlanoOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle><span>Eliminar mapa</span></DialogTitle></DialogHeader>
          {planoSel && (
            <div className="space-y-3 text-xs">
              <p className="text-sm text-slate-600">
                Estas seguro de eliminar <strong>{planoSel.nombre}</strong> ({planoSel.codigo})?
              </p>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[11px] text-red-700 space-y-1">
                <p>Se eliminara: {planoSel.tipo === TIPOS_PLANO.MACRO ? `el mapa macro con ${planoSel.secciones.length} secciones` : `el layout con ${planoSel.bloques.length} bloques`}.</p>
                {planoSel.tipo !== TIPOS_PLANO.MACRO && <p>Si pertenece a un macro, su vinculo con las secciones se desasignara (las secciones se conservan sin plano).</p>}
                <p>No se puede eliminar si esta asignado a un evento.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 rounded-full text-xs" onClick={() => setEliminarPlanoOpen(false)}>Cancelar</Button>
                <Button variant="destructive" size="sm" className="flex-1 rounded-full text-xs" onClick={handleEliminarPlano}>
                  <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG: Nuevo tipo */}
      <NuevoTipoDialog open={nuevoTipoOpen} onClose={() => setNuevoTipoOpen(false)} onAdd={(t) => { setTipos((prev) => [...prev, t]); setDirty(true); setNuevoTipoOpen(false); }} />

      {/* DIALOG: Nuevo bloque */}
      <NuevoBloqueDialog open={nuevoBloqueOpen} onClose={() => setNuevoBloqueOpen(false)} tipos={tipos} bloques={bloques}
        onCrearTipo={() => setNuevoTipoOpen(true)}
        onAdd={(b) => { setBloques((prev) => [...prev, b]); setSelected({ kind: "bloque", id: b.bloqueId }); setDirty(true); setNuevoBloqueOpen(false); }} />

      {/* DIALOG: Export TS */}
      <Dialog open={tsExportOpen} onOpenChange={setTsExportOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle><span>Archivos TypeScript — src/lib/shared/planos/{planoSel?.codigo}/</span></DialogTitle></DialogHeader>
          {tsFiles && (
            <div className="space-y-3 text-xs">
              {(["bloques", "tipos", "construccion", "index"] as const).map((name) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-mono font-semibold text-slate-700">{name}.ts</p>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] rounded-full" onClick={() => {
                      const blob = new Blob([tsFiles[name]], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = `${name}.ts`; a.click();
                      URL.revokeObjectURL(url);
                    }}>Descargar</Button>
                  </div>
                  <pre className="rounded-md bg-slate-950 text-slate-200 p-3 overflow-x-auto max-h-48 overflow-y-auto text-[10px]">{tsFiles[name]}</pre>
                </div>
              ))}
              <div>
                <p className="font-mono font-semibold text-slate-700 mb-1">Snippet para registry.ts</p>
                <pre className="rounded-md bg-slate-950 text-emerald-300 p-3 overflow-x-auto text-[10px]">{tsFiles.registrySnippet}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* DIALOGS */

/* PERTENENCIA A MACRO */

function PertenenciaMacro({ planoId, planos }: { planoId: string; planos: PlanoListItemDTO[] }) {
  const [macros, setMacros] = useState<Array<{ id: string; codigo: string; nombre: string }>>([]);
  const [cargado, setCargado] = useState(false);
  const [macroSel, setMacroSel] = useState("");
  const [seccionSel, setSeccionSel] = useState("");
  const [seccionesLibres, setSeccionesLibres] = useState<Array<{ codigo: string; nombre: string }>>([]);
  const [trabajando, setTrabajando] = useState(false);

  const macrosDisponibles = planos.filter((p) => p.tipo === TIPOS_PLANO.MACRO && !macros.some((m) => m.id === p.id));

  const cargar = useCallback(async () => {
    try {
      const data = await planosService.macrosDePlano(planoId);
      setMacros(data);
    } catch { /* ignore */ }
    setCargado(true);
  }, [planoId]);

  useEffect(() => {
    (async () => {
      setCargado(false);
      await cargar();
    })();
  }, [cargar]);

  useEffect(() => {
    (async () => {
      setSeccionSel("");
      setSeccionesLibres([]);
      if (!macroSel) return;
      try {
        const macro = await planosService.detalle(macroSel);
        setSeccionesLibres(
          macro.secciones
            .filter((s) => !s.planoHijoId)
            .map((s) => ({ codigo: s.codigo, nombre: s.nombre })),
        );
      } catch {
        setSeccionesLibres([]);
      }
    })();
  }, [macroSel]);

  const handleAsignar = async () => {
    if (!macroSel) return;
    setTrabajando(true);
    try {
      if (seccionSel && seccionSel !== OPCION_NUEVA_SECCION) {
        const macro = await planosService.detalle(macroSel);
        await planosService.guardarSecciones({
          id: macroSel,
          secciones: macro.secciones.map((s) => ({
            codigo: s.codigo,
            nombre: s.nombre,
            x: s.x,
            y: s.y,
            w: s.w,
            h: s.h,
            rotacion: s.rotacion,
            color: s.color,
            planoHijoId: s.codigo === seccionSel ? planoId : s.planoHijoId,
            orden: s.orden,
          })),
        });
        toast.success("Asignado a la seccion existente del macro");
      } else {
        await planosService.asignarAMacro(macroSel, planoId);
        toast.success("Pabellon asignado al macro — ajusta su posicion en el editor del macro");
      }
      setMacroSel("");
      setSeccionSel("");
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al asignar");
    }
    setTrabajando(false);
  };

  const handleQuitar = async () => {
    setTrabajando(true);
    try {
      await planosService.quitarDeMacros(planoId);
      toast.success("Quitado del macro");
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al quitar");
    }
    setTrabajando(false);
  };

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3 space-y-2">
      <p className="text-xs font-semibold text-slate-700">Macro al que pertenece</p>
      {!cargado ? (
        <p className="text-[10px] text-slate-400">Cargando...</p>
      ) : macros.length === 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500">Este plano 3D aun no esta asignado a ningun macro.</p>
          <Select value={macroSel} onValueChange={setMacroSel}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Seleccionar macro" /></SelectTrigger>
            <SelectContent>
              {macrosDisponibles.length === 0 ? (
                <SelectItem value="__none" disabled><span>No hay macros disponibles</span></SelectItem>
              ) : macrosDisponibles.map((m) => (
                <SelectItem key={m.id} value={m.id}><span>{m.nombre} ({m.codigo})</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
          {macroSel && (
            <Select value={seccionSel} onValueChange={setSeccionSel}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Nueva seccion (default)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={OPCION_NUEVA_SECCION}><span>— Nueva seccion (en el centro) —</span></SelectItem>
                {seccionesLibres.map((s) => (
                  <SelectItem key={s.codigo} value={s.codigo}><span>{s.codigo} — {s.nombre}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" className="w-full rounded-full h-7 text-xs bg-violet-600 hover:bg-violet-700" disabled={!macroSel || trabajando} onClick={handleAsignar}>
            {seccionSel && seccionSel !== OPCION_NUEVA_SECCION ? "Asignar a seccion existente" : "Asignar como nueva seccion"}
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {macros.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded border border-violet-200 bg-white px-2 py-1.5">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-700 truncate">{m.nombre}</p>
                <p className="text-[9px] text-slate-400 font-mono">{m.codigo}</p>
              </div>
                <Button size="sm" variant="outline" className="h-6 text-[10px] rounded-full" disabled={trabajando} onClick={() => handleQuitar()}>
                Quitar
              </Button>
            </div>
          ))}
        </div>
      )}
      <p className="text-[9px] text-slate-400">Un plano 3D solo puede pertenecer a un macro a la vez.</p>
    </div>
  );
}

function NuevoPlanoDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<TipoPlano>(TIPOS_PLANO.SIMPLE);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!codigo.trim() || !nombre.trim()) { toast.error("Codigo y nombre requeridos"); return; }
    setCreating(true);
    try {
      const plano = await planosService.crear({ codigo: codigo.trim().toLowerCase(), nombre: nombre.trim(), descripcion: descripcion.trim() || null, tipo });
      toast.success(`Mapa "${plano.nombre}" creado${tipo === TIPOS_PLANO.MACRO ? " — sube la imagen de pabellones" : ""}`);
      setCodigo(""); setNombre(""); setDescripcion(""); setTipo(TIPOS_PLANO.SIMPLE);
      onCreated(plano.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear");
    }
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle><span>Nuevo mapa 3D</span></DialogTitle></DialogHeader>
        <div className="space-y-3 text-xs">
          <div>
            <Label>Codigo (identificador unico)</Label>
            <Input className="text-xs font-mono" placeholder="perumin" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            <p className="text-[10px] text-slate-400 mt-0.5">Minusculas, numeros y guiones. Se guarda en evento_metadata.plano</p>
          </div>
          <div>
            <Label>Nombre</Label>
            <Input className="text-xs" placeholder="PERUMIN" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <Label>Tipo de mapa</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoPlano)}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TIPOS_PLANO.SIMPLE}><span>Simple — un plano 3D con bloques</span></SelectItem>
                <SelectItem value={TIPOS_PLANO.MACRO}><span>Macro — mapa de pabellones con secciones a planos 3D</span></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descripcion</Label>
            <Input className="text-xs" placeholder="Opcional" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <Button className="w-full rounded-full" disabled={creating} onClick={handleCreate}>
            {creating ? "Creando..." : "Crear mapa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NuevoTipoDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (t: EditTipo) => void }) {
  const [form, setForm] = useState<EditTipo>({ codigo: "", label: "", nombre: "", w: 2, d: 2, h: 2.4, color: "#32CD32" });

  const handleAdd = () => {
    if (!form.codigo.trim() || !form.nombre.trim()) { toast.error("Codigo y nombre requeridos"); return; }
    onAdd({ ...form, codigo: form.codigo.trim().toUpperCase(), label: form.label.trim() || form.codigo.trim().toUpperCase() });
    setForm({ codigo: "", label: "", nombre: "", w: 2, d: 2, h: 2.4, color: "#32CD32" });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle><span>Nuevo tipo de bloque</span></DialogTitle></DialogHeader>
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Codigo</Label>
              <Input className="text-xs font-mono" placeholder="VIP" value={form.codigo} onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value }))} />
            </div>
            <div>
              <Label>Label</Label>
              <Input className="text-xs font-mono" placeholder="VIP" value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Nombre</Label>
            <Input className="text-xs" placeholder="Stand VIP" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>W (ancho)</Label><Input className="text-xs" type="number" step={0.1} value={form.w} onChange={(e) => setForm((p) => ({ ...p, w: Number(e.target.value) }))} /></div>
            <div><Label>D (fondo)</Label><Input className="text-xs" type="number" step={0.1} value={form.d} onChange={(e) => setForm((p) => ({ ...p, d: Number(e.target.value) }))} /></div>
            <div><Label>H (alto)</Label><Input className="text-xs" type="number" step={0.1} value={form.h} onChange={(e) => setForm((p) => ({ ...p, h: Number(e.target.value) }))} /></div>
          </div>
          <div>
            <Label>Color</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} className="h-8 w-12 cursor-pointer rounded border" />
              <Input className="text-xs font-mono flex-1" value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} />
            </div>
          </div>
          <Button className="w-full rounded-full" onClick={handleAdd}>Agregar tipo</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NuevoBloqueDialog({ open, onClose, tipos, bloques, onAdd, onCrearTipo }: {
  open: boolean; onClose: () => void; tipos: EditTipo[]; bloques: EditBloque[]; onAdd: (b: EditBloque) => void; onCrearTipo: () => void;
}) {
  const [bloqueId, setBloqueId] = useState("");
  const [tipoCodigo, setTipoCodigo] = useState("");
  const [tipologia, setTipologia] = useState<string>(TIPOLOGIAS_STAND.SIMPLE);

  // Al abrir: resetear seleccion, auto-seleccionar primer tipo y sugerir siguiente ID disponible
  useEffect(() => {
    (async () => {
      if (!open) return;
      setTipoCodigo(tipos[0]?.codigo ?? "");
      let n = bloques.length + 1;
      let candidate = `BLOQUE-${String(n).padStart(2, "0")}`;
      while (bloques.some((b) => b.bloqueId === candidate)) {
        n++;
        candidate = `BLOQUE-${String(n).padStart(2, "0")}`;
      }
      setBloqueId(candidate);
    })();
  }, [open, tipos, bloques]);

  const handleAdd = () => {
    const id = bloqueId.trim().toUpperCase();
    if (!id) { toast.error("ID requerido"); return; }
    if (bloques.some((b) => b.bloqueId === id)) { toast.error("Ese ID ya existe"); return; }
    if (!tipoCodigo) { toast.error("Selecciona un tipo"); return; }
    onAdd({ bloqueId: id, tipoCodigo, tipologia, x: 0, z: 0, rotY: 0, orden: bloques.length, flgActivo: true });
    setBloqueId(""); setTipoCodigo(""); setTipologia(TIPOLOGIAS_STAND.SIMPLE);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle><span>Agregar bloque</span></DialogTitle></DialogHeader>
        <div className="space-y-3 text-xs">
          <div>
            <Label>ID del bloque</Label>
            <Input className="text-xs font-mono" placeholder="BLOQUE-A1" value={bloqueId} onChange={(e) => setBloqueId(e.target.value)} />
            <p className="text-[10px] text-slate-400 mt-0.5">Este ID se usa para vincular con gess_stand.bloqueId</p>
          </div>
          <div>
            <Label>Tipo</Label>
            {tipos.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center space-y-2">
                <p className="text-[11px] text-amber-700">Este mapa no tiene tipos de bloque.</p>
                <Button size="sm" variant="outline" className="h-7 text-xs rounded-full" onClick={onCrearTipo}>
                  <Plus className="h-3 w-3 mr-1" /> Crear tipo de bloque
                </Button>
              </div>
            ) : (
              <Select value={tipoCodigo} onValueChange={setTipoCodigo}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => (
                    <SelectItem key={t.codigo} value={t.codigo}><span>{t.label} — {t.nombre}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label>Tipologia (expediente tecnico)</Label>
            <Select value={tipologia} onValueChange={setTipologia}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.values(TIPOLOGIAS_STAND).map((t) => {
                  const lbl = TIPOLOGIAS_STAND_LABELS[t];
                  if (!lbl) return null;
                  return (
                    <SelectItem key={t} value={t}><span>[{lbl.label}] {lbl.nombre}</span></SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full rounded-full" onClick={handleAdd} disabled={tipos.length === 0}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Agregar en el centro (0, 0)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
