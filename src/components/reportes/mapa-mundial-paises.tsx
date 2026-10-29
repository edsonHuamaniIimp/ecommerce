"use client";

import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, Graticule, Sphere } from "react-simple-maps";
import worldData from "world-atlas/countries-110m.json";
import countries from "i18n-iso-countries";
import { Card, CardContent, CardHeader, CardTitle } from "@nrivera-iimp/ui-kit-iimp";
import { Globe2 } from "lucide-react";
import { nombrePais } from "@/lib/shared/utils/pais";
import type { ResumenPaisSolicitudes } from "@/domain/models/reportes";

const TOPOLOGY = worldData as unknown as Parameters<typeof Geographies>[0]["geography"];

interface Props {
  data: ResumenPaisSolicitudes[];
}

export function MapaMundialPaises({ data }: Props) {
  const [hover, setHover] = useState<{ pais: string; empresas: number; solicitudes: number } | null>(null);

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

  const colorPais = (pais: string | null): string => {
    if (!pais) return "var(--muted)";
    const fila = porPais.get(pais);
    if (!fila) return "var(--secondary)";
    const intensidad = Math.max(0.18, fila.solicitudes / maximo);
    return `hsl(var(--primary) / ${intensidad})`;
  };

  const empresasTotal = data.reduce((total, fila) => total + fila.empresas, 0);
  const solicitudesTotal = data.reduce((total, fila) => total + fila.solicitudes, 0);
  const paisesTotal = data.filter((fila) => fila.pais).length;
  const sinPais = data.find((fila) => !fila.pais);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Globe2 className="h-4 w-4 text-primary" />
              <span>Solicitudes por país</span>
            </CardTitle>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Intensidad según cantidad de solicitudes. Pasa el cursor sobre un país para ver el detalle.
            </p>
          </div>
          {hover ? (
            <div className="rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{nombrePais(hover.pais)}</p>
              <p className="text-xs font-semibold text-foreground">{hover.empresas} empresas · {hover.solicitudes} solicitudes</p>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-hidden rounded-xl border border-border bg-secondary/20">
            <ComposableMap
              projection="geoEqualEarth"
              projectionConfig={{ scale: 150 }}
              className="h-auto w-full"
              width={800}
              height={420}
              aria-label="Mapa mundial de solicitudes por país"
            >
              <Sphere fill="var(--card)" stroke="var(--border)" strokeWidth={0.5} />
              <Graticule stroke="var(--border)" strokeWidth={0.3} />
              <Geographies geography={TOPOLOGY}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const pais = countries.numericToAlpha2(String(geo.id)) ?? null;
                    const fila = pais ? porPais.get(pais) : undefined;
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fila ? colorPais(pais) : "var(--secondary)"}
                        stroke="var(--border)"
                        strokeWidth={0.35}
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
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
            <span>{paisesTotal} países con datos</span>
            <span>{empresasTotal} empresas</span>
            <span>{solicitudesTotal} solicitudes</span>
            <span className="inline-flex items-center gap-1.5">
              Intensidad
              <span className="h-2.5 w-20 rounded-full bg-gradient-to-r from-secondary via-primary/40 to-primary" />
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="text-sm font-semibold">Detalle por país</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-4">
          {data.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay solicitudes para los filtros seleccionados.</p>
          ) : (
            data.map((fila) => (
              <div key={fila.pais ?? "sin-pais"} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">{fila.pais ? nombrePais(fila.pais) : "Sin país"}</p>
                  <p className="text-[10px] text-muted-foreground">{fila.pais ?? "Empresa sin país confirmado"}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold text-foreground">{fila.solicitudes}</p>
                  <p className="text-[10px] text-muted-foreground">{fila.empresas} empresas</p>
                </div>
              </div>
            ))
          )}
          {sinPais ? (
            <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-muted-foreground">
              Hay empresas sin país confirmado. Se muestran en “Sin país” y no se asignan al mapa.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
