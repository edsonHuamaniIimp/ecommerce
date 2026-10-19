"use client";

import { useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label } from "@nrivera-iimp/ui-kit-iimp";
import { CalendarCog, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { empresasService } from "@/lib/client/api/services/empresas-service";
import { dateUtils } from "@/lib/shared/utils/date";
import { configCuotasValida, porcentajesEquitativos, type ConfigCuotasEmpresa } from "@/lib/shared/utils/cuotas";
import { MAX_CUOTAS_PERSONALIZADAS } from "@/lib/shared/constants";
import type { EmpresaDTO } from "@/types/dto/empresas";

interface Props {
  empresa: EmpresaDTO;
  onClose: () => void;
  onSaved: () => void;
}

/** Configura el cronograma personalizado de cuotas (Modalidad 4) de una empresa. */
export function ConfigurarCuotasEmpresaModal({ empresa, onClose, onSaved }: Props) {
  const hoy = dateUtils.todayLimaInputValue();
  const manana = dateUtils.inputValue(dateUtils.addDays(dateUtils.toDate(hoy) ?? new Date(), 1));
  const inicial = empresa.configCuotas;
  const [fechas, setFechas] = useState<string[]>(() => {
    if (inicial?.fechas?.length) return [...inicial.fechas];
    return [""];
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cantidad = fechas.length;
  const porcentajesSugeridos = porcentajesEquitativos(cantidad);

  const agregarCuota = () => {
    if (fechas.length >= MAX_CUOTAS_PERSONALIZADAS) return;
    setFechas((prev) => [...prev, ""]);
    setError(null);
  };

  const quitarCuota = (idx: number) => {
    if (fechas.length <= 1) return;
    setFechas((prev) => prev.filter((_, i) => i !== idx));
    setError(null);
  };

  const guardar = async (config: ConfigCuotasEmpresa | null) => {
    if (config && !configCuotasValida(config, hoy)) {
      setError("Completa las cuotas con fechas futuras, válidas y en orden ascendente.");
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <CalendarCog className="h-4 w-4 text-primary" />
            <span>Fechas de pago · {empresa.razonSocial}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            El administrador define la cantidad de cuotas y sus fechas. El cliente solo
            configura el porcentaje de cada cuota en el wizard. Este cronograma se imprime
            como <strong className="text-foreground">Modalidad 4</strong> en el contrato.
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
            {fechas.map((fecha, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card text-[11px] font-bold text-foreground">
                  {i + 1}
                </span>
                <span className="w-20 shrink-0 text-[11px] text-muted-foreground">Cuota {i + 1}</span>
                <Input
                  type="date"
                  min={manana}
                  value={fecha}
                  onChange={(e) => {
                    setFechas((prev) => prev.map((f, j) => (j === i ? e.target.value : f)));
                    setError(null);
                  }}
                  className="h-8 text-xs"
                />
                <span className="ml-auto text-[10px] text-muted-foreground">sugerido {porcentajesSugeridos[i] ?? 0}%</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Quitar cuota"
                  disabled={cantidad <= 1 || guardando}
                  onClick={() => quitarCuota(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {error && <p className="text-[11px] font-medium text-destructive">{error}</p>}

          <p className="text-[10px] text-muted-foreground">
            Las fechas deben ser estrictamente posteriores a hoy. Al guardar, el cliente verá
            estas cuotas y fechas en el paso “Cuotas” y solo podrá editar los porcentajes.
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
              disabled={guardando}
              onClick={() => { void guardar({ maxCuotas: cantidad, fechas }); }}
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
