"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { ExternalLink } from "lucide-react";
import type {
  DdMatrizEvaluacionDetalleDTO,
  DdMatrizEvaluacionFilaDTO,
} from "@/types/dto/debida-diligencia";
import {
  BADGE_STYLES,
  DD_MATRIZ_ORIGENES,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_RUTAS,
  type DdMatrizTipoVinculo,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { notasPorCriterios, type DdInformeNotaCriterio } from "@/lib/shared/utils/dd-informe";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import {
  DdMatrizAmbitoBadge,
  DdMatrizConclusionBadge,
  DdMatrizResultadoBadge,
  DdMatrizSiNoNaBadge,
} from "./dd-matriz-badges";

interface Props {
  detalle: DdMatrizEvaluacionDetalleDTO | null;
  vinculos: DdMatrizEvaluacionFilaDTO[];
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

function EstadoVinculo({
  titulo,
  resultado,
  conclusion,
  fecha,
}: {
  titulo: string;
  resultado: string | null;
  conclusion: string | null;
  fecha: string | null;
}) {
  const pendiente = !resultado && !conclusion;
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <p className="shrink-0 text-[10px] text-muted-foreground">
          {fecha ? dateUtils.format(fecha) : "Sin fecha"}
        </p>
      </div>

      {pendiente ? (
        <p className="mt-3 text-[11px] text-muted-foreground">Pendiente</p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {resultado ? (
            <div className="space-y-1">
              <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                Resultado
              </p>
              <div className="flex flex-wrap gap-1">
                <DdMatrizResultadoBadge valor={resultado} />
              </div>
            </div>
          ) : null}
          {conclusion ? (
            <div className="space-y-1">
              <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                Conclusión
              </p>
              <div className="flex flex-wrap gap-1">
                <DdMatrizConclusionBadge valor={conclusion} />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * Observacion de los criterios marcados SI de cada vinculo (sustento de SIG). La lista de la matriz no
 * la trae: se lee el detalle de cada vinculo. La empresa (`detalle`) no se repite: sus observaciones
 * salen en «Listas restrictivas».
 */
function useNotasCriterios(
  vinculos: DdMatrizEvaluacionFilaDTO[],
  detalle: DdMatrizEvaluacionDetalleDTO,
): Record<string, DdInformeNotaCriterio[]> {
  const [notas, setNotas] = useState<Record<string, DdInformeNotaCriterio[]>>({});
  const ids = vinculos.map((vinculo) => vinculo.id).filter((id) => id !== detalle.id).join(",");
  useEffect(() => {
    let activo = true;
    const lista = ids ? ids.split(",") : [];
    void Promise.all(
      lista.map((id) =>
        ddMatrizEvaluacionService
          .detalle(id)
          .then((d) => [id, notasPorCriterios([d], null)] as const)
          .catch(() => [id, [] as DdInformeNotaCriterio[]] as const),
      ),
    ).then((pares) => {
      if (activo) setNotas(Object.fromEntries(pares));
    });
    return () => {
      activo = false;
    };
  }, [ids]);
  return notas;
}

function VinculosMatriz({
  vinculos,
  detalle,
  returnTo,
}: {
  vinculos: DdMatrizEvaluacionFilaDTO[];
  detalle: DdMatrizEvaluacionDetalleDTO;
  returnTo: string;
}) {
  const notas = useNotasCriterios(vinculos, detalle);
  if (vinculos.length === 0) return null;
  return (
    <SeccionMatriz
      titulo={`Vínculos de la matriz (${vinculos.length})`}
      descripcion="Cada sujeto evaluado tiene su propio estado y fecha. Abre el vínculo para ver el detalle completo."
    >
      <div className="space-y-2">
        {vinculos.map((vinculo) => (
          <div key={vinculo.id} className="rounded-lg border border-border bg-secondary/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">{vinculo.nombre}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {DD_MATRIZ_TIPO_VINCULO_LABELS[vinculo.tipo as DdMatrizTipoVinculo] ?? vinculo.tipo}
                  {vinculo.cargo ? ` · ${vinculo.cargo}` : ""}
                  {vinculo.documento ? ` · ${vinculo.documento}` : ""}
                </p>
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[10px]">
                <Link href={`${DD_RUTAS.MATRIZ}/${vinculo.id}?returnTo=${encodeURIComponent(returnTo)}`}>
                  <ExternalLink className="h-3 w-3" />
                  <span>Abrir</span>
                </Link>
              </Button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <EstadoVinculo
                titulo="SIG"
                resultado={vinculo.sigResultado}
                conclusion={vinculo.sigConclusion}
                fecha={vinculo.sigFecha}
              />
              <EstadoVinculo
                titulo="Comunicaciones"
                resultado={vinculo.repResultado}
                conclusion={vinculo.repConclusion}
                fecha={vinculo.repFecha}
              />
              <EstadoVinculo
                titulo="Legal"
                resultado={vinculo.cmpResultado}
                conclusion={vinculo.cmpConclusion}
                fecha={vinculo.cmpFecha}
              />
            </div>
            {(notas[vinculo.id] ?? []).length > 0 ? (
              <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                <p className="text-[10px] font-medium uppercase text-muted-foreground">Observación de los criterios marcados SI</p>
                {(notas[vinculo.id] ?? []).map((nota) => (
                  <div key={nota.id}>
                    <p className="text-[10px] font-semibold text-foreground">{nota.criterio}</p>
                    <p className="max-h-28 overflow-y-auto whitespace-pre-wrap text-[11px] text-foreground [overflow-wrap:anywhere]">{nota.texto}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </SeccionMatriz>
  );
}

export function DdRevisionMatrizTab({ detalle, vinculos, loading, error, matrizId }: Props) {
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

      <VinculosMatriz vinculos={vinculos} detalle={detalle} returnTo={returnTo} />

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
                {lista.observacion?.trim() ? (
                  <span className="mt-1 block max-h-28 overflow-y-auto whitespace-pre-wrap text-[11px] font-normal text-foreground [overflow-wrap:anywhere]">
                    {lista.observacion}
                  </span>
                ) : null}
              </DatoMatriz>
            ))}
          </div>
        )}
      </SeccionMatriz>

    </div>
  );
}

