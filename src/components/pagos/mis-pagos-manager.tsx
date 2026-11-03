"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  Badge, Button, Card, CardContent, Dialog, DialogContent, DialogFooter,
  DialogHeader, DialogTitle, Input, Skeleton, Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow, Tooltip, TooltipContent, TooltipTrigger,
} from "@nrivera-iimp/ui-kit-iimp";
import { AlertTriangle, CreditCard, Eye, FileDown, FileText, Files, LayoutGrid, Pencil, Plus, RefreshCw, Rows3, Trash2, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { pagosService, type CuotaPagoDTO, type PagoRowDTO } from "@/lib/client/api/services/pagos-service";
import { Pagination } from "@/components/shared/pagination";
import { ArchivosCuentaCorriente } from "@/components/pagos/archivos-cuenta-corriente";
import { EnviarReservaIimp } from "@/components/pagos/enviar-reserva-iimp";
import { useSesion } from "@/hooks/use-sesion";
import { useVistaBandeja } from "@/hooks/use-vista-bandeja";
import { useConfirm } from "@/hooks/use-confirm";
import { BADGE_STYLES, DIAS_ANTICIPACION_CUOTA, ESTADO_CUOTA_LABELS, ESTADOS_CUOTA, ESTADOS_FACTURACION, PERMISSIONS, TIPOS_ARCHIVO_IIMP, VISTAS_BANDEJA, type TipoArchivoIImp } from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { numberUtils } from "@/lib/shared/utils/number";

const ESTADO_FACTURACION_LABELS: Record<string, string> = {
  [ESTADOS_FACTURACION.PENDIENTE]: "Pendiente",
  [ESTADOS_FACTURACION.PAGADO]: "Pagado",
  [ESTADOS_FACTURACION.ARCHIVADO]: "Archivado",
  [ESTADOS_FACTURACION.CANCELADO]: "Cancelado",
};

/**
 * Tipos de documento del panel "Documentos para tu factura" segun los requisitos
 * declarados por el cliente: OC/HES/valorizacion solo si los marco; con "ninguna
 * de las anteriores" solo quedan las constancias de pago. Sin declaracion, todos.
 */
function tiposDocumentosPorRequisitos(requisitos: PagoRowDTO["requisitos"]): TipoArchivoIImp[] {
  const pagos: TipoArchivoIImp[] = [TIPOS_ARCHIVO_IIMP.DETRACCION, TIPOS_ARCHIVO_IIMP.DIFERENCIA, TIPOS_ARCHIVO_IIMP.PAGO_TOTAL];
  if (!requisitos) {
    return [TIPOS_ARCHIVO_IIMP.OC, TIPOS_ARCHIVO_IIMP.HES, TIPOS_ARCHIVO_IIMP.VALORIZACION_COTIZACION, ...pagos];
  }
  if (requisitos.ninguna) return pagos;
  const tipos: TipoArchivoIImp[] = [];
  if (requisitos.oc) tipos.push(TIPOS_ARCHIVO_IIMP.OC);
  if (requisitos.hes) tipos.push(TIPOS_ARCHIVO_IIMP.HES);
  if (requisitos.valorizacion) tipos.push(TIPOS_ARCHIVO_IIMP.VALORIZACION_COTIZACION);
  return [...tipos, ...pagos];
}

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
export function MisPagosManager({ empresaVerComoId }: { empresaVerComoId?: string }) {
  const { session } = useSesion();
  const soloLectura = Boolean(empresaVerComoId);
  const { vista, setVista } = useVistaBandeja("mis-pagos");
  const { confirm, confirmDialog } = useConfirm();
  const [rows, setRows] = useState<PagoRowDTO[]>([]);
  const [loading, setLoading] = useState(true);
  /** Giro minimo del icono de actualizar para que la animacion sea visible. */
  const [refrescando, setRefrescando] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 10;

  const [dialog, setDialog] = useState<DialogCuota | null>(null);
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState("");
  const [guardando, setGuardando] = useState(false);

  /* "Registrar reserva": dialogo con documentos por categoria antes de enviar al IIMP. */
  const [reservaCuota, setReservaCuota] = useState<{ cuotaId: string; cuotas: number; standCode: string } | null>(null);
  /* Documentos de la cuenta corriente del IIMP (OC/HES/detraccion/diferencia) de la reserva. */
  const [archivosCuota, setArchivosCuota] = useState<{ cuotaId: string; cuotas: number; standCode: string; numero: number; tiposPermitidos: TipoArchivoIImp[] } | null>(null);

  const puedeGestionar = !soloLectura && Boolean(
    session?.permissions?.includes(PERMISSIONS.PAGOS_MANAGE) ||
    session?.permissions?.includes(PERMISSIONS.ADMIN_FULL),
  );

  const load = useCallback(async (p: number, pp: number) => {
    setLoading(true);
    try {
      const res = await pagosService.listar({ page: p, per_page: pp, empresaId: empresaVerComoId });
      setRows(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch {
      setRows([]);
      setTotal(0);
    }
    setLoading(false);
  }, [empresaVerComoId]);

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

  /** "Registrar reserva": dialogo con documentos por categoria y envio al IIMP (ver EnviarReservaIimp). */

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const renderCuotas = (row: PagoRowDTO) => {
    const restante = restanteDe(row);
    /* Cuota donde se sugiere registrar la reserva cuando la solicitud aun no se envio. */
    const cuotaSugerida = row.cuotas.find((c) => c.estado !== ESTADOS_CUOTA.PAGADO) ?? row.cuotas[0];
    /* Seguimiento: siguiente cuota pendiente. Antes de emitirse la factura se cuenta
       contra su fecha programada; si la factura ya se emitio, se avisa el pago. */
    const cuotaPendiente = row.cuotas.find((c) => c.estado !== ESTADOS_CUOTA.PAGADO) ?? null;
    const fechaEmisionReal = cuotaPendiente
      ? (cuotaPendiente.documentoSieFechaEmision ?? cuotaPendiente.iimpDocumento?.fechaEmision ?? null)
      : null;
    const facturaEmitida = Boolean(fechaEmisionReal);
    const diasParaPendiente = facturaEmitida || !cuotaPendiente
      ? null
      : dateUtils.diffInDays(dateUtils.todayLimaInputValue(), cuotaPendiente.fechaVencimiento);
    const cuotaSeguimiento = row.iimpContrato && cuotaPendiente && (facturaEmitida || (diasParaPendiente !== null && diasParaPendiente <= DIAS_ANTICIPACION_CUOTA))
      ? cuotaPendiente
      : null;
    return (
    <div className="space-y-2">
      {!row.iimpContrato && !soloLectura && row.cuotas.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[11px]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <span className="text-foreground">
            <strong>Solicitud de factura pendiente:</strong> aún no enviaste tu solicitud de factura.
            {cuotaSugerida ? ` Usa el ícono de solicitud de la cuota ${cuotaSugerida.numero}.` : ""}
          </span>
        </div>
      )}
      {row.cuotas.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin cuotas configuradas.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {row.cuotas.map((cuota) => (
            <div
              key={cuota.id}
              className={`flex flex-wrap items-center gap-3 px-3 py-2 text-xs ${
                !row.iimpContrato && cuotaSugerida?.id === cuota.id ? "bg-warning/5 ring-1 ring-inset ring-warning/40" : ""
              } ${cuotaSeguimiento?.id === cuota.id ? "bg-info/5 ring-1 ring-inset ring-info/40" : ""}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-foreground">
                {cuota.numero}
              </span>
              <span className="font-semibold text-foreground">{numberUtils.monto(cuota.monto, row.moneda)}</span>
              <span className="text-muted-foreground">
                Fecha de emisión: {dateUtils.format(cuota.documentoSieFechaEmision ?? cuota.iimpDocumento?.fechaEmision ?? cuota.fechaVencimiento)}
              </span>
              <Badge className={`pointer-events-none ${claseBadge(cuota.estado)}`}>
                <span>{ESTADO_CUOTA_LABELS[cuota.estado] ?? cuota.estado}</span>
              </Badge>
              {!row.iimpContrato && cuotaSugerida?.id === cuota.id && (
                <span className="text-[10px] font-semibold text-warning">Solicitar factura aquí</span>
              )}
              {cuotaSeguimiento?.id === cuota.id && (
                <span className="text-[10px] font-semibold text-info">
                  {facturaEmitida
                    ? "Factura emitida · pendiente de pago"
                    : `Siguiente cuota${
                        diasParaPendiente !== null
                          ? diasParaPendiente < 0
                            ? " · fecha de emisión pasada"
                            : diasParaPendiente === 0
                              ? " · se emite hoy"
                              : ` · se emite en ${diasParaPendiente} día${diasParaPendiente === 1 ? "" : "s"}`
                          : ""
                      }`}
                </span>
              )}
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
                {(cuota.comprobanteFiscal || cuota.iimpDocumento) && !cuota.documentoSieAnulado ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                        <a
                          href={`/api/pagos/factura?cuotaId=${cuota.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <span>
                        {cuota.comprobanteFiscal
                          ? `Descargar factura (${cuota.comprobanteFiscal.tipo} ${cuota.comprobanteFiscal.numero})`
                          : `Descargar factura IIMP ${cuota.iimpDocumento?.serie}-${cuota.iimpDocumento?.numero}`}
                      </span>
                    </TooltipContent>
                  </Tooltip>
                ) : row.iimpContrato ? (
                  cuota.estado === ESTADOS_CUOTA.PAGADO ? null : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        disabled={soloLectura}
                        onClick={() => setArchivosCuota({ cuotaId: cuota.id, cuotas: row.cuotas.length, standCode: row.standCode, numero: cuota.numero, tiposPermitidos: tiposDocumentosPorRequisitos(row.requisitos) })}
                      >
                        <Files className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <span>{soloLectura ? "Solo lectura: Documentos para tu factura (OC, HES y pagos)" : "Documentos para tu factura (OC, HES y pagos)"}</span>
                    </TooltipContent>
                  </Tooltip>
                  )
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        disabled={soloLectura}
                        onClick={() => setReservaCuota({ cuotaId: cuota.id, cuotas: row.cuotas.length, standCode: row.standCode })}
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <span>{soloLectura ? "Solo lectura: Solicitar factura" : "Solicitar factura"}</span>
                    </TooltipContent>
                  </Tooltip>
                )}
                {cuota.documentoSie && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                        <a href={`/api/pagos/factura?cuotaId=${encodeURIComponent(cuota.id)}&inline=1`} target="_blank" rel="noreferrer" title="Ver factura">
                          <FileDown className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <span>Ver factura del IIMP: {cuota.documentoSie}{cuota.estado === ESTADOS_CUOTA.PAGADO ? " (pagado)" : " (pendiente de pago)"} — abre en otra pestaña</span>
                    </TooltipContent>
                  </Tooltip>
                )}
                {cuota.documentoSieAnulado && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.DESTRUCTIVE}`}>
                          <XCircle className="mr-0.5 h-2.5 w-2.5" />
                          <span>Factura anulada por el IIMP</span>
                        </Badge>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <span>{cuota.documentoSieJustificacion ? `Motivo de la anulación: ${cuota.documentoSieJustificacion}` : "Anulada o rechazada por el IIMP"}</span>
                    </TooltipContent>
                  </Tooltip>
                )}
                {cuota.comprobante && cuota.estado !== ESTADOS_CUOTA.PAGADO && (
                  <span className="text-[10px] text-muted-foreground">Pendiente de confirmacion</span>
                )}
                {puedeGestionar && cuota.estado !== ESTADOS_CUOTA.PAGADO && (
                  <span className="flex items-center gap-0.5">
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
            Las cuotas las definió el cliente en el contrato; no son editables.{" "}
            {soloLectura ? "Vista de solo lectura." : "Usa el ícono de documentos para adjuntar las constancias de pago (pago total, detracción o diferencia)."}
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
          {soloLectura && (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-info">
              <Eye className="h-3.5 w-3.5" />
              <span>Vista de solo lectura</span>
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {soloLectura
              ? "Esta empresa aun no tiene planes de pago."
              : "Aun no tienes planes de pago. Se generan cuando la administracion aprueba tu solicitud."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {soloLectura && (
        <p className="flex items-start gap-2 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-[11px] text-info">
          <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Vista de solo lectura: los botones del cliente se muestran deshabilitados. Puedes abrir enlaces de facturas y vouchers.</span>
        </p>
      )}
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => {
            setRefrescando(true);
            const inicio = Date.now();
            void load(page, perPage).finally(() => {
              const espera = Math.max(0, 600 - (Date.now() - inicio));
              setTimeout(() => setRefrescando(false), espera);
            });
          }}
          disabled={loading || refrescando}
          title="Actualizar documentos"
        >
          <RefreshCw className={`h-4 w-4 transition-transform ${refrescando ? "animate-spin" : ""}`} />
        </Button>
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
                  {row.iimpContrato && (
                    <p className="text-[11px] text-muted-foreground">
                      Contrato IIMP: <span className="font-mono">{row.iimpContrato}</span>
                    </p>
                  )}
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

      {confirmDialog}

      {!soloLectura && (
        <>
          <EnviarReservaIimp
            open={reservaCuota !== null}
            onOpenChange={(v) => { if (!v) setReservaCuota(null); }}
            cuotaId={reservaCuota?.cuotaId ?? ""}
            cuotas={reservaCuota?.cuotas ?? 0}
            standCode={reservaCuota?.standCode}
            onEnviado={() => { void load(page, perPage); }}
          />

          <ArchivosCuentaCorriente
            open={archivosCuota !== null}
            onOpenChange={(v) => { if (!v) setArchivosCuota(null); }}
            cuotaId={archivosCuota?.cuotaId ?? ""}
            cuotas={archivosCuota?.cuotas ?? 0}
            standCode={archivosCuota?.standCode}
            cuotaNumero={archivosCuota?.numero}
            tiposPermitidos={archivosCuota?.tiposPermitidos}
          />
        </>
      )}

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
              <p className="text-xs font-semibold text-muted-foreground">Fecha de emisión (opcional)</p>
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
