"use client";

import { Fragment } from "react";
import { Check, X } from "lucide-react";
import { REVISION_AREA_ORDER, REVISION_AREA_LABELS, RESULTADOS_APROBACION } from "@/lib/constants";

interface Props {
  currentStep: number;
  stepState: (area: string) => "pendiente" | "aprobado" | "rechazado";
  onGoStep: (step: number) => void;
}

export function RevisionStepIndicator({ currentStep, stepState, onGoStep }: Props) {
  return (
    <div className="mb-4 flex items-start justify-between px-2">
      {REVISION_AREA_ORDER.map((area, idx) => {
        const estado = stepState(area);
        const isCurrent = currentStep === idx;
        const isDone = estado === RESULTADOS_APROBACION.APROBADO;
        const isRejected = estado === RESULTADOS_APROBACION.RECHAZADO;
        const isActive = isDone || isRejected;

        return (
          <Fragment key={area}>
            <button
              type="button"
              onClick={() => onGoStep(idx)}
              className="flex flex-col items-center gap-1.5 cursor-pointer group"
              title={REVISION_AREA_LABELS[area]}
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
                {REVISION_AREA_LABELS[area]}
              </span>
            </button>
            {idx < REVISION_AREA_ORDER.length - 1 && (
              <div
                className={`mt-[18px] h-0.5 flex-1 rounded-full transition-colors duration-300 mx-1 ${
                  isDone ? "bg-emerald-400" : isCurrent ? "bg-primary/40" : "bg-slate-200"
                }`}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
