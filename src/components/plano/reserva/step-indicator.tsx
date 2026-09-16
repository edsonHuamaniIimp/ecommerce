"use client";

import { Fragment } from "react";
import { Check } from "lucide-react";
import { RESERVA_STEPS } from "@/lib/shared/constants";
import type { ReservaStep } from "@/lib/shared/constants";

const STEPS = [
  { key: RESERVA_STEPS.DATOS, label: "Tus datos" },
  { key: RESERVA_STEPS.DOCUMENTOS, label: "Documentos" },
  { key: RESERVA_STEPS.CONFIRMACION, label: "Confirmar" },
] as const;

interface Props {
  currentStep: ReservaStep;
  stepDone: (step: number) => boolean;
  canGoStep: (step: number) => boolean;
  onGoStep: (step: ReservaStep) => void;
}

export function StepIndicator({ currentStep, stepDone, canGoStep, onGoStep }: Props) {
  return (
    <div className="mb-3 flex items-start justify-between">
      {STEPS.map((step, idx) => {
        const active = currentStep >= step.key;
        const done = stepDone(step.key);
        const clickable = canGoStep(step.key);
        const isCurrent = currentStep === step.key;
        return (
          <Fragment key={step.key}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onGoStep(step.key)}
              className={`flex flex-col items-center gap-1 transition-all duration-200 ${
                clickable ? "cursor-pointer group" : "cursor-default"
              }`}
              title={step.label}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all ${
                done
                  ? "bg-emerald-500 text-white shadow-sm shadow-emerald-200"
                  : isCurrent
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-200 group-hover:scale-105"
                  : active
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-400"
              }`}>
                {done ? <Check className="h-4 w-4" /> : idx + 1}
              </span>
              <span className={`text-[10px] font-medium transition-colors ${
                isCurrent ? "text-slate-800" : active ? "text-slate-500" : "text-slate-400"
              }`}>{step.label}</span>
            </button>
            {idx < 2 && (
              <div className={`mt-4 h-px flex-1 rounded-full transition-colors ${
                currentStep > step.key ? "bg-emerald-400" : "bg-slate-200"
              }`} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
