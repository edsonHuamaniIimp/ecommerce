"use client";

import { Button, Input, Label } from "@nrivera-iimp/ui-kit-iimp";
import { Plus, Trash2 } from "lucide-react";
import { CUOTAS_PORCENTAJE_PASO, CUOTAS_PORCENTAJE_TOTAL, MAX_CUOTAS_PERSONALIZADAS } from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import {
  configCuotasValida,
  montoCuotaDesdePorcentaje,
  porcentajeCuotaDesdeMonto,
  porcentajeRestante,
  porcentajesValidos,
  sumarPorcentajes,
} from "@/lib/shared/utils/cuotas";
import { sumarMontos } from "@/lib/shared/utils/importes";
import { etiquetaMoneda, formatearMonto } from "@/lib/shared/utils/moneda";

export interface CuotaFila {
  fecha: string;
  porcentaje: string;
  monto: string;
}

function montoEditable(total: number, porcentaje: number): string {
  const monto = montoCuotaDesdePorcentaje(total, porcentaje);
  return monto > 0 ? monto.toFixed(2) : "";
}

function porcentajeEditable(total: number, monto: number): string {
  const porcentaje = porcentajeCuotaDesdeMonto(total, monto);
  return porcentaje > 0 ? porcentaje.toFixed(2) : "";
}

export function crearCuotaFilaInicial(total = 0): CuotaFila[] {
  return [
    {
      fecha: dateUtils.inputValue(dateUtils.addMonths(new Date(), 1)),
      porcentaje: String(CUOTAS_PORCENTAJE_TOTAL),
      monto: total > 0 ? total.toFixed(2) : "",
    },
  ];
}

export function validarFilasCuotas(filas: CuotaFila[]): boolean {
  const fechas = filas.map((fila) => fila.fecha);
  const porcentajes = filas.map((fila) => Number(fila.porcentaje));
  return configCuotasValida(
    { maxCuotas: filas.length, fechas, porcentajes },
    dateUtils.todayLimaInputValue(),
  );
}

export function CuotasEditor({ filas, onChange, montoTotal, moneda = "USD", disabled = false }: {
  filas: CuotaFila[];
  onChange: (filas: CuotaFila[]) => void;
  montoTotal: number;
  moneda?: string;
  disabled?: boolean;
}) {
  const hoy = dateUtils.todayLimaInputValue();
  const manana = dateUtils.inputValue(dateUtils.addDays(dateUtils.toDate(hoy) ?? new Date(), 1));
  const fechas = filas.map((fila) => fila.fecha);
  const porcentajes = filas.map((fila) => Number(fila.porcentaje));
  const suma = sumarPorcentajes(porcentajes);
  const sumaMontos = sumarMontos(filas.map((fila) => ({ monto: Number(fila.monto) || 0 })));
  const fechasCompletas = filas.every((fila) => fila.fecha.trim() !== "");
  const porcentajesCompletos = filas.every((fila) => fila.porcentaje.trim() !== "");
  const fechasOk = fechasCompletas && fechas.every((fecha, index) => fecha > hoy && (index === 0 || fecha > (fechas[index - 1] ?? "")));
  const porcentajesOk = porcentajesCompletos && porcentajesValidos(porcentajes, filas.length);
  const formularioValido = validarFilasCuotas(filas);

  const actualizarPorcentaje = (index: number, valor: string) => {
    const next: CuotaFila[] = filas.map((fila, i) =>
      i === index
        ? { ...fila, porcentaje: valor, monto: montoEditable(montoTotal, Number(valor)) }
        : fila,
    );
    if (index < filas.length - 1 && valor.trim() !== "") {
      const last = next.length - 1;
      const lastFila = next[last];
      const restante = porcentajeRestante(next.slice(0, last).map((fila) => Number(fila.porcentaje) || 0));
      if (lastFila) {
        next[last] = {
          ...lastFila,
          porcentaje: restante > 0 ? String(restante) : lastFila.porcentaje,
          monto: restante > 0 ? montoEditable(montoTotal, restante) : lastFila.monto,
        };
      }
    }
    onChange(next);
  };

  const actualizarMonto = (index: number, valor: string) => {
    const next: CuotaFila[] = filas.map((fila, i) =>
      i === index
        ? { ...fila, monto: valor, porcentaje: porcentajeEditable(montoTotal, Number(valor)) }
        : fila,
    );
    if (index < filas.length - 1 && valor.trim() !== "") {
      const last = next.length - 1;
      const lastFila = next[last];
      const restante = porcentajeRestante(next.slice(0, last).map((fila) => Number(fila.porcentaje) || 0));
      if (lastFila) {
        next[last] = {
          ...lastFila,
          porcentaje: restante > 0 ? String(restante) : lastFila.porcentaje,
          monto: restante > 0 ? montoEditable(montoTotal, restante) : lastFila.monto,
        };
      }
    }
    onChange(next);
  };

  const actualizarFila = (index: number, cambios: Partial<Pick<CuotaFila, "fecha">>) => {
    onChange(filas.map((fila, i) => (i === index ? { ...fila, ...cambios } : fila)));
  };

  const agregar = () => {
    if (filas.length >= MAX_CUOTAS_PERSONALIZADAS) return;
    const restante = porcentajeRestante(porcentajes);
    onChange([
      ...filas,
      {
        fecha: "",
        porcentaje: restante > 0 ? String(restante) : "",
        monto: restante > 0 ? montoEditable(montoTotal, restante) : "",
      },
    ]);
  };

  const quitar = (index: number) => {
    if (filas.length <= 1) return;
    onChange(filas.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">
          <span>Cuotas: <strong>{filas.length}</strong></span>
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 rounded-full text-[11px]"
          disabled={disabled || filas.length >= MAX_CUOTAS_PERSONALIZADAS}
          onClick={agregar}
        >
          <Plus className="h-3 w-3" />
          <span>Agregar cuota</span>
        </Button>
      </div>

      <div className="space-y-2">
        {filas.map((fila, index) => (
          <div key={index} className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 p-2.5">
            <span className="mt-5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card text-[11px] font-bold text-foreground">
              {index + 1}
            </span>
            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor={`reserva-fecha-${index}`} className="text-[10px] text-muted-foreground">
                  <span>Fecha de vencimiento</span>
                </Label>
                <Input
                  id={`reserva-fecha-${index}`}
                  type="date"
                  min={manana}
                  value={fila.fecha}
                  onChange={(event) => actualizarFila(index, { fecha: event.target.value })}
                  className="h-8 text-xs"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`reserva-porcentaje-${index}`} className="text-[10px] text-muted-foreground">
                  <span>Porcentaje</span>
                </Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id={`reserva-porcentaje-${index}`}
                    type="number"
                    min={CUOTAS_PORCENTAJE_PASO}
                    max={CUOTAS_PORCENTAJE_TOTAL}
                    step={CUOTAS_PORCENTAJE_PASO}
                    value={fila.porcentaje}
                    onChange={(event) => actualizarPorcentaje(index, event.target.value)}
                    className="h-8 text-xs"
                    disabled={disabled}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`reserva-monto-${index}`} className="text-[10px] text-muted-foreground">
                  <span>Monto ({etiquetaMoneda(moneda)})</span>
                </Label>
                <Input
                  id={`reserva-monto-${index}`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={fila.monto}
                  onChange={(event) => actualizarMonto(index, event.target.value)}
                  className="h-8 text-xs"
                  disabled={disabled}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-5 h-7 w-7 shrink-0 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Quitar cuota"
              disabled={disabled || filas.length <= 1}
              onClick={() => quitar(index)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-1 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <span className={formularioValido ? "font-medium text-success" : "font-medium text-warning"}>
            <span>
              {porcentajesCompletos
                ? `Suma de porcentajes: ${suma}% de ${CUOTAS_PORCENTAJE_TOTAL}%`
                : "Porcentajes incompletos"}
            </span>
          </span>
          {!formularioValido ? <span className="text-warning">Completa todos los campos.</span> : null}
        </div>
        <div className={Math.abs(sumaMontos - montoTotal) < 0.01 ? "text-muted-foreground" : "text-warning"}>
          <span>Suma de montos: {formatearMonto(sumaMontos, moneda, { decimales: 2 })} de {formatearMonto(montoTotal, moneda, { decimales: 2 })}</span>
        </div>
        {!fechasOk ? <p className="text-warning">Usa fechas futuras y en orden ascendente.</p> : null}
        {!porcentajesOk ? <p className="text-warning">Cada porcentaje debe ser mayor a 0 y sumar 100%.</p> : null}
      </div>
    </div>
  );
}
