"use client";

import { Fragment } from "react";
import { Check } from "lucide-react";
import { Button } from "@nrivera-iimp/ui-kit-iimp";
import { RESERVA_STEPS } from "@/lib/shared/constants";
import type { ReservaStep } from "@/lib/shared/constants";

const STEPS = [
  { key: RESERVA_STEPS.DATOS, label: "Tus datos", sub: "RUC y contacto" },
  { key: RESERVA_STEPS.DOCUMENTOS, label: "Documentos", sub: "Poderes y anexos" },
  { key: RESERVA_STEPS.CONFIRMACION, label: "Confirmar", sub: "Resumen y firma" },
] as const;

interface Props {
  currentStep: ReservaStep;
  stepDone: (step: number) => boolean;
  canGoStep: (step: number) => boolean;
  onGoStep: (step: ReservaStep) => void;
}

export function StepIndicator({ currentStep, stepDone, canGoStep, onGoStep }: Props) {
  return (
    <div className="mb-4 flex items-start justify-between gap-1">
      {STEPS.map((step, idx) => {
        const done = stepDone(step.key);
        const clickable = canGoStep(step.key);
        const isCurrent = currentStep === step.key;
        return (
          <Fragment key={step.key}>
            <Button
              type="button"
              variant="ghost"
              disabled={!clickable}
              onClick={() => clickable && onGoStep(step.key)}
              title={step.label}
              className={`h-auto flex-col gap-1.5 rounded-lg px-2 py-1 hover:bg-transparent ${
                clickable ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  done
                    ? "bg-success text-success-foreground"
                    : isCurrent
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/10"
                      : "border border-border bg-secondary text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : idx + 1}
              </span>
              <span className="flex flex-col items-center leading-tight">
                <span
                  className={`text-[10px] font-semibold ${
                    isCurrent ? "text-primary" : done ? "text-success" : "text-muted-foreground"
                  }`}
                >
                  Paso {idx + 1}
                </span>
                <span
                  className={`text-[11px] ${
                    isCurrent
                      ? "font-bold text-primary underline decoration-2 underline-offset-2"
                      : done
                        ? "font-medium text-foreground"
                        : "font-medium text-muted-foreground/70"
                  }`}
                >
                  {step.label}
                </span>
                <span className="hidden text-[10px] text-muted-foreground/70 sm:inline">{step.sub}</span>
              </span>
            </Button>
            {idx < STEPS.length - 1 && (
              <div
                className={`mt-4 h-0.5 flex-1 rounded-full transition-colors ${
                  currentStep > step.key ? "bg-success" : "bg-border"
                }`}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
