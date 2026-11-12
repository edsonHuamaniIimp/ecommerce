"use client";

import { useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label } from "@nrivera-iimp/ui-kit-iimp";
import { CalendarCog, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { empresasService } from "@/lib/client/api/services/empresas-service";
import { dateUtils } from "@/lib/shared/utils/date";
import { configCuotasValida, porcentajesEquitativos, porcentajesValidos, type ConfigCuotasEmpresa } from "@/lib/shared/utils/cuotas";
import { CUOTAS_PORCENTAJE_PASO, CUOTAS_PORCENTAJE_TOTAL, MAX_CUOTAS_PERSONALIZADAS } from "@/lib/shared/constants";
import type { EmpresaDTO } from "@/types/dto/empresas";

interface Props {
  empresa: EmpresaDTO;
  onClose: () => void;
  onSaved: () => void;
}

interface FilaCuota {
  fecha: string;
  porcentaje: string;
}

function filasIniciales(config: EmpresaDTO["configCuotas"]): FilaCuota[] {
  if (config?.fechas?.length) {
    const porcentajes = config.porcentajes ?? porcentajesEquitativos(config.maxCuotas);
    return config.fechas.map((fecha, i) => ({
      fecha,
      porcentaje: String(porcentajes[i] ?? ""),
    }));
  }
  return [{ fecha: "", porcentaje: String(CUOTAS_PORCENTAJE_TOTAL) }];
}

/** Configura el cronograma personalizado de cuotas (Modalidad 4) de una empresa. */
export function ConfigurarCuotasEmpresaModal({ empresa, onClose, onSaved }: Props) {
  const hoy = dateUtils.todayLimaInputValue();
  const manana = dateUtils.inputValue(dateUtils.addDays(dateUtils.toDate(hoy) ?? new Date(), 1));
  const inicial = empresa.configCuotas;
  const [filas, setFilas] = useState<FilaCuota[]>(() => filasIniciales(inicial));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cantidad = filas.length;
  const fechas = filas.map((fila) => fila.fecha);
  const porcentajes = filas.map((fila) => Number(fila.porcentaje));
  const suma = Math.round(porcentajes.reduce((total, porcentaje) => total + (Number.isFinite(porcentaje) ? porcentaje : 0), 0) * 100) / 100;
  const fechasCompletas = filas.every((fila) => fila.fecha.trim() !== "");
  const porcentajesCompletos = filas.every((fila) => fila.porcentaje.trim() !== "");
  const fechasOk = fechasCompletas && fechas.every((fecha, i) => fecha > hoy && (i === 0 || fecha > (fechas[i - 1] ?? "")));
  const porcentajesOk = porcentajesCompletos && porcentajesValidos(porcentajes, cantidad);
  const formularioValido = configCuotasValida({ maxCuotas: cantidad, fechas, porcentajes }, hoy);

  const agregarCuota = () => {
    if (filas.length >= MAX_CUOTAS_PERSONALIZADAS) return;
    setFilas((prev) => [...prev, { fecha: "", porcentaje: "" }]);
    setError(null);
  };

  const quitarCuota = (idx: number) => {
    if (filas.length <= 1) return;
    setFilas((prev) => prev.filter((_, i) => i !== idx));
    setError(null);
  };

  const actualizarFila = (idx: number, cambios: Partial<FilaCuota>) => {
    setFilas((prev) => prev.map((fila, i) => (i === idx ? { ...fila, ...cambios } : fila)));
    setError(null);
  };

  const guardar = async (config: ConfigCuotasEmpresa | null) => {
    if (config && !configCuotasValida(config, hoy)) {
      setError("Completa las cuotas con fechas futuras, válidas, en orden ascendente y porcentajes que sumen 100%.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await empresasService.configurarCuotas(empresa.id, config);
      toast.success(config ? "Cronograma personalizado guardado" : "La empresa volvió al cronograma estándar");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el cronograma");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <CalendarCog className="h-4 w-4 text-primary" />
            <span>Fechas y porcentajes de pago · {empresa.razonSocial}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            El administrador define la cantidad de cuotas, sus fechas y sus porcentajes. El cliente
            solo visualiza este cronograma en el wizard. Se imprime como{" "}
            <strong className="text-foreground">Modalidad 4</strong> en el contrato.
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Cantidad de cuotas: <strong>{cantidad}</strong></Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 rounded-full text-[11px]"
              disabled={cantidad >= MAX_CUOTAS_PERSONALIZADAS || guardando}
              onClick={agregarCuota}
            >
              <Plus className="h-3 w-3" />
              <span>Agregar cuota</span>
            </Button>
          </div>

          <div className="space-y-2">
            {filas.map((fila, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2">
                <span className="mt-5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card text-[11px] font-bold text-foreground">
                  {i + 1}
                </span>
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`fecha-cuota-${i}`} className="text-[10px] text-muted-foreground">Fecha de vencimiento</Label>
                    <Input
                      id={`fecha-cuota-${i}`}
                      type="date"
                      min={manana}
                      value={fila.fecha}
                      onChange={(e) => actualizarFila(i, { fecha: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`porcentaje-cuota-${i}`} className="text-[10px] text-muted-foreground">Porcentaje</Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        id={`porcentaje-cuota-${i}`}
                        type="number"
                        min={CUOTAS_PORCENTAJE_PASO}
                        max={CUOTAS_PORCENTAJE_TOTAL}
                        step={CUOTAS_PORCENTAJE_PASO}
                        value={fila.porcentaje}
                        onChange={(e) => actualizarFila(i, { porcentaje: e.target.value })}
                        className="h-8 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-5 h-7 w-7 shrink-0 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Quitar cuota"
                  disabled={cantidad <= 1 || guardando}
                  onClick={() => quitarCuota(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="flex items-center justify-between">
              <span className={formularioValido ? "font-medium text-success" : "font-medium text-warning"}>
                {porcentajesCompletos
                  ? `Suma de porcentajes: ${suma}% de ${CUOTAS_PORCENTAJE_TOTAL}%`
                  : "Porcentajes incompletos"}
              </span>
              {!formularioValido && <span className="text-warning">Completa todos los campos para guardar.</span>}
            </div>
            {!fechasOk && <p className="text-warning">Completa una fecha futura y en orden ascendente para cada cuota.</p>}
            {!porcentajesOk && <p className="text-warning">Completa un porcentaje mayor a 0 para cada cuota; la suma debe ser 100%.</p>}
          </div>

          {error && <p className="text-[11px] font-medium text-destructive">{error}</p>}

          <p className="text-[10px] text-muted-foreground">
            Las fechas deben ser estrictamente posteriores a hoy. Los porcentajes definidos aquí
            quedan fijos para el cliente y se trasladan al contrato.
          </p>
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground"
            disabled={guardando || !empresa.configCuotas}
            onClick={() => { void guardar(null); }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Usar cronograma estándar</span>
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={onClose} disabled={guardando}>
              <span>Cancelar</span>
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={guardando || !formularioValido}
              onClick={() => {
                void guardar({
                  maxCuotas: cantidad,
                  fechas: filas.map((fila) => fila.fecha),
                  porcentajes,
                });
              }}
            >
              {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarCog className="h-3.5 w-3.5" />}
              <span>{guardando ? "Guardando..." : "Guardar cronograma"}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
