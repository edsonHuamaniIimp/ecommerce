"use client";

import Image from "next/image";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@nrivera-iimp/ui-kit-iimp";
import { Layers, ZoomIn, ZoomOut, Maximize } from "lucide-react";

export interface SeccionPublica {
  codigo: string;
  nombre: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotacion?: number;
  color: string;
  planoHijoId: string | null;
  planoHijoCodigo?: string | null;
}

export interface OcupacionPublica {
  seccionCodigo: string;
  total: number;
  disponibles: number;
  pctDisponible: number;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 6;
const ZOOM_STEP = 0.25;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function colorOcupacion(oc: OcupacionPublica | undefined): { bg: string; border: string; label: string } {
  if (!oc || oc.total === 0) return { bg: "#94a3b8", border: "#64748b", label: "Sin stands" };
  if (oc.pctDisponible > 50) return { bg: "#22c55e", border: "#15803d", label: `${oc.disponibles}/${oc.total} disp.` };
  if (oc.pctDisponible >= 20) return { bg: "#f59e0b", border: "#b45309", label: `${oc.disponibles}/${oc.total} disp.` };
  return { bg: "#ef4444", border: "#b91c1c", label: `${oc.disponibles}/${oc.total} disp.` };
}

export function MacroMapaView({ imagenFondo, secciones, ocupacion, nombrePlano }: {
  imagenFondo: string | null;
  secciones: SeccionPublica[];
  ocupacion: OcupacionPublica[] | null;
  nombrePlano: string;
}) {
  const router = useRouter();
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ocupMap = new Map((ocupacion ?? []).map((o) => [o.seccionCodigo, o]));

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => clamp(z + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), ZOOM_MIN, ZOOM_MAX));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [imagenFondo]);

  const irAPabellon = (s: SeccionPublica) => {
    if (!s.planoHijoCodigo) return;
    const parent = new URLSearchParams(window.location.search).get("codigo");
    const qs = new URLSearchParams({ codigo: s.planoHijoCodigo });
    if (parent) qs.set("parent", parent);
    router.push(`/mapa?${qs.toString()}`);
  };

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-violet-600" />
        <h2 className="text-sm font-semibold text-slate-800">{nombrePlano} — Mapa de pabellones</h2>
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1 py-0.5 ml-2">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded-full" title="Alejar" onClick={() => setZoom((z) => clamp(z - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-[10px] font-mono font-semibold text-slate-600 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded-full" title="Acercar" onClick={() => setZoom((z) => clamp(z + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded-full" title="Zoom 100%" onClick={() => setZoom(1)}>
            <Maximize className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#22c55e" }} /> Disponible</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#f59e0b" }} /> Pocos</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#ef4444" }} /> Casi lleno</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#94a3b8" }} /> Sin datos</span>
        </div>
      </div>

      <div ref={scrollRef} className="relative flex-1 min-h-0 rounded-xl border border-slate-200 bg-slate-100 overflow-auto p-3">
        {imagenFondo ? (
          <div className="relative select-none" style={{ width: `${zoom * 100}%` }}>
            <Image width={0} height={0} sizes="100vw" src={imagenFondo} alt="Mapa de pabellones" className="w-full h-auto block rounded-lg pointer-events-none" draggable={false} />
            {secciones.map((s) => {
              const oc = ocupMap.get(s.codigo);
              const c = colorOcupacion(oc);
              const navegable = !!s.planoHijoCodigo;
              return (
                <button
                  key={s.codigo}
                  type="button"
                  disabled={!navegable}
                  onClick={() => irAPabellon(s)}
                  className={`absolute group touch-none ${navegable ? "cursor-pointer" : "cursor-not-allowed"}`}
                  style={{
                    left: `${s.x * 100}%`,
                    top: `${s.y * 100}%`,
                    width: `${s.w * 100}%`,
                    height: `${s.h * 100}%`,
                    transform: `rotate(${s.rotacion ?? 0}deg)`,
                    transformOrigin: "center",
                  }}
                  title={navegable ? `${s.nombre} — Entrar al pabellon` : `${s.nombre} — Sin plano asignado`}
                >
                  <div
                    className={`h-full w-full rounded border-2 flex flex-col items-center justify-center gap-0.5 transition-all ${navegable ? "group-hover:scale-[1.02] group-hover:shadow-xl group-hover:z-20" : "opacity-70"}`}
                    style={{ backgroundColor: `${c.bg}66`, borderColor: c.border }}
                  >
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white truncate max-w-full"
                      style={{ backgroundColor: c.bg, transform: `rotate(${-(s.rotacion ?? 0)}deg)` }}
                    >
                      {s.codigo}
                    </span>
                    <span
                      className="text-[9px] font-medium text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
                      style={{ transform: `rotate(${-(s.rotacion ?? 0)}deg)` }}
                    >
                      {c.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Este mapa macro no tiene imagen de fondo configurada.
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        Haz click en un pabellon para entrar a su plano 3D y reservar stands.
      </p>
    </div>
  );
}
