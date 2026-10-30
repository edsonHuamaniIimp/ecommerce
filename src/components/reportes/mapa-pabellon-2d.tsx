"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@nrivera-iimp/ui-kit-iimp";
import { MapPin } from "lucide-react";
import BanderaSvg from "@/components/debida-diligencia/dd-pais-bandera-svg";
import { DdPaisBandera } from "@/components/debida-diligencia/dd-pais-bandera";
import { REPORTES_MODOS_MAPA, type ReporteMetrica, type ReporteModoMapa } from "@/lib/shared/constants";
import { nombrePais } from "@/lib/shared/utils/pais";
import type { BloqueMapaReporteDTO, PaisMetricaPabellonDTO } from "@/types/dto/reportes";
import type { PlanoPublicoPayloadDTO } from "@/types/dto/planos/planos-response.dto";

const COLORES_PAIS = [
  "#2563eb",
  "#0f766e",
  "#b45309",
  "#7c3aed",
  "#be123c",
  "#0369a1",
  "#4d7c0f",
  "#a21caf",
  "#c2410c",
  "#1d4ed8",
  "#15803d",
  "#9f1239",
];

function colorPais(pais: string | null): string {
  if (!pais) return "#94a3b8";
  let hash = 0;
  for (const char of pais) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLORES_PAIS[hash % COLORES_PAIS.length] ?? "#2563eb";
}

function numero(valor: number): string {
  return new Intl.NumberFormat("es-PE").format(valor);
}


function colorCalor(intensidad: number): string {
  return `color-mix(in srgb, var(--primary) ${Math.round(22 + intensidad * 78)}%, white)`;
}

function valorMetrica(fila: BloqueMapaReporteDTO, metrica: ReporteMetrica, pais: string | null): number {
  if (!pais) return fila[metrica];
  return fila.paises.find((p) => p.pais === pais)?.[metrica] ?? 0;
}

function paisPrincipal(fila: BloqueMapaReporteDTO): string | null {
  return fila.paises[0]?.pais ?? null;
}

function resumenPaises(bloques: BloqueMapaReporteDTO[], metrica: ReporteMetrica): PaisMetricaPabellonDTO[] {
  const mapa = new Map<string | null, PaisMetricaPabellonDTO>();
  for (const bloque of bloques) {
    for (const pais of bloque.paises) {
      const actual = mapa.get(pais.pais) ?? { pais: pais.pais, empresas: 0, solicitudes: 0 };
      actual.empresas += pais.empresas;
      actual.solicitudes += pais.solicitudes;
      mapa.set(pais.pais, actual);
    }
  }
  return [...mapa.values()].sort((a, b) => b[metrica] - a[metrica]);
}

interface Props {
  plano: PlanoPublicoPayloadDTO;
  bloques: BloqueMapaReporteDTO[];
  metrica: ReporteMetrica;
  modo: ReporteModoMapa;
  paisSeleccionado: string | null;
}

export function MapaPabellon2D({ plano, bloques, metrica, modo, paisSeleccionado }: Props) {
  const [hover, setHover] = useState<BloqueMapaReporteDTO | null>(null);

  const metricasPorBloque = useMemo(
    () => new Map(bloques.filter((b) => b.planoCodigo === plano.codigo).map((b) => [b.bloqueId, b])),
    [bloques, plano.codigo],
  );

  const dimensiones = useMemo(() => {
    const dims = new Map(plano.tipos.map((tipo) => [tipo.codigo, tipo]));
    const items = plano.bloques
      .filter((bloque) => bloque.flgActivo !== false)
      .map((bloque) => {
        const tipo = dims.get(bloque.tipoCodigo);
        return { ...bloque, w: tipo?.w ?? 2, d: tipo?.d ?? 2 };
      });
    if (items.length === 0) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const item of items) {
      minX = Math.min(minX, item.x - item.w / 2);
      maxX = Math.max(maxX, item.x + item.w / 2);
      minY = Math.min(minY, item.z - item.d / 2);
      maxY = Math.max(maxY, item.z + item.d / 2);
    }
    const margen = Math.max(maxX - minX, maxY - minY) * 0.04;
    return { items, minX: minX - margen, maxX: maxX + margen, minY: minY - margen, maxY: maxY + margen };
  }, [plano]);

  const maximo = useMemo(
    () => Math.max(1, ...bloques.filter((b) => b.planoCodigo === plano.codigo).map((b) => valorMetrica(b, metrica, paisSeleccionado))),
    [bloques, metrica, paisSeleccionado, plano.codigo],
  );

  const paises = useMemo(() => resumenPaises(bloques.filter((b) => b.planoCodigo === plano.codigo), metrica), [bloques, metrica, plano.codigo]);
  const conDatos = bloques.filter((b) => b.planoCodigo === plano.codigo && valorMetrica(b, metrica, paisSeleccionado) > 0).length;

  if (!dimensiones) {
    return (
      <Card>
        <CardContent className="flex h-64 flex-col items-center justify-center gap-2 text-center">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Este pabellón aún no tiene bloques.</p>
          <p className="text-xs text-muted-foreground">Carga su plano en el Laboratorio 3D para visualizarlo aquí.</p>
        </CardContent>
      </Card>
    );
  }

  const { items, minX, maxX, minY, maxY } = dimensiones;
  const viewBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border bg-secondary/30 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-primary" />
            <span>{plano.nombre} - mapa 2D</span>
          </CardTitle>
          <span className="text-[10px] font-medium text-muted-foreground">
            {conDatos} de {items.length} stands con actividad
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {paisSeleccionado ? `Resaltando ${nombrePais(paisSeleccionado)}.` : "Concentración de la métrica seleccionada por stand."}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <div className="overflow-hidden rounded-lg border border-border bg-slate-50 p-2">
          <svg viewBox={viewBox} className="h-auto max-h-[560px] w-full" role="img" aria-label={`Mapa 2D de ${plano.nombre}`}>
            <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill="#f8fafc" />
            {items.map((item) => {
              const fila = metricasPorBloque.get(item.bloqueId);
              const valor = fila ? valorMetrica(fila, metrica, paisSeleccionado) : 0;
              const pais = fila ? (paisSeleccionado ?? paisPrincipal(fila)) : null;
              const esPaisSeleccionado = Boolean(paisSeleccionado && pais === paisSeleccionado);
              const relleno = valor <= 0
                ? "#e2e8f0"
                : modo === REPORTES_MODOS_MAPA.PAIS || paisSeleccionado
                  ? paisSeleccionado && !esPaisSeleccionado ? "#cbd5e1" : colorPais(pais)
                  : colorCalor(valor / maximo);
              const mostrarBandera = Boolean(fila && valor > 0);
              return (
                <g
                  key={item.bloqueId}
                  transform={`rotate(${item.rotY ?? 0} ${item.x} ${item.z})`}
                  onMouseEnter={() => setHover(fila ?? null)}
                  onMouseLeave={() => setHover(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x={item.x - item.w / 2}
                    y={item.z - item.d / 2}
                    width={item.w}
                    height={item.d}
                    rx={Math.min(item.w, item.d) * 0.08}
                    fill={relleno}
                    stroke={valor > 0 ? "#ffffff" : "#94a3b8"}
                    strokeWidth={Math.max(0.08, Math.max(maxX - minX, maxY - minY) * 0.002)}
                  />
                  {mostrarBandera && pais ? (
                    <svg
                      x={item.x - Math.min(item.w, item.d) * 0.3}
                      y={item.z - Math.min(item.w, item.d) * 0.2}
                      width={Math.min(item.w, item.d) * 0.6}
                      height={Math.min(item.w, item.d) * 0.4}
                      viewBox="0 0 3 2"
                      pointerEvents="none"
                    >
                      <BanderaSvg codigo={pais} titulo={nombrePais(pais)} className="h-full w-full" />
                    </svg>
                  ) : null}
                  <title>{`${item.bloqueId}: ${fila ? `${numero(valor)} ${metrica}` : "Sin datos"}`}</title>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#e2e8f0]" /> Sin datos</span>
            {paisSeleccionado ? (
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colorPais(paisSeleccionado) }} />
                {nombrePais(paisSeleccionado)}
              </span>
            ) : modo === REPORTES_MODOS_MAPA.PAIS ? (
              paises.slice(0, 7).map((pais) => (
                <span key={pais.pais ?? "sin-pais"} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colorPais(pais.pais) }} />
                  <DdPaisBandera pais={pais.pais} />
                  <span>{pais.pais ? nombrePais(pais.pais) : "Sin país"}</span>
                </span>
              ))
            ) : (
              <span className="flex items-center gap-1.5">
                <span>Menor</span>
                <span className="h-2 w-20 rounded-full bg-gradient-to-r from-primary/20 via-primary/60 to-primary" />
                <span>Mayor</span>
              </span>
            )}
          </div>
          <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-right text-[11px]">
            {hover ? (
              <>
                <p className="font-mono font-semibold text-foreground">{hover.bloqueId}</p>
                <p className="text-muted-foreground">
                  {numero(valorMetrica(hover, metrica, paisSeleccionado))} {metrica}
                  {hover.paises[0]?.pais ? ` - ${nombrePais(hover.paises[0].pais)}` : ""}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Pasa el cursor sobre un stand para ver su detalle.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

