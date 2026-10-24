"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { ExternalLink, FileText, Paperclip } from "lucide-react";
import type { DdMatrizBloqueDTO, DdMatrizEvaluacionDetalleDTO } from "@/types/dto/debida-diligencia";
import {
  BADGE_STYLES,
  DD_MATRIZ_ADJUNTO_CATEGORIA_LABELS,
  DD_MATRIZ_ADJUNTO_CATEGORIAS,
  DD_MATRIZ_ORIGENES,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_RUTAS,
  type DdMatrizAdjuntoCategoria,
  type DdMatrizTipoVinculo,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import {
  DdMatrizAmbitoBadge,
  DdMatrizConclusionBadge,
  DdMatrizConclusionComplianceBadge,
  DdMatrizResultadoBadge,
  DdMatrizResultadoFinalBadge,
  DdMatrizSiNoNaBadge,
} from "./dd-matriz-badges";

interface Props {
  detalle: DdMatrizEvaluacionDetalleDTO | null;
  loading: boolean;
  error: string | null;
  matrizId: string | null;
}

function SeccionMatriz({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h3>
        {descripcion ? <p className="mt-0.5 text-[11px] text-muted-foreground">{descripcion}</p> : null}
      </div>
      <div className="rounded-lg border border-border bg-secondary/20 p-4">{children}</div>
    </section>
  );
}

function DatoMatriz({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-medium uppercase text-muted-foreground">{etiqueta}</p>
      <div className="text-xs text-foreground">{children || <span className="text-muted-foreground">Sin registrar</span>}</div>
    </div>
  );
}

function valorSiNoNa(valor: string | null): React.ReactNode {
  if (!valor) return null;
  return <DdMatrizSiNoNaBadge valor={valor} />;
}

function AdjuntosMatriz({
  adjuntos,
  categorias,
}: {
  adjuntos: DdMatrizEvaluacionDetalleDTO["adjuntos"];
  categorias: DdMatrizAdjuntoCategoria[];
}) {
  const visibles = adjuntos.filter((adjunto) => categorias.includes(adjunto.categoria as DdMatrizAdjuntoCategoria));
  if (visibles.length === 0) {
    return <p className="text-[11px] text-muted-foreground">Sin adjuntos en la matriz.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {visibles.map((adjunto) => (
        <li key={adjunto.id} className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-2">
          <a
            href={adjunto.url}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-primary hover:underline"
          >
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{adjunto.nombre}</span>
          </a>
          <Badge className={`pointer-events-none shrink-0 text-[9px] ${BADGE_STYLES.NEUTRAL}`}>
            <span>{DD_MATRIZ_ADJUNTO_CATEGORIA_LABELS[adjunto.categoria as DdMatrizAdjuntoCategoria] ?? adjunto.categoria}</span>
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function BloqueMatriz({
  titulo,
  descripcion,
  bloque,
  compliance = false,
  adjuntos,
  categorias,
}: {
  titulo: string;
  descripcion: string;
  bloque: DdMatrizBloqueDTO;
  compliance?: boolean;
  adjuntos: DdMatrizEvaluacionDetalleDTO["adjuntos"];
  categorias: DdMatrizAdjuntoCategoria[];
}) {
  return (
    <SeccionMatriz titulo={titulo} descripcion={descripcion}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <DdMatrizResultadoBadge valor={bloque.resultado} />
          {compliance ? (
            <DdMatrizConclusionComplianceBadge valor={bloque.conclusion} />
          ) : (
            <DdMatrizConclusionBadge valor={bloque.conclusion} />
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <DatoMatriz etiqueta="Observaciones">{bloque.observaciones ?? null}</DatoMatriz>
          <DatoMatriz etiqueta="Responsable">{bloque.responsable ?? null}</DatoMatriz>
          <DatoMatriz etiqueta="Fecha">{dateUtils.format(bloque.fecha)}</DatoMatriz>
        </div>
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
            <Paperclip className="h-3 w-3" />
            <span>Adjuntos</span>
          </p>
          <AdjuntosMatriz adjuntos={adjuntos} categorias={categorias} />
        </div>
      </div>
    </SeccionMatriz>
  );
}

export function DdRevisionMatrizTab({ detalle, loading, error, matrizId }: Props) {
  const [returnTo] = useState<string>(() => {
    if (typeof window === "undefined") return DD_RUTAS.MATRIZ;
    return `${window.location.pathname}${window.location.search}`;
  });

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !detalle) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-4">
        <p className="text-xs font-medium text-foreground">No se pudo cargar la matriz del expediente.</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{error ?? "El expediente aún no cuenta con una fila en la matriz."}</p>
        {matrizId ? (
          <Button asChild variant="outline" size="sm" className="mt-3 h-8 gap-1.5 text-xs">
            <Link href={`${DD_RUTAS.MATRIZ}/${matrizId}?returnTo=${encodeURIComponent(returnTo)}`}>
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Abrir matriz</span>
            </Link>
          </Button>
        ) : null}
      </div>
    );
  }

  const origen =
    detalle.origen === DD_MATRIZ_ORIGENES.AUTOMATICO ? "Automático" : "Manual";
  const listas = detalle.listas;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-secondary/20 p-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.INDIGO}`}>
              <span>{DD_MATRIZ_TIPO_VINCULO_LABELS[detalle.tipo as DdMatrizTipoVinculo] ?? detalle.tipo}</span>
            </Badge>
            <DdMatrizAmbitoBadge valor={detalle.ambito} />
            <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.NEUTRAL}`}>
              <span>{origen}</span>
            </Badge>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Actualizado {dateUtils.formatDateTime(detalle.updatedAt)}
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Link href={`${DD_RUTAS.MATRIZ}/${detalle.id}?returnTo=${encodeURIComponent(returnTo)}`}>
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Abrir matriz completa</span>
          </Link>
        </Button>
      </div>

      <SeccionMatriz titulo="Datos de la matriz" descripcion="Información registrada en la matriz que no forma parte del resumen del expediente.">
        <div className="grid gap-3 sm:grid-cols-2">
          <DatoMatriz etiqueta="Fecha de inicio de actividades">{dateUtils.format(detalle.generales.fechaInicioActividades)}</DatoMatriz>
          <DatoMatriz etiqueta="Estado de contribuyente">{detalle.generales.estadoContribuyente ?? null}</DatoMatriz>
          <DatoMatriz etiqueta="Dirección legal">{detalle.generales.direccionLegal ?? null}</DatoMatriz>
          <DatoMatriz etiqueta="Historial con IIMP">{valorSiNoNa(detalle.generales.historialIimp)}</DatoMatriz>
          <DatoMatriz etiqueta="Beneficio mutuo">{valorSiNoNa(detalle.generales.beneficioMutuo)}</DatoMatriz>
        </div>
      </SeccionMatriz>

      <SeccionMatriz titulo="Listas restrictivas" descripcion="Respuestas registradas para cada lista aplicable al vínculo.">
        {listas.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Sin listas restrictivas registradas.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {listas.map((lista) => (
              <DatoMatriz key={lista.codigo} etiqueta={lista.label}>
                {lista.valor ? <DdMatrizSiNoNaBadge valor={lista.valor} /> : <span className="text-muted-foreground">Sin evaluar</span>}
              </DatoMatriz>
            ))}
          </div>
        )}
      </SeccionMatriz>

      <BloqueMatriz
        titulo="Conclusiones SIG"
        descripcion="Evaluación de SIG registrada en la matriz."
        bloque={detalle.sig}
        adjuntos={detalle.adjuntos}
        categorias={[DD_MATRIZ_ADJUNTO_CATEGORIAS.SIG_INFORME, DD_MATRIZ_ADJUNTO_CATEGORIAS.SIG_SUSTENTO]}
      />

      <BloqueMatriz
        titulo="Conclusiones reputacional"
        descripcion="Evaluación reputacional registrada en la matriz."
        bloque={detalle.reputacional}
        adjuntos={detalle.adjuntos}
        categorias={[DD_MATRIZ_ADJUNTO_CATEGORIAS.REPUTACIONAL_SUSTENTO]}
      />

      <BloqueMatriz
        titulo="Conclusiones Compliance"
        descripcion="Evaluación de Compliance registrada en la matriz."
        bloque={detalle.compliance}
        compliance
        adjuntos={detalle.adjuntos}
        categorias={[DD_MATRIZ_ADJUNTO_CATEGORIAS.COMPLIANCE_SUSTENTO]}
      />

      <SeccionMatriz titulo="Conclusión final" descripcion="Resultado final registrado en la matriz. No modifica el estado del expediente.">
        <div className="grid gap-3 sm:grid-cols-2">
          <DatoMatriz etiqueta="Resultado">
            <DdMatrizResultadoFinalBadge valor={detalle.resultadoFinal} />
          </DatoMatriz>
          <DatoMatriz etiqueta="Registrado por">{detalle.finalPor ?? null}</DatoMatriz>
          <DatoMatriz etiqueta="Fecha">{dateUtils.format(detalle.finalFecha)}</DatoMatriz>
        </div>
      </SeccionMatriz>

    </div>
  );
}
