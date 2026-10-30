"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { BarChart3, Layers, Loader2, MapPin } from "lucide-react";
import { PdfCanvas } from "@/components/plano/pdf-canvas";
import { MapaPabellon2D } from "@/components/reportes/mapa-pabellon-2d";
import { planosService } from "@/lib/client/api/services/planos-service";
import {
  REPORTES_METRICAS,
  REPORTES_MODOS_MAPA,
  REPORTES_TODOS_LOS_PAISES,
  TIPOS_PLANO,
  type ReporteMetrica,
  type ReporteModoMapa,
} from "@/lib/shared/constants";
import { archivoUtils } from "@/lib/shared/utils/archivo";
import { normalizarTexto } from "@/lib/shared/utils/normalizar-texto";
import { nombrePais } from "@/lib/shared/utils/pais";
import type {
  MapaPabellonesReporteDTO as MapaPabellonesData,
  PabellonMapaReporteDTO,
  ResumenPaisSolicitudesDTO,
} from "@/types/dto/reportes";
import type { PlanoPublicoPayloadDTO, PlanoPublicoSeccionDTO } from "@/types/dto/planos/planos-response.dto";

interface Props {
  data: MapaPabellonesData;
  paises: ResumenPaisSolicitudesDTO[];
  eventoId?: string | null;
  tipoEvento?: number;
  codigoEvento?: number;
}

function agregarPabellones(filas: PabellonMapaReporteDTO[]): PabellonMapaReporteDTO | null {
  const primero = filas[0];
  if (!primero) return null;
  const paises = new Map<string | null, { pais: string | null; empresas: number; solicitudes: number }>();
  let empresas = 0;
  let solicitudes = 0;
  for (const fila of filas) {
    empresas += fila.empresas;
    solicitudes += fila.solicitudes;
    for (const pais of fila.paises) {
      const actual = paises.get(pais.pais) ?? { pais: pais.pais, empresas: 0, solicitudes: 0 };
      actual.empresas += pais.empresas;
      actual.solicitudes += pais.solicitudes;
      paises.set(pais.pais, actual);
    }
  }
  return {
    planoCodigo: primero.planoCodigo,
    planoNombre: primero.planoNombre,
    pabellon: primero.pabellon,
    empresas,
    solicitudes,
    paises: [...paises.values()].sort((a, b) => b.solicitudes - a.solicitudes),
  };
}

function metricasDeSeccion(seccion: PlanoPublicoSeccionDTO, data: MapaPabellonesData): PabellonMapaReporteDTO | null {
  const porPlano = data.pabellones.filter((fila) => fila.planoCodigo && fila.planoCodigo === seccion.planoHijoCodigo);
  if (porPlano.length > 0) return agregarPabellones(porPlano);

  const nombreSeccion = normalizarTexto(seccion.nombre);
  const porNombre = data.pabellones.filter((fila) => {
    const nombrePabellon = normalizarTexto(fila.pabellon ?? "");
    const nombrePlano = normalizarTexto(fila.planoNombre ?? "");
    return nombrePabellon === nombreSeccion || nombrePlano === nombreSeccion;
  });
  return agregarPabellones(porNombre);
}

function valorMetrica(fila: PabellonMapaReporteDTO | null, metrica: ReporteMetrica, pais: string | null): number {
  if (!fila) return 0;
  if (!pais) return fila[metrica];
  return fila.paises.find((p) => p.pais === pais)?.[metrica] ?? 0;
}

function colorSeccion(valor: number, maximo: number, seleccionada: boolean): string {
  if (seleccionada) return "var(--gold)";
  if (valor <= 0) return "var(--secondary)";
  const intensidad = 0.22 + (valor / maximo) * 0.7;
  return `color-mix(in srgb, var(--primary) ${Math.round(intensidad * 100)}%, white)`;
}

export function MapaPabellonesReporte({ data, paises, eventoId, tipoEvento, codigoEvento }: Props) {
  const [macro, setMacro] = useState<PlanoPublicoPayloadDTO | null>(null);
  const [macroLoading, setMacroLoading] = useState(false);
  const [macroError, setMacroError] = useState<string | null>(null);
  const [seccion, setSeccion] = useState<PlanoPublicoSeccionDTO | null>(null);
  const [planoHijo, setPlanoHijo] = useState<PlanoPublicoPayloadDTO | null>(null);
  const [hijoLoading, setHijoLoading] = useState(false);
  const [metrica, setMetrica] = useState<ReporteMetrica>(REPORTES_METRICAS.SOLICITUDES);
  const [modo, setModo] = useState<ReporteModoMapa>(REPORTES_MODOS_MAPA.CALOR);
  const [paisSeleccionado, setPaisSeleccionado] = useState<string>(REPORTES_TODOS_LOS_PAISES);

  useEffect(() => {
    let activo = true;
    if (!eventoId) return () => { activo = false; };

    void (async () => {
      setMacroLoading(true);
      setMacroError(null);
      try {
        const payload = tipoEvento !== undefined && codigoEvento !== undefined
          ? await planosService.publico({ eventoId, tipoEvento, codigoEvento })
          : await planosService.publico({ eventoId });
        if (!activo) return;
        if (payload.tipo !== TIPOS_PLANO.MACRO) {
          setMacro(null);
          setMacroError("El evento no tiene un plano macro de pabellones.");
          return;
        }
        setMacro(payload);
        setSeccion(payload.secciones.find((s) => Boolean(s.planoHijoCodigo)) ?? payload.secciones[0] ?? null);
      } catch (error) {
        if (activo) {
          setMacro(null);
          setMacroError(error instanceof Error ? error.message : "No se pudo cargar el mapa de pabellones.");
        }
      } finally {
        if (activo) setMacroLoading(false);
      }
    })();

    return () => { activo = false; };
  }, [eventoId, tipoEvento, codigoEvento]);

  useEffect(() => {
    let activo = true;
    const codigo = seccion?.planoHijoCodigo;
    if (!codigo) return () => { activo = false; };

    void (async () => {
      setHijoLoading(true);
      try {
        const payload = await planosService.publico({ codigo, eventoId: eventoId ?? undefined });
        if (activo) setPlanoHijo(payload);
      } catch {
        if (activo) setPlanoHijo(null);
      } finally {
        if (activo) setHijoLoading(false);
      }
    })();

    return () => { activo = false; };
  }, [seccion, eventoId]);

  const paisFiltro = paisSeleccionado === REPORTES_TODOS_LOS_PAISES ? null : paisSeleccionado;
  const seccionesConMetricas = useMemo(
    () => (macro?.secciones ?? []).map((s) => ({ seccion: s, fila: metricasDeSeccion(s, data) })),
    [macro, data],
  );
  const maximo = useMemo(
    () => Math.max(1, ...seccionesConMetricas.map(({ fila }) => valorMetrica(fila, metrica, paisFiltro))),
    [seccionesConMetricas, metrica, paisFiltro],
  );
  const totalPaises = useMemo(
    () => new Set(data.pabellones.flatMap((fila) => fila.paises.map((p) => p.pais).filter(Boolean))).size,
    [data.pabellones],
  );
  const planoHijoSel = planoHijo?.codigo === seccion?.planoHijoCodigo ? planoHijo : null;

  if (!eventoId) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex h-56 flex-col items-center justify-center gap-2 text-center">
          <Layers className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Selecciona un evento</p>
          <p className="max-w-md text-xs text-muted-foreground">El mapa de pabellones necesita un evento activo para ubicar los stands.</p>
        </CardContent>
      </Card>
    );
  }

  if (macroLoading) {
    return (
      <Card>
        <CardContent className="flex h-72 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando mapa de pabellones...
        </CardContent>
      </Card>
    );
  }

  if (macroError || !macro) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex h-56 flex-col items-center justify-center gap-2 text-center">
          <Layers className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Mapa de pabellones no disponible</p>
          <p className="max-w-md text-xs text-muted-foreground">{macroError ?? "No se encontró un plano macro para el evento actual."}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border bg-secondary/30 pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="h-4 w-4 text-primary" />
              <span>Mapa de pabellones en 2D</span>
            </CardTitle>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {data.pabellones.length} pabellones con actividad - {totalPaises} países identificados.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={modo} onValueChange={(valor) => setModo(valor as ReporteModoMapa)}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <Layers className="mr-1 h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={REPORTES_MODOS_MAPA.CALOR}><span>Mapa de calor</span></SelectItem>
                <SelectItem value={REPORTES_MODOS_MAPA.PAIS}><span>Por país</span></SelectItem>
              </SelectContent>
            </Select>
            <Select value={metrica} onValueChange={(valor) => setMetrica(valor as ReporteMetrica)}>
              <SelectTrigger className="h-8 w-[145px] text-xs">
                <BarChart3 className="mr-1 h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={REPORTES_METRICAS.SOLICITUDES}><span>Solicitudes</span></SelectItem>
                <SelectItem value={REPORTES_METRICAS.EMPRESAS}><span>Empresas</span></SelectItem>
              </SelectContent>
            </Select>
            <Select value={paisSeleccionado} onValueChange={setPaisSeleccionado}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="Todos los países" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={REPORTES_TODOS_LOS_PAISES}><span>Todos los países</span></SelectItem>
                {paises.filter((fila) => fila.pais).map((fila) => (
                  <SelectItem key={fila.pais} value={fila.pais ?? REPORTES_TODOS_LOS_PAISES}>
                    <span>{nombrePais(fila.pais)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Vista general</p>
              <span className="text-[10px] text-muted-foreground">Clic en un pabellón</span>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-border bg-slate-100">
              {macro.imagenFondo ? (
                archivoUtils.esPdf(macro.imagenFondo) ? (
                  <PdfCanvas url={macro.imagenFondo} className="w-full" alt={`Mapa de pabellones ${macro.nombre}`} />
                ) : (
                  <img src={macro.imagenFondo} alt={`Mapa de pabellones ${macro.nombre}`} className="block h-auto w-full" />
                )
              ) : (
                <div className="flex aspect-[16/9] items-center justify-center text-xs text-muted-foreground">Sin imagen de fondo</div>
              )}
              <div className="absolute inset-0">
                {seccionesConMetricas.map(({ seccion: s, fila }) => {
                  const valor = valorMetrica(fila, metrica, paisFiltro);
                  const activa = seccion?.codigo === s.codigo;
                  const pts = Array.isArray(s.puntos) && s.puntos.length >= 3 ? s.puntos : null;
                  const clip = pts
                    ? `polygon(${pts.map((p) => `${((p.x - s.x) / s.w) * 100}% ${((p.y - s.y) / s.h) * 100}%`).join(", ")})`
                    : undefined;
                  return (
                    <button
                      key={s.codigo}
                      type="button"
                      disabled={!s.planoHijoCodigo}
                      onClick={() => setSeccion(s)}
                      className={`absolute flex items-center justify-center border-2 transition-all ${activa ? "z-20 shadow-lg" : "z-10 hover:z-20 hover:brightness-110"} ${s.planoHijoCodigo ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                      style={{
                        left: `${s.x * 100}%`,
                        top: `${s.y * 100}%`,
                        width: `${s.w * 100}%`,
                        height: `${s.h * 100}%`,
                        clipPath: clip,
                        backgroundColor: colorSeccion(valor, maximo, activa),
                        borderColor: activa ? "var(--gold)" : "color-mix(in srgb, var(--primary) 55%, white)",
                      }}
                      title={`${s.nombre}: ${valor} ${metrica}${paisFiltro ? ` de ${nombrePais(paisFiltro)}` : ""}`}
                    >
                      <span className="max-w-[90%] truncate rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm">
                        {s.nombre}
                      </span>
                      {valor > 0 ? <span className="absolute bottom-1 right-1 rounded-full bg-background/90 px-1.5 text-[9px] font-bold text-primary">{valor}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-2"><span>Menor</span><span className="h-2 w-20 rounded-full bg-gradient-to-r from-secondary via-primary/45 to-primary" /><span>Mayor</span></span>
              <span>{paisFiltro ? nombrePais(paisFiltro) : "Todos los países"}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Detalle del pabellón</p>
              {seccion ? <Badge variant="secondary"><span>{seccion.nombre}</span></Badge> : null}
            </div>
            {hijoLoading ? (
              <div className="flex h-72 items-center justify-center gap-2 rounded-xl border border-border text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando plano...
              </div>
            ) : planoHijoSel && seccion ? (
              <MapaPabellon2D
                plano={planoHijoSel}
                bloques={data.bloques}
                metrica={metrica}
                modo={modo}
                paisSeleccionado={paisFiltro}
              />
            ) : (
              <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/20 px-4 text-center">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Selecciona un pabellón con plano asignado</p>
                <p className="text-xs text-muted-foreground">Los pabellones sin plano hijo no tienen mapa 2D disponible.</p>
              </div>
            )}
          </div>
        </div>

        {data.pabellones.length === 0 ? (
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-muted-foreground">
            No hay solicitudes con stand asociado para el evento y filtros seleccionados.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
