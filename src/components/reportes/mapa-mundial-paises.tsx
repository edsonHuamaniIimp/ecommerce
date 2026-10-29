"use client";

import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, Graticule, Sphere } from "react-simple-maps";
import worldData from "world-atlas/countries-110m.json";
import countries from "i18n-iso-countries";
import { Card, CardContent, CardHeader, CardTitle } from "@nrivera-iimp/ui-kit-iimp";
import { ArrowUpRight, Globe2 } from "lucide-react";
import { nombrePais } from "@/lib/shared/utils/pais";
import type { ResumenPaisSolicitudes } from "@/domain/models/reportes";

const TOPOLOGY = worldData as unknown as Parameters<typeof Geographies>[0]["geography"];

interface Props {
  data: ResumenPaisSolicitudes[];
}

interface HoverPais {
  pais: string;
  empresas: number;
  solicitudes: number;
}

export function MapaMundialPaises({ data }: Props) {
  const [hover, setHover] = useState<HoverPais | null>(null);

  const porPais = useMemo(() => {
    const mapa = new Map<string, ResumenPaisSolicitudes>();
    for (const fila of data) {
      if (fila.pais) mapa.set(fila.pais, fila);
    }
    return mapa;
  }, [data]);

  const maximo = useMemo(
    () => Math.max(...data.filter((fila) => fila.pais).map((fila) => fila.solicitudes), 1),
    [data],
  );

  const ranking = useMemo(
    () => [...data].sort((a, b) => b.solicitudes - a.solicitudes),
    [data],
  );

  const sinPais = data.find((fila) => !fila.pais);
  const paisesConDatos = data.filter((fila) => fila.pais).length;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="overflow-hidden border-primary/10 bg-gradient-to-br from-secondary/50 via-background to-primary/[0.04] shadow-sm">
        <div className="relative">
          <div className="absolute left-4 top-4 z-10 rounded-full border border-primary/15 bg-background/85 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary shadow-sm backdrop-blur">
            Mapa global
          </div>

          <div className="absolute right-4 top-4 z-10 min-w-[170px] rounded-xl border border-border/80 bg-background/90 px-3 py-2 text-right shadow-lg backdrop-blur">
            {hover ? (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wide text-primary">{nombrePais(hover.pais)}</p>
                <p className="mt-0.5 text-xs font-semibold text-foreground">
                  {hover.empresas} empresas · {hover.solicitudes} solicitudes
                </p>
              </>
            ) : (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Explora el mapa</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Pasa el cursor sobre un país</p>
              </>
            )}
          </div>

          <ComposableMap
            projection="geoEqualEarth"
            projectionConfig={{ scale: 158, center: [0, 8] }}
            className="h-auto w-full"
            width={900}
            height={500}
            aria-label="Mapa mundial de solicitudes por país"
          >
            <Sphere fill="var(--card)" stroke="var(--border)" strokeWidth={0.6} />
            <Graticule stroke="var(--border)" strokeWidth={0.35} opacity={0.55} />
            <Geographies geography={TOPOLOGY}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const pais = countries.numericToAlpha2(String(geo.id)) ?? null;
                  const fila = pais ? porPais.get(pais) : undefined;
                  const activo = Boolean(fila);
                  const hovered = hover?.pais === pais;
                  const intensidad = activo ? Math.max(0.24, (fila?.solicitudes ?? 0) / maximo) : 0;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={hovered ? "var(--gold)" : activo ? "var(--primary)" : "var(--secondary)"}
                      fillOpacity={hovered ? 0.95 : activo ? intensidad : 0.78}
                      stroke={hovered ? "var(--gold)" : "var(--border)"}
                      strokeWidth={hovered ? 1.1 : 0.55}
                      onMouseEnter={() => {
                        if (!pais) return;
                        setHover({
                          pais,
                          empresas: fila?.empresas ?? 0,
                          solicitudes: fila?.solicitudes ?? 0,
                        });
                      }}
                      onMouseLeave={() => setHover(null)}
                    >
                      <title>{`${pais ? nombrePais(pais) : geo.properties?.name ?? "País"}: ${fila?.solicitudes ?? 0} solicitudes`}</title>
                    </Geography>
                  );
                })
              }
            </Geographies>
          </ComposableMap>

          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/90 px-3 py-2 shadow-lg backdrop-blur">
            <span className="text-[11px] font-medium text-muted-foreground">
              {paisesConDatos} países con solicitudes registradas
            </span>
            <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
              <span>Menor</span>
              <span className="h-2 w-24 rounded-full bg-gradient-to-r from-primary/15 via-primary/50 to-primary" />
              <span>Mayor</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-secondary/30 pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Globe2 className="h-4 w-4 text-primary" />
              <span>Ranking de países</span>
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Solicitudes y empresas por ubicación.</p>
        </CardHeader>
        <CardContent className="space-y-2.5 pt-4">
          {ranking.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay solicitudes para los filtros seleccionados.</p>
          ) : (
            ranking.map((fila, index) => {
              const porcentaje = Math.round((fila.solicitudes / Math.max(ranking[0]?.solicitudes ?? 1, 1)) * 100);
              return (
                <div key={fila.pais ?? "sin-pais"} className="space-y-1.5 rounded-lg border border-border/80 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground">{fila.pais ? nombrePais(fila.pais) : "Sin país"}</p>
                        <p className="text-[10px] text-muted-foreground">{fila.empresas} empresas</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-foreground">{fila.solicitudes}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full ${fila.pais ? "bg-primary" : "bg-warning"}`}
                      style={{ width: `${Math.max(4, porcentaje)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
          {sinPais ? (
            <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Hay {sinPais.empresas} empresa(s) sin país confirmado. Se muestran en el ranking como “Sin país” y no se asignan al mapa.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
