"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Badge } from "@nrivera-iimp/ui-kit-iimp";
import { Plus, Save, Trash2, Upload, ImageIcon, Move, Expand, RotateCw, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { toast } from "sonner";
import { planosService } from "@/lib/client/api/services/planos-service";
import { TIPOS_PLANO } from "@/lib/shared/constants";
import type { PlanoDTO, PlanoListItemDTO } from "@/types/dto/planos/planos-response.dto";

interface EditSeccion {
  codigo: string;
  nombre: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotacion: number;
  color: string;
  planoHijoId: string | null;
  orden: number;
}

interface DragInfo {
  codigo: string;
  mode: "move" | "resize" | "rotate";
  startNX: number;
  startNY: number;
  orig: EditSeccion;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const snapDeg = (deg: number) => Math.round(deg / 5) * 5;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 6;
const ZOOM_STEP = 0.25;

export function MacroEditor({ plano, planos, onChange }: {
  plano: PlanoDTO;
  planos: PlanoListItemDTO[];
  onChange: (plano: PlanoDTO) => void;
}) {
  const [secciones, setSecciones] = useState<EditSeccion[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragInfo | null>(null);

  // Zoom anclado al punto bajo el cursor
  const aplicarZoom = useCallback((nuevoZoom: number, punto?: { x: number; y: number }) => {
    setZoom((prev) => {
      const next = clamp(nuevoZoom, ZOOM_MIN, ZOOM_MAX);
      const el = scrollRef.current;
      if (!el || next === prev) return next;

      const rect = el.getBoundingClientRect();
      const px = (punto?.x ?? rect.left + rect.width / 2) - rect.left;
      const py = (punto?.y ?? rect.top + rect.height / 2) - rect.top;
      const ratio = next / prev;

      el.scrollLeft = px + (el.scrollLeft - px) * ratio;
      el.scrollTop = py + (el.scrollTop - py) * ratio;
      return next;
    });
  }, []);

  // Ctrl + rueda = zoom anclado al cursor; rueda normal = scroll libre del contenedor
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      aplicarZoom(zoomRef.current + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), { x: e.clientX, y: e.clientY });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [aplicarZoom]);

  

  const panRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);

  const startPan = (e: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    const target = e.target as HTMLElement;
    const esFondo = target === containerRef.current || target.tagName === "IMG";
    // Solo se pannea sobre el fondo/imagen (no sobre secciones) o con boton medio siempre
    if (!esFondo && e.button !== 1) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    panRef.current = { startX: e.clientX, startY: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
    el.classList.add("cursor-grabbing");

    const onMove = (ev: PointerEvent) => {
      const pan = panRef.current;
      if (!pan) return;
      // Deltas absolutos: mueve el scroll en ambos ejes (diagonal incluida) sin depender de smooth
      el.scrollLeft = pan.scrollLeft - (ev.clientX - pan.startX);
      el.scrollTop = pan.scrollTop - (ev.clientY - pan.startY);
    };
    const onUp = (ev: PointerEvent) => {
      if (el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
      panRef.current = null;
      el.classList.remove("cursor-grabbing");
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  };

  useEffect(() => {
    setSecciones(plano.secciones.map((s) => ({ codigo: s.codigo, nombre: s.nombre, x: s.x, y: s.y, w: s.w, h: s.h, rotacion: s.rotacion ?? 0, color: s.color, planoHijoId: s.planoHijoId, orden: s.orden })));
    setSelected(null);
    setDirty(false);
  }, [plano.id, plano.secciones]);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const planosHijos = planos.filter((p) => p.tipo === TIPOS_PLANO.SIMPLE && p.id !== plano.id);
  const seccionSel = selected ? secciones.find((s) => s.codigo === selected) : null;

  

  const normFromEvent = (e: PointerEvent | React.PointerEvent): { nx: number; ny: number } => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { nx: 0, ny: 0 };
    return {
      nx: (e.clientX - rect.left) / rect.width,
      ny: (e.clientY - rect.top) / rect.height,
    };
  };

  const startDrag = (e: React.PointerEvent, codigo: string, mode: "move" | "resize" | "rotate") => {
    e.stopPropagation();
    e.preventDefault();
    const s = secciones.find((x) => x.codigo === codigo);
    if (!s) return;
    setSelected(codigo);
    const { nx, ny } = normFromEvent(e);
    dragRef.current = { codigo, mode, startNX: nx, startNY: ny, orig: { ...s } };

    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const { nx: cnx, ny: cny } = normFromEvent(ev);

      if (drag.mode === "rotate") {
        // Angulo del puntero respecto al centro de la seccion (coords normalizadas)
        const cx = drag.orig.x + drag.orig.w / 2;
        const cy = drag.orig.y + drag.orig.h / 2;
        const angRad = Math.atan2(cny - cy, cnx - cx);
        let deg = (angRad * 180) / Math.PI + 90; // +90 para que el handle superior sea 0
        deg = ((deg % 360) + 360) % 360;
        setSecciones((prev) => prev.map((sec) => (sec.codigo === drag.codigo ? { ...sec, rotacion: snapDeg(deg) } : sec)));
        setDirty(true);
        return;
      }

      const dx = cnx - drag.startNX;
      const dy = cny - drag.startNY;
      setSecciones((prev) => prev.map((sec) => {
        if (sec.codigo !== drag.codigo) return sec;
        if (drag.mode === "move") {
          return {
            ...sec,
            x: clamp(drag.orig.x + dx, 0, 1 - sec.w),
            y: clamp(drag.orig.y + dy, 0, 1 - sec.h),
          };
        }
        return {
          ...sec,
          w: clamp(drag.orig.w + dx, 0.02, 1 - sec.x),
          h: clamp(drag.orig.h + dy, 0.02, 1 - sec.y),
        };
      }));
      setDirty(true);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  

  const addSeccion = () => {
    let n = secciones.length + 1;
    let codigo = `PAB-${String.fromCharCode(64 + n)}`;
    while (secciones.some((s) => s.codigo === codigo)) {
      n++;
      codigo = `PAB-${String.fromCharCode(64 + Math.min(n, 90))}`;
    }
    const colores = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];
    const nueva: EditSeccion = {
      codigo,
      nombre: `Pabellon ${codigo.replace("PAB-", "")}`,
      x: 0.35, y: 0.35, w: 0.15, h: 0.12,
      rotacion: 0,
      color: colores[secciones.length % colores.length],
      planoHijoId: null,
      orden: secciones.length,
    };
    setSecciones((prev) => [...prev, nueva]);
    setSelected(codigo);
    setDirty(true);
    toast.success(`Seccion ${codigo} creada — muevela y ajusta su tamano sobre la imagen`);
  };

  const deleteSeccion = () => {
    if (!seccionSel) return;
    setSecciones((prev) => prev.filter((s) => s.codigo !== seccionSel.codigo));
    setSelected(null);
    setDirty(true);
  };

  const updateSeccion = (patch: Partial<EditSeccion>) => {
    if (!seccionSel) return;
    setSecciones((prev) => prev.map((s) => (s.codigo === seccionSel.codigo ? { ...s, ...patch } : s)));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await planosService.guardarSecciones({
        id: plano.id,
        secciones: secciones.map((s, i) => ({ ...s, orden: i })),
      });
      setDirty(false);
      toast.success("Secciones guardadas");
      onChange(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    }
    setSaving(false);
  };

  const handleUploadImagen = async (file: File) => {
    setUploading(true);
    try {
      const url = await planosService.subirImagen(file);
      const updated = await planosService.actualizarMeta({ id: plano.id, imagenFondo: url });
      toast.success("Imagen actualizada");
      onChange(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir imagen");
    }
    setUploading(false);
  };

  

  return (
    <div className="flex min-h-0 gap-3 h-[calc(100vh-10rem)]">
      {/* LIENZO MACRO */}
      <div className="flex-1 min-h-0 flex flex-col gap-2">
        {/* Toolbar de zoom */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1 py-0.5">
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded-full" title="Alejar" onClick={() => aplicarZoom(zoom - ZOOM_STEP)}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[10px] font-mono font-semibold text-slate-600 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded-full" title="Acercar" onClick={() => aplicarZoom(zoom + ZOOM_STEP)}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded-full" title="Zoom 100%" onClick={() => aplicarZoom(1)}>
              <Maximize className="h-3.5 w-3.5" />
            </Button>
          </div>
          <span className="text-[10px] text-slate-400">Ctrl + rueda = zoom (ancla al cursor) · arrastra el fondo para navegar · barras de scroll como respaldo</span>
        </div>

        <div ref={scrollRef} className="flex-1 min-h-0 rounded-xl border border-slate-200 bg-slate-100 overflow-auto overscroll-contain p-3" style={{ scrollbarGutter: "stable" }}>
        {plano.imagenFondo ? (
          <div
            ref={containerRef}
            className="relative select-none"
            style={{ width: `${zoom * 100}%`, minWidth: "100%", cursor: zoom > 1 ? "grab" : "default" }}
            onPointerDown={(e) => { setSelected(null); startPan(e); }}
          >
            <img
              src={plano.imagenFondo}
              alt="Mapa de pabellones"
              className="w-full h-auto block pointer-events-none rounded-lg"
              draggable={false}
            />
            {secciones.map((s) => (
              <div
                key={s.codigo}
                className={`absolute group cursor-move touch-none ${selected === s.codigo ? "z-20" : "z-10"}`}
                style={{
                  left: `${s.x * 100}%`,
                  top: `${s.y * 100}%`,
                  width: `${s.w * 100}%`,
                  height: `${s.h * 100}%`,
                  transform: `rotate(${s.rotacion}deg)`,
                  transformOrigin: "center",
                }}
                onPointerDown={(e) => startDrag(e, s.codigo, "move")}
              >
                <div
                  className={`h-full w-full rounded border-2 flex items-center justify-center transition-shadow ${selected === s.codigo ? "shadow-lg ring-2 ring-white/70" : "hover:shadow-md"}`}
                  style={{
                    backgroundColor: `${s.color}55`,
                    borderColor: selected === s.codigo ? "#fff" : s.color,
                  }}
                >
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white truncate max-w-full"
                    style={{ backgroundColor: s.color, transform: `rotate(${-s.rotacion}deg)` }}
                  >
                    {s.codigo}
                  </span>
                </div>
                {/* Rotate handle (superior centro) */}
                <div
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 h-4 w-4 rounded-full border-2 border-white flex items-center justify-center cursor-grab active:cursor-grabbing touch-none ${selected === s.codigo ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                  style={{ backgroundColor: s.color }}
                  onPointerDown={(e) => startDrag(e, s.codigo, "rotate")}
                  title="Arrastra para rotar"
                >
                  <RotateCw className="h-2 w-2 text-white" />
                </div>
                {/* Resize handle (esquina inferior derecha) */}
                <div
                  className={`absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 rounded-full border-2 border-white cursor-nwse-resize touch-none ${selected === s.codigo ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                  style={{ backgroundColor: s.color }}
                  onPointerDown={(e) => startDrag(e, s.codigo, "resize")}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
            <ImageIcon className="h-12 w-12" />
            <p className="text-sm">Este plano macro no tiene imagen de fondo.</p>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => imgInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Subir imagen de pabellones
            </Button>
          </div>
        )}
        </div>
      </div>

      {/* PANEL */}
      <div className="w-[280px] shrink-0 flex flex-col gap-3 overflow-y-auto">
        <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-700">Mapa macro: {plano.nombre}</p>
          <p className="text-[10px] text-slate-500">{secciones.length} secciones (pabellones)</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="rounded-full h-7 text-xs flex-1" onClick={addSeccion}>
              <Plus className="h-3 w-3 mr-1" /> Seccion
            </Button>
            <Button size="sm" variant="outline" className="rounded-full h-7 text-xs" disabled={uploading} onClick={() => imgInputRef.current?.click()}>
              <Upload className="h-3 w-3 mr-1" /> {uploading ? "..." : "Imagen"}
            </Button>
            <Button size="sm" className="rounded-full h-7 text-xs bg-violet-600 hover:bg-violet-700" disabled={!dirty || saving} onClick={handleSave}>
              <Save className="h-3 w-3 mr-1" /> {saving ? "..." : dirty ? "Guardar *" : "Guardar"}
            </Button>
          </div>
        </div>

        {seccionSel ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">Seccion seleccionada</p>
              <Badge className="text-[10px]" style={{ backgroundColor: seccionSel.color, color: "#fff" }}>{seccionSel.codigo}</Badge>
            </div>
            <div>
              <Label className="text-[10px]">Codigo</Label>
              <Input className="h-7 text-xs font-mono" value={seccionSel.codigo}
                onChange={(e) => {
                  const nuevo = e.target.value.toUpperCase();
                  setSecciones((prev) => prev.map((s) => (s.codigo === seccionSel.codigo ? { ...s, codigo: nuevo } : s)));
                  setSelected(nuevo);
                  setDirty(true);
                }} />
            </div>
            <div>
              <Label className="text-[10px]">Nombre</Label>
              <Input className="h-7 text-xs" value={seccionSel.nombre}
                onChange={(e) => updateSeccion({ nombre: e.target.value })} />
            </div>
            <div>
              <Label className="text-[10px]">Plano 3D del pabellon</Label>
              <Select value={seccionSel.planoHijoId ?? "none"} onValueChange={(v) => updateSeccion({ planoHijoId: v === "none" ? null : v })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none"><span>— Sin asignar —</span></SelectItem>
                  {planosHijos.map((p) => (
                    <SelectItem key={p.id} value={p.id}><span>{p.nombre} ({p.bloquesCount} bloques)</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={seccionSel.color} onChange={(e) => updateSeccion({ color: e.target.value })} className="h-7 w-10 cursor-pointer rounded border" />
                <Input className="h-7 text-xs font-mono flex-1" value={seccionSel.color} onChange={(e) => updateSeccion({ color: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-[10px]">Rotacion (grados)</Label>
              <div className="flex items-center gap-2">
                <Input className="h-7 text-xs flex-1" type="number" step={5} min={0} max={360} value={Math.round(seccionSel.rotacion)}
                  onChange={(e) => updateSeccion({ rotacion: clamp(Number(e.target.value), 0, 360) })} />
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Resetear rotacion"
                  onClick={() => updateSeccion({ rotacion: 0 })}>
                  <RotateCw className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <Button size="sm" variant="destructive" className="w-full rounded-full h-7 text-xs" onClick={deleteSeccion}>
              <Trash2 className="h-3 w-3 mr-1" /> Eliminar seccion
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center space-y-1">
            <Move className="h-4 w-4 mx-auto text-slate-400" />
            <p className="text-[11px] text-slate-400">Arrastra para mover — esquina ↘ redimensiona — circulo superior rota</p>
            <Expand className="h-4 w-4 mx-auto text-slate-400" />
          </div>
        )}

        <div className="rounded-xl border border-slate-200 p-3 text-[10px] text-slate-500 space-y-1">
          <p className="font-semibold text-slate-600">Como funciona</p>
          <p>1. Dibuja una seccion por pabellon sobre la imagen</p>
          <p>2. Asigna a cada seccion su plano 3D</p>
          <p>3. Asigna este plano macro al evento</p>
          <p>4. En /mapa el visitante ve el mapa de calor y entra a cada pabellon</p>
        </div>
      </div>

      <input ref={imgInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadImagen(f); e.target.value = ""; }} />
    </div>
  );
}
