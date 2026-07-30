"use client";

import { Fragment } from "react";
import { Check } from "lucide-react";
import { RESERVA_STEPS } from "@/lib/constants";
import type { ReservaStep } from "@/lib/constants";

const STEPS = [
  { key: RESERVA_STEPS.DATOS, label: "Datos" },
  { key: RESERVA_STEPS.DOCUMENTOS, label: "Documentos" },
  { key: RESERVA_STEPS.CONFIRMACION, label: "Confirmacion" },
] as const;

interface Props {
  currentStep: ReservaStep;
  stepDone: (step: number) => boolean;
  canGoStep: (step: number) => boolean;
  onGoStep: (step: ReservaStep) => void;
}

export function StepIndicator({ currentStep, stepDone, canGoStep, onGoStep }: Props) {
  return (
    <div className="mb-4 flex items-center justify-center gap-2">
      {STEPS.map((step, idx) => {
        const active = currentStep >= step.key;
        const done = stepDone(step.key);
        const clickable = canGoStep(step.key);
        return (
          <Fragment key={step.key}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onGoStep(step.key)}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                done ? "bg-emerald-500 text-white shadow-sm" :
                active ? "bg-primary text-primary-foreground shadow-sm" :
                "bg-slate-200 text-slate-500"
              } ${clickable ? "cursor-pointer hover:scale-105" : "cursor-default"}`}
              title={step.label}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
            </button>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${
              active ? "text-slate-700" : "text-slate-400"
            }`}>{step.label}</span>
            {idx < 2 && (
              <div className={`h-px w-8 ${currentStep > step.key ? "bg-primary" : "bg-slate-200"}`} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
