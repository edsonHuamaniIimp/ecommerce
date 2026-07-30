"use client";

import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@nrivera-iimp/ui-kit-iimp";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { RESERVA_STEPS } from "@/lib/constants";
import type { ReservaStep } from "@/lib/constants";
import { StepIndicator } from "./step-indicator";
import { StepDatos } from "./step-datos";
import { StepDocumentos } from "./step-documentos";
import { StepConfirmacion } from "./step-confirmacion";
import type { FormDatos, GessLinkedInfo } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: ReservaStep;
  onGoStep: (s: ReservaStep) => void;
  stepDone: (s: number) => boolean;
  canGoStep: (s: number) => boolean;
  formDatos: FormDatos;
  onDatosChange: (update: Partial<FormDatos>) => void;
  formDocs: string[];
  uploading: boolean;
  submitting: boolean;
  selectedCount: number;
  singleStand: boolean;
  selectedLabels: string;
  existingDocs: string[];
  onAddDoc: (file: File) => Promise<void>;
  onRemoveDoc: (idx: number) => void;
  onSubmit: () => Promise<boolean>;
}

const STEPS = [RESERVA_STEPS.DATOS, RESERVA_STEPS.DOCUMENTOS, RESERVA_STEPS.CONFIRMACION] as const;

export function ReservaModal(props: Props) {
  const {
    open, onOpenChange, step, onGoStep, stepDone, canGoStep,
    formDatos, onDatosChange, formDocs, uploading, submitting,
    selectedCount, singleStand, selectedLabels,
    existingDocs, onAddDoc, onRemoveDoc, onSubmit,
  } = props;

  const isLast = step === RESERVA_STEPS.CONFIRMACION;
  const isFirst = step === RESERVA_STEPS.DATOS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <StepIndicator currentStep={step} stepDone={stepDone} canGoStep={canGoStep} onGoStep={onGoStep} />

        <DialogHeader>
          <DialogTitle><span>Reserva de {selectedCount} stand(s)</span></DialogTitle>
          <DialogDescription>
            {step === RESERVA_STEPS.DATOS && <span>Completa los datos de la empresa para iniciar la reserva.</span>}
            {step === RESERVA_STEPS.DOCUMENTOS && singleStand && <span>Descarga el formato de contrato, completalo, y adjuntalo firmado.</span>}
            {step === RESERVA_STEPS.DOCUMENTOS && !singleStand && <span>La reserva multiple no requiere adjuntar contrato por stand.</span>}
            {step === RESERVA_STEPS.CONFIRMACION && <span>Confirma los datos y envia la solicitud de reserva.</span>}
          </DialogDescription>
        </DialogHeader>

        {step === RESERVA_STEPS.DATOS && (
          <StepDatos datos={formDatos} onChange={onDatosChange} selectedLabels={selectedLabels} selectedCount={selectedCount} />
        )}
        {step === RESERVA_STEPS.DOCUMENTOS && (
          <StepDocumentos
            singleStand={singleStand}
            existingDocs={existingDocs} formDocs={formDocs}
            uploading={uploading} onAddDoc={onAddDoc} onRemoveDoc={onRemoveDoc}
          />
        )}
        {step === RESERVA_STEPS.CONFIRMACION && (
          <StepConfirmacion datos={formDatos} selectedLabels={selectedLabels} docsCount={formDocs.length} />
        )}

        <DialogFooter>
          <div className="flex w-full items-center justify-between gap-2">
            <div>
              {!isFirst && (
                <Button variant="secondary" size="sm" disabled={submitting}
                  onClick={() => {
                    const idx = STEPS.indexOf(step);
                    if (idx > 0) onGoStep(STEPS[idx - 1]);
                  }}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  <span>Volver</span>
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {!isLast && (
                <Button size="sm" disabled={!stepDone(step)}
                  onClick={() => {
                    const idx = STEPS.indexOf(step);
                    if (idx < STEPS.length - 1) onGoStep(STEPS[idx + 1]);
                  }}>
                  <span>Continuar</span>
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}
              {isLast && (
                <Button size="sm" disabled={submitting} onClick={onSubmit}>
                  {submitting ? <span>Enviando...</span> : <span>Enviar solicitud</span>}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
