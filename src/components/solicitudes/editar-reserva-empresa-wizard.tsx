"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
} from "@nrivera-iimp/ui-kit-iimp";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/use-confirm";
import { contratosService } from "@/lib/client/api/services/contratos-service";
import { solicitudesService } from "@/lib/client/api/services/solicitudes-service";
import { CuotasEditor, type CuotaFila } from "@/components/shared/cuotas-editor";
import { aplicarDescuentoMonto, aplicarDescuentoNeto, calcularImportes, descuentoMontoValido, descuentoPorcentajeValido, redondear2 } from "@/lib/shared/utils/importes";
import { convertirNeto, formatearMonto } from "@/lib/shared/utils/moneda";
import { porcentajesValidos, sumarPorcentajes } from "@/lib/shared/utils/cuotas";
import {
  MODOS_DESCUENTO,
  TIPO_COMPROBANTE_LABELS,
  TIPOS_DESCUENTO,
  type ModoDescuento,
  type TipoDescuentoGlobal,
} from "@/lib/shared/constants";
import type { SolicitudDTO } from "@/types/dto/solicitudes/solicitudes-response.dto";

const OPCIONES_DESCUENTO = [
  { key: "porcentaje_total", modo: MODOS_DESCUENTO.GRUPAL, tipo: TIPOS_DESCUENTO.PORCENTAJE, label: "Porcentaje sobre el total" },
  { key: "monto_total", modo: MODOS_DESCUENTO.GRUPAL, tipo: TIPOS_DESCUENTO.MONTO, label: "Monto fijo sobre el total" },
  { key: "porcentaje_stand", modo: MODOS_DESCUENTO.POR_STAND, tipo: TIPOS_DESCUENTO.PORCENTAJE, label: "Porcentaje por cada stand" },
  { key: "monto_stand", modo: MODOS_DESCUENTO.POR_STAND, tipo: TIPOS_DESCUENTO.MONTO, label: "Monto fijo por cada stand" },
] as const;
interface Props {
  solicitud: SolicitudDTO;
  onClose: () => void;
  onSaved: () => void;
}

const PASOS = ["Configuración", "Descuento", "Cuotas y plazos"] as const;

function filasDesdePlan(plan: NonNullable<SolicitudDTO["planCuotas"]>): CuotaFila[] {
  return (plan.cuotas ?? []).map((cuota) => ({
    fecha: cuota.fechaVencimiento ?? "",
    porcentaje: String(cuota.porcentaje),
    monto: cuota.monto.toFixed(2),
  }));
}

function descuentosStandDesdePlan(plan: NonNullable<SolicitudDTO["planCuotas"]> | null): Record<string, string> {
  return Object.fromEntries(
    (plan?.descuentosPorStand ?? []).map((detalle) => [detalle.standCode ?? detalle.standId, String(detalle.valor ?? 0)]),
  );
}

/** Edición de una reserva administrativa con el mismo flujo de 3 pasos del alta. */
export function EditarReservaEmpresaWizard({ solicitud, onClose, onSaved }: Props) {
  const { confirm, confirmDialog } = useConfirm();
  const [paso, setPaso] = useState(0);
  const [cargando, setCargando] = useState(!solicitud.planCuotas?.cuotas?.length);
  const [guardando, setGuardando] = useState(false);
  const [plan, setPlan] = useState(solicitud.planCuotas ?? null);
  const [filas, setFilas] = useState<CuotaFila[]>(solicitud.planCuotas?.cuotas ? filasDesdePlan(solicitud.planCuotas) : []);
  const [aplicarDescuento, setAplicarDescuento] = useState(
    Number(solicitud.planCuotas?.descuentoMonto ?? 0) > 0 ||
      solicitud.planCuotas?.descuentoTipo === TIPOS_DESCUENTO.POR_STAND,
  );
  const [tipoDescuento, setTipoDescuento] = useState<TipoDescuentoGlobal>(
    solicitud.planCuotas?.descuentosPorStand?.[0]?.tipo === TIPOS_DESCUENTO.MONTO ||
      solicitud.planCuotas?.descuentoTipo === TIPOS_DESCUENTO.MONTO
      ? TIPOS_DESCUENTO.MONTO
      : TIPOS_DESCUENTO.PORCENTAJE,
  );
  const [descuentoValor, setDescuentoValor] = useState(
    String(solicitud.planCuotas?.descuentoValor ?? solicitud.planCuotas?.descuentoPorcentaje ?? 0),
  );
  const [descuentosStand, setDescuentosStand] = useState<Record<string, string>>(
    () => descuentosStandDesdePlan(solicitud.planCuotas ?? null),
  );
  const [modoDescuento, setModoDescuento] = useState<ModoDescuento>(
    solicitud.planCuotas?.descuentoTipo === TIPOS_DESCUENTO.POR_STAND
      ? MODOS_DESCUENTO.POR_STAND
      : MODOS_DESCUENTO.GRUPAL,
  );
  const [busquedaDescuentoStand, setBusquedaDescuentoStand] = useState("");

  useEffect(() => {
    if (plan?.cuotas?.length) return;
    let vigente = true;
    solicitudesService.detalle(solicitud.id)
      .then((detalle) => {
        if (!vigente) return;
        setPlan(detalle.planCuotas ?? null);
        setFilas(detalle.planCuotas?.cuotas ? filasDesdePlan(detalle.planCuotas) : []);
        setAplicarDescuento(
          Number(detalle.planCuotas?.descuentoMonto ?? 0) > 0 ||
            detalle.planCuotas?.descuentoTipo === TIPOS_DESCUENTO.POR_STAND,
        );
        setTipoDescuento(
          detalle.planCuotas?.descuentosPorStand?.[0]?.tipo === TIPOS_DESCUENTO.MONTO ||
            detalle.planCuotas?.descuentoTipo === TIPOS_DESCUENTO.MONTO
            ? TIPOS_DESCUENTO.MONTO
            : TIPOS_DESCUENTO.PORCENTAJE,
        );
        setDescuentoValor(String(detalle.planCuotas?.descuentoValor ?? detalle.planCuotas?.descuentoPorcentaje ?? 0));
        setDescuentosStand(descuentosStandDesdePlan(detalle.planCuotas ?? null));
        setModoDescuento(
          detalle.planCuotas?.descuentoTipo === TIPOS_DESCUENTO.POR_STAND
            ? MODOS_DESCUENTO.POR_STAND
            : MODOS_DESCUENTO.GRUPAL,
        );
      })
      .catch(() => toast.error("No se pudo cargar el plan de la solicitud"))
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [plan?.cuotas?.length, solicitud.id]);

  const moneda = plan?.moneda ?? solicitud.moneda ?? "USD";
  const netoLista = Number(plan?.netoLista ?? 0);
  const esDescuentoPorStand = modoDescuento === MODOS_DESCUENTO.POR_STAND;
  const standsBase = useMemo(() => {
    const detallesPlan = plan?.descuentosPorStand ?? [];
    const desdeSolicitud = solicitud.standsDetalle ?? [];
    const codigos = desdeSolicitud.length > 0
      ? desdeSolicitud.map((stand) => stand.standCode)
      : detallesPlan.map((detalle) => detalle.standCode ?? detalle.standId);
    return codigos.map((standCode) => {
      const detallePlan = detallesPlan.find((detalle) => (detalle.standCode ?? detalle.standId) === standCode);
      const standSolicitud = desdeSolicitud.find((stand) => stand.standCode === standCode);
      const precio = detallePlan?.precio
        ?? convertirNeto(standSolicitud?.precio ?? 0, moneda, solicitud.tipoCambio ?? 1);
      return { standCode, precio };
    });
  }, [moneda, plan, solicitud.standsDetalle, solicitud.tipoCambio]);
  const valorDescuento = aplicarDescuento ? Number(descuentoValor || 0) : 0;
  const detallesStand = standsBase.map((stand) => {
    const tipo = tipoDescuento;
    const valorTexto = descuentosStand[stand.standCode] ?? "0";
    const valor = Number(valorTexto || 0);
    const valido = valorTexto.trim() !== "" && (tipo === TIPOS_DESCUENTO.PORCENTAJE
      ? descuentoPorcentajeValido(valor)
      : descuentoMontoValido(stand.precio, valor));
    return {
      standId: stand.standCode,
      standCode: stand.standCode,
      precio: stand.precio,
      tipo,
      valor,
      valorTexto,
      valido,
      descuentoMonto: valido
        ? tipo === TIPOS_DESCUENTO.PORCENTAJE
          ? redondear2(stand.precio - aplicarDescuentoNeto(stand.precio, valor))
          : valor
        : 0,
      neto: valido
        ? tipo === TIPOS_DESCUENTO.PORCENTAJE
          ? aplicarDescuentoNeto(stand.precio, valor)
          : aplicarDescuentoMonto(stand.precio, valor)
        : stand.precio,
    };
  });
  const busquedaStand = busquedaDescuentoStand.trim().toLowerCase();
  const detallesFiltrados = detallesStand.filter((detalle) =>
    !busquedaStand || `${detalle.standCode ?? detalle.standId}`.toLowerCase().includes(busquedaStand),
  );
  const descuentosStandValidos = detallesStand.length > 0 && detallesStand.every((detalle) => detalle.valido);
  const descuentoValido = esDescuentoPorStand
    ? descuentosStandValidos
    : !aplicarDescuento || (
      tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE
        ? descuentoPorcentajeValido(valorDescuento)
        : descuentoMontoValido(netoLista, valorDescuento)
    );
  const neto = esDescuentoPorStand
    ? redondear2(detallesStand.reduce((suma, detalle) => suma + detalle.neto, 0))
    : !descuentoValido || netoLista <= 0
      ? netoLista
      : tipoDescuento === TIPOS_DESCUENTO.MONTO
        ? aplicarDescuentoMonto(netoLista, valorDescuento)
        : aplicarDescuentoNeto(netoLista, valorDescuento);
  const total = calcularImportes(neto).total;
  const porcentajes = filas.map((fila) => Number(fila.porcentaje) || 0);
  const cuotasValidas = filas.length > 0 &&
    porcentajesValidos(porcentajes, filas.length) &&
    sumarPorcentajes(porcentajes) === 100 &&
    filas.every((fila) => fila.fecha.trim() !== "");
  const puedeGuardar = !cargando && !guardando && plan?.cuotas?.length && netoLista > 0 && descuentoValido && cuotasValidas;
  const opcionDescuento = !aplicarDescuento ? "ninguno" : `${modoDescuento}:${tipoDescuento}`;

  const cambiarOpcionDescuento = (value: string) => {
    if (value === "ninguno") {
      setAplicarDescuento(false);
      setDescuentoValor("0");
      return;
    }
    const [modo, tipo] = value.split(":") as [ModoDescuento, TipoDescuentoGlobal];
    setAplicarDescuento(true);
    setModoDescuento(modo);
    setTipoDescuento(tipo);
    setDescuentoValor("0");
    setDescuentosStand({});
  };

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
        descuentoTipo: esDescuentoPorStand ? undefined : aplicarDescuento ? tipoDescuento : TIPOS_DESCUENTO.PORCENTAJE,
        descuentoValor: esDescuentoPorStand ? undefined : aplicarDescuento ? valorDescuento : 0,
        ...(esDescuentoPorStand
          ? {
              descuentosPorStand: detallesStand.map((detalle) => ({
                standCode: detalle.standCode ?? detalle.standId,
                tipo: detalle.tipo,
                valor: detalle.valor,
              })),
            }
          : {}),
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

  const stands = solicitud.standsDetalle?.length
    ? solicitud.standsDetalle
    : solicitud.standCodes.map((standCode) => ({ standCode }));

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="flex h-[min(92vh,840px)] w-[min(1200px,96vw)] flex-col overflow-hidden sm:max-w-[1200px]">
          <DialogHeader className="shrink-0 text-left">
            <DialogTitle className="text-base font-semibold">Editar reserva de empresa</DialogTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Actualiza el descuento y el cronograma. El contrato se regenera al guardar.
            </p>
          </DialogHeader>

          <div className="flex shrink-0 items-center gap-2 border-b border-border pb-3">
            {PASOS.map((titulo, index) => (
              <div key={titulo} className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                  index === paso
                    ? "bg-primary text-primary-foreground"
                    : index < paso
                      ? "bg-success/15 text-success"
                      : "bg-muted text-muted-foreground"
                }`}>
                  {index + 1}
                </span>
                <span className={`text-xs ${index === paso ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {titulo}
                </span>
                {index < PASOS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />}
              </div>
            ))}
          </div>

          {cargando ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando plan...
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2 pr-1">
              {paso === 0 && (
                <div className="space-y-3">
                  <div className="grid gap-3 rounded-lg border border-border p-3 text-xs sm:grid-cols-2">
                    <div>
                      <span className="text-muted-foreground">Empresa</span>
                      <p className="mt-0.5 font-medium text-foreground">{solicitud.empresa ?? "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo de facturación</span>
                      <p className="mt-0.5 font-medium text-foreground">
                        {solicitud.tipoFacturacion ? (TIPO_COMPROBANTE_LABELS[solicitud.tipoFacturacion] ?? solicitud.tipoFacturacion) : "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo de pago</span>
                      <p className="mt-0.5 font-medium text-foreground">{moneda}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Stands</span>
                      <p className="mt-0.5 font-medium text-foreground">{stands.length}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs font-medium text-foreground">Stands seleccionados</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {stands.map((stand) => (
                        <span key={stand.standCode} className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] text-foreground">
                          {stand.standCode}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      Los stands y los datos de la empresa no se modifican desde esta edición. Solo se actualizan el descuento y el cronograma.
                    </p>
                  </div>
                </div>
              )}

              {paso === 1 && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <p className="text-xs font-medium text-foreground">Tipo de descuento</p>
                    <RadioGroup
                      value={opcionDescuento}
                      onValueChange={cambiarOpcionDescuento}
                      className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
                      disabled={guardando}
                    >
                      <Label htmlFor="editar-sin-descuento" className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background p-2.5 text-xs">
                        <RadioGroupItem id="editar-sin-descuento" value="ninguno" className="mt-0.5" />
                        <span className="font-medium">Sin descuento</span>
                      </Label>
                      {OPCIONES_DESCUENTO.map((opcion) => {
                        const value = `${opcion.modo}:${opcion.tipo}`;
                        return (
                          <Label key={opcion.key} htmlFor={`editar-descuento-${opcion.key}`} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background p-2.5 text-xs">
                            <RadioGroupItem id={`editar-descuento-${opcion.key}`} value={value} className="mt-0.5" />
                            <span className="font-medium leading-snug">{opcion.label}</span>
                          </Label>
                        );
                      })}
                    </RadioGroup>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Elige descuento general o por stand. El descuento se aplica antes de IGV.
                    </p>
                  </div>
                  {esDescuentoPorStand ? (
                    <div className="rounded-lg border border-border bg-secondary/30 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium text-foreground">Descuento por stand</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Ajusta el porcentaje o monto de cada stand. El descuento se aplica antes de IGV.
                          </p>
                        </div>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {detallesStand.length} stand(s)
                        </span>
                      </div>
                      <div className="relative mt-3">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={busquedaDescuentoStand}
                          onChange={(event) => setBusquedaDescuentoStand(event.target.value)}
                          placeholder="Buscar stand"
                          className="h-9 pl-8 text-xs"
                          disabled={guardando}
                        />
                      </div>
                      <div className="mt-2 overflow-hidden rounded-md border border-border bg-background">
                        <div className="hidden grid-cols-[minmax(0,1fr)_150px_130px] gap-3 border-b border-border bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
                          <span>Stand</span>
                          <span>Descuento</span>
                          <span className="text-right">Neto</span>
                        </div>
                        <div className="max-h-[min(42vh,380px)] overflow-y-auto">
                          {detallesFiltrados.map((detalle) => (
                            <div key={detalle.standCode} className="grid gap-2 border-b border-border/60 px-3 py-2.5 last:border-0 sm:grid-cols-[minmax(0,1fr)_150px_130px] sm:items-center sm:gap-3">
                              <div className="min-w-0">
                                <p className="font-mono text-xs font-semibold">{detalle.standCode}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  Base {formatearMonto(detalle.precio, moneda, { decimales: 2 })}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={detalle.valorTexto}
                                  onChange={(event) => setDescuentosStand((prev) => ({ ...prev, [detalle.standCode]: event.target.value }))}
                                  className="h-9 text-right text-xs"
                                  aria-label={`Descuento para ${detalle.standCode}`}
                                  disabled={guardando}
                                />
                                <span className="w-8 text-[10px] text-muted-foreground">
                                  {tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE ? "%" : moneda}
                                </span>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-medium">{formatearMonto(detalle.neto, moneda, { decimales: 2 })}</p>
                                {!detalle.valido && (
                                  <p className="text-[10px] text-destructive">
                                    {tipoDescuento === TIPOS_DESCUENTO.MONTO ? "No puede superar el precio." : "Entre 0% y 100%."}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                          {detallesFiltrados.length === 0 && (
                            <p className="px-3 py-5 text-center text-xs text-muted-foreground">No hay stands que coincidan.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border bg-secondary/30 p-3">
                      <p className="text-xs font-medium text-foreground">Descuento del contrato</p>
                      {aplicarDescuento && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={descuentoValor}
                            onChange={(event) => setDescuentoValor(event.target.value)}
                            className="h-9 max-w-[160px] text-xs"
                            aria-label={tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE ? "Descuento en porcentaje" : "Descuento en monto"}
                            disabled={guardando}
                          />
                          <span className="text-xs text-muted-foreground">
                            {tipoDescuento === TIPOS_DESCUENTO.PORCENTAJE ? "%" : moneda}
                          </span>
                        </div>
                      )}
                      {!descuentoValido && (
                        <p className="mt-1 text-[11px] text-destructive">
                          {tipoDescuento === TIPOS_DESCUENTO.MONTO
                            ? "El monto debe ser mayor a 0, con 2 decimales y no superar el neto."
                            : "El porcentaje debe estar entre 0 y 100 con máximo 2 decimales."}
                        </p>
                      )}
                    </div>
                  )}

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
                </div>
              )}

              {paso === 2 && (
                <div className="space-y-3">
                  <CuotasEditor
                    filas={filas}
                    onChange={setFilas}
                    montoTotal={total}
                    moneda={moneda}
                    disabled={guardando}
                    ayuda="El contrato se regenera con las fechas y porcentajes guardados. La última cuota absorbe el redondeo."
                  />
                  <div className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Total con IGV</span>
                    <span className="font-semibold">{formatearMonto(total, moneda, { decimales: 2 })}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="shrink-0 gap-2 border-t border-border pt-3">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={guardando}>
              Cancelar
            </Button>
            {paso > 0 && (
              <Button variant="outline" size="sm" onClick={() => setPaso((actual) => Math.max(0, actual - 1))} disabled={guardando}>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Atrás
              </Button>
            )}
            {paso < 2 ? (
              <Button
                size="sm"
                onClick={() => setPaso((actual) => Math.min(2, actual + 1))}
                disabled={cargando || guardando || (paso === 1 && !descuentoValido)}
              >
                Siguiente <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => { void guardar(); }} disabled={!puedeGuardar}>
                {guardando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Guardar y regenerar contrato
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  );
}
