"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { AlertTriangle, CheckCircle2, ClipboardList, ShieldAlert } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { DdPaisBandera } from "./dd-pais-bandera";
import type { DdMatrizConteoDTO, DdMatrizEvaluacionResumenDTO } from "@/types/dto/debida-diligencia";
import {
  DD_MATRIZ_AMBITO_LABELS,
  DD_MATRIZ_AMBITOS,
  DD_MATRIZ_RESULTADO_FINAL_LABELS,
  DD_MATRIZ_RESULTADOS,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  type DdMatrizResultadoFinal,
} from "@/lib/shared/constants";
import { nombrePais } from "@/lib/shared/utils/pais";

/** Paises que se listan en el stat de paises (el resto se omite para no alargar la tarjeta). */
const PAISES_VISIBLES = 6;

const COLORES = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--destructive)",
  primary: "var(--primary)",
  gold: "var(--gold)",
  muted: "var(--muted-foreground)",
  border: "var(--border)",
} as const;

/** Color de cada resultado final en la dona (el mismo criterio que sus badges). */
const COLOR_FINAL: Record<DdMatrizResultadoFinal, string> = {
  [DD_MATRIZ_RESULTADOS_FINALES.APTO]: COLORES.success,
  [DD_MATRIZ_RESULTADOS_FINALES.APTO_CON_OBSERVACIONES]: COLORES.warning,
  [DD_MATRIZ_RESULTADOS_FINALES.NO_APTO]: COLORES.danger,
  [DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA]: COLORES.gold,
  [DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION]: COLORES.primary,
};

/** Mismos tonos de la matriz oficial: naranja = nacional, celeste = extranjero. */
const COLOR_NACIONAL = "#F6B26B";
const COLOR_EXTRANJERO = "#9FC5E8";

const cuenta = (conteos: DdMatrizConteoDTO[], valor: string | null): number =>
  conteos.find((c) => c.valor === valor)?.total ?? 0;

interface Segmento {
  etiqueta: string;
  valor: number;
  color: string;
}

function Dona({ segmentos, total, descripcion }: { segmentos: Segmento[]; total: number; descripcion: string }) {
  const radio = 42;
  const circunferencia = 2 * Math.PI * radio;
  const base = Math.max(total, 1);
  /* Inicio de cada tramo = suma de los anteriores (sin mutar variables durante el render). */
  const tramos = segmentos
    .filter((segmento) => segmento.valor > 0)
    .map((segmento, indice, visibles) => ({
      ...segmento,
      inicio: visibles.slice(0, indice).reduce((suma, previo) => suma + previo.valor, 0),
    }));

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <svg width="132" height="132" viewBox="0 0 120 120" role="img" aria-label={descripcion}>
        <circle cx="60" cy="60" r={radio} fill="none" stroke={COLORES.border} strokeWidth="12" />
        {tramos.map((tramo) => (
          <circle
            key={tramo.etiqueta}
            cx="60"
            cy="60"
            r={radio}
            fill="none"
            stroke={tramo.color}
            strokeWidth="12"
            strokeDasharray={`${(tramo.valor / base) * circunferencia} ${circunferencia - (tramo.valor / base) * circunferencia}`}
            strokeDashoffset={-((tramo.inicio / base) * circunferencia)}
            transform="rotate(-90 60 60)"
          />
        ))}
        <text x="60" y="56" textAnchor="middle" fill="currentColor" className="text-foreground text-[15px] font-bold">{total}</text>
        <text x="60" y="70" textAnchor="middle" fill="currentColor" className="text-muted-foreground text-[8px] uppercase tracking-wide">vínculos</text>
      </svg>
      <ul className="space-y-1.5">
        {segmentos.map((segmento) => (
          <li key={segmento.etiqueta} className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: segmento.color }} />
            <span>{segmento.etiqueta}</span>
            <strong className="ml-auto pl-3 text-foreground">{segmento.valor}</strong>
          </li>
        ))}
      </ul>
      <table className="sr-only">
        <caption>{descripcion}</caption>
        <thead><tr><th>Estado</th><th>Total</th></tr></thead>
        <tbody>
          {segmentos.map((s) => <tr key={s.etiqueta}><td>{s.etiqueta}</td><td>{s.valor}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

/** Barra apilada de un area: aceptados / observados / pendientes sobre su total. */
function BarraArea({ etiqueta, total, aceptados, observados, pendientes }: {
  etiqueta: string;
  total: number;
  aceptados: number;
  observados: number;
  pendientes: number;
}) {
  const ancho = (n: number) => `${total > 0 ? (n / total) * 100 : 0}%`;
  return (
    <div className="grid grid-cols-[110px_1fr_auto] items-center gap-2 sm:grid-cols-[150px_1fr_auto]">
      <span className="truncate text-[11px] text-muted-foreground sm:text-xs">{etiqueta}</span>
      <div className="flex h-4 w-full overflow-hidden rounded bg-secondary" aria-hidden="true">
        <span className="h-full bg-success" style={{ width: ancho(aceptados) }} />
        <span className="h-full bg-warning" style={{ width: ancho(observados) }} />
        <span className="h-full bg-muted-foreground/30" style={{ width: ancho(pendientes) }} />
      </div>
      <span className="text-right text-[11px] font-semibold text-foreground">
        {aceptados + observados}/{total}
      </span>
    </div>
  );
}

/** Barra simple (un solo color) con su conteo y porcentaje. */
function BarraSimple({ etiqueta, valor, total, destacado }: { etiqueta: ReactNode; valor: number; total: number; destacado: string }) {
  const porcentaje = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="grid grid-cols-[130px_1fr_70px] items-center gap-2">
      <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] text-muted-foreground sm:text-xs">{etiqueta}</span>
      <div className="h-3 w-full overflow-hidden rounded bg-secondary" aria-hidden="true">
        <span className="block h-full" style={{ width: `${porcentaje}%`, backgroundColor: destacado }} />
      </div>
      <span className="text-right text-[11px] font-semibold text-foreground">
        {valor} <span className="font-normal text-muted-foreground">({porcentaje}%)</span>
      </span>
    </div>
  );
}

function TarjetaStat({ titulo, descripcion, className, children }: {
  titulo: string;
  descripcion: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader className="border-b border-border pb-3">
        <CardTitle><span className="text-sm font-bold text-primary">{titulo}</span></CardTitle>
        <p className="text-[11px] text-muted-foreground">{descripcion}</p>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">{children}</CardContent>
    </Card>
  );
}

/** Stats de la Matriz de evaluacion DD, con el mismo estilo que el Panel DD. */
export function DdMatrizResumen({ resumen }: { resumen: DdMatrizEvaluacionResumenDTO | null }) {
  if (!resumen) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  const { total } = resumen;
  const final = (codigo: DdMatrizResultadoFinal) => cuenta(resumen.resultadoFinal, codigo);
  const aptos = final(DD_MATRIZ_RESULTADOS_FINALES.APTO) + final(DD_MATRIZ_RESULTADOS_FINALES.APTO_CON_OBSERVACIONES);
  const sinEvaluar = cuenta(resumen.resultadoFinal, null);

  const segmentosFinal: Segmento[] = [
    ...(Object.keys(DD_MATRIZ_RESULTADO_FINAL_LABELS) as DdMatrizResultadoFinal[]).map((codigo) => ({
      etiqueta: DD_MATRIZ_RESULTADO_FINAL_LABELS[codigo],
      valor: final(codigo),
      color: COLOR_FINAL[codigo],
    })),
    { etiqueta: "Sin evaluar", valor: sinEvaluar, color: COLORES.muted },
  ];

  const area = (conteos: DdMatrizConteoDTO[], base: number, pendientes?: number) => {
    const aceptados = cuenta(conteos, DD_MATRIZ_RESULTADOS.ACEPTADO);
    const observados = cuenta(conteos, DD_MATRIZ_RESULTADOS.OBSERVADO);
    return { total: base, aceptados, observados, pendientes: pendientes ?? Math.max(base - aceptados - observados, 0) };
  };
  const sig = area(resumen.sig, total);
  const reputacional = area(resumen.reputacional, total);
  /* Compliance solo evalua a quienes SIG derivo: su universo es ese grupo. */
  const compliance = area(resumen.compliance, resumen.requierenReforzada, resumen.pendientesCompliance);

  const paises = resumen.paises.slice(0, PAISES_VISIBLES);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Aptos"
          value={aptos}
          icon={<CheckCircle2 className="h-4 w-4" />}
          chip={{ texto: `${final(DD_MATRIZ_RESULTADOS_FINALES.APTO_CON_OBSERVACIONES)} con observaciones`, variante: "primary" }}
        />
        <StatsCard
          title="En revisión"
          value={resumen.enRevision}
          icon={<ClipboardList className="h-4 w-4" />}
          chip={{ texto: "SIG / Reputacional / Final", variante: "primary" }}
        />
        <StatsCard
          title="Requieren DD reforzada"
          value={resumen.requierenReforzada}
          icon={<ShieldAlert className="h-4 w-4" />}
          chip={{ texto: "Pasan a Compliance", variante: "gold" }}
          footer={{ texto: "Pendientes de Compliance", destacado: String(resumen.pendientesCompliance) }}
        />
        <StatsCard
          title="Sin evaluar"
          value={sinEvaluar}
          icon={<AlertTriangle className="h-4 w-4" />}
          chip={{ texto: `${final(DD_MATRIZ_RESULTADOS_FINALES.NO_APTO)} no aptos`, variante: "muted" }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TarjetaStat titulo="Resultado final" descripcion="Distribución de los vínculos según su conclusión final.">
          <Dona segmentos={segmentosFinal} total={total} descripcion={`Resultado final de ${total} vínculos`} />
        </TarjetaStat>

        <TarjetaStat className="lg:col-span-2" titulo="Avance por área" descripcion="Evaluaciones aceptadas, observadas y pendientes de cada área.">
          <BarraArea etiqueta="SIG (Logística)" {...sig} />
          <BarraArea etiqueta="Reputacional" {...reputacional} />
          <BarraArea etiqueta="Compliance (derivados)" {...compliance} />
          <div className="flex flex-wrap gap-3 border-t border-border pt-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" />Aceptadas</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" />Observadas</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/30" />Pendientes</span>
          </div>
        </TarjetaStat>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TarjetaStat titulo="Nacional y extranjera" descripcion="Vínculos según el ámbito que define sus listas.">
          {Object.entries(DD_MATRIZ_AMBITO_LABELS).map(([codigo, label]) => (
            <BarraSimple
              key={codigo}
              etiqueta={<span>{label}</span>}
              valor={cuenta(resumen.ambito, codigo)}
              total={total}
              destacado={codigo === DD_MATRIZ_AMBITOS.EXTRANJERO ? COLOR_EXTRANJERO : COLOR_NACIONAL}
            />
          ))}
        </TarjetaStat>

        <TarjetaStat titulo="Tipo de vínculo" descripcion="Empresa, representantes, beneficiarios y vinculados.">
          {Object.entries(DD_MATRIZ_TIPO_VINCULO_LABELS).map(([codigo, label]) => (
            <BarraSimple key={codigo} etiqueta={<span>{label}</span>} valor={cuenta(resumen.tipo, codigo)} total={total} destacado={COLORES.primary} />
          ))}
        </TarjetaStat>

        <TarjetaStat titulo="Principales países" descripcion="Países con más vínculos en el evento.">
          {paises.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Aún no hay vínculos con país registrado.</p>
          ) : (
            paises.map((p) => (
              <BarraSimple
                key={p.pais}
                etiqueta={<><DdPaisBandera pais={p.pais} /><span className="truncate">{nombrePais(p.pais)}</span></>}
                valor={p.total}
                total={total}
                destacado={COLORES.primary}
              />
            ))
          )}
        </TarjetaStat>
      </div>
    </div>
  );
}
