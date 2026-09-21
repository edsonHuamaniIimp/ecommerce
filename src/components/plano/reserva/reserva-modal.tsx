"use client";

import { Button, Dialog, DialogContent, DialogFooter } from "@nrivera-iimp/ui-kit-iimp";
import { ChevronRight, ChevronLeft, Building2 } from "lucide-react";
import { useState } from "react";
import { RESERVA_STEPS } from "@/lib/shared/constants";
import type { ReservaStep } from "@/lib/shared/constants";
import { StepIndicator } from "./step-indicator";
import { StepDatos } from "./step-datos";
import { StepDocumentos } from "./step-documentos";
import { StepConfirmacion } from "./step-confirmacion";
import type { FormDatos } from "./interfaces";

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
  submitError: string | null;
  selectedCount: number;
  singleStand: boolean;
  selectedLabels: string;
  selectedItems: { id: string; typeLabel: string; precio: string | null; reserved: boolean }[];
  existingDocs: string[];
  onAddDoc: (file: File) => Promise<void>;
  onRemoveDoc: (idx: number) => void;
  onSubmit: () => Promise<boolean>;
  confirmado: boolean;
  onConfirmadoChange: (v: boolean) => void;
}

const STEPS = [RESERVA_STEPS.DATOS, RESERVA_STEPS.DOCUMENTOS, RESERVA_STEPS.CONFIRMACION] as const;

export function ReservaModal(props: Props) {
  const {
    open, onOpenChange, step, onGoStep, stepDone, canGoStep,
    formDatos, onDatosChange, formDocs, uploading, submitting, submitError,
    selectedCount, singleStand, selectedLabels, selectedItems,
    existingDocs, onAddDoc, onRemoveDoc, onSubmit,
    confirmado, onConfirmadoChange,
  } = props;

  const isLast = step === RESERVA_STEPS.CONFIRMACION;
  const isFirst = step === RESERVA_STEPS.DATOS;
  const [showStands, setShowStands] = useState(false);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col rounded-2xl border-0 shadow-xl shadow-slate-200/50 !px-0 !py-0 overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-5 pt-4 pb-2 border-b border-slate-100 !pr-12">
          <StepIndicator currentStep={step} stepDone={stepDone} canGoStep={canGoStep} onGoStep={onGoStep} />
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <button
              className="flex items-center gap-1.5 rounded-md px-2 py-1 -ml-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              onClick={() => setShowStands(true)}
              title="Ver stands seleccionados"
            >
              <Building2 className="h-3.5 w-3.5" />
              <span className="font-medium">{selectedCount} {selectedCount === 1 ? "stand" : "stands"}</span>
            </button>
            {step === RESERVA_STEPS.DATOS && <span>· Completa los datos comerciales</span>}
            {step === RESERVA_STEPS.DOCUMENTOS && singleStand && <span>· Adjunta el contrato firmado</span>}
            {step === RESERVA_STEPS.DOCUMENTOS && !singleStand && <span>· Reserva multiple</span>}
            {step === RESERVA_STEPS.CONFIRMACION && <span>· Confirma y envia</span>}
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          {submitError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {submitError}
            </div>
          )}
          {step === RESERVA_STEPS.DATOS && (
            <StepDatos datos={formDatos} onChange={onDatosChange} />
          )}
          {step === RESERVA_STEPS.DOCUMENTOS && (
            <StepDocumentos
              singleStand={singleStand}
              existingDocs={existingDocs} formDocs={formDocs}
              uploading={uploading} onAddDoc={onAddDoc} onRemoveDoc={onRemoveDoc}
            />
          )}
          {step === RESERVA_STEPS.CONFIRMACION && (
            <StepConfirmacion datos={formDatos} selectedLabels={selectedLabels} docsCount={formDocs.length} confirmado={confirmado} onConfirmadoChange={onConfirmadoChange} />
          )}
        </div>

        {/* Footer — fixed */}
        <DialogFooter className="shrink-0 border-t border-slate-100 px-5 py-3 !mt-0">
          <div className="flex w-full items-center justify-between gap-2">
            <div>
              {!isFirst && (
                <Button variant="outline" size="sm" disabled={submitting}
                  className="rounded-full px-3 text-xs font-medium border-slate-200 hover:bg-slate-50"
                  onClick={() => {
                    const idx = STEPS.indexOf(step);
                    const prev = idx > 0 ? STEPS[idx - 1] : undefined;
                    if (prev !== undefined) onGoStep(prev);
                  }}>
                  <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                  <span>Volver</span>
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {!isLast && (
                <Button size="sm" disabled={!stepDone(step)}
                  className="rounded-full px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    const idx = STEPS.indexOf(step);
                    const next = idx < STEPS.length - 1 ? STEPS[idx + 1] : undefined;
                    if (next !== undefined) onGoStep(next);
                  }}>
                  <span>Continuar</span>
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              )}
              {isLast && (
                <Button size="sm" disabled={submitting || !stepDone(step)}
                  className="rounded-full px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700"
                  onClick={onSubmit}>
                  {submitting ? <span>Enviando...</span> : <span>Enviar solicitud</span>}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={showStands} onOpenChange={setShowStands}>
      <DialogContent className="sm:max-w-sm rounded-2xl border-0 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">{selectedCount} {selectedCount === 1 ? "stand seleccionado" : "stands seleccionados"}</h3>
        </div>
        <div className="space-y-1.5">
          {selectedItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: item.reserved ? "#9ca3af" : "#32CD32" }} />
              <span className="font-mono font-medium text-slate-700">{item.id}</span>
              <span className="text-slate-400">{item.typeLabel}</span>
              {item.precio && <span className="ml-auto font-medium text-emerald-700">{item.precio}</span>}
              {item.reserved && <span className="ml-auto text-[10px] text-red-500 font-medium">No disponible</span>}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
