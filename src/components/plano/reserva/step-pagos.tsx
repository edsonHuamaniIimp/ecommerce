"use client";

import { CalendarClock, CheckCircle2, CreditCard, FileText, Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@nrivera-iimp/ui-kit-iimp";
import { MAX_CUOTAS_PAGO, MONEDAS } from "@/lib/shared/constants";
import { calcularImportes } from "@/lib/shared/utils/importes";
import { fechasCuotasValidas, planCuotasConFechas, porcentajesValidos, siguienteFechaCuota } from "@/lib/shared/utils/cuotas";
import { numberUtils } from "@/lib/shared/utils/number";
import { dateUtils } from "@/lib/shared/utils/date";
import type { CuotaConfig } from "./use-reserva-form";

interface Props {
  /** Precios netos (USD) de los stands seleccionados. */
  precios: number[];
  /** Cuotas configuradas por el cliente: porcentaje + fecha (1..3, suman 100%). */
  cuotas: CuotaConfig[];
  onCuotasChange: (cuotas: CuotaConfig[]) => void;
  /** Contrato generado (se muestra el aviso cuando ya existe). */
  contrato: { docxUrl: string; pdfUrl: string | null } | null;
}

function Preset({ label, activo, onClick }: { label: string; activo: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant={activo ? "default" : "outline"}
      size="sm"
      className="h-7 rounded-full px-3 text-[11px] font-semibold"
      onClick={onClick}
    >
      <span>{label}</span>
    </Button>
  );
}

/**
 * Paso 2: el cliente configura sus cuotas de pago (hasta 3): porcentajes que suman 100%
 * y **fechas de pago** (no pasadas y en orden). Al continuar se genera el contrato.
 */
export function StepPagos({ precios, cuotas, onCuotasChange, contrato }: Props) {
  const neto = precios.reduce((s, p) => s + p, 0);
  const importes = calcularImportes(neto);
  const moneda = MONEDAS.USD;
  const hoy = dateUtils.todayInputValue();

  const porcentajes = cuotas.map((c) => c.porcentaje);
  const fechas = cuotas.map((c) => c.fecha);
  const plan = planCuotasConFechas(importes.total, porcentajes, fechas);
  const suma = Math.round(porcentajes.reduce((s, p) => s + p, 0) * 100) / 100;
  const sumaOk = porcentajesValidos(porcentajes);
  const fechasOk = fechasCuotasValidas(fechas);
  const valido = sumaOk && fechasOk;
  const esPreset1 = cuotas.length === 1 && cuotas[0]?.porcentaje === 100;
  const esPreset2 = cuotas.length === 2 && cuotas[0]?.porcentaje === 50 && cuotas[1]?.porcentaje === 50;

  /** Maximo permitido para una cuota: lo que resta para llegar a 100% (sin exceder). */
  const maxPorCuota = (idx: number) => {
    const otros = Math.round((suma - (cuotas[idx]?.porcentaje ?? 0)) * 100) / 100;
    return Math.max(0, Math.round((100 - otros) * 100) / 100);
  };

  const setPorcentaje = (idx: number, valor: number) => {
    const maximo = maxPorCuota(idx);
    const numero = Number.isFinite(valor) ? valor : 0;
    const saneado = Math.min(Math.max(numero, 0), maximo);
    onCuotasChange(cuotas.map((c, i) => (i === idx ? { ...c, porcentaje: Math.round(saneado * 100) / 100 } : c)));
  };

  const setFecha = (idx: number, valor: string) => {
    onCuotasChange(cuotas.map((c, i) => (i === idx ? { ...c, fecha: valor } : c)));
  };

  const agregarCuota = () => {
    if (cuotas.length >= MAX_CUOTAS_PAGO) return;
    const restante = Math.max(0, Math.round((100 - suma) * 100) / 100);
    if (restante < 0.01) return; // sin porcentaje disponible: no se puede agregar
    const ultimaFecha = cuotas[cuotas.length - 1]?.fecha ?? null;
    onCuotasChange([...cuotas, { porcentaje: restante, fecha: siguienteFechaCuota(ultimaFecha) }]);
  };

  const quitarCuota = (idx: number) => {
    if (cuotas.length <= 1) return;
    onCuotasChange(cuotas.filter((_, i) => i !== idx));
  };

  const aplicarPreset = (porcentajesPreset: number[]) => {
    onCuotasChange(
      porcentajesPreset.map((porcentaje, i) => ({
        porcentaje,
        fecha: cuotas[i]?.fecha ?? siguienteFechaCuota(cuotas[i - 1]?.fecha ?? null),
      })),
    );
  };

  return (
    <div className="flex flex-col gap-3 pt-3">
      <div className="flex items-start gap-3 rounded-xl border border-info/30 bg-info/10 px-3.5 py-3">
        <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Configura tus cuotas (hasta {MAX_CUOTAS_PAGO}): porcentajes que suman 100% y sus
          fechas de pago. El contrato incluira este cronograma.
        </p>
      </div>

      {/* Resumen de importes */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-secondary px-3 py-2 text-[10px] font-semibold tracking-wider text-primary uppercase">
          Importe
        </div>
        <div className="space-y-1.5 px-3 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Valor venta (neto)</span>
            <span className="font-medium text-foreground">{numberUtils.monto(importes.valorVenta, moneda, { decimales: 2 })}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">IGV (18%)</span>
            <span className="font-medium text-foreground">{numberUtils.monto(importes.igv, moneda, { decimales: 2 })}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-1.5 text-sm">
            <span className="font-semibold text-foreground">Total a pagar</span>
            <span className="font-bold text-primary">{numberUtils.monto(importes.total, moneda, { decimales: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Configurador de cuotas */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary px-3 py-2">
          <span className="flex items-center gap-2 text-[10px] font-semibold tracking-wider text-primary uppercase">
            <CalendarClock className="h-3.5 w-3.5" />
            Configuracion de cuotas
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sumaOk ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
            {suma}% de 100%
          </span>
        </div>
        <div className="space-y-3 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Rapidos:</span>
            <Preset label="100% (1 cuota)" activo={esPreset1} onClick={() => aplicarPreset([100])} />
            <Preset label="50% + 50% (2 cuotas)" activo={esPreset2} onClick={() => aplicarPreset([50, 50])} />
          </div>

          <div className="space-y-1.5">
            {cuotas.map((cuota, idx) => {
              const monto = plan[idx]?.monto ?? 0;
              return (
                <div key={idx} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2.5 py-2 text-xs">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-card text-[10px] font-bold text-foreground">
                    {idx + 1}
                  </span>
                  <span className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      max={maxPorCuota(idx)}
                      step="1"
                      value={String(cuota.porcentaje)}
                      onChange={(e) => setPorcentaje(idx, Number(e.target.value))}
                      className="h-7 w-[64px] text-center text-xs"
                    />
                    <span className="text-muted-foreground">%</span>
                  </span>
                  <Input
                    type="date"
                    min={hoy}
                    value={cuota.fecha}
                    onChange={(e) => setFecha(idx, e.target.value)}
                    className="h-7 w-[136px] text-xs"
                  />
                  <span className="font-semibold text-foreground">
                    {numberUtils.monto(monto, moneda, { decimales: 2 })}
                  </span>
                  {cuotas.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-6 w-6 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Quitar cuota"
                      onClick={() => quitarCuota(idx)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {cuotas.length < MAX_CUOTAS_PAGO && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full text-xs"
              disabled={suma >= 100}
              title={suma >= 100 ? "Ya distribuiste el 100%; reduce una cuota para agregar otra" : undefined}
              onClick={agregarCuota}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              <span>Agregar cuota ({cuotas.length + 1} de {MAX_CUOTAS_PAGO})</span>
            </Button>
          )}

          {!sumaOk && (
            <p className="text-[11px] font-medium text-warning">
              Ajusta los porcentajes: deben ser mayores a 0 y sumar exactamente 100%.
            </p>
          )}
          {sumaOk && !fechasOk && (
            <p className="text-[11px] font-medium text-warning">
              Revisa las fechas: no pueden ser anteriores a hoy y deben ir en orden cronologico.
            </p>
          )}
          <p className="text-[10px] text-muted-foreground">
            Las fechas se confirman con Facturacion del IIMP al momento del pago.
          </p>
        </div>
      </div>

      {contrato && (
        <div className="flex items-start gap-2.5 rounded-xl border border-success/30 bg-success/10 px-3.5 py-3">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Contrato generado con esta configuracion. Puedes descargarlo y firmarlo en el siguiente paso.
            {valido ? "" : " Ojo: ajusta las cuotas y vuelve a generar el contrato."}
          </p>
        </div>
      )}

      {valido && (
        <p className="flex items-center gap-1.5 text-[11px] text-success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Configuracion de cuotas lista ({cuotas.length} cuota{cuotas.length === 1 ? "" : "s"}).</span>
        </p>
      )}
    </div>
  );
}
