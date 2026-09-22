"use client";

import { Fragment } from "react";
import { Check, Scale, X } from "lucide-react";
import { REVISION_AREA_ORDER, REVISION_AREA_LABELS, REVISION_AREA_SGC_LABEL, RESULTADOS_APROBACION, type ResultadoAprobacion, type RevisionArea } from "@/lib/shared/constants";

interface Props {
  currentStep: number;
  stepState: (area: string) => ResultadoAprobacion;
  onGoStep: (step: number) => void;
  stepCanGo: (step: number) => boolean;
  /** Áreas locales a mostrar (por defecto el orden vigente). Soporta datos legacy con Legal. */
  areas?: RevisionArea[];
  /** Muestra el paso "Legal (SGC)" (revisión delegada). Por defecto true. */
  mostrarSgc?: boolean;
  /** Marca el paso "Legal (SGC)" como aprobado por el SGC. */
  sgcDone?: boolean;
  /** El paso activo es "Legal (SGC)". */
  sgcCurrent?: boolean;
  /** Se puede navegar al paso "Legal (SGC)". */
  sgcCanGo?: boolean;
  /** Navega al paso "Legal (SGC)". */
  onGoSgc?: () => void;
}

export function RevisionStepIndicator({
  currentStep,
  stepState,
  onGoStep,
  stepCanGo,
  areas = REVISION_AREA_ORDER,
  mostrarSgc = true,
  sgcDone = false,
  sgcCurrent = false,
  sgcCanGo = false,
  onGoSgc,
}: Props) {
  return (
    <div className="mb-4 flex items-start justify-between px-2">
      {areas.map((area, idx) => {
        const estado = stepState(area);
        const isCurrent = currentStep === idx;
        const isDone = estado === RESULTADOS_APROBACION.APROBADO;
        const isRejected = estado === RESULTADOS_APROBACION.RECHAZADO;
        const isActive = isDone || isRejected;
        const canClick = stepCanGo(idx);
        return (
          <Fragment key={area}>
            <button
              type="button"
              onClick={() => canClick && onGoStep(idx)}
              disabled={!canClick}
              className={`flex flex-col items-center gap-1.5 transition-all duration-200 ${
                canClick ? "cursor-pointer group" : "cursor-default opacity-60"
              }`}
              title={REVISION_AREA_LABELS[area] ?? area}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ring-2 ${
                  isDone
                    ? "bg-emerald-500 text-white shadow-sm shadow-emerald-200 ring-emerald-500/30"
                    : isRejected
                    ? "bg-red-500 text-white shadow-sm shadow-red-200 ring-red-500/30"
                    : isCurrent
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/30 ring-primary"
                    : isActive
                    ? "bg-emerald-100 text-emerald-700 ring-emerald-200/50"
                    : "bg-slate-100 text-slate-400 ring-transparent"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : isRejected ? <X className="h-4 w-4" /> : idx + 1}
              </span>
              <span
                className={`text-xs transition-colors duration-300 ${
                  isCurrent
                    ? "font-bold text-primary"
                    : isActive
                    ? "font-medium text-slate-600"
                    : "font-normal text-slate-400"
                }`}
              >
                {REVISION_AREA_LABELS[area] ?? area}
              </span>
            </button>
            {idx < areas.length - 1 && (
              <div
                className={`mt-[18px] h-0.5 flex-1 rounded-full transition-colors duration-300 mx-1 ${
                  isDone ? "bg-emerald-400" : isCurrent ? "bg-primary/40" : "bg-slate-200"
                }`}
              />
            )}
          </Fragment>
        );
      })}

      {/* Paso delegado: la revisión Legal ahora la realiza el SGC */}
      {mostrarSgc && (
        <>
          <div className={`mt-[18px] h-0.5 flex-1 rounded-full mx-1 ${sgcDone ? "bg-emerald-400" : "bg-slate-200"}`} />
          <button
            type="button"
            onClick={() => sgcCanGo && onGoSgc?.()}
            disabled={!sgcCanGo}
            className={`flex flex-col items-center gap-1.5 transition-all duration-200 ${
              sgcCanGo ? "cursor-pointer group" : "cursor-default opacity-60"
            }`}
            title="Revisión Legal delegada al SGC"
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ring-2 ${
                sgcDone
                  ? "bg-emerald-500 text-white ring-emerald-500/30"
                  : sgcCurrent
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/30 ring-primary"
                  : "border-2 border-dashed border-slate-300 text-slate-400 ring-transparent"
              }`}
            >
              {sgcDone ? <Check className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
            </span>
            <span
              className={`text-xs transition-colors duration-300 ${
                sgcCurrent
                  ? "font-bold text-primary"
                  : sgcDone
                  ? "font-medium text-slate-600"
                  : "font-normal text-slate-400"
              }`}
            >
              {REVISION_AREA_SGC_LABEL}
            </span>
          </button>
        </>
      )}
    </div>
  );
}
