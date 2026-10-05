"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge, Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { Layers, ZoomIn, ZoomOut, Maximize, ShoppingBag, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Loader2 } from "lucide-react";
import { usePlanoCarrito, totalCarrito, conteoPorPlano } from "@/lib/client/stores/plano-carrito-store";
import { planoVisitaCache } from "@/lib/client/stores/plano-visita-cache";
import { archivoUtils } from "@/lib/shared/utils/archivo";
import { PdfCanvas } from "@/components/plano/pdf-canvas";

export interface SeccionPublica {
  codigo: string;
  nombre: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotacion?: number;
  /** Seccion libre: N puntos normalizados [{x,y}]; null/ausente = rectangulo. */
  puntos?: Array<{ x: number; y: number }> | null;
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

/** D-pad flotante para desplazar el mapa en pantallas tactiles (donde no hay drag con mouse). */
function PadDesplazamiento({ onMover, className }: { onMover: (dx: number, dy: number) => void; className?: string }) {
  const boton = "h-10 w-10 rounded-full shadow-md";
  return (
    <div className={`grid grid-cols-3 grid-rows-3 place-items-center gap-1 rounded-2xl border border-border bg-card/90 p-1.5 shadow-sm backdrop-blur-sm ${className ?? ""}`}>
      <span />
      <Button type="button" size="icon" variant="secondary" className={boton} title="Desplazar arriba" onClick={() => onMover(0, -1)}>
        <ChevronUp className="h-4 w-4" />
      </Button>
      <span />
      <Button type="button" size="icon" variant="secondary" className={boton} title="Desplazar izquierda" onClick={() => onMover(-1, 0)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
      <Button type="button" size="icon" variant="secondary" className={boton} title="Desplazar derecha" onClick={() => onMover(1, 0)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <span />
      <Button type="button" size="icon" variant="secondary" className={boton} title="Desplazar abajo" onClick={() => onMover(0, 1)}>
        <ChevronDown className="h-4 w-4" />
      </Button>
      <span />
    </div>
  );
}

export function MacroMapaView({ imagenFondo, secciones, ocupacion, nombrePlano }: {
  imagenFondo: string | null;
  secciones: SeccionPublica[];
  ocupacion: OcupacionPublica[] | null;
  nombrePlano: string;
}) {
  const router = useRouter();
  const [zoom, setZoom] = useState(1);
  const [panning, setPanning] = useState(false);
  const [estadoFondo, setEstadoFondo] = useState<{ url: string; listo: boolean; error: boolean; anchoAlto?: number }>(() => {
    const cache = imagenFondo ? planoVisitaCache.fondoObtener(imagenFondo) : undefined;
    // Al volver al macro se muestra el skeleton SIEMPRE (estado intermedio limpio),
    // pero el cache hace el re-render casi instantaneo: aspecto reservado + documento PDF en memoria.
    return { url: imagenFondo ?? "", listo: false, error: false, anchoAlto: cache?.anchoAlto };
  });
  const [reintentos, setReintentos] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const fondoListo = !!imagenFondo && estadoFondo.url === imagenFondo && estadoFondo.listo;
  const fondoError = !!imagenFondo && estadoFondo.url === imagenFondo && estadoFondo.error;
  const ocupMap = new Map((ocupacion ?? []).map((o) => [o.seccionCodigo, o]));
  const seleccionesCarrito = usePlanoCarrito((s) => s.selecciones);
  const total = useMemo(() => totalCarrito(seleccionesCarrito), [seleccionesCarrito]);
  const conteo = useMemo(() => conteoPorPlano(seleccionesCarrito), [seleccionesCarrito]);

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

  // Seguridad: si la imagen no emite evento de carga en 8s, se muestra el error con reintento
  // (evita quedar clavado en la precarga). Los PDF no usan watchdog: pdfjs maneja su propio
  // error (onError) y un PDF pesado puede tardar mas de 8s en descargar/parsear/renderizar.
  useEffect(() => {
    if (!imagenFondo || fondoListo || fondoError) return;
    if (archivoUtils.esPdf(imagenFondo)) return;
    const timer = setTimeout(() => {
      setEstadoFondo((prev) => (prev.url === imagenFondo && !prev.listo && !prev.error ? { url: imagenFondo, listo: false, error: true } : prev));
      planoVisitaCache.fondoMarcar(imagenFondo, { listo: false, error: true });
    }, 8000);
    return () => clearTimeout(timer);
  }, [imagenFondo, fondoListo, fondoError]);

  const marcarFondo = (listo: boolean, error: boolean, anchoAlto?: number) => {
    if (!imagenFondo) return;
    setEstadoFondo({ url: imagenFondo, listo, error, anchoAlto: anchoAlto ?? estadoFondo.anchoAlto });
    planoVisitaCache.fondoMarcar(imagenFondo, { listo, error, anchoAlto: anchoAlto ?? estadoFondo.anchoAlto });
  };

  const irAPabellon = (s: SeccionPublica) => {
    if (!s.planoHijoCodigo) return;
    const parent = new URLSearchParams(window.location.search).get("codigo");
    const qs = new URLSearchParams({ codigo: s.planoHijoCodigo });
    if (parent) qs.set("parent", parent);
    router.push(`/mapa?${qs.toString()}`);
  };

  /** Arrastra el fondo para desplazar el mapa (las secciones siguen clickeables). */
  const startPan = (e: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    // En tactil el desplazamiento nativo + el D-pad se encargan.
    if (e.pointerType === "touch") return;
    if ((e.target as HTMLElement).closest("button")) return;
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    panRef.current = { startX: e.clientX, startY: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
    setPanning(true);

    const onMove = (ev: PointerEvent) => {
      const pan = panRef.current;
      if (!pan) return;
      el.scrollLeft = pan.scrollLeft - (ev.clientX - pan.startX);
      el.scrollTop = pan.scrollTop - (ev.clientY - pan.startY);
    };
    const onUp = (ev: PointerEvent) => {
      if (el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
      panRef.current = null;
      setPanning(false);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  };

  /** Desplaza el mapa un paso en la direccion indicada (controles tactiles). */
  const moverMapa = (dx: number, dy: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const pasoX = Math.max(140, Math.round(el.clientWidth * 0.5));
    const pasoY = Math.max(120, Math.round(el.clientHeight * 0.5));
    el.scrollBy({ left: dx * pasoX, top: dy * pasoY, behavior: "smooth" });
  };

  const reintentarFondo = () => {
    setEstadoFondo({ url: "", listo: false, error: false });
    if (imagenFondo) planoVisitaCache.fondoMarcar(imagenFondo, { listo: false, error: false });
    setReintentos((n) => n + 1);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-primary">{nombrePlano} — Mapa de pabellones</h2>
          {total > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-extrabold text-gold-foreground">
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>{total} {total === 1 ? "stand" : "stands"}</span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-border bg-secondary px-1 py-0.5">
            <Button size="sm" variant="ghost" className="h-6 w-6 rounded-full p-0" title="Alejar" onClick={() => setZoom((z) => clamp(z - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="w-10 text-center font-mono text-[10px] font-semibold text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <Button size="sm" variant="ghost" className="h-6 w-6 rounded-full p-0" title="Acercar" onClick={() => setZoom((z) => clamp(z + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 rounded-full p-0" title="Zoom 100%" onClick={() => setZoom(1)}>
              <Maximize className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#22c55e" }} /> Disponible</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#f59e0b" }} /> Pocos</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#ef4444" }} /> Casi lleno</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#94a3b8" }} /> Sin datos</span>
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} className="absolute inset-0 overflow-auto bg-slate-100 p-3" style={{ scrollbarGutter: "stable" }}>
        {imagenFondo ? (
            <div
              className={`relative select-none transition-opacity duration-200 ${panning ? "cursor-grabbing" : "cursor-grab"} ${fondoListo ? "opacity-100" : "opacity-0"}`}
              style={{ width: `${zoom * 100}%`, ...(estadoFondo.anchoAlto ? { aspectRatio: String(estadoFondo.anchoAlto) } : {}) }}
              onPointerDown={startPan}
            >
              {archivoUtils.esPdf(imagenFondo) ? (
                <PdfCanvas
                  key={`pdf-${imagenFondo}-${reintentos}`}
                  url={imagenFondo}
                  className="overflow-hidden rounded-lg bg-white"
                  alt="Mapa de pabellones (PDF)"
                  onListo={(anchoAlto) => marcarFondo(true, false, anchoAlto)}
                  onError={() => marcarFondo(false, true)}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`img-${reintentos}`}
                  src={imagenFondo}
                  alt="Mapa de pabellones"
                  loading="eager"
                  className="w-full h-auto block rounded-lg pointer-events-none"
                  draggable={false}
                  onLoad={(e) => marcarFondo(true, false, e.currentTarget.naturalWidth / (e.currentTarget.naturalHeight || 1))}
                  onError={() => marcarFondo(false, true)}
                />
              )}
            {fondoListo && secciones.map((s) => {
              const oc = ocupMap.get(s.codigo);
              const c = colorOcupacion(oc);
              const navegable = !!s.planoHijoCodigo;
              const enCarrito = s.planoHijoCodigo ? (conteo[s.planoHijoCodigo] ?? 0) : 0;
              const pts = Array.isArray(s.puntos) && s.puntos.length >= 3 ? s.puntos : null;
              const clip = pts
                ? `polygon(${pts.map((p) => `${((p.x - s.x) / s.w) * 100}% ${((p.y - s.y) / s.h) * 100}%`).join(", ")})`
                : undefined;
              const rel = pts ? pts.map((p) => `${((p.x - s.x) / s.w) * 100},${((p.y - s.y) / s.h) * 100}`).join(" ") : "";
              const cenX = pts ? pts.reduce((a, p) => a + p.x, 0) / pts.length : s.x + s.w / 2;
              const cenY = pts ? pts.reduce((a, p) => a + p.y, 0) / pts.length : s.y + s.h / 2;
              return (
                <div
                  key={s.codigo}
                  className={`absolute group touch-none ${navegable ? "cursor-pointer" : "cursor-not-allowed"}`}
                  style={{
                    left: `${s.x * 100}%`,
                    top: `${s.y * 100}%`,
                    width: `${s.w * 100}%`,
                    height: `${s.h * 100}%`,
                    transform: pts ? undefined : `rotate(${s.rotacion ?? 0}deg)`,
                    transformOrigin: "center",
                  }}
                  title={navegable ? `${s.nombre} — Entrar al pabellon` : `${s.nombre} — Sin plano asignado`}
                >
                  {enCarrito > 0 && (
                    <Badge className="pointer-events-none absolute -right-1.5 -top-1.5 z-30 h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-gold px-1 text-[10px] font-extrabold text-gold-foreground shadow">
                      <span>{enCarrito}</span>
                    </Badge>
                  )}
                  <button
                    type="button"
                    disabled={!navegable}
                    onClick={() => irAPabellon(s)}
                    className={`relative h-full w-full transition-all ${navegable ? "hover:brightness-110" : ""}`}
                    style={clip ? { clipPath: clip } : undefined}
                  >
                    {pts ? (
                      <span className="absolute inset-0" style={{ backgroundColor: `${c.bg}66` }} />
                    ) : (
                      <span
                        className={`absolute inset-0 rounded border-2 flex flex-col items-center justify-center gap-0.5 transition-all ${navegable ? "group-hover:scale-[1.02] group-hover:shadow-xl group-hover:z-20" : "opacity-70"}`}
                        style={{ backgroundColor: `${c.bg}66`, borderColor: c.border }}
                      >
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white truncate max-w-full"
                          style={{ backgroundColor: c.bg, transform: `rotate(${-(s.rotacion ?? 0)}deg)` }}
                        >
                          {s.nombre || s.codigo}
                        </span>
                        <span
                          className="text-[9px] font-medium text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
                          style={{ transform: `rotate(${-(s.rotacion ?? 0)}deg)` }}
                        >
                          {c.label}
                        </span>
                      </span>
                    )}
                  </button>
                  {pts && (
                    <>
                      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <polygon points={rel} fill="none" stroke={c.border} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                      </svg>
                      <span className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5" style={{ left: `${((cenX - s.x) / s.w) * 100}%`, top: `${((cenY - s.y) / s.h) * 100}%` }}>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white truncate max-w-full" style={{ backgroundColor: c.bg }}>{s.nombre || s.codigo}</span>
                        <span className="text-[9px] font-medium text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">{c.label}</span>
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Este mapa macro no tiene imagen o PDF de fondo configurado.
          </div>
        )}
        </div>
        {imagenFondo && !fondoListo && !fondoError && (
          <div className="absolute inset-0 z-50 overflow-hidden rounded-xl">
            <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground">Cargando mapa de pabellones...</p>
            </div>
          </div>
        )}
        {imagenFondo && fondoError && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-slate-100">
            <Layers className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-xs text-muted-foreground">No se pudo cargar el fondo del mapa.</p>
            <Button size="sm" variant="outline" className="rounded-full" onClick={reintentarFondo}>
              Reintentar
            </Button>
          </div>
        )}
        <PadDesplazamiento onMover={moverMapa} className="absolute bottom-3 right-3 z-30 md:hidden" />
      </div>

      <p className="border-t border-border bg-secondary px-4 py-2.5 text-center text-[11px] font-medium text-muted-foreground">
        <span className="hidden md:inline">Arrastra para mover · Ctrl + rueda para zoom · </span>
        <span className="md:hidden">Usa las flechas para desplazarte · </span>
        Haz clic en un pabellon para entrar a su plano 3D y reservar stands.
      </p>
    </div>
  );
}
