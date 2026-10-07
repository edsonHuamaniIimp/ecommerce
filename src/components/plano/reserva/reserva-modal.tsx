"use client";

import { Button, Dialog, DialogContent, DialogFooter } from "@nrivera-iimp/ui-kit-iimp";
import { ChevronRight, ChevronLeft, Building2, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { RESERVA_STEPS } from "@/lib/shared/constants";
import type { ReservaStep } from "@/lib/shared/constants";
import { codigoComercialStand } from "@/lib/shared/utils/stand-codigo";
import { StepIndicator } from "./step-indicator";
import { StepDatos } from "./step-datos";
import { StepContrato } from "./step-contrato";
import { StepConfirmacion } from "./step-confirmacion";
import { StepPagos } from "./step-pagos";
import { ReservaAuthForm } from "./reserva-auth-form";
import type { DatosContratoForm, FormDatos } from "./interfaces";
import type { CuotaConfig } from "./use-reserva-form";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autenticado: boolean;
  sesionCargando: boolean;
  onAuthenticated: () => void | Promise<unknown>;
  step: ReservaStep;
  onGoStep: (s: ReservaStep) => void;
  stepDone: (s: number) => boolean;
  canGoStep: (s: number) => boolean;
  formDatos: FormDatos;
  onDatosChange: (update: Partial<FormDatos>) => void;
  /** Documentos del cliente por requisito (ANEXOS_REQUERIDOS): clave -> URL. */
  docsRequisitos: Record<string, string>;
  subiendoRequisito: string | null;
  submitting: boolean;
  submitError: string | null;
  selectedCount: number;
  singleStand: boolean;
  selectedLabels: string;
  selectedItems: { id: string; standCode?: string | null; typeLabel: string; medidas: string | null; reserved: boolean; precio?: number }[];
  existingDocs: string[];
  onAddRequisito: (requisito: string, file: File) => Promise<void>;
  onRemoveRequisito: (requisito: string) => void;
  onSubmit: () => Promise<boolean>;
  confirmado: boolean;
  onConfirmadoChange: (v: boolean) => void;
  /** Declaracion del solicitante como representante legal de la empresa. */
  aceptaRepresentante: boolean;
  onAceptaRepresentanteChange: (v: boolean) => void;
  /** Cuotas configuradas por el cliente: porcentaje + fecha (1..3). */
  cuotasPago: CuotaConfig[];
  onCuotasPagoChange: (cuotas: CuotaConfig[]) => void;
  /** Datos del exhibidor para el cuerpo del contrato (paso Cuotas). */
  contratoDatos: DatosContratoForm;
  onContratoDatosChange: (datos: DatosContratoForm) => void;
  contrato: { solicitudId: string; docxUrl: string; pdfUrl: string | null } | null;
  generandoContrato: boolean;
  onGenerarContrato: () => Promise<boolean>;
  contratoFirmadoUrl: string | null;
  subiendoFirmado: boolean;
  onSubirFirmado: (file: File) => void;
  /** Firma digital del perfil (RF-12). */
  firmaPerfilUrl: string | null;
  firmandoDigital: boolean;
  onFirmarDigital: () => void;
}

const STEPS = [RESERVA_STEPS.DATOS, RESERVA_STEPS.CUOTAS, RESERVA_STEPS.CONTRATO, RESERVA_STEPS.CONFIRMACION] as const;

/** Titulo y subtitulo del encabezado segun el paso actual. */
function encabezado(step: ReservaStep): string {
  if (step === RESERVA_STEPS.DATOS) return "Completa los datos comerciales y de facturacion para formalizar tu solicitud.";
  if (step === RESERVA_STEPS.CUOTAS) return "Configura tus cuotas de pago: se genera el contrato (borrador). La solicitud se crea al confirmar.";
  if (step === RESERVA_STEPS.CONTRATO) return "Descarga el contrato, firmalo (digital o manualmente) y adjunta los 3 documentos requeridos.";
  return "Revisa el resumen y envia tu solicitud al proceso de revision.";
}

export function ReservaModal(props: Props) {
  const {
    open, onOpenChange, autenticado, sesionCargando, onAuthenticated, step, onGoStep, stepDone, canGoStep,
    formDatos, onDatosChange, docsRequisitos, subiendoRequisito, submitting, submitError,
    selectedCount, singleStand, selectedLabels, selectedItems,
    onAddRequisito, onRemoveRequisito, onSubmit,
    confirmado, onConfirmadoChange,
    aceptaRepresentante, onAceptaRepresentanteChange,
    cuotasPago, onCuotasPagoChange, contratoDatos, onContratoDatosChange, contrato, generandoContrato, onGenerarContrato,
    contratoFirmadoUrl, subiendoFirmado, onSubirFirmado,
    firmaPerfilUrl, firmandoDigital, onFirmarDigital,
  } = props;

  const isLast = step === RESERVA_STEPS.CONFIRMACION;
  const isFirst = step === RESERVA_STEPS.DATOS;
  const [showStands, setShowStands] = useState(false);
  const pasoActual = STEPS.indexOf(step) + 1;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden rounded-xl border-border !px-0 !py-0 shadow-2xl backdrop-blur-sm sm:max-w-[640px]">
        {/* Header */}
        <div className="shrink-0 border-b border-border px-5 pt-5 pb-3 !pr-12">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              {selectedCount} {selectedCount === 1 ? "stand seleccionado" : "stands seleccionados"}
            </span>
            {!singleStand && (
              <span className="rounded-full border border-gold/30 bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold">
                Reserva multiple
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto h-7 gap-1.5 px-2 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={() => setShowStands(true)}
              title="Ver stands seleccionados"
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Ver stands</span>
            </Button>
          </div>

          <h2 className="text-base font-bold tracking-tight text-primary">Proceso de Reserva de Stands</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {autenticado ? encabezado(step) : "Identificate para continuar con tu reserva."}
          </p>

          {autenticado && (
            <div className="mt-4">
              <StepIndicator currentStep={step} stepDone={stepDone} canGoStep={canGoStep} onGoStep={onGoStep} />
            </div>
          )}
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          {submitError && (
            <div className="mb-3 mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {submitError}
            </div>
          )}
          {sesionCargando ? (
            <p className="py-10 text-center text-sm text-muted-foreground"><span>Cargando...</span></p>
          ) : !autenticado ? (
            <ReservaAuthForm onAuthenticated={onAuthenticated} />
          ) : (
            <>
              {step === RESERVA_STEPS.DATOS && (
                <StepDatos datos={formDatos} onChange={onDatosChange} selectedLabels={selectedLabels} />
              )}
              {step === RESERVA_STEPS.CUOTAS && (
                <StepPagos
                  precios={selectedItems.map((s) => s.precio ?? 0)}
                  cuotas={cuotasPago}
                  onCuotasChange={onCuotasPagoChange}
                  contratoDatos={contratoDatos}
                  onContratoDatosChange={onContratoDatosChange}
                  contrato={contrato}
                />
              )}
              {step === RESERVA_STEPS.CONTRATO && (
                <StepContrato
                  contrato={contrato}
                  contratoFirmadoUrl={contratoFirmadoUrl}
                  subiendoFirmado={subiendoFirmado}
                  onSubirFirmado={onSubirFirmado}
                  firmaPerfilUrl={firmaPerfilUrl}
                  firmandoDigital={firmandoDigital}
                  onFirmarDigital={onFirmarDigital}
                  generandoContrato={generandoContrato}
                  onGenerarContrato={onGenerarContrato}
                  docsRequisitos={docsRequisitos}
                  subiendoRequisito={subiendoRequisito}
                  onAddRequisito={onAddRequisito}
                  onRemoveRequisito={onRemoveRequisito}
                />
              )}
              {step === RESERVA_STEPS.CONFIRMACION && (
                <StepConfirmacion
                  datos={formDatos}
                  selectedLabels={selectedLabels}
                  docsCount={Object.keys(docsRequisitos).length + (contratoFirmadoUrl ? 1 : 0)}
              confirmado={confirmado}
              onConfirmadoChange={onConfirmadoChange}
              aceptaRepresentante={aceptaRepresentante}
              onAceptaRepresentanteChange={onAceptaRepresentanteChange}
                />
              )}
            </>
          )}
        </div>

        {/* Footer - fixed */}
        {autenticado && (
        <DialogFooter className="shrink-0 border-t border-border px-5 py-3 !mt-0">
          <div className="flex w-full items-center justify-between gap-2">
            <span className="hidden text-[11px] font-medium text-muted-foreground sm:block">
              Paso {pasoActual} de {STEPS.length}
            </span>
            <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
              {isFirst ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={submitting}
                  className="gap-1.5 border-border text-xs font-medium"
                  onClick={() => onOpenChange(false)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Volver al Plano</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={submitting}
                  className="gap-1.5 border-border text-xs font-medium"
                  onClick={() => {
                    const idx = STEPS.indexOf(step);
                    const prev = idx > 0 ? STEPS[idx - 1] : undefined;
                    if (prev !== undefined) onGoStep(prev);
                  }}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Volver</span>
                </Button>
              )}

              {!isLast && (
                <Button
                  size="sm"
                  disabled={!stepDone(step) || (step === RESERVA_STEPS.CUOTAS && generandoContrato)}
                  className="gap-1.5 bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  onClick={() => {
                    const idx = STEPS.indexOf(step);
                    const next = idx < STEPS.length - 1 ? STEPS[idx + 1] : undefined;
                    if (next === undefined) return;
                    if (step === RESERVA_STEPS.CUOTAS) {
                      void (async () => {
                        if (await onGenerarContrato()) onGoStep(next);
                      })();
                      return;
                    }
                    onGoStep(next);
                  }}
                >
                  {step === RESERVA_STEPS.CUOTAS && generandoContrato ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Generando contrato...</span>
                    </>
                  ) : (
                    <>
                      <span>{step === RESERVA_STEPS.CUOTAS ? "Generar contrato y continuar" : "Continuar"}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              )}
              {isLast && (
                <Button
                  size="sm"
                  disabled={submitting || !stepDone(step)}
                  className="gap-1.5 bg-gold text-xs font-bold text-gold-foreground shadow-md hover:bg-gold/90 disabled:opacity-60"
                  onClick={onSubmit}
                >
                  {submitting ? <span>Enviando...</span> : <span>Enviar solicitud</span>}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={showStands} onOpenChange={setShowStands}>
      <DialogContent className="rounded-xl border-border sm:max-w-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-primary">
            {selectedCount} {selectedCount === 1 ? "stand seleccionado" : "stands seleccionados"}
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
            title="Cerrar"
            onClick={() => setShowStands(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-1.5">
          {selectedItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary px-3 py-2 text-xs">
              <span
                className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/10 ${item.reserved ? "bg-muted-foreground" : "bg-success"}`}
              />
              <span className="font-mono font-semibold text-primary">{codigoComercialStand(item.standCode || item.id)}</span>
              <span className="truncate text-muted-foreground">{item.typeLabel}</span>
              {item.medidas && <span className="ml-auto font-medium text-foreground">{item.medidas}</span>}
              {item.reserved && (
                <span className="ml-auto rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                  No disponible
                </span>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
