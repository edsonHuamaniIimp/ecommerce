"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { planosService } from "@/lib/client/api/services/planos-service";
import { loadPlanoDefinition } from "@/lib/shared/planos/registry";
import type { PlanoDefinition } from "@/lib/shared/planos/registry";
import { construirSvgRecorte } from "@/lib/shared/utils/recorte-plano";

interface Props {
  /** Bloques de los stands del cliente (`gess_stand.bloqueId`), uno o varios (reserva multiple). */
  bloqueIds: string[];
  className?: string;
  /** Oculta la leyenda de tipos (espacios reducidos). */
  sinLeyenda?: boolean;
  /** Permite exportar el recorte a PNG (para el contrato). */
  ref?: React.Ref<RecortePlanoHandle>;
}

/** Handle imperativo: rasteriza el SVG del recorte a PNG. */
export interface RecortePlanoHandle {
  exportarPng: () => Promise<Blob | null>;
}

const ANCHO_PNG = 1600;

/**
 * RF-08: recorte del pabellon (vista top-down de TODO el pabellon) con los stands del
 * cliente destacados, para que entienda su ubicacion respecto de los demas stands.
 * El SVG se construye con la util compartida (misma que usa el contrato en el servidor).
 */
export function RecortePlano({ bloqueIds, className, sinLeyenda = false, ref }: Props) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const [estado, setEstado] = useState<{ def: PlanoDefinition | null; error: string | null; listo: boolean }>({
    def: null,
    error: null,
    listo: false,
  });

  const clave = useMemo(() => [...bloqueIds].sort().join("|"), [bloqueIds]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const primero = bloqueIds[0];
        if (!primero) throw new Error("sin stands");
        const ubicacion = await planosService.ubicacion(primero);
        const def = await loadPlanoDefinition(ubicacion.plano.codigo);
        if (!vivo) return;
        setEstado({
          def: def ?? null,
          error: def ? null : "No se encontro el plano del pabellon.",
          listo: true,
        });
      } catch {
        if (vivo) setEstado({ def: null, error: "El stand aun no tiene ubicacion en el plano.", listo: true });
      }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const vista = useMemo(() => {
    if (!estado.def) return null;
    const items = estado.def.buildItems();
    const etiquetas: Record<string, string> = {};
    for (const [codigo, etiqueta] of Object.entries(estado.def.blockLabel)) {
      etiquetas[codigo] = etiqueta.label;
    }
    const { svg, encontrado } = construirSvgRecorte(items, bloqueIds, { etiquetas, sinLeyenda });
    if (!encontrado) return null;
    return { svg };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.def, clave, sinLeyenda]);

  const base = className ?? "w-full";

  /* RF-08 (F2): rasteriza el SVG a PNG con canvas (sin dependencias). */
  useImperativeHandle(ref, () => ({
    exportarPng: async () => {
      const svg = contenedorRef.current?.querySelector("svg");
      if (!svg || !vista) return null;

      const viewBox = svg.getAttribute("viewBox")?.split(/\s+/).map(Number) ?? [];
      const w = viewBox[2] ?? 1;
      const h = viewBox[3] ?? 1;
      const altoSalida = Math.round((ANCHO_PNG * h) / w);

      const clon = svg.cloneNode(true) as SVGSVGElement;
      clon.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clon.setAttribute("width", String(ANCHO_PNG));
      clon.setAttribute("height", String(altoSalida));

      const data = new XMLSerializer().serializeToString(clon);
      const svgUrl = URL.createObjectURL(new Blob([data], { type: "image/svg+xml;charset=utf-8" }));
      try {
        const imagen = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("No se pudo rasterizar el recorte"));
          img.src = svgUrl;
        });
        const canvas = document.createElement("canvas");
        canvas.width = ANCHO_PNG;
        canvas.height = altoSalida;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height);
        return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
      } finally {
        URL.revokeObjectURL(svgUrl);
      }
    },
  }));

  if (!estado.listo) {
    return (
      <div className={`${base} flex aspect-[16/10] items-center justify-center rounded-lg border border-border bg-secondary`}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (estado.error || !vista) {
    return (
      <div className={`${base} flex aspect-[16/10] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-secondary px-4 text-center`}>
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{estado.error ?? "El stand no aparece en el plano del pabellon."}</p>
      </div>
    );
  }

  return (
    <div
      ref={contenedorRef}
      className={`${base} overflow-hidden rounded-lg border border-border bg-white [&>svg]:block [&>svg]:h-auto [&>svg]:w-full`}
      role="img"
      aria-label={`Ubicacion de ${bloqueIds.length > 1 ? `los stands ${bloqueIds.join(", ")}` : `el stand ${bloqueIds[0] ?? ""}`} en el pabellon`}
      dangerouslySetInnerHTML={{ __html: vista.svg }}
    />
  );
}
