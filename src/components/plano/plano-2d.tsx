"use client";

import { useMemo } from "react";
import type { PlanoPublicoPayloadDTO, PlanoTipoDTO } from "@/types/dto/planos/planos-response.dto";

const ESCALA_BASE = 18;
const ANCHO_MAX_PX = 2000;
export const PLANO_2D_ZOOM_MIN = 0.5;
export const PLANO_2D_ZOOM_MAX = 3;
export const PLANO_2D_ZOOM_PASO = 0.25;

interface Bloque2D {
  id: string;
  tipo: string;
  label: string;
  nombre: string;
  color: string;
  x: number;
  z: number;
  w: number;
  d: number;
  rotY: number;
}

/**
 * Vista 2D de un pabellon construida desde el MISMO payload que usa el 3D
 * (`/api/planos/publico`): rectangulos top-down, sin rotacion ni Canvas,
 * para que los stands no salgan girados ni borrosos. El tipo no se pinta
 * dentro de cada stand: se explica en la leyenda.
 */
export function Plano2D({ payload, codigoComercialPorBloque, zoom = 1 }: {
  payload: PlanoPublicoPayloadDTO;
  /** bloqueId (3D) -> codigo comercial del stand. Sin entrada = sin texto. */
  codigoComercialPorBloque?: Record<string, string>;
  zoom?: number;
}) {
  const { bloques, leyenda, escala, ancho, alto, offsetX, offsetZ } = useMemo(() => {
    const tipos = new Map<string, PlanoTipoDTO>((payload.tipos ?? []).map((t) => [t.codigo, t]));
    const bloques: Bloque2D[] = (payload.bloques ?? [])
      .filter((b) => b.flgActivo !== false)
      .filter((b) => {
        /* La maquinaria (forma != bloque) se pinta en el 3D como decoracion;
           en el 2D se omite para que no tape a los stands. */
        const tipo = tipos.get(b.tipoCodigo);
        return !tipo || tipo.forma === undefined || tipo.forma === "bloque";
      })
      .map((b) => {
        const tipo = tipos.get(b.tipoCodigo);
        return {
          id: b.bloqueId,
          tipo: b.tipoCodigo,
          label: tipo?.label ?? b.tipoCodigo,
          nombre: tipo?.nombre ?? b.tipoCodigo,
          color: tipo?.color ?? "#94a3b8",
          x: b.x,
          z: b.z,
          w: tipo?.w ?? 2,
          d: tipo?.d ?? 2,
          rotY: b.rotY,
        };
      });
    const usados = new Set(bloques.map((b) => b.tipo));
    const leyenda = (payload.tipos ?? []).filter((t) => usados.has(t.codigo));
    const minX = Math.min(...bloques.map((b) => b.x - b.w / 2));
    const maxX = Math.max(...bloques.map((b) => b.x + b.w / 2));
    const minZ = Math.min(...bloques.map((b) => b.z - b.d / 2));
    const maxZ = Math.max(...bloques.map((b) => b.z + b.d / 2));
    const margen = 4;
    const escala = Math.min(ESCALA_BASE, ANCHO_MAX_PX / (maxX - minX + margen * 2));
    return {
      bloques,
      leyenda,
      escala,
      ancho: (maxX - minX + margen * 2) * escala,
      alto: (maxZ - minZ + margen * 2) * escala,
      offsetX: -minX + margen,
      offsetZ: -minZ + margen,
    };
  }, [payload]);

  const escalaFinal = escala * zoom;
  const anchoFinal = ancho * zoom;
  const altoFinal = alto * zoom;

  return (
    <div className="rounded-md border border-border bg-white p-3">
      <div className="max-h-[68vh] overflow-auto">
        <div className="relative" style={{ width: anchoFinal, height: altoFinal }}>
          {bloques.map((b) => (
            <div
              key={b.id}
              title={`${b.nombre} · ${b.id}`}
              className="absolute flex items-center justify-center overflow-visible text-center leading-tight"
              style={{
                left: (b.x - b.w / 2 + offsetX) * escalaFinal,
                top: (b.z - b.d / 2 + offsetZ) * escalaFinal,
                width: b.w * escalaFinal,
                height: b.d * escalaFinal,
              }}
            >
              <div
                className="absolute inset-0 border"
                style={{
                  backgroundColor: b.color,
                  borderColor: "rgba(0,0,0,0.35)",
                  transform: `rotate(${-b.rotY}rad)`,
                }}
              />
              {codigoComercialPorBloque?.[b.id] ? (
                <span className="relative z-10 max-w-full truncate px-0.5 text-[8px] font-semibold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]" style={{ fontSize: `${Math.max(8, Math.min(13, 8 * zoom))}px` }}>
                  {codigoComercialPorBloque[b.id]}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {leyenda.map((tipo) => (
          <div key={tipo.codigo} className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 shrink-0 rounded-sm border border-black/20"
              style={{ backgroundColor: tipo.color }}
            />
            <span className="text-[11px] font-medium text-foreground">
              {tipo.label} - {tipo.nombre}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
