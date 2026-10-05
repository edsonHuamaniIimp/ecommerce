"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  Badge, Button, Card, CardContent, Dialog, DialogContent, DialogFooter,
  DialogHeader, DialogTitle, Input, Skeleton, Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow, Tooltip, TooltipContent, TooltipTrigger,
} from "@nrivera-iimp/ui-kit-iimp";
import { CreditCard, Eye, FileDown, FileText, LayoutGrid, Paperclip, Pencil, Plus, Receipt, Rows3, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { pagosService, type CuotaPagoDTO, type PagoRowDTO } from "@/lib/client/api/services/pagos-service";
import { uploadService } from "@/lib/client/api/services/upload-service";
import { Pagination } from "@/components/shared/pagination";
import { useSesion } from "@/hooks/use-sesion";
import { useVistaBandeja } from "@/hooks/use-vista-bandeja";
import { useConfirm } from "@/hooks/use-confirm";
import { BADGE_STYLES, ESTADOS_CUOTA, ESTADOS_FACTURACION, PERMISSIONS, VISTAS_BANDEJA } from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { numberUtils } from "@/lib/shared/utils/number";

const ESTADO_FACTURACION_LABELS: Record<string, string> = {
  [ESTADOS_FACTURACION.PENDIENTE]: "Pendiente",
  [ESTADOS_FACTURACION.PAGADO]: "Pagado",
  [ESTADOS_FACTURACION.ARCHIVADO]: "Archivado",
  [ESTADOS_FACTURACION.CANCELADO]: "Cancelado",
};

const ESTADO_CUOTA_LABELS: Record<string, string> = {
  [ESTADOS_CUOTA.PENDIENTE]: "Pendiente",
  [ESTADOS_CUOTA.PAGADO]: "Pagado",
  [ESTADOS_CUOTA.VENCIDO]: "Vencido",
};

function claseBadge(estado: string): string {
  if (estado === ESTADOS_FACTURACION.PAGADO || estado === ESTADOS_CUOTA.PAGADO) return BADGE_STYLES.SUCCESS;
  if (estado === ESTADOS_FACTURACION.CANCELADO || estado === ESTADOS_CUOTA.VENCIDO) return BADGE_STYLES.DESTRUCTIVE;
  if (estado === ESTADOS_FACTURACION.ARCHIVADO) return BADGE_STYLES.INFO;
  return BADGE_STYLES.WARNING;
}

interface DialogCuota {
  modo: "crear" | "editar";
  facturacionId?: string;
  cuotaId?: string;
  numero?: number;
}

/** Bandeja de pagos del exhibidor, con vista en cuadricula/lista persistida. */
export function MisPagosManager() {
  const { session } = useSesion();
  const { vista, setVista } = useVistaBandeja("mis-pagos");
  const { confirm, confirmDialog } = useConfirm();
  const [rows, setRows] = useState<PagoRowDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 10;

  const [dialog, setDialog] = useState<DialogCuota | null>(null);
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Voucher: se elige la cuota destino y se abre el selector de archivo.
  const inputVoucherRef = useRef<HTMLInputElement>(null);
  const [cuotaVoucher, setCuotaVoucher] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const puedeGestionar = Boolean(
    session?.permissions?.includes(PERMISSIONS.PAGOS_MANAGE) ||
    session?.permissions?.includes(PERMISSIONS.ADMIN_FULL),
  );

  const load = useCallback(async (p: number, pp: number) => {
    setLoading(true);
    try {
      const res = await pagosService.listar({ page: p, per_page: pp });
      setRows(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch {
      setRows([]);
      setTotal(0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => { await load(page, perPage); })();
  }, [load, page]);

  const sumaCuotas = (row: PagoRowDTO) => row.cuotas.reduce((total, c) => total + c.monto, 0);
  const restanteDe = (row: PagoRowDTO) => Math.max(0, row.montoTotal - sumaCuotas(row));

  const abrirCrear = (row: PagoRowDTO) => {
    const restante = restanteDe(row);
    setMonto(restante > 0 ? String(Number(restante.toFixed(2))) : "");
    setFecha("");
    setDialog({ modo: "crear", facturacionId: row.id });
  };

  const abrirEditar = (cuota: CuotaPagoDTO) => {
    setMonto(String(cuota.monto));
    setFecha(cuota.fechaVencimiento ? cuota.fechaVencimiento.slice(0, 10) : "");
    setDialog({ modo: "editar", cuotaId: cuota.id, numero: cuota.numero });
  };

  const guardarCuota = async () => {
    if (!dialog) return;
    const valor = Number(monto);
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error("Ingresa un monto mayor a 0");
      return;
    }
    // No permitir que la suma de cuotas supere el monto total.
    const objetivo = dialog.facturacionId
      ? rows.find((r) => r.id === dialog.facturacionId)
      : rows.find((r) => r.cuotas.some((c) => c.id === dialog.cuotaId));
    if (objetivo) {
      const otros = objetivo.cuotas.reduce((s, c) => s + (c.id === dialog.cuotaId ? 0 : c.monto), 0);
      const maximo = objetivo.montoTotal - otros;
      if (valor > maximo + 0.001) {
        toast.error(`La suma de las cuotas supera el total. Maximo permitido: ${numberUtils.monto(Number(maximo.toFixed(2)), objetivo.moneda)}`);
        return;
      }
    }
    setGuardando(true);
    try {
      const fechaVencimiento = fecha ? new Date(`${fecha}T00:00:00`).toISOString() : null;
      if (dialog.modo === "crear" && dialog.facturacionId) {
        await pagosService.agregarCuota({ facturacionId: dialog.facturacionId, monto: valor, fechaVencimiento });
        toast.success("Cuota agregada");
      } else if (dialog.cuotaId) {
        await pagosService.actualizarCuota({ cuotaId: dialog.cuotaId, monto: valor, fechaVencimiento });
        toast.success("Cuota actualizada");
      }
      setDialog(null);
      await load(page, perPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar la cuota");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarCuota = async (cuota: CuotaPagoDTO) => {
    const ok = await confirm({
      title: "Eliminar cuota",
      description: `¿Eliminar la cuota #${cuota.numero}? Las cuotas restantes se renumeraran.`,
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    try {
      await pagosService.eliminarCuota(cuota.id);
      toast.success("Cuota eliminada");
      await load(page, perPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar la cuota");
    }
  };

  const elegirVoucher = (cuotaId: string) => {
    setCuotaVoucher(cuotaId);
    inputVoucherRef.current?.click();
  };

  const onVoucherFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !cuotaVoucher) return;
    setSubiendo(true);
    try {
      const url = await uploadService.subir(file);
      await pagosService.adjuntarVoucher({ cuotaId: cuotaVoucher, comprobante: url });
      toast.success("Voucher adjuntado");
      await load(page, perPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al adjuntar el voucher");
    } finally {
      setSubiendo(false);
      setCuotaVoucher(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const renderCuotas = (row: PagoRowDTO) => {
    const restante = restanteDe(row);
    return (
    <div className="space-y-2">
      {row.cuotas.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin cuotas configuradas.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {row.cuotas.map((cuota) => (
            <div key={cuota.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-xs">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-foreground">
                {cuota.numero}
              </span>
              <span className="font-semibold text-foreground">{numberUtils.monto(cuota.monto, row.moneda)}</span>
              <span className="text-muted-foreground">Vence: {dateUtils.format(cuota.fechaVencimiento)}</span>
              <Badge className={`pointer-events-none ${claseBadge(cuota.estado)}`}>
                <span>{ESTADO_CUOTA_LABELS[cuota.estado] ?? cuota.estado}</span>
              </Badge>
              <span className="ml-auto flex shrink-0 items-center gap-1.5">
                {cuota.comprobante && (
                  <a
                    href={cuota.comprobante}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                    title="Ver voucher adjunto"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Voucher</span>
                  </a>
                )}
                {cuota.comprobanteFiscal && (
                  <a
                    href={cuota.comprobanteFiscal.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                    title={`Comprobante fiscal: ${cuota.comprobanteFiscal.tipo} ${cuota.comprobanteFiscal.numero}`}
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    <span>Comprobante</span>
                  </a>
                )}
                {!cuota.comprobanteFiscal && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled>
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><span>Solicitar factura (integracion de facturacion pendiente)</span></TooltipContent>
                  </Tooltip>
                )}
                {(cuota.comprobanteFiscal || cuota.estado === ESTADOS_CUOTA.PAGADO) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {cuota.comprobanteFiscal ? (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                          <a href={cuota.comprobanteFiscal.url} target="_blank" rel="noreferrer">
                            <FileDown className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled>
                          <FileDown className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <span>
                        {cuota.comprobanteFiscal
                          ? `Descargar factura (${cuota.comprobanteFiscal.tipo} ${cuota.comprobanteFiscal.numero})`
                          : "Factura aun no emitida"}
                      </span>
                    </TooltipContent>
                  </Tooltip>
                )}
                {cuota.comprobante && cuota.estado !== ESTADOS_CUOTA.PAGADO && (
                  <span className="text-[10px] text-muted-foreground">Pendiente de confirmacion</span>
                )}
                {puedeGestionar && cuota.estado !== ESTADOS_CUOTA.PAGADO && (
                  <span className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => elegirVoucher(cuota.id)}
                      disabled={subiendo && cuotaVoucher === cuota.id}
                      title={cuota.comprobante ? "Reemplazar voucher" : "Adjuntar voucher"}
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                    </Button>
                    {/* Con voucher adjunto la cuota queda bloqueada. Con plan del contrato no es editable. */}
                    {!cuota.comprobante && !row.planCliente && (
                      <>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => abrirEditar(cuota)} title="Editar cuota">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => { void eliminarCuota(cuota); }} title="Eliminar cuota">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {puedeGestionar && row.estado !== ESTADOS_FACTURACION.PAGADO && !row.planCliente && (
        restante > 0 ? (
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => abrirCrear(row)}>
            <Plus className="h-3.5 w-3.5" />
            <span>Agregar cuota (resta {numberUtils.monto(Number(restante.toFixed(2)), row.moneda)})</span>
          </Button>
        ) : (
          <p className="text-[11px] font-medium text-success">
            <span>Plan completo: 100% del monto total distribuido en cuotas.</span>
          </p>
        )
      )}

      {row.planCliente && (
        <p className="text-[11px] text-muted-foreground">
          <span>
            Las cuotas las definió el cliente en el contrato; no son editables. Aquí solo puedes adjuntar el
            voucher de pago de cada cuota.
          </span>
        </p>
      )}
    </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <Wallet className="h-6 w-6" />
          </span>
          <p className="text-sm text-muted-foreground">
            Aun no tienes planes de pago. Se generan cuando la administracion aprueba tu solicitud.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          variant={vista === VISTAS_BANDEJA.GRID ? "default" : "outline"}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setVista(VISTAS_BANDEJA.GRID)}
          title="Vista en cuadricula"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={vista === VISTAS_BANDEJA.ROW ? "default" : "outline"}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setVista(VISTAS_BANDEJA.ROW)}
          title="Vista en lista"
        >
          <Rows3 className="h-4 w-4" />
        </Button>
      </div>

      {vista === VISTAS_BANDEJA.ROW ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><span>Stand</span></TableHead>
                  <TableHead className="hidden sm:table-cell"><span>Tipo</span></TableHead>
                  <TableHead className="text-right"><span>Monto</span></TableHead>
                  <TableHead><span>Estado</span></TableHead>
                  <TableHead className="text-right"><span>Cuotas</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <Fragment key={row.id}>
                    <TableRow>
                      <TableCell className="font-mono text-xs font-semibold">{row.standCode}</TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                        {row.tipo === "manual" ? "Manual" : "Pasarela"} · {row.modoPago === "completo" ? "Completo" : "Cuotas"}
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold">{numberUtils.monto(row.montoTotal, row.moneda)}</TableCell>
                      <TableCell>
                        <Badge className={`pointer-events-none ${claseBadge(row.estado)}`}>
                          <span>{ESTADO_FACTURACION_LABELS[row.estado] ?? row.estado}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{row.cuotas.length}</TableCell>
                    </TableRow>
                    <TableRow className="border-0 hover:bg-transparent">
                      <TableCell colSpan={5} className="pt-0">{renderCuotas(row)}</TableCell>
                    </TableRow>
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        rows.map((row) => (
          <Card key={row.id} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/40 px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CreditCard className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    <span>Stand </span><span className="font-mono">{row.standCode}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.tipo === "manual" ? "Pago manual" : "Pasarela"} · {row.modoPago === "cuotas" ? "En cuotas" : "Pago completo"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-foreground">{numberUtils.monto(row.montoTotal, row.moneda)}</span>
                <Badge className={`pointer-events-none ${claseBadge(row.estado)}`}>
                  <span>{ESTADO_FACTURACION_LABELS[row.estado] ?? row.estado}</span>
                </Badge>
              </div>
            </div>
            <CardContent className="p-4">{renderCuotas(row)}</CardContent>
          </Card>
        ))
      )}

      {totalPages > 1 && (
        <div className="flex justify-center pt-2">
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      <input
        ref={inputVoucherRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => { void onVoucherFile(e); }}
      />

      {confirmDialog}

      <Dialog open={dialog !== null} onOpenChange={(v) => { if (!v) setDialog(null); }}>
        <DialogContent className="rounded-xl border-border sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              <span>{dialog?.modo === "crear" ? "Agregar cuota" : `Editar cuota #${dialog?.numero ?? ""}`}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Monto</p>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Fecha de vencimiento (opcional)</p>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full" disabled={guardando} onClick={() => { void guardarCuota(); }}>
              <span>{guardando ? "Guardando..." : "Guardar"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
