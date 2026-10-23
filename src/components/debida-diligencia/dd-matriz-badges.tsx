"use client";

import { Badge } from "@nrivera-iimp/ui-kit-iimp";
import {
  BADGE_STYLES,
  DD_MATRIZ_AMBITO_LABELS,
  DD_MATRIZ_AMBITOS,
  DD_MATRIZ_CONCLUSION_COMPLIANCE_LABELS,
  DD_MATRIZ_CONCLUSION_LABELS,
  DD_MATRIZ_CONCLUSIONES,
  DD_MATRIZ_CONCLUSIONES_COMPLIANCE,
  DD_MATRIZ_RESULTADO_FINAL_LABELS,
  DD_MATRIZ_RESULTADO_LABELS,
  DD_MATRIZ_RESULTADOS,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_MATRIZ_SI_NO_NA_LABELS,
  type DdMatrizAmbito,
  type DdMatrizConclusion,
  type DdMatrizConclusionCompliance,
  type DdMatrizResultado,
  type DdMatrizResultadoFinal,
  type DdMatrizSiNoNa,
} from "@/lib/shared/constants";

const SIN_DATO = <span className="text-[11px] text-muted-foreground">—</span>;

function Etiqueta({ texto, estilo }: { texto: string; estilo: string }) {
  return (
    <Badge className={`pointer-events-none text-[9px] ${estilo}`}>
      <span>{texto}</span>
    </Badge>
  );
}

const ESTILO_FINAL: Record<DdMatrizResultadoFinal, string> = {
  [DD_MATRIZ_RESULTADOS_FINALES.APTO]: BADGE_STYLES.SUCCESS,
  [DD_MATRIZ_RESULTADOS_FINALES.APTO_CON_OBSERVACIONES]: BADGE_STYLES.WARNING,
  [DD_MATRIZ_RESULTADOS_FINALES.NO_APTO]: BADGE_STYLES.DESTRUCTIVE,
  [DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA]: BADGE_STYLES.WARNING,
  [DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION]: BADGE_STYLES.INFO,
};

export function DdMatrizResultadoFinalBadge({ valor }: { valor: string | null }) {
  if (!valor) return <Etiqueta texto="Sin evaluar" estilo={BADGE_STYLES.NEUTRAL} />;
  const codigo = valor as DdMatrizResultadoFinal;
  return <Etiqueta texto={DD_MATRIZ_RESULTADO_FINAL_LABELS[codigo] ?? valor} estilo={ESTILO_FINAL[codigo] ?? BADGE_STYLES.NEUTRAL} />;
}

/** Resultado de un area (ACEPTADO / OBSERVADO / NO APLICA). */
export function DdMatrizResultadoBadge({ valor }: { valor: string | null }) {
  if (!valor) return SIN_DATO;
  const codigo = valor as DdMatrizResultado;
  const estilo =
    codigo === DD_MATRIZ_RESULTADOS.ACEPTADO
      ? BADGE_STYLES.SUCCESS
      : codigo === DD_MATRIZ_RESULTADOS.OBSERVADO
        ? BADGE_STYLES.WARNING
        : BADGE_STYLES.NEUTRAL;
  return <Etiqueta texto={DD_MATRIZ_RESULTADO_LABELS[codigo] ?? valor} estilo={estilo} />;
}

/** Conclusion de SIG o Reputacional. */
export function DdMatrizConclusionBadge({ valor }: { valor: string | null }) {
  if (!valor) return SIN_DATO;
  const codigo = valor as DdMatrizConclusion;
  const estilo =
    codigo === DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA
      ? BADGE_STYLES.DESTRUCTIVE
      : codigo === DD_MATRIZ_CONCLUSIONES.EN_REVISION
        ? BADGE_STYLES.INFO
        : BADGE_STYLES.SUCCESS;
  return <Etiqueta texto={DD_MATRIZ_CONCLUSION_LABELS[codigo] ?? valor} estilo={estilo} />;
}

/** Conclusion de Compliance (Legal). */
export function DdMatrizConclusionComplianceBadge({ valor }: { valor: string | null }) {
  if (!valor) return SIN_DATO;
  const codigo = valor as DdMatrizConclusionCompliance;
  const estilo =
    codigo === DD_MATRIZ_CONCLUSIONES_COMPLIANCE.RECHAZADO
      ? BADGE_STYLES.DESTRUCTIVE
      : codigo === DD_MATRIZ_CONCLUSIONES_COMPLIANCE.ACEPTADO_CON_OBSERVACIONES
        ? BADGE_STYLES.WARNING
        : BADGE_STYLES.SUCCESS;
  return <Etiqueta texto={DD_MATRIZ_CONCLUSION_COMPLIANCE_LABELS[codigo] ?? valor} estilo={estilo} />;
}

export function DdMatrizAmbitoBadge({ valor }: { valor: string }) {
  const codigo = valor as DdMatrizAmbito;
  const estilo = codigo === DD_MATRIZ_AMBITOS.EXTRANJERO ? "bg-sky-100 text-sky-800 border-sky-200" : "bg-orange-100 text-orange-800 border-orange-200";
  return <Etiqueta texto={DD_MATRIZ_AMBITO_LABELS[codigo] ?? valor} estilo={estilo} />;
}

/** Respuesta de una lista restrictiva (SI / NO / N.A.). */
export function DdMatrizSiNoNaBadge({ valor }: { valor: string | null }) {
  if (!valor) return SIN_DATO;
  const codigo = valor as DdMatrizSiNoNa;
  return <Etiqueta texto={DD_MATRIZ_SI_NO_NA_LABELS[codigo] ?? valor} estilo={BADGE_STYLES.NEUTRAL} />;
}
