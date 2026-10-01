"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, Dialog, DialogContent, DialogHeader, DialogTitle, Badge, Checkbox } from "@nrivera-iimp/ui-kit-iimp";
import { FlaskConical, Plus, Save, Upload, Trash2, Box, FileJson, FileCode2, RotateCcw, RotateCw, RefreshCw, Pencil } from "lucide-react";
import { toast } from "sonner";
import { planosService } from "@/lib/client/api/services/planos-service";
import type { PlanoDTO, PlanoListItemDTO, PlanoTipoDTO, PlanoBloqueDTO, PlanoFurnitureDTO, PlanoTipoSugeridoDTO } from "@/types/dto/planos/planos-response.dto";
import { codigoPlanoUtils } from "@/lib/shared/utils/codigo-plano";
import { furnitureUtils } from "@/lib/shared/utils/furniture";
import { planoEditorUtils, type PuntoAlineable } from "@/lib/shared/utils/plano-editor";
import { FurnitureRenderer } from "@/components/plano/plano-3d-componentes";
import { useConfirm } from "@/hooks/use-confirm";
import { MacroEditor } from "./macro-editor";
import { AMBITO_TIPO_BLOQUE_LABELS, AMBITOS_TIPO_BLOQUE, EDITOR_PLANO, PERSONA_COLORES_CABEZA, TIPOLOGIAS_STAND, TIPOS_FURNITURE, TIPOS_PLANO, FURNITURE_LABELS, type PersonaFurnitureConfig, type PisoFurnitureConfig, type TipoPlano } from "@/lib/shared/constants";

/* TIPOS LOCALES DE EDICION */

type EditTipo = Omit<PlanoTipoDTO, "id">;
type EditBloque = Omit<PlanoBloqueDTO, "id">;
type EditFurniture = Omit<PlanoFurnitureDTO, "id">;

const snap = (v: number) => Math.round(v / EDITOR_PLANO.SNAP_POSICION) * EDITOR_PLANO.SNAP_POSICION;

/** Sentinel del dropdown de secciones: crea una seccion nueva en el centro */
const OPCION_NUEVA_SECCION = "__nueva";

/* COMPONENTES 3D */

type ObjetoKind = "bloque" | "furniture";

type DragState =
  | { mode: "move"; kind: ObjetoKind; id: string; offsetX: number; offsetZ: number }
  | { mode: "rotate"; kind: ObjetoKind; id: string; centerX: number; centerZ: number; inicioRad: number; inicioAngulo: number };

function EditorBloque({ bloque, dim, selected, inactive, onPointerDown }: {
  bloque: EditBloque;
  dim: { w: number; d: number; h: number; color: string };
  selected: boolean;
  inactive?: boolean;
  onPointerDown: (e: { stopPropagation: () => void; point: { x: number; z: number } }) => void;
}) {
  return (
    <mesh
      position={[bloque.x, dim.h / 2, bloque.z]}
      rotation={[0, bloque.rotY ?? 0, 0]}
      onPointerDown={onPointerDown}
    >
      <boxGeometry args={[dim.w - 0.15, dim.h + (selected ? 0.6 : 0), dim.d - 0.15]} />
      <meshStandardMaterial
        color={selected ? "#f59e0b" : dim.color}
        roughness={0.55}
        metalness={0.1}
        emissive={selected ? "#f59e0b" : "#000000"}
        emissiveIntensity={selected ? 0.35 : 0}
        transparent={inactive}
        opacity={inactive ? 0.35 : 1}
      />
    </mesh>
  );
}

function EditorFurniture({ item, selected, inactive, onPointerDown }: {
  item: EditFurniture;
  selected: boolean;
  inactive?: boolean;
  onPointerDown: (e: { stopPropagation: () => void; point: { x: number; z: number } }) => void;
}) {
  const huella = furnitureUtils.huella(item.tipo, item.config);
  return (
    <group onPointerDown={onPointerDown}>
      <group position={[item.x, 0, item.z]} rotation={[0, item.rotY, 0]}>
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[huella.w, huella.d]} />
          <meshBasicMaterial color={selected ? "#f59e0b" : inactive ? "#ef4444" : "#94a3b8"} transparent opacity={selected ? 0.45 : inactive ? 0.3 : 0.15} depthWrite={false} />
        </mesh>
      </group>
      <FurnitureRenderer item={{ id: item.refId, type: item.tipo, x: item.x, z: item.z, rotY: item.rotY, config: item.config }} />
    </group>
  );
}

function DragManager({ dragging, onMove, onEnd }: {
  dragging: DragState | null;
  onMove: (x: number, z: number, shift: boolean) => void;
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
        onMove(point.x, point.z, e.shiftKey);
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

function GridFloor({ minX, maxX, minZ, maxZ, mostrarGuias }: { minX: number; maxX: number; minZ: number; maxZ: number; mostrarGuias: boolean }) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const tamano = Math.max(20, Math.ceil(Math.max(w, d) / 5) * 5);
  const divisionesFinas = Math.min(Math.round(tamano), 200);
  const divisionesGruesas = Math.max(2, Math.round(tamano / 5));
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.01, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>
      {mostrarGuias && (
        <>
          <gridHelper args={[tamano, divisionesFinas, "#e2e8f0", "#e2e8f0"]} position={[cx, 0.002, cz]} />
          <gridHelper args={[tamano, divisionesGruesas, "#cbd5e1", "#cbd5e1"]} position={[cx, 0.004, cz]} />
          {/* Eje X (z = 0) */}
          <mesh position={[cx, 0.02, 0]}>
            <boxGeometry args={[w + 2, 0.01, 0.05]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
          {/* Eje Z (x = 0) */}
          <mesh position={[0, 0.02, cz]}>
            <boxGeometry args={[0.05, 0.01, d + 2]} />
            <meshBasicMaterial color="#3b82f6" />
          </mesh>
        </>
      )}
    </group>
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
  const [guias, setGuias] = useState<{ x: number | null; z: number | null }>({ x: null, z: null });
  const [mostrarGuias, setMostrarGuias] = useState(true);
  const [mostrarEliminados, setMostrarEliminados] = useState(false);
  const { confirm, confirmDialog } = useConfirm();
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [nuevoPlanoOpen, setNuevoPlanoOpen] = useState(false);
  const [nuevoPlanoKey, setNuevoPlanoKey] = useState(0);
  const [nuevoPlanoCodigo, setNuevoPlanoCodigo] = useState("");
  const [nuevoTipoOpen, setNuevoTipoOpen] = useState(false);
  const [nuevoTipoKey, setNuevoTipoKey] = useState(0);
  const [ultimoTipoCreado, setUltimoTipoCreado] = useState<string | null>(null);
  const [tipoEditando, setTipoEditando] = useState<EditTipo | null>(null);
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
      setTipos(plano.tipos.map(({ codigo, label, nombre, w, d, h, color, ambito, flgActivo }) => ({ codigo, label, nombre, w, d, h, color, ambito, flgActivo })));
      setBloques(plano.bloques.map(({ bloqueId, tipoCodigo, tipologia, x, z, rotY, orden, flgActivo }) => ({ bloqueId, tipoCodigo, tipologia, x, z, rotY, orden, flgActivo })));
      setFurniture(plano.furniture.map(({ refId, tipo, x, z, rotY, config, flgActivo }) => ({ refId, tipo, x, z, rotY, config, flgActivo })));
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

  /** Abre el dialogo con `key` nueva para que el formulario se remonte limpio. */
  const abrirNuevoPlano = useCallback(() => {
    setNuevoPlanoCodigo(codigoPlanoUtils.generar(planos.map((p) => p.codigo)));
    setNuevoPlanoKey((k) => k + 1);
    setNuevoPlanoOpen(true);
  }, [planos]);

  const abrirNuevoTipo = useCallback(() => {
    setTipoEditando(null);
    setNuevoTipoKey((k) => k + 1);
    setNuevoTipoOpen(true);
  }, []);

  const abrirEditarTipo = useCallback((t: EditTipo) => {
    setTipoEditando(t);
    setNuevoTipoKey((k) => k + 1);
    setNuevoTipoOpen(true);
  }, []);

  

  const tiposVisibles = useMemo(() => (mostrarEliminados ? tipos : tipos.filter((t) => t.flgActivo !== false)), [tipos, mostrarEliminados]);
  const bloquesVisibles = useMemo(() => (mostrarEliminados ? bloques : bloques.filter((b) => b.flgActivo !== false)), [bloques, mostrarEliminados]);
  const furnitureVisibles = useMemo(() => (mostrarEliminados ? furniture : furniture.filter((f) => f.flgActivo !== false)), [furniture, mostrarEliminados]);
  const bloquesActivosCount = useMemo(() => bloques.filter((b) => b.flgActivo !== false).length, [bloques]);
  const furnitureActivaCount = useMemo(() => furniture.filter((f) => f.flgActivo !== false).length, [furniture]);

  const bounds = useMemo(() => {
    if (bloquesVisibles.length === 0) return { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const b of bloquesVisibles) {
      const dim = tipos.find((t) => t.codigo === b.tipoCodigo);
      const w = dim?.w ?? 2, d = dim?.d ?? 2;
      minX = Math.min(minX, b.x - w / 2); maxX = Math.max(maxX, b.x + w / 2);
      minZ = Math.min(minZ, b.z - d / 2); maxZ = Math.max(maxZ, b.z + d / 2);
    }
    return { minX: minX - 6, maxX: maxX + 6, minZ: minZ - 6, maxZ: maxZ + 6 };
  }, [bloquesVisibles, tipos]);

  const camPos = useMemo(() => {
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const s = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
    return { position: [cx, s * 0.85, cz + s * 0.5] as [number, number, number], target: [cx, 0, cz] as [number, number, number] };
  }, [bounds]);

  /** Centros de bloques y decoraciones (mas el origen) para las guias magneticas. */
  const candidatosGuia = useMemo<PuntoAlineable[]>(() => {
    const out: PuntoAlineable[] = [{ id: "origen", x: 0, z: 0 }];
    for (const b of bloquesVisibles) out.push({ id: `bloque:${b.bloqueId}`, x: b.x, z: b.z });
    for (const f of furnitureVisibles) out.push({ id: `furniture:${f.refId}`, x: f.x, z: f.z });
    return out;
  }, [bloquesVisibles, furnitureVisibles]);

  

  const startDrag = (kind: ObjetoKind, id: string, pointX: number, pointZ: number) => {
    const item = kind === "bloque" ? bloques.find((b) => b.bloqueId === id) : furniture.find((f) => f.refId === id);
    if (!item) return;
    setSelected({ kind, id });
    setDragging({ mode: "move", kind, id, offsetX: item.x - pointX, offsetZ: item.z - pointZ });
  };

  const startRotate = (kind: ObjetoKind, id: string, pointX: number, pointZ: number) => {
    const item = kind === "bloque" ? bloques.find((b) => b.bloqueId === id) : furniture.find((f) => f.refId === id);
    if (!item) return;
    setSelected({ kind, id });
    setDragging({
      mode: "rotate",
      kind,
      id,
      centerX: item.x,
      centerZ: item.z,
      inicioRad: item.rotY ?? 0,
      inicioAngulo: Math.atan2(pointZ - item.z, pointX - item.x),
    });
  };

  const moveDrag = (pointX: number, pointZ: number, shift: boolean) => {
    if (!dragging) return;
    if (dragging.mode === "rotate") {
      const angulo = Math.atan2(pointZ - dragging.centerZ, pointX - dragging.centerX);
      const deltaGrados = planoEditorUtils.aGrados(angulo - dragging.inicioAngulo);
      const bruto = planoEditorUtils.aGrados(dragging.inicioRad) - deltaGrados;
      const paso = shift ? EDITOR_PLANO.SNAP_ROTACION_MAYOR_GRADOS : EDITOR_PLANO.SNAP_ROTACION_GRADOS;
      const rotY = planoEditorUtils.aRadianes(planoEditorUtils.snapGrados(bruto, paso));
      if (dragging.kind === "bloque") {
        setBloques((prev) => prev.map((b) => (b.bloqueId === dragging.id ? { ...b, rotY } : b)));
      } else {
        setFurniture((prev) => prev.map((f) => (f.refId === dragging.id ? { ...f, rotY } : f)));
      }
      setDirty(true);
      return;
    }
    const nx = snap(pointX + dragging.offsetX);
    const nz = snap(pointZ + dragging.offsetZ);
    const prefijo = dragging.kind === "bloque" ? "bloque:" : "furniture:";
    const otros = candidatosGuia.filter((c) => c.id !== `${prefijo}${dragging.id}`);
    const alineado = mostrarGuias
      ? planoEditorUtils.alinear(nx, nz, otros, EDITOR_PLANO.UMBRAL_GUIA)
      : { x: nx, z: nz, guiaX: null, guiaZ: null };
    setGuias({ x: alineado.guiaX, z: alineado.guiaZ });
    if (dragging.kind === "bloque") {
      setBloques((prev) => prev.map((b) => (b.bloqueId === dragging.id ? { ...b, x: alineado.x, z: alineado.z } : b)));
    } else {
      setFurniture((prev) => prev.map((f) => (f.refId === dragging.id ? { ...f, x: alineado.x, z: alineado.z } : f)));
    }
    setDirty(true);
  };

  const endDrag = () => {
    setDragging(null);
    setGuias({ x: null, z: null });
  };

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

  const addFurnitureAt = (tipo: string, x: number, z: number) => {
    const refId = furnitureUtils.refIdSugerido(tipo, furniture.map((f) => f.refId));
    const nuevo: EditFurniture = { refId, tipo, x: snap(x), z: snap(z), rotY: 0, config: furnitureUtils.configPorDefecto(tipo), flgActivo: true };
    setFurniture((prev) => [...prev, nuevo]);
    setSelected({ kind: "furniture", id: refId });
    setDirty(true);
    toast.success(`${FURNITURE_LABELS[tipo]?.label ?? tipo} ${refId} agregado — arrastralo para posicionarlo`);
  };

  

  const bloqueSel = selected?.kind === "bloque" ? bloques.find((b) => b.bloqueId === selected.id) : null;

  const updateBloque = (patch: Partial<EditBloque>) => {
    if (!bloqueSel) return;
    setBloques((prev) => prev.map((b) => (b.bloqueId === bloqueSel.bloqueId ? { ...b, ...patch } : b)));
    setDirty(true);
  };

  const deleteBloque = async () => {
    if (!bloqueSel) return;
    const id = bloqueSel.bloqueId;
    const ok = await confirm({
      title: `Eliminar bloque ${id}`,
      description: "Se marcará como eliminado (borrado lógico). Podés restaurarlo activando \"Mostrar eliminados\" y guardar para aplicar.",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    setBloques((prev) => prev.map((b) => (b.bloqueId === id ? { ...b, flgActivo: false } : b)));
    setDirty(true);
    toast.success(`Bloque ${id} eliminado (guardar para aplicar)`);
  };

  const restaurarBloque = () => {
    if (!bloqueSel) return;
    updateBloque({ flgActivo: true });
    toast.success(`Bloque ${bloqueSel.bloqueId} restaurado (guardar para aplicar)`);
  };

  const furnitureSel = selected?.kind === "furniture" ? (furniture.find((f) => f.refId === selected.id) ?? null) : null;

  const updateFurniture = (patch: Partial<EditFurniture>) => {
    if (!furnitureSel) return;
    setFurniture((prev) => prev.map((f) => (f.refId === furnitureSel.refId ? { ...f, ...patch } : f)));
    setDirty(true);
  };

  const deleteFurniture = async () => {
    if (!furnitureSel) return;
    const id = furnitureSel.refId;
    const ok = await confirm({
      title: `Eliminar decoración ${id}`,
      description: "Se marcará como eliminada (borrado lógico). Podés restaurarla activando \"Mostrar eliminados\" y guardar para aplicar.",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    setFurniture((prev) => prev.map((f) => (f.refId === id ? { ...f, flgActivo: false } : f)));
    setDirty(true);
    toast.success(`${id} eliminado (guardar para aplicar)`);
  };

  const restaurarFurniture = () => {
    if (!furnitureSel) return;
    updateFurniture({ flgActivo: true });
    toast.success(`${furnitureSel.refId} restaurado (guardar para aplicar)`);
  };

  const persistirTipos = async (nuevosTipos: EditTipo[]) => {
    if (!planoSel) return;
    try {
      await planosService.guardarTipos({ id: planoSel.id, tipos: nuevosTipos });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron guardar los tipos");
    }
  };

  const usageDeTipo = (codigo: string) => bloques.filter((b) => b.tipoCodigo === codigo).length;

  const deleteTipo = async (codigo: string) => {
    const enUso = usageDeTipo(codigo);
    if (enUso > 0) {
      await confirm({
        title: "No se puede eliminar el tipo",
        description: `El tipo ${codigo} está en uso por ${enUso} bloque(s). Reasigná o eliminá esos bloques primero.`,
        confirmLabel: "Entendido",
        cancelLabel: "Cerrar",
      });
      return;
    }
    const ok = await confirm({
      title: `Eliminar tipo ${codigo}`,
      description: "Se marcará como eliminado (borrado lógico). Podés restaurarlo activando \"Mostrar eliminados\".",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    const nuevos = tipos.map((t) => (t.codigo === codigo ? { ...t, flgActivo: false } : t));
    setTipos(nuevos);
    void persistirTipos(nuevos);
    toast.success(`Tipo ${codigo} eliminado`);
  };

  const restaurarTipo = (codigo: string) => {
    const nuevos = tipos.map((t) => (t.codigo === codigo ? { ...t, flgActivo: true } : t));
    setTipos(nuevos);
    void persistirTipos(nuevos);
    toast.success(`Tipo ${codigo} restaurado`);
  };

  const cambiarTipoFurniture = (tipo: string) => {
    if (!furnitureSel) return;
    const config = tipo === TIPOS_FURNITURE.PERSONA && furnitureSel.tipo === TIPOS_FURNITURE.PERSONA
      ? furnitureSel.config
      : furnitureUtils.configPorDefecto(tipo);
    updateFurniture({ tipo, config });
  };

  const patchPersonaConfig = (patch: Partial<PersonaFurnitureConfig>) => {
    if (!furnitureSel) return;
    updateFurniture({ config: { ...furnitureUtils.personaConfig(furnitureSel.config), ...patch } });
  };

  const patchPisoConfig = (patch: Partial<PisoFurnitureConfig>) => {
    if (!furnitureSel) return;
    updateFurniture({ config: { ...furnitureUtils.pisoConfig(furnitureSel.config), ...patch } });
  };

  /** Objeto seleccionado con datos para la manija de rotacion. */
  const objetoSel = useMemo(() => {
    if (bloqueSel) {
      const dim = tipos.find((t) => t.codigo === bloqueSel.tipoCodigo);
      return {
        kind: "bloque" as const,
        id: bloqueSel.bloqueId,
        x: bloqueSel.x,
        z: bloqueSel.z,
        rotY: bloqueSel.rotY ?? 0,
        radio: Math.max(dim?.w ?? 2, dim?.d ?? 2) / 2 + 0.8,
      };
    }
    if (furnitureSel) {
      const huella = furnitureUtils.huella(furnitureSel.tipo, furnitureSel.config);
      return {
        kind: "furniture" as const,
        id: furnitureSel.refId,
        x: furnitureSel.x,
        z: furnitureSel.z,
        rotY: furnitureSel.rotY,
        radio: Math.max(huella.w, huella.d) / 2 + 0.8,
      };
    }
    return null;
  }, [bloqueSel, furnitureSel, tipos]);

  

  const handleSave = async () => {
    if (!planoSel) return;
    const refIds = furniture.map((f) => f.refId.trim());
    if (refIds.some((r) => !r) || new Set(refIds).size !== refIds.length) {
      toast.error("Hay decoraciones con RefId vacio o duplicado");
      return;
    }
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

  const confirmarEliminarPlano = async () => {
    if (!planoSel) return;
    const plano = planoSel;
    const detalle = plano.tipo === TIPOS_PLANO.MACRO
      ? `Se eliminará el mapa macro y sus ${plano.secciones.length} secciones.`
      : `Se eliminará el layout con ${plano.bloques.length} bloques.`;
    const vinculo = plano.tipo !== TIPOS_PLANO.MACRO
      ? " Si pertenece a un macro, su vínculo con las secciones se desasignará (las secciones se conservan sin plano)."
      : "";
    const ok = await confirm({
      title: `Eliminar mapa ${plano.nombre}`,
      description: `${detalle}${vinculo} Esta acción no se puede deshacer. No se puede eliminar si está asignado a un evento.`,
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    try {
      await planosService.eliminar(plano.id);
      toast.success(`Mapa "${plano.nombre}" eliminado`);
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
          <h1 className="text-lg font-semibold text-slate-800"><span>Laboratorio 3D</span></h1>
        </div>
        <Select value={planoSel?.id ?? ""} onValueChange={(v) => loadDetalle(v)}>
          <SelectTrigger className="w-[260px] h-8 text-xs"><SelectValue placeholder="Seleccionar mapa" /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel className="text-[10px] font-bold uppercase tracking-wider text-slate-400"><span>Mapas 3D — pabellones</span></SelectLabel>
              {planos.filter((p) => p.tipo !== TIPOS_PLANO.MACRO).map((p) => (
                <SelectItem key={p.id} value={p.id}><span>{p.nombre} ({p.bloquesCount} bloques)</span></SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel className="text-[10px] font-bold uppercase tracking-wider text-slate-400"><span>Mapas macro</span></SelectLabel>
              {planos.filter((p) => p.tipo === TIPOS_PLANO.MACRO).map((p) => (
                <SelectItem key={p.id} value={p.id}><span>{p.nombre} — agrupa pabellones</span></SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="rounded-full h-8 text-xs" onClick={abrirNuevoPlano}>
          <Plus className="h-3.5 w-3.5 mr-1" /> <span>Nuevo mapa</span>
        </Button>
        <Button size="sm" variant="outline" className="rounded-full h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200" disabled={!planoSel} title="Eliminar mapa"
          onClick={() => void confirmarEliminarPlano()}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 h-8">
          <Checkbox
            id="editor-guias"
            checked={mostrarGuias}
            onCheckedChange={(v) => {
              const activo = v === true;
              setMostrarGuias(activo);
              if (!activo) setGuias({ x: null, z: null });
            }}
          />
          <Label htmlFor="editor-guias" className="cursor-pointer text-xs text-slate-600"><span>Lineas de apoyo</span></Label>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 h-8">
          <Checkbox
            id="editor-eliminados"
            checked={mostrarEliminados}
            onCheckedChange={(v) => setMostrarEliminados(v === true)}
          />
          <Label htmlFor="editor-eliminados" className="cursor-pointer text-xs text-slate-600"><span>Mostrar eliminados</span></Label>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="rounded-full h-8 text-xs" disabled={!planoSel || planoSel.tipo === TIPOS_PLANO.MACRO} onClick={() => setNuevoBloqueOpen(true)} title={planoSel?.tipo === TIPOS_PLANO.MACRO ? "Los mapas macro usan secciones, no bloques" : undefined}>
            <Box className="h-3.5 w-3.5 mr-1" /> <span>Agregar bloque</span>
          </Button>
          <Button size="sm" variant="outline" className="rounded-full h-8 text-xs" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1" /> <span>Importar</span>
          </Button>
          <Button size="sm" variant="outline" className="rounded-full h-8 text-xs" disabled={!planoSel} onClick={handleExportJson}>
            <FileJson className="h-3.5 w-3.5 mr-1" /> <span>Exportar JSON</span>
          </Button>
          <Button size="sm" variant="outline" className="rounded-full h-8 text-xs" disabled={!planoSel} onClick={handleExportTs}>
            <FileCode2 className="h-3.5 w-3.5 mr-1" /> <span>Exportar TS</span>
          </Button>
          <Button size="sm" className="rounded-full h-8 text-xs bg-violet-600 hover:bg-violet-700" disabled={!planoSel || !dirty || saving} onClick={handleSave}>
            <Save className="h-3.5 w-3.5 mr-1" /> <span>{saving ? "Guardando..." : dirty ? "Guardar *" : "Guardar"}</span>
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
            if (!planoSel) return;
            const pos = dropConverterRef.current?.(e.clientX, e.clientY) ?? { x: 0, z: 0 };
            const tipoFurniture = e.dataTransfer.getData("application/x-plano-furniture");
            if (tipoFurniture) { addFurnitureAt(tipoFurniture, pos.x, pos.z); return; }
            const tipoCodigo = e.dataTransfer.getData("application/x-plano-tipo");
            if (tipoCodigo) addBlockAt(tipoCodigo, pos.x, pos.z);
          }}
        >
          {loadingDetail ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground"><span>Cargando mapa...</span></div>
          ) : (
            <Canvas shadows camera={{ position: camPos.position, fov: 45 }} key={planoSel?.id ?? "empty"}>
              <color attach="background" args={["#e2e8f0"]} />
              <ambientLight intensity={0.6} />
              <directionalLight position={[15, 25, 10]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} />
              <GridFloor {...bounds} mostrarGuias={mostrarGuias} />
              <DropCoordinator register={(fn) => { dropConverterRef.current = fn; }} />
              {bloquesVisibles.map((b) => {
                const dim = tipos.find((t) => t.codigo === b.tipoCodigo);
                if (!dim) return null;
                return (
                  <EditorBloque
                    key={b.bloqueId}
                    bloque={b}
                    dim={dim}
                    selected={selected?.kind === "bloque" && selected.id === b.bloqueId}
                    inactive={b.flgActivo === false}
                    onPointerDown={(e) => { e.stopPropagation(); startDrag("bloque", b.bloqueId, e.point.x, e.point.z); }}
                  />
                );
              })}
              {furnitureVisibles.map((f) => (
                <EditorFurniture
                  key={f.refId}
                  item={f}
                  selected={selected?.kind === "furniture" && selected.id === f.refId}
                  inactive={f.flgActivo === false}
                  onPointerDown={(e) => { e.stopPropagation(); startDrag("furniture", f.refId, e.point.x, e.point.z); }}
                />
              ))}
              {mostrarGuias && guias.x !== null && (
                <mesh position={[guias.x, 0.03, (bounds.minZ + bounds.maxZ) / 2]}>
                  <boxGeometry args={[0.04, 0.01, bounds.maxZ - bounds.minZ + 4]} />
                  <meshBasicMaterial color="#f43f5e" />
                </mesh>
              )}
              {mostrarGuias && guias.z !== null && (
                <mesh position={[(bounds.minX + bounds.maxX) / 2, 0.03, guias.z]}>
                  <boxGeometry args={[bounds.maxX - bounds.minX + 4, 0.01, 0.04]} />
                  <meshBasicMaterial color="#f43f5e" />
                </mesh>
              )}
              {objetoSel && (
                <group position={[objetoSel.x, 0, objetoSel.z]} rotation={[0, objetoSel.rotY, 0]}>
                  <mesh position={[objetoSel.radio / 2, 0.05, 0]}>
                    <boxGeometry args={[objetoSel.radio, 0.02, 0.03]} />
                    <meshBasicMaterial color="#f59e0b" />
                  </mesh>
                  <mesh
                    position={[objetoSel.radio, 0.2, 0]}
                    onPointerDown={(e) => { e.stopPropagation(); startRotate(objetoSel.kind, objetoSel.id, e.point.x, e.point.z); }}
                    onPointerOver={() => { document.body.style.cursor = "grab"; }}
                    onPointerOut={() => { document.body.style.cursor = "auto"; }}
                  >
                    <sphereGeometry args={[0.18, 16, 16]} />
                    <meshBasicMaterial color="#f59e0b" />
                  </mesh>
                </group>
              )}
              <DragManager dragging={dragging} onMove={moveDrag} onEnd={endDrag} />
              <OrbitControls makeDefault enabled={!dragging} target={camPos.target} maxPolarAngle={Math.PI / 2.15} minDistance={5} maxDistance={150} />
            </Canvas>
          )}
          <div className="absolute left-2 top-2 rounded-md bg-white/80 backdrop-blur px-2 py-1 text-[10px] text-slate-500 pointer-events-none">
            <span>Arrastra tipos o decoraciones al mapa — mueve con drag, gira con la manija (Shift = 15°)</span>
          </div>
        </div>

        {/* PANEL DERECHO */}
        <div className="w-[280px] shrink-0 flex flex-col gap-3 overflow-y-auto">
          {/* Propiedades del bloque seleccionado */}
          {bloqueSel ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700"><span>Bloque seleccionado</span></p>
                <div className="flex items-center gap-1">
                  {bloqueSel.flgActivo === false && <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200"><span>Eliminado</span></Badge>}
                  <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-200">{bloqueSel.tipoCodigo}</Badge>
                </div>
              </div>
              <div>
                <Label className="text-[10px]"><span>ID del bloque</span></Label>
                <Input className="h-7 text-xs font-mono" value={bloqueSel.bloqueId}
                  onChange={(e) => {
                    const nuevoId = e.target.value;
                    setBloques((prev) => prev.map((b) => (b.bloqueId === bloqueSel.bloqueId ? { ...b, bloqueId: nuevoId } : b)));
                    setSelected({ kind: "bloque", id: nuevoId });
                    setDirty(true);
                  }} />
              </div>
              <div>
                <Label className="text-[10px]"><span>Tipo</span></Label>
                <Select value={bloqueSel.tipoCodigo} onValueChange={(v) => updateBloque({ tipoCodigo: v })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tipos.map((t) => (
                      <SelectItem key={t.codigo} value={t.codigo}><span>{t.label} — {t.nombre}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]"><span>X</span></Label>
                  <Input className="h-7 text-xs" type="number" step={EDITOR_PLANO.SNAP_POSICION} value={bloqueSel.x}
                    onChange={(e) => updateBloque({ x: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-[10px]"><span>Z</span></Label>
                  <Input className="h-7 text-xs" type="number" step={EDITOR_PLANO.SNAP_POSICION} value={bloqueSel.z}
                    onChange={(e) => updateBloque({ z: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label className="text-[10px]"><span>Rotacion (grados)</span></Label>
                <div className="flex items-center gap-1">
                  <Input className="h-7 text-xs flex-1" type="number" step={EDITOR_PLANO.SNAP_ROTACION_GRADOS}
                    value={Math.round(planoEditorUtils.normalizarGrados(planoEditorUtils.aGrados(bloqueSel.rotY ?? 0)))}
                    onChange={(e) => updateBloque({ rotY: planoEditorUtils.aRadianes(Number(e.target.value)) })} />
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Girar -90"
                    onClick={() => updateBloque({ rotY: (bloqueSel.rotY ?? 0) - Math.PI / 2 })}>
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Girar +90"
                    onClick={() => updateBloque({ rotY: (bloqueSel.rotY ?? 0) + Math.PI / 2 })}>
                    <RotateCw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {bloqueSel.flgActivo === false ? (
                <Button size="sm" variant="outline" className="w-full rounded-full h-7 text-xs" onClick={restaurarBloque}>
                  <RotateCcw className="h-3 w-3 mr-1" /> <span>Restaurar bloque (eliminado)</span>
                </Button>
              ) : (
                <Button size="sm" variant="destructive" className="w-full rounded-full h-7 text-xs" onClick={deleteBloque}>
                  <Trash2 className="h-3 w-3 mr-1" /> <span>Eliminar bloque</span>
                </Button>
              )}
            </div>
          ) : null}

          {/* Propiedades de la decoracion seleccionada */}
          {furnitureSel ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700"><span>Decoracion seleccionada</span></p>
                <div className="flex items-center gap-1">
                  {furnitureSel.flgActivo === false && <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200"><span>Eliminado</span></Badge>}
                  <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-200">{FURNITURE_LABELS[furnitureSel.tipo]?.label ?? furnitureSel.tipo}</Badge>
                </div>
              </div>
              <div>
                <Label className="text-[10px]"><span>RefId</span></Label>
                <Input className="h-7 text-xs font-mono" value={furnitureSel.refId}
                  onChange={(e) => {
                    const nuevoId = e.target.value;
                    setFurniture((prev) => prev.map((f) => (f.refId === furnitureSel.refId ? { ...f, refId: nuevoId } : f)));
                    setSelected({ kind: "furniture", id: nuevoId });
                    setDirty(true);
                  }} />
              </div>
              <div>
                <Label className="text-[10px]"><span>Tipo</span></Label>
                <Select value={furnitureSel.tipo} onValueChange={cambiarTipoFurniture}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(TIPOS_FURNITURE).map((t) => (
                      <SelectItem key={t} value={t}><span>{FURNITURE_LABELS[t]?.label ?? t}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]"><span>X</span></Label>
                  <Input className="h-7 text-xs" type="number" step={EDITOR_PLANO.SNAP_POSICION} value={furnitureSel.x}
                    onChange={(e) => updateFurniture({ x: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-[10px]"><span>Z</span></Label>
                  <Input className="h-7 text-xs" type="number" step={EDITOR_PLANO.SNAP_POSICION} value={furnitureSel.z}
                    onChange={(e) => updateFurniture({ z: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label className="text-[10px]"><span>Rotacion (grados)</span></Label>
                <div className="flex items-center gap-1">
                  <Input className="h-7 text-xs flex-1" type="number" step={EDITOR_PLANO.SNAP_ROTACION_GRADOS}
                    value={Math.round(planoEditorUtils.normalizarGrados(planoEditorUtils.aGrados(furnitureSel.rotY)))}
                    onChange={(e) => updateFurniture({ rotY: planoEditorUtils.aRadianes(Number(e.target.value)) })} />
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Girar -90"
                    onClick={() => updateFurniture({ rotY: furnitureSel.rotY - Math.PI / 2 })}>
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Girar +90"
                    onClick={() => updateFurniture({ rotY: furnitureSel.rotY + Math.PI / 2 })}>
                    <RotateCw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {furnitureSel.tipo === TIPOS_FURNITURE.PERSONA && (() => {
                const config = furnitureUtils.personaConfig(furnitureSel.config);
                return (
                  <div className="space-y-2 rounded-lg border border-amber-200 bg-white/60 p-2">
                    <div>
                      <Label className="text-[10px]"><span>Color de cabeza</span></Label>
                      <Select value={String(config.colorIdx)} onValueChange={(v) => patchPersonaConfig({ colorIdx: Number(v) })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PERSONA_COLORES_CABEZA.map((c, i) => (
                            <SelectItem key={c} value={String(i)}>
                              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm border" style={{ backgroundColor: c }} /><span>{`Tono ${i + 1}`}</span></span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]"><span>Torso</span></Label>
                        <input type="color" value={config.torsoColor} onChange={(e) => patchPersonaConfig({ torsoColor: e.target.value })} className="h-7 w-full cursor-pointer rounded border" />
                      </div>
                      <div>
                        <Label className="text-[10px]"><span>Piernas</span></Label>
                        <input type="color" value={config.piernasColor} onChange={(e) => patchPersonaConfig({ piernasColor: e.target.value })} className="h-7 w-full cursor-pointer rounded border" />
                      </div>
                    </div>
                  </div>
                );
              })()}
              {furnitureSel.tipo === TIPOS_FURNITURE.PISO && (() => {
                const config = furnitureUtils.pisoConfig(furnitureSel.config);
                return (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]"><span>Ancho (m)</span></Label>
                      <Input className="h-7 text-xs" type="number" step={0.5} min={0.5} value={config.w}
                        onChange={(e) => patchPisoConfig({ w: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label className="text-[10px]"><span>Fondo (m)</span></Label>
                      <Input className="h-7 text-xs" type="number" step={0.5} min={0.5} value={config.d}
                        onChange={(e) => patchPisoConfig({ d: Number(e.target.value) })} />
                    </div>
                  </div>
                );
              })()}
              {furnitureSel.flgActivo === false ? (
                <Button size="sm" variant="outline" className="w-full rounded-full h-7 text-xs" onClick={restaurarFurniture}>
                  <RotateCcw className="h-3 w-3 mr-1" /> <span>Restaurar decoracion (eliminada)</span>
                </Button>
              ) : (
                <Button size="sm" variant="destructive" className="w-full rounded-full h-7 text-xs" onClick={deleteFurniture}>
                  <Trash2 className="h-3 w-3 mr-1" /> <span>Eliminar decoracion</span>
                </Button>
              )}
            </div>
          ) : !bloqueSel ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              <p className="text-[11px] text-slate-400"><span>Selecciona un bloque o decoracion en el canvas para editarlo</span></p>
            </div>
          ) : null}

          {/* Tipos de bloque */}
          <div className="rounded-xl border border-slate-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700"><span>Tipos de bloque ({tiposVisibles.length}{mostrarEliminados && tipos.length !== tiposVisibles.length ? `/${tipos.length}` : ""})</span></p>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={abrirNuevoTipo}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-[10px] text-slate-400"><span>Arrastra un tipo al mapa para crear un bloque · lapiz edita · papelera elimina</span></p>
            <div className="space-y-1">
              {tiposVisibles.map((t) => {
                const eliminado = t.flgActivo === false;
                return (
                <div
                  key={t.codigo}
                  draggable={!eliminado}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-plano-tipo", t.codigo);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  title={eliminado ? "Tipo eliminado (restaurar para usar)" : "Arrastra al mapa para crear un bloque"}
                  className={`flex items-center gap-2 rounded border px-2 py-1.5 text-[11px] transition-all select-none ${eliminado ? "border-dashed border-red-200 bg-red-50/40 opacity-70" : "border-slate-100 bg-white cursor-grab active:cursor-grabbing hover:border-violet-300 hover:bg-violet-50/50 hover:shadow-sm"}`}
                >
                  <span className="h-3 w-3 rounded-sm border shrink-0" style={{ backgroundColor: t.color }} />
                  <span className="font-mono font-medium">{t.codigo}</span>
                  <span className="text-slate-400 truncate flex-1">{t.nombre}</span>
                  <span className="rounded border border-slate-200 px-1 text-[9px] text-slate-500">{AMBITO_TIPO_BLOQUE_LABELS[t.ambito]?.label ?? t.ambito}</span>
                  <span className="text-[9px] text-slate-400">{t.w}x{t.d}x{t.h}</span>
                  {eliminado ? (
                    <>
                      <span className="shrink-0 text-[9px] text-red-500">eliminado</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 text-slate-400 hover:text-primary"
                        title="Restaurar tipo"
                        onClick={(e) => { e.stopPropagation(); restaurarTipo(t.codigo); }}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 text-slate-400 hover:text-primary"
                        title="Editar tipo (nombre, medidas, color)"
                        onClick={(e) => { e.stopPropagation(); abrirEditarTipo(t); }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 text-slate-400 hover:text-red-500"
                        title="Eliminar tipo (logico)"
                        onClick={(e) => { e.stopPropagation(); deleteTipo(t.codigo); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
                );
              })}
            </div>
          </div>

          {/* Decoraciones */}
          <div className="rounded-xl border border-slate-200 p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-700"><span>Decoraciones ({furnitureActivaCount}{mostrarEliminados && furniture.length !== furnitureActivaCount ? `/${furniture.length}` : ""})</span></p>
            <p className="text-[10px] text-slate-400"><span>Arrastra al mapa o usa + para agregar en el centro</span></p>
            <div className="space-y-1">
              {Object.values(TIPOS_FURNITURE).map((t) => {
                const lbl = FURNITURE_LABELS[t];
                return (
                  <div
                    key={t}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-plano-furniture", t);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    title="Arrastra al mapa para agregar la decoracion"
                    className="flex items-center gap-2 rounded border border-slate-100 bg-white px-2 py-1.5 text-[11px] cursor-grab active:cursor-grabbing hover:border-violet-300 hover:bg-violet-50/50 hover:shadow-sm transition-all select-none"
                  >
                    <span className="font-medium">{lbl?.label ?? t}</span>
                    <span className="text-slate-400 truncate flex-1">{lbl?.nombre ?? ""}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0 text-slate-400 hover:text-primary"
                      title="Agregar en el centro (0, 0)"
                      onClick={() => addFurnitureAt(t, 0, 0)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info */}
          <div className="rounded-xl border border-slate-200 p-3 text-[10px] text-slate-500 space-y-1">
            <p><span className="font-medium">{bloquesActivosCount}</span> <span>bloques, </span><span className="font-medium">{furnitureActivaCount}</span> <span>decoraciones</span>{mostrarEliminados && (bloques.length !== bloquesActivosCount || furniture.length !== furnitureActivaCount) ? <span className="text-red-500">{` (+${bloques.length - bloquesActivosCount} bloques, +${furniture.length - furnitureActivaCount} decoraciones eliminadas)`}</span> : null}</p>
            {dirty && <p className="text-amber-600 font-medium"><span>Cambios sin guardar — presiona Guardar</span></p>}
          </div>

          {/* Pertenencia a macro (solo planos simples) */}
          {planoSel?.tipo === TIPOS_PLANO.SIMPLE && (
            <PertenenciaMacro planoId={planoSel.id} planos={planos} />
          )}
        </div>
      </div>
      )}

      {/* DIALOG: Nuevo plano */}
      <NuevoPlanoDialog key={`plano-${nuevoPlanoKey}`} open={nuevoPlanoOpen} codigoInicial={nuevoPlanoCodigo} codigosExistentes={planos.map((p) => p.codigo)} onClose={() => setNuevoPlanoOpen(false)} onCreated={async (id) => { setNuevoPlanoOpen(false); await loadPlanos(); await loadDetalle(id); }} />

      {/* DIALOG: Nuevo tipo */}
      <NuevoTipoDialog key={`tipo-${nuevoTipoKey}`} open={nuevoTipoOpen} tipos={tipos} tipoInicial={tipoEditando} onClose={() => setNuevoTipoOpen(false)} onAdd={(t) => {
        const normalizado = (c: string) => c.trim().toUpperCase();
        const original = tipoEditando;
        if (tipos.some((x) => x !== original && normalizado(x.codigo) === normalizado(t.codigo))) {
          toast.error("Ya existe un tipo con ese codigo en este mapa");
          return;
        }
        if (original) {
          const nuevos = tipos.map((x) => (x === original ? t : x));
          setTipos(nuevos);
          if (normalizado(t.codigo) !== normalizado(original.codigo)) {
            // El cambio de codigo requiere actualizar los bloques: se aplica con Guardar.
            setBloques((prev) => prev.map((b) => (b.tipoCodigo === original.codigo ? { ...b, tipoCodigo: t.codigo } : b)));
            setDirty(true);
            toast.info("Codigo cambiado: presioná Guardar para aplicarlo a los bloques");
          } else {
            void persistirTipos(nuevos);
            toast.success("Tipo actualizado");
          }
          setUltimoTipoCreado(null);
        } else {
          const nuevos = [...tipos, t];
          setTipos(nuevos);
          setUltimoTipoCreado(t.codigo);
          void persistirTipos(nuevos);
          toast.success("Tipo agregado");
        }
        setNuevoTipoOpen(false);
      }} />

      {/* DIALOG: Nuevo bloque */}
      <NuevoBloqueDialog open={nuevoBloqueOpen} onClose={() => setNuevoBloqueOpen(false)} tipos={tipos} bloques={bloques} tipoSugerido={ultimoTipoCreado}
        onCrearTipo={abrirNuevoTipo}
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
                    <p className="font-mono font-semibold text-slate-700"><span>{name}.ts</span></p>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] rounded-full" onClick={() => {
                      const blob = new Blob([tsFiles[name]], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = `${name}.ts`; a.click();
                      URL.revokeObjectURL(url);
                    }}><span>Descargar</span></Button>
                  </div>
                  <pre className="rounded-md bg-slate-950 text-slate-200 p-3 overflow-x-auto max-h-48 overflow-y-auto text-[10px]"><span>{tsFiles[name]}</span></pre>
                </div>
              ))}
              <div>
                <p className="font-mono font-semibold text-slate-700 mb-1"><span>Snippet para registry.ts</span></p>
                <pre className="rounded-md bg-slate-950 text-emerald-300 p-3 overflow-x-auto text-[10px]"><span>{tsFiles.registrySnippet}</span></pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {confirmDialog}
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
      <p className="text-xs font-semibold text-slate-700"><span>Macro al que pertenece</span></p>
      {!cargado ? (
        <p className="text-[10px] text-slate-400"><span>Cargando...</span></p>
      ) : macros.length === 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500"><span>Este plano 3D aun no esta asignado a ningun macro.</span></p>
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
            <span>{seccionSel && seccionSel !== OPCION_NUEVA_SECCION ? "Asignar a seccion existente" : "Asignar como nueva seccion"}</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {macros.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded border border-violet-200 bg-white px-2 py-1.5">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-700 truncate"><span>{m.nombre}</span></p>
                <p className="text-[9px] text-slate-400 font-mono"><span>{m.codigo}</span></p>
              </div>
                <Button size="sm" variant="outline" className="h-6 text-[10px] rounded-full" disabled={trabajando} onClick={() => handleQuitar()}>
                <span>Quitar</span>
              </Button>
            </div>
          ))}
        </div>
      )}
      <p className="text-[9px] text-slate-400"><span>Un plano 3D solo puede pertenecer a un macro a la vez.</span></p>
    </div>
  );
}

function NuevoPlanoDialog({ open, onClose, onCreated, codigosExistentes, codigoInicial }: { open: boolean; onClose: () => void; onCreated: (id: string) => void; codigosExistentes: string[]; codigoInicial: string }) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<TipoPlano>(TIPOS_PLANO.SIMPLE);
  const [creating, setCreating] = useState(false);
  const [intentoEnviar, setIntentoEnviar] = useState(false);

  const codigoLimpio = codigo.trim();
  const codigoError = !codigoLimpio
    ? "El codigo es requerido"
    : !codigoPlanoUtils.esValido(codigoLimpio)
      ? "Solo minusculas, numeros y guiones"
      : codigoPlanoUtils.existe(codigoLimpio, codigosExistentes)
        ? "Ya existe un mapa con ese codigo"
        : null;
  const nombreError = nombre.trim() ? null : "El nombre es requerido";

  const handleCreate = async () => {
    if (codigoError || nombreError) {
      setIntentoEnviar(true);
      toast.error(codigoError ?? nombreError ?? "Revisa los campos");
      return;
    }
    setCreating(true);
    try {
      const plano = await planosService.crear({ codigo: codigoLimpio, nombre: nombre.trim(), descripcion: descripcion.trim() || null, tipo });
      toast.success(`Mapa "${plano.nombre}" creado${tipo === TIPOS_PLANO.MACRO ? " — sube la imagen de pabellones" : ""}`);
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
            <Label><span>Codigo (identificador unico)</span></Label>
            <div className="flex gap-2">
              <Input
                className="text-xs font-mono flex-1"
                placeholder="pab-54621"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toLowerCase())}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                title="Generar otro codigo"
                onClick={() => setCodigo(codigoPlanoUtils.generar(codigosExistentes))}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
            {codigoError ? (
              <p className="text-[10px] text-red-500 mt-0.5"><span>{codigoError}</span></p>
            ) : (
              <p className="text-[10px] text-slate-400 mt-0.5"><span>Minusculas, numeros y guiones. Se guarda en evento_metadata.plano</span></p>
            )}
          </div>
          <div>
            <Label><span>Nombre</span></Label>
            <Input className="text-xs" placeholder="Pabellon 4" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            {intentoEnviar && nombreError && <p className="text-[10px] text-red-500 mt-0.5"><span>{nombreError}</span></p>}
          </div>
          <div>
            <Label><span>Tipo de mapa</span></Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoPlano)}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TIPOS_PLANO.SIMPLE}><span>Simple — un plano 3D con bloques</span></SelectItem>
                <SelectItem value={TIPOS_PLANO.MACRO}><span>Macro — mapa de pabellones con secciones a planos 3D</span></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label><span>Descripcion</span></Label>
            <Input className="text-xs" placeholder="Opcional" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <Button className="w-full rounded-full" disabled={creating} onClick={handleCreate}>
            <span>{creating ? "Creando..." : "Crear mapa"}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NuevoTipoDialog({ open, onClose, onAdd, tipos, tipoInicial }: { open: boolean; onClose: () => void; onAdd: (t: EditTipo) => void; tipos: EditTipo[]; tipoInicial?: EditTipo | null }) {
  const [form, setForm] = useState<EditTipo>(() => tipoInicial ?? { codigo: "", label: "", nombre: "", w: 2, d: 2, h: 2.4, color: "#32CD32", ambito: AMBITOS_TIPO_BLOQUE.INTERNO, flgActivo: true });
  const [codigoEditado, setCodigoEditado] = useState(!!tipoInicial);
  const [codigoTocado, setCodigoTocado] = useState(false);
  const [nombreTocado, setNombreTocado] = useState(false);
  const [intentoEnviar, setIntentoEnviar] = useState(false);
  const [sugerencias, setSugerencias] = useState<PlanoTipoSugeridoDTO[]>([]);
  const [cargandoSugerencias, setCargandoSugerencias] = useState(false);

  useEffect(() => {
    if (!open || tipoInicial) return;
    void (async () => {
      setCargandoSugerencias(true);
      try {
        setSugerencias(await planosService.tiposSugeridos());
      } catch {
        setSugerencias([]);
      }
      setCargandoSugerencias(false);
    })();
  }, [open, tipoInicial]);

  const codigosActuales = useMemo(() => tipos.filter((t) => t !== tipoInicial).map((t) => t.codigo), [tipos, tipoInicial]);
  // Los tipos de este mapa se muestran tambien en la lista (marcados "ya existe"),
  // aunque aun no esten guardados en BD.
  const sugerenciasVisibles = useMemo<PlanoTipoSugeridoDTO[]>(() => {
    const codigos = new Set(sugerencias.map((s) => s.codigo.trim().toUpperCase()));
    const locales: PlanoTipoSugeridoDTO[] = tipos
      .filter((t) => !codigos.has(t.codigo.trim().toUpperCase()))
      .map((t) => ({ codigo: t.codigo, label: t.label, nombre: t.nombre, w: t.w, d: t.d, h: t.h, color: t.color, ambito: t.ambito, planoCodigo: "", planosCount: 1, bloquesCount: 0 }));
    return [...locales, ...sugerencias];
  }, [sugerencias, tipos]);
  const codigoLimpio = form.codigo.trim().toUpperCase();
  const codigoDuplicado = codigosActuales.some((c) => c.trim().toUpperCase() === codigoLimpio);
  const codigoError = !codigoLimpio
    ? "El codigo es requerido"
    : !codigoPlanoUtils.esTipoCodigoValido(codigoLimpio)
      ? "Solo mayusculas, numeros y guiones (max. 20)"
      : codigoDuplicado
        ? "Ya existe un tipo con ese codigo en este mapa"
        : null;
  const nombreError = form.nombre.trim() ? null : "El nombre es requerido";
  const mostrarCodigoError = (codigoTocado || intentoEnviar) && codigoError;
  const mostrarNombreError = (nombreTocado || intentoEnviar) && nombreError;

  const cambiarNombre = (valor: string) => {
    setForm((p) => {
      const next = { ...p, nombre: valor };
      if (!codigoEditado) {
        const codigoSugerido = codigoPlanoUtils.sugerirTipoCodigo(valor, codigosActuales);
        next.codigo = valor.trim() ? codigoSugerido : "";
        if (!p.label.trim()) next.label = valor.trim() ? codigoSugerido : "";
      }
      return next;
    });
  };

  const aplicarSugerencia = (s: PlanoTipoSugeridoDTO) => {
    // La sugerencia solo prellena la data: no crea vinculo con el tipo original.
    // Si el codigo ya existe en este mapa, se genera una variante para no duplicar.
    const yaExiste = codigosActuales.some((c) => c.trim().toUpperCase() === s.codigo.trim().toUpperCase());
    const codigo = yaExiste ? codigoPlanoUtils.sugerirTipoCodigo(s.codigo, codigosActuales) : s.codigo;
    setForm({ codigo, label: s.label, nombre: s.nombre, w: s.w, d: s.d, h: s.h, color: s.color, ambito: s.ambito, flgActivo: true });
    setCodigoEditado(true);
    setCodigoTocado(false);
    setIntentoEnviar(false);
  };

  const handleAdd = () => {
    if (codigoError || nombreError) {
      setIntentoEnviar(true);
      toast.error(codigoError ?? nombreError ?? "Revisa los campos");
      return;
    }
    onAdd({ ...form, codigo: codigoLimpio, label: form.label.trim() || codigoLimpio, nombre: form.nombre.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle><span>{tipoInicial ? "Editar tipo de bloque" : "Nuevo tipo de bloque"}</span></DialogTitle></DialogHeader>
        <div className="space-y-3 text-xs">
          {!tipoInicial && (cargandoSugerencias ? (
            <p className="text-[10px] text-slate-400"><span>Buscando tipos de otros mapas...</span></p>
          ) : sugerenciasVisibles.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400"><span>Reutilizar de otros mapas</span></p>
              <p className="text-[9px] text-slate-400"><span>Click prellena la data del formulario (no vincula el tipo)</span></p>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {sugerenciasVisibles.map((s) => {
                  const yaExiste = codigosActuales.some((c) => c.trim().toUpperCase() === s.codigo.trim().toUpperCase());
                  return (
                    <button
                      key={s.codigo}
                      type="button"
                      onClick={() => aplicarSugerencia(s)}
                      title={yaExiste
                        ? "Tipo ya usado en este mapa: se prellenará la data con un código nuevo"
                        : s.planoCodigo ? `Usado en ${s.planosCount} mapa(s), ${s.bloquesCount} bloque(s)` : "Tipo de este mapa (se guarda junto con el mapa)"}
                      className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left text-[11px] transition-colors hover:border-violet-300 hover:bg-violet-50/50"
                    >
                      <span className="h-3 w-3 shrink-0 rounded-sm border" style={{ backgroundColor: s.color }} />
                      <span className="font-mono font-medium">{s.codigo}</span>
                      <span className="truncate text-slate-500">{s.nombre}</span>
                      <span className="ml-auto shrink-0 text-[9px] text-slate-400">{AMBITO_TIPO_BLOQUE_LABELS[s.ambito]?.label ?? s.ambito}</span>
                      <span className="shrink-0 text-[9px] text-slate-400">{s.w}x{s.d}x{s.h}</span>
                      {yaExiste && (
                        <span className="shrink-0 rounded border border-amber-200 bg-amber-50 px-1 text-[9px] text-amber-700">en uso</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label><span>Codigo</span></Label>
              <Input
                className="text-xs font-mono"
                placeholder="VIP"
                value={form.codigo}
                onChange={(e) => {
                  const valor = e.target.value.toUpperCase();
                  setForm((p) => ({ ...p, codigo: valor }));
                  setCodigoEditado(valor.trim().length > 0);
                  setCodigoTocado(true);
                }}
              />
              {mostrarCodigoError ? (
                <p className="text-[10px] text-red-500 mt-0.5"><span>{codigoError}</span></p>
              ) : (!codigoEditado && form.nombre.trim() ? (
                <p className="text-[10px] text-slate-400 mt-0.5"><span>Sugerido desde el nombre</span></p>
              ) : null)}
            </div>
            <div>
              <Label><span>Label</span></Label>
              <Input className="text-xs font-mono" placeholder="VIP" value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label><span>Nombre</span></Label>
            <Input className="text-xs" placeholder="Stand VIP" value={form.nombre} onChange={(e) => { setNombreTocado(true); cambiarNombre(e.target.value); }} />
            {mostrarNombreError && <p className="text-[10px] text-red-500 mt-0.5"><span>{nombreError}</span></p>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label><span>W (ancho)</span></Label><Input className="text-xs" type="number" step={0.1} value={form.w} onChange={(e) => setForm((p) => ({ ...p, w: Number(e.target.value) }))} /></div>
            <div><Label><span>D (fondo)</span></Label><Input className="text-xs" type="number" step={0.1} value={form.d} onChange={(e) => setForm((p) => ({ ...p, d: Number(e.target.value) }))} /></div>
            <div><Label><span>H (alto)</span></Label><Input className="text-xs" type="number" step={0.1} value={form.h} onChange={(e) => setForm((p) => ({ ...p, h: Number(e.target.value) }))} /></div>
          </div>
          <div>
            <Label><span>Color</span></Label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} className="h-8 w-12 cursor-pointer rounded border" />
              <Input className="text-xs font-mono flex-1" value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label><span>Ámbito</span></Label>
            <Select value={form.ambito} onValueChange={(v) => setForm((p) => ({ ...p, ambito: v }))}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.values(AMBITOS_TIPO_BLOQUE).map((a) => (
                  <SelectItem key={a} value={a}><span>{AMBITO_TIPO_BLOQUE_LABELS[a]?.nombre ?? a}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full rounded-full" onClick={handleAdd}><span>{tipoInicial ? "Guardar cambios" : "Agregar tipo"}</span></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NuevoBloqueDialog({ open, onClose, tipos, bloques, tipoSugerido, onAdd, onCrearTipo }: {
  open: boolean; onClose: () => void; tipos: EditTipo[]; bloques: EditBloque[]; tipoSugerido?: string | null; onAdd: (b: EditBloque) => void; onCrearTipo: () => void;
}) {
  const [bloqueId, setBloqueId] = useState("");
  const [tipoCodigo, setTipoCodigo] = useState("");
  const tipoCodigoRef = useRef(tipoCodigo);
  useEffect(() => { tipoCodigoRef.current = tipoCodigo; }, [tipoCodigo]);

  // Al abrir (o al crear un tipo desde este dialogo): elegir el tipo nuevo si existe,
  // conservar el actual si sigue siendo valido, y sugerir el siguiente ID disponible.
  useEffect(() => {
    (async () => {
      if (!open) return;
      const actual = tipoCodigoRef.current;
      const sugeridoValido = tipoSugerido && tipos.some((t) => t.codigo === tipoSugerido) ? tipoSugerido : null;
      const actualValido = tipos.some((t) => t.codigo === actual) ? actual : null;
      setTipoCodigo(sugeridoValido ?? actualValido ?? tipos[tipos.length - 1]?.codigo ?? "");
      setBloqueId((prev) => {
        if (prev.trim() && !bloques.some((b) => b.bloqueId === prev.trim().toUpperCase())) return prev;
        let n = bloques.length + 1;
        let candidate = `BLOQUE-${String(n).padStart(2, "0")}`;
        while (bloques.some((b) => b.bloqueId === candidate)) {
          n++;
          candidate = `BLOQUE-${String(n).padStart(2, "0")}`;
        }
        return candidate;
      });
    })();
  }, [open, tipos, bloques, tipoSugerido]);

  const handleAdd = () => {
    const id = bloqueId.trim().toUpperCase();
    if (!id) { toast.error("ID requerido"); return; }
    if (bloques.some((b) => b.bloqueId === id)) { toast.error("Ese ID ya existe"); return; }
    if (!tipoCodigo) { toast.error("Selecciona un tipo"); return; }
    onAdd({ bloqueId: id, tipoCodigo, tipologia: TIPOLOGIAS_STAND.SIMPLE, x: 0, z: 0, rotY: 0, orden: bloques.length, flgActivo: true });
    setBloqueId(""); setTipoCodigo("");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle><span>Agregar bloque</span></DialogTitle></DialogHeader>
        <div className="space-y-3 text-xs">
          <div>
            <Label><span>ID del bloque</span></Label>
            <Input className="text-xs font-mono" placeholder="BLOQUE-A1" value={bloqueId} onChange={(e) => setBloqueId(e.target.value)} />
            <p className="text-[10px] text-slate-400 mt-0.5"><span>Este ID se usa para vincular con gess_stand.bloqueId</span></p>
          </div>
          <div>
            <Label><span>Tipo</span></Label>
            {tipos.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center space-y-2">
                <p className="text-[11px] text-amber-700"><span>Este mapa no tiene tipos de bloque.</span></p>
                <Button size="sm" variant="outline" className="h-7 text-xs rounded-full" onClick={onCrearTipo}>
                  <Plus className="h-3 w-3 mr-1" /> <span>Crear tipo de bloque</span>
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
          <Button className="w-full rounded-full" onClick={handleAdd} disabled={tipos.length === 0}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> <span>Agregar en el centro (0, 0)</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
