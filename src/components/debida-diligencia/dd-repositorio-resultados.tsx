"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Progress,
} from "@nrivera-iimp/ui-kit-iimp";
import { AlertTriangle, FileImage, FileQuestion, FileText, FileType2, SearchX } from "lucide-react";
import { DdDocumentoBadge } from "./dd-estado-badge";
import { DdEvidenciaPreviewButton } from "./dd-evidencia-preview-button";
import {
  BADGE_STYLES,
  DD_DOCUMENTO_ESTADOS,
  DD_REPOSITORIO_AGRUPACIONES,
  DD_REPOSITORIO_AREA_ESTILOS,
  DD_REPOSITORIO_FORMATO_ESTILOS,
  DD_REPOSITORIO_FORMATO_LABELS,
  DD_REPOSITORIO_FORMATOS,
  DD_REPOSITORIO_TIPOS,
  type DdRepositorioAgrupacion,
  type DdRepositorioFormato,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import {
  ddRepositorioVista,
  type DdRepositorioCobertura,
  type DdRepositorioFila,
  type DdRepositorioGrupo,
} from "@/lib/shared/utils/dd-repositorio-vista";

const MAX_FALTANTES_VISIBLES = 6;

function IconoFormato({ formato }: { formato: string }) {
  const clase = DD_REPOSITORIO_FORMATO_ESTILOS[formato] ?? DD_REPOSITORIO_FORMATO_ESTILOS[DD_REPOSITORIO_FORMATOS.OTRO];
  const icono =
    formato === DD_REPOSITORIO_FORMATOS.PDF ? (
      <FileText className="h-4 w-4" />
    ) : formato === DD_REPOSITORIO_FORMATOS.IMAGEN ? (
      <FileImage className="h-4 w-4" />
    ) : formato === DD_REPOSITORIO_FORMATOS.WORD ? (
      <FileType2 className="h-4 w-4" />
    ) : (
      <FileQuestion className="h-4 w-4" />
    );
  return (
    <span
      title={DD_REPOSITORIO_FORMATO_LABELS[formato as DdRepositorioFormato] ?? formato}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-md border ${clase}`}
    >
      {icono}
    </span>
  );
}

interface FilaArchivoProps {
  fila: DdRepositorioFila;
  ahora: number;
  /** Datos que ya da el encabezado del grupo no se repiten en la fila. */
  agrupacion: DdRepositorioAgrupacion;
}

function FilaArchivo({ fila, ahora, agrupacion }: FilaArchivoProps) {
  const esDocumento = fila.tipo === DD_REPOSITORIO_TIPOS.DOCUMENTO;
  const nuevo = ddRepositorioVista.esNuevo(fila.fecha, ahora);
  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2.5 transition-colors hover:bg-secondary/30">
      <IconoFormato formato={fila.formato} />
      <div className="min-w-[180px] flex-1 basis-60">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="max-w-full truncate text-xs font-semibold text-foreground" title={fila.nombre}>
            {fila.nombre}
          </p>
          {nuevo ? (
            <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.SUCCESS}`}>
              <span>Nuevo</span>
            </Badge>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          {agrupacion !== DD_REPOSITORIO_AGRUPACIONES.CLASE ? (
            <span className="font-medium text-foreground/80">{fila.claseLabel}</span>
          ) : null}
          {agrupacion !== DD_REPOSITORIO_AGRUPACIONES.VINCULO ? <span>· {fila.vinculoNombre}</span> : null}
          {agrupacion !== DD_REPOSITORIO_AGRUPACIONES.AREA ? (
            <Badge className={`pointer-events-none text-[9px] ${DD_REPOSITORIO_AREA_ESTILOS[fila.area] ?? BADGE_STYLES.NEUTRAL}`}>
              <span>{fila.area}</span>
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="min-w-[110px] text-[11px] sm:text-right">
        <p className="text-foreground" title={dateUtils.formatDateTime(fila.fecha)}>
          {ddRepositorioVista.fechaRelativa(fila.fecha, ahora)}
        </p>
        <p className="max-w-[160px] truncate text-[10px] text-muted-foreground" title={fila.responsable}>
          {fila.responsable}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {esDocumento && fila.estado !== DD_DOCUMENTO_ESTADOS.CARGADO ? <DdDocumentoBadge estado={fila.estado} /> : null}
        <DdEvidenciaPreviewButton url={fila.url} nombre={fila.nombre} mimeType={fila.mimeType} />
      </div>
    </li>
  );
}

function BarraCobertura({ cobertura }: { cobertura: DdRepositorioCobertura }) {
  if (cobertura.aplicables === 0) return null;
  const porcentaje = Math.round((cobertura.conEvidencia / cobertura.aplicables) * 100);
  const completo = cobertura.conEvidencia === cobertura.aplicables;
  return (
    <div
      className="hidden w-[150px] shrink-0 sm:block"
      title={completo ? "Todos los criterios tienen evidencia" : `Sin evidencia: ${cobertura.faltantes.join(", ")}`}
    >
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">Criterios con evidencia</span>
        <span className={completo ? "font-semibold text-success" : "font-semibold text-warning"}>
          {cobertura.conEvidencia}/{cobertura.aplicables}
        </span>
      </div>
      <Progress value={porcentaje} className="mt-1 h-1" />
    </div>
  );
}

interface Props {
  grupos: DdRepositorioGrupo[];
  agrupacion: DdRepositorioAgrupacion;
  ahora: number;
  coberturas: Record<string, DdRepositorioCobertura>;
  hayFiltros: boolean;
  total: number;
  onLimpiar: () => void;
}

export function DdRepositorioResultados({ grupos, agrupacion, ahora, coberturas, hayFiltros, total, onLimpiar }: Props) {
  /* Abre los grupos con archivos (todos si son pocos; si no, los dos primeros). */
  const conArchivos = grupos.filter((grupo) => grupo.filas.length > 0).map((grupo) => grupo.clave);
  const [abiertos, setAbiertos] = useState<string[]>(() => (conArchivos.length <= 6 ? conArchivos : conArchivos.slice(0, 2)));

  if (total === 0 && hayFiltros) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-10 text-center">
        <SearchX className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">Ningún archivo coincide con los filtros</p>
        <p className="max-w-sm text-xs text-muted-foreground">Prueba quitando algún filtro o ampliando el rango de fechas.</p>
        <Button type="button" size="sm" variant="outline" className="mt-1 h-8 text-xs" onClick={onLimpiar}>
          <span>Limpiar filtros</span>
        </Button>
      </div>
    );
  }

  if (agrupacion === DD_REPOSITORIO_AGRUPACIONES.NINGUNA) {
    const lista = grupos[0]?.filas ?? [];
    return (
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {lista.map((fila) => (
          <FilaArchivo key={fila.id} fila={fila} ahora={ahora} agrupacion={agrupacion} />
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-1">
        <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setAbiertos(grupos.map((grupo) => grupo.clave))}>
          <span>Expandir todo</span>
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setAbiertos([])}>
          <span>Contraer todo</span>
        </Button>
      </div>
      <Accordion
        type="multiple"
        value={abiertos}
        onValueChange={setAbiertos}
        className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card"
      >
        {grupos.map((grupo) => {
          const cobertura = agrupacion === DD_REPOSITORIO_AGRUPACIONES.VINCULO ? coberturas[grupo.clave] : undefined;
          const vacio = grupo.filas.length === 0;
          return (
            <AccordionItem key={grupo.clave} value={grupo.clave} className="border-0">
              <AccordionTrigger className="border-l-4 border-l-primary/30 bg-secondary/40 px-3 py-2.5 hover:bg-secondary/60 hover:no-underline data-[state=open]:border-l-primary data-[state=open]:bg-primary/5">
                <div className="flex w-full flex-wrap items-center justify-between gap-3 pr-3 text-left">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{grupo.titulo}</p>
                    {grupo.subtitulo ? <p className="text-[10px] text-muted-foreground">{grupo.subtitulo}</p> : null}
                  </div>
                  <div className="flex items-center gap-3">
                    {cobertura ? <BarraCobertura cobertura={cobertura} /> : null}
                    <Badge
                      className={`pointer-events-none text-[10px] ${vacio ? BADGE_STYLES.WARNING : BADGE_STYLES.SUCCESS}`}
                    >
                      <span>{vacio ? "Sin archivos" : `${grupo.filas.length} archivo${grupo.filas.length === 1 ? "" : "s"}`}</span>
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-0">
                {cobertura && !hayFiltros && cobertura.faltantes.length > 0 ? (
                  <div className="flex items-start gap-2 border-t border-border bg-warning/5 px-3 py-2 text-[11px] text-warning">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <p>
                      <strong>Criterios sin evidencia:</strong>{" "}
                      {cobertura.faltantes.slice(0, MAX_FALTANTES_VISIBLES).join(" · ")}
                      {cobertura.faltantes.length > MAX_FALTANTES_VISIBLES
                        ? ` · y ${cobertura.faltantes.length - MAX_FALTANTES_VISIBLES} más`
                        : ""}
                    </p>
                  </div>
                ) : null}
                {vacio ? (
                  <p className="border-t border-border px-3 py-4 text-xs text-muted-foreground">Aún no hay archivos para este grupo.</p>
                ) : (
                  <ul className="divide-y divide-border border-t border-border">
                    {grupo.filas.map((fila) => (
                      <FilaArchivo key={fila.id} fila={fila} ahora={ahora} agrupacion={agrupacion} />
                    ))}
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
