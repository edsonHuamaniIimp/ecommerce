"use client";

import { useEffect, useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/use-confirm";
import { contratosService } from "@/lib/client/api/services/contratos-service";
import { solicitudesService } from "@/lib/client/api/services/solicitudes-service";
import { CuotasEditor, type CuotaFila } from "@/components/shared/cuotas-editor";
import { aplicarDescuentoMonto, aplicarDescuentoNeto, calcularImportes, descuentoMontoValido, descuentoPorcentajeValido } from "@/lib/shared/utils/importes";
import { formatearMonto } from "@/lib/shared/utils/moneda";
import { porcentajesValidos, sumarPorcentajes } from "@/lib/shared/utils/cuotas";
import type { SolicitudDTO } from "@/types/dto/solicitudes/solicitudes-response.dto";

interface Props {
  solicitud: SolicitudDTO;
  onClose: () => void;
  onSaved: () => void;
}

type TipoDescuento = "porcentaje" | "monto";

function filasDesdePlan(plan: NonNullable<SolicitudDTO["planCuotas"]>): CuotaFila[] {
  return (plan.cuotas ?? []).map((cuota) => ({
    fecha: cuota.fechaVencimiento ?? "",
    porcentaje: String(cuota.porcentaje),
    monto: cuota.monto.toFixed(2),
  }));
}

/** Edicion administrativa del cronograma y descuento de una reserva de empresa. */
export function EditarPlanSolicitudModal({ solicitud, onClose, onSaved }: Props) {
  const { confirm, confirmDialog } = useConfirm();
  const [cargando, setCargando] = useState(!solicitud.planCuotas?.cuotas?.length);
  const [guardando, setGuardando] = useState(false);
  const [plan, setPlan] = useState(solicitud.planCuotas ?? null);
  const [filas, setFilas] = useState<CuotaFila[]>(solicitud.planCuotas?.cuotas ? filasDesdePlan(solicitud.planCuotas) : []);
  const [aplicarDescuento, setAplicarDescuento] = useState(
    Number(solicitud.planCuotas?.descuentoMonto ?? 0) > 0,
  );
  const [tipoDescuento, setTipoDescuento] = useState<TipoDescuento>(
    solicitud.planCuotas?.descuentoTipo === "monto" ? "monto" : "porcentaje",
  );
  const [descuentoValor, setDescuentoValor] = useState(
    String(solicitud.planCuotas?.descuentoValor ?? solicitud.planCuotas?.descuentoPorcentaje ?? 0),
  );

  useEffect(() => {
    if (plan?.cuotas?.length) return;
    let vigente = true;
    solicitudesService.detalle(solicitud.id)
      .then((detalle) => {
        if (!vigente) return;
        setPlan(detalle.planCuotas ?? null);
        setFilas(detalle.planCuotas?.cuotas ? filasDesdePlan(detalle.planCuotas) : []);
        setAplicarDescuento(Number(detalle.planCuotas?.descuentoMonto ?? 0) > 0);
        setTipoDescuento(detalle.planCuotas?.descuentoTipo === "monto" ? "monto" : "porcentaje");
        setDescuentoValor(String(detalle.planCuotas?.descuentoValor ?? detalle.planCuotas?.descuentoPorcentaje ?? 0));
      })
      .catch(() => toast.error("No se pudo cargar el plan de la solicitud"))
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [plan?.cuotas?.length, solicitud.id]);

  const moneda = plan?.moneda ?? solicitud.moneda ?? "USD";
  const netoLista = Number(plan?.netoLista ?? 0);
  const valorDescuento = aplicarDescuento ? Number(descuentoValor || 0) : 0;
  const descuentoValido = !aplicarDescuento || (
    tipoDescuento === "porcentaje"
      ? descuentoPorcentajeValido(valorDescuento)
      : descuentoMontoValido(netoLista, valorDescuento)
  );
  const neto = !descuentoValido || netoLista <= 0
    ? netoLista
    : tipoDescuento === "monto"
      ? aplicarDescuentoMonto(netoLista, valorDescuento)
      : aplicarDescuentoNeto(netoLista, valorDescuento);
  const total = calcularImportes(neto).total;
  const porcentajes = filas.map((fila) => Number(fila.porcentaje) || 0);
  const cuotasValidas = filas.length > 0 &&
    porcentajesValidos(porcentajes, filas.length) &&
    sumarPorcentajes(porcentajes) === 100 &&
    filas.every((fila) => fila.fecha.trim() !== "");
  const puedeGuardar = !cargando && !guardando && plan?.cuotas?.length && netoLista > 0 && descuentoValido && cuotasValidas;

  const guardar = async () => {
    if (!puedeGuardar || !plan?.cuotas?.length) return;
    const confirmado = await confirm({
      title: "Guardar cambios del plan",
      description: `Se actualizarán el descuento, las cuotas y las fechas. El contrato se regenerará por un total de ${formatearMonto(total, moneda, { decimales: 2 })}. ¿Continuar?`,
      confirmLabel: "Guardar y regenerar",
      destructive: true,
    });
    if (!confirmado) return;
    setGuardando(true);
    try {
      await contratosService.generar({
        solicitudId: solicitud.id,
        cuotas: filas.map((fila) => ({
          porcentaje: Number(fila.porcentaje),
          fechaVencimiento: fila.fecha,
        })),
        descuentoTipo: aplicarDescuento ? tipoDescuento : "porcentaje",
        descuentoValor: aplicarDescuento ? valorDescuento : 0,
      });
      toast.success("Plan actualizado y contrato regenerado");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el plan");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base font-semibold">Editar plan de la solicitud</DialogTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ajusta descuento, porcentajes y fechas. Los montos se recalculan y el contrato se regenera al guardar.
          </p>
        </DialogHeader>

        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando plan...
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">Aplicar descuento</Label>
                <Checkbox
                  checked={aplicarDescuento}
                  onCheckedChange={(value) => {
                    const activo = value === true;
                    setAplicarDescuento(activo);
                    if (!activo) setDescuentoValor("0");
                  }}
                  disabled={guardando}
                />
              </div>
              {aplicarDescuento && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Select value={tipoDescuento} onValueChange={(value) => { setTipoDescuento(value as TipoDescuento); setDescuentoValor("0"); }} disabled={guardando}>
                    <SelectTrigger className="h-9 w-[135px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="porcentaje">Porcentaje</SelectItem>
                      <SelectItem value="monto">Monto fijo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={descuentoValor}
                    onChange={(event) => setDescuentoValor(event.target.value)}
                    className="h-9 max-w-[160px] text-xs"
                    aria-label={tipoDescuento === "porcentaje" ? "Descuento en porcentaje" : "Descuento en monto"}
                    disabled={guardando}
                  />
                  <span className="text-xs text-muted-foreground">{tipoDescuento === "porcentaje" ? "%" : moneda}</span>
                </div>
              )}
              {!descuentoValido && (
                <p className="mt-1 text-[11px] text-destructive">
                  {tipoDescuento === "monto"
                    ? "El monto debe ser mayor a 0, con 2 decimales y no superar el neto."
                    : "El porcentaje debe estar entre 0 y 100 con máximo 2 decimales."}
                </p>
              )}
            </div>

            <div className="grid gap-2 rounded-lg border border-border p-3 text-xs sm:grid-cols-3">
              <div>
                <span className="text-muted-foreground">Neto lista</span>
                <p className="font-medium">{formatearMonto(netoLista, moneda, { decimales: 2 })}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Neto con descuento</span>
                <p className="font-medium">{formatearMonto(neto, moneda, { decimales: 2 })}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Total con IGV</span>
                <p className="font-semibold">{formatearMonto(total, moneda, { decimales: 2 })}</p>
              </div>
            </div>

            <CuotasEditor
              filas={filas}
              onChange={setFilas}
              montoTotal={total}
              moneda={moneda}
              disabled={guardando}
              ayuda="El contrato se regenera con las fechas y porcentajes guardados. La última cuota absorbe el redondeo."
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button size="sm" onClick={() => { void guardar(); }} disabled={!puedeGuardar}>
            {guardando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Guardar y regenerar contrato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
      {confirmDialog}
    </>
  );
}
