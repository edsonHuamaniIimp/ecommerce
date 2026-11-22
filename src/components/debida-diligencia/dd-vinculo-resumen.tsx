"use client";

import { DdMatrizResultadoBadge, DdMatrizResultadoFinalBadge } from "./dd-matriz-badges";
import type { DdMatrizEvaluacionDetalleDTO } from "@/types/dto/debida-diligencia";

/** Fila de estado del vinculo (SIG, Comunicaciones, Compliance y resultado final) para el encabezado. */
export function DdVinculoResumen({ detalle }: { detalle: DdMatrizEvaluacionDetalleDTO }) {
  const areas = [
    { etiqueta: "SIG", valor: detalle.sig.resultado },
    { etiqueta: "Comunicaciones", valor: detalle.reputacional.resultado },
    { etiqueta: "Compliance", valor: detalle.compliance.resultado },
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3">
      {areas.map((area) => (
        <span key={area.etiqueta} className="inline-flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{area.etiqueta}</span>
          <DdMatrizResultadoBadge valor={area.valor} />
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Final</span>
        <DdMatrizResultadoFinalBadge valor={detalle.resultadoFinal} />
      </span>
    </div>
  );
}
