"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { ChevronDown, ExternalLink, FileText, FolderOpen, Paperclip, Users } from "lucide-react";
import { DdEvidenciaPreviewButton } from "./dd-evidencia-preview-button";
import { DdMatrizResultadoFinalBadge } from "./dd-matriz-badges";
import { DdPaisBandera } from "./dd-pais-bandera";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import {
  DD_MATRIZ_EVAL_PER_PAGE_MAX,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_RUTAS,
  type DdMatrizTipoVinculo,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import {
  ddEvidenciaDetalles,
  etiquetaCategoriaAdjunto,
  formatearTamano,
} from "@/lib/shared/utils/dd-evidencia-detalles";
import type { DdMatrizEvaluacionDetalleDTO } from "@/types/dto/debida-diligencia";

interface Props {
  expedienteId: string;
}

type Filtro = "con-evidencias" | "todos";

/** Sin el prefijo "Criterio: " (el chip ya lo dice por contexto). */
function nombreCriterio(categoria: string): string {
  return etiquetaCategoriaAdjunto(categoria).replace(/^Criterio:\s*/, "");
}

function Resumen({ icono, valor, etiqueta }: { icono: React.ReactNode; valor: number; etiqueta: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">{icono}</span>
      <div>
        <p className="text-lg font-bold leading-none text-foreground">{valor}</p>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
      </div>
    </div>
  );
}

/**
 * Vinculos del expediente (empresa, representante, beneficiarios...) con las evidencias
 * que se adjuntaron en la matriz a cada uno, para revisarlas sin salir de la ventana.
 */
export function DdVinculosEvidencias({ expedienteId }: Props) {
  const [vinculos, setVinculos] = useState<DdMatrizEvaluacionDetalleDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  const [filtro, setFiltro] = useState<Filtro>("con-evidencias");

  useEffect(() => {
    let activo = true;
    (async () => {
      const filas = [];
      for (let page = 1; ; page += 1) {
        const respuesta = await ddMatrizEvaluacionService.listar({
          expedienteId,
          page,
          perPage: DD_MATRIZ_EVAL_PER_PAGE_MAX,
        });
        filas.push(...respuesta.data);
        if (page >= respuesta.totalPages) break;
      }
      const detalles = await Promise.all(filas.map((fila) => ddMatrizEvaluacionService.detalle(fila.id)));
      if (activo) setVinculos(detalles);
    })().catch((e) => {
      if (activo) setError(e instanceof Error ? e.message : "No se pudieron cargar los vínculos");
    });
    return () => {
      activo = false;
    };
  }, [expedienteId]);

  const conEvidencias = useMemo(() => (vinculos ?? []).filter((vinculo) => vinculo.adjuntos.length > 0), [vinculos]);
  const totalEvidencias = useMemo(
    () => conEvidencias.reduce((total, vinculo) => total + vinculo.adjuntos.length, 0),
    [conEvidencias],
  );
  const visibles = filtro === "con-evidencias" ? conEvidencias : (vinculos ?? []);
  /* Pocos vinculos con evidencias: se muestran desplegados; muchos: el usuario elige. */
  const abiertoPorDefecto = conEvidencias.length <= 2;
  const estaAbierto = (vinculo: DdMatrizEvaluacionDetalleDTO) =>
    abiertos[vinculo.id] ?? (abiertoPorDefecto && vinculo.adjuntos.length > 0);
  const todosAbiertos = visibles.length > 0 && visibles.every((vinculo) => vinculo.adjuntos.length === 0 || estaAbierto(vinculo));

  const alternarTodos = () => {
    const abrir = !todosAbiertos;
    setAbiertos(Object.fromEntries(visibles.map((vinculo) => [vinculo.id, abrir])));
  };

  return (
    <section className="space-y-3" aria-label="Vínculos y evidencias">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vínculos y evidencias</h3>
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-sm text-muted-foreground">{error}</p>
      ) : !vinculos ? (
        <div className="space-y-3" role="status" aria-label="Cargando vínculos">
          <div className="grid gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, indice) => (
              <Skeleton key={indice} className="h-14 rounded-lg" />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, indice) => (
            <Skeleton key={indice} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : vinculos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
          La matriz aún no tiene vínculos para este expediente.
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <Resumen icono={<Users className="h-4 w-4" />} valor={vinculos.length} etiqueta="Vínculos" />
            <Resumen icono={<FolderOpen className="h-4 w-4" />} valor={conEvidencias.length} etiqueta="Con evidencias" />
            <Resumen icono={<Paperclip className="h-4 w-4" />} valor={totalEvidencias} etiqueta="Evidencias" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-md border border-border p-0.5 text-[11px]" role="group" aria-label="Filtrar vínculos">
              {(
                [
                  { valor: "con-evidencias", etiqueta: `Con evidencias (${conEvidencias.length})` },
                  { valor: "todos", etiqueta: `Todos (${vinculos.length})` },
                ] as const
              ).map((opcion) => (
                <button
                  key={opcion.valor}
                  type="button"
                  aria-pressed={filtro === opcion.valor}
                  onClick={() => setFiltro(opcion.valor)}
                  className={`rounded px-2.5 py-1 font-medium transition ${
                    filtro === opcion.valor ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opcion.etiqueta}
                </button>
              ))}
            </div>
            {conEvidencias.length > 0 ? (
              <button type="button" onClick={alternarTodos} className="text-[11px] font-semibold text-primary hover:underline">
                {todosAbiertos ? "Contraer todos" : "Expandir todos"}
              </button>
            ) : null}
          </div>

          {visibles.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
              Ningún vínculo tiene evidencias adjuntas todavía.
            </p>
          ) : (
            <div className="space-y-2">
              {visibles.map((vinculo) => {
                const tieneEvidencias = vinculo.adjuntos.length > 0;
                const abierto = estaAbierto(vinculo);
                const archivos = [...vinculo.adjuntos].sort(
                  (a, b) => nombreCriterio(a.categoria).localeCompare(nombreCriterio(b.categoria)) || b.createdAt.localeCompare(a.createdAt),
                );
                const subtitulo = [
                  DD_MATRIZ_TIPO_VINCULO_LABELS[vinculo.tipo as DdMatrizTipoVinculo] ?? vinculo.tipo,
                  vinculo.documento ? [vinculo.tipoDocumento, vinculo.documento].filter(Boolean).join(" ") : null,
                  vinculo.nacionalidad,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div
                    key={vinculo.id}
                    className={`overflow-hidden rounded-xl border bg-card transition ${
                      tieneEvidencias ? "border-border shadow-sm" : "border-dashed border-border/70"
                    }`}
                  >
                    <div className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${abierto ? "border-b border-border bg-secondary/30" : ""}`}>
                      <button
                        type="button"
                        disabled={!tieneEvidencias}
                        aria-expanded={tieneEvidencias ? abierto : undefined}
                        onClick={() => setAbiertos((previo) => ({ ...previo, [vinculo.id]: !abierto }))}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-default"
                      >
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                            !tieneEvidencias ? "opacity-0" : abierto ? "" : "-rotate-90"
                          }`}
                        />
                        <DdPaisBandera pais={vinculo.pais} />
                        <span className="min-w-0">
                          <span className={`block truncate text-sm font-semibold ${tieneEvidencias ? "text-foreground" : "text-muted-foreground"}`}>
                            {vinculo.nombre}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">{subtitulo}</span>
                        </span>
                      </button>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          tieneEvidencias ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                        }`}
                        title={tieneEvidencias ? `${vinculo.adjuntos.length} evidencia(s)` : "Sin evidencias"}
                      >
                        <Paperclip className="h-3 w-3" />
                        <span>{vinculo.adjuntos.length}</span>
                      </span>
                      <DdMatrizResultadoFinalBadge valor={vinculo.resultadoFinal} />
                      <Link
                        href={`${DD_RUTAS.MATRIZ}/${vinculo.id}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir vínculo en la matriz"
                        aria-label={`Abrir ${vinculo.nombre} en la matriz`}
                        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-primary"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>

                    {abierto && tieneEvidencias ? (
                      <ul className="divide-y divide-border">
                        {archivos.map((archivo) => (
                          <li key={archivo.id} className="flex items-center gap-3 px-3 py-2 hover:bg-secondary/20">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                              <FileText className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-foreground" title={archivo.nombre}>
                                {nombreCriterio(archivo.categoria)}
                              </p>
                              <a
                                href={archivo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={archivo.nombre}
                                className="block truncate text-[11px] text-primary hover:underline"
                              >
                                {archivo.nombre}
                              </a>
                              <p className="truncate text-[10px] text-muted-foreground">
                                {archivo.creadoPor || "—"} · {dateUtils.formatDateTime(archivo.createdAt)}
                                {archivo.tamano ? ` · ${formatearTamano(archivo.tamano)}` : ""}
                              </p>
                            </div>
                            <DdEvidenciaPreviewButton
                              url={archivo.url}
                              nombre={archivo.nombre}
                              mimeType={archivo.mimeType}
                              detalles={ddEvidenciaDetalles.deAdjunto(archivo)}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
