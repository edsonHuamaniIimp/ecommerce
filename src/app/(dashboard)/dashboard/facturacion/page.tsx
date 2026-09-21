"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { CreditCard, Eye, Loader2, Check, Plus, Wallet, Pencil, Trash2, X, Upload, FileText, Archive } from "lucide-react";
import { toast } from "sonner";
import { internalApi } from "@/lib/client/api/services/internal-api";
import { authService } from "@/lib/client/api/services/auth-service";
import { dateUtils } from "@/lib/shared/utils/date";
import { BADGE_STYLES, ESTADOS_FACTURACION, ESTADOS_CUOTA, TIPOS_FACTURACION } from "@/lib/shared/constants";

interface CuotaItem {
  id: string;
  numero: number;
  monto: number;
  fechaVencimiento: string | null;
  estado: string;
  comprobante: string | null;
}

interface FacturacionItem {
  id: string;
  solicitudId: string;
  tipo: string;
  estado: string;
  montoTotal: number;
  moneda: string;
  modoPago: string;
  standCode: string;
  solicitudEstado: string;
  createdAt: string;
  cuotas: CuotaItem[];
}

const ITEMS_PER_PAGE = 10;

export default function FacturacionPage() {
  const [rows, setRows] = useState<FacturacionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<FacturacionItem | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payRow, setPayRow] = useState<FacturacionItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<FacturacionItem | null>(null);
  const [editTipo, setEditTipo] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [modoPago, setModoPago] = useState("cuotas");
  const [deleteCuotaId, setDeleteCuotaId] = useState<string | null>(null);
  const [payCuotaId, setPayCuotaId] = useState<string | null>(null);
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [uploadingComprobante, setUploadingComprobante] = useState(false);

  // Cuota form state
  const [newCuotaMonto, setNewCuotaMonto] = useState("");
  const [newCuotaVencimiento, setNewCuotaVencimiento] = useState("");
  const [addingCuota, setAddingCuota] = useState(false);
  const [eventoId, setEventoId] = useState<string | null>(null);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(p), per_page: String(ITEMS_PER_PAGE) });
      if (eventoId) qs.set("eventoId", eventoId);
      const data = await internalApi.get<{ data: FacturacionItem[]; total: number }>(`/api/facturacion/listar?${qs.toString()}`);
      setRows(data.data ?? []);
      setTotal(data.total ?? 0);
      setPage(p);
    } catch { }
    setLoading(false);
  }, [eventoId]);

  useEffect(() => {
    authService.getSession().then((s) => setEventoId(s.eventoId ?? null));
  }, []);

  useEffect(() => {
    if (eventoId === null) return;
    (async () => { await load(); })();
  }, [eventoId, load]);

  const handleOpenDetail = async (row: FacturacionItem) => {
    try {
      const data = await internalApi.get<FacturacionItem>(`/api/facturacion/detalle?id=${row.id}`);
      setDetailRow(data);
      setDetailOpen(true);
    } catch { toast.error("Error al cargar detalle"); }
  };

  const handleOpenPay = async (row: FacturacionItem) => {
    try {
      const data = await internalApi.get<FacturacionItem>(`/api/facturacion/detalle?id=${row.id}`);
      setPayRow(data);
      setModoPago(data.modoPago ?? "cuotas");
      setNewCuotaMonto("");
      setNewCuotaVencimiento("");
      setPayOpen(true);
    } catch { toast.error("Error al cargar detalle"); }
  };

  const handleAddCuota = async () => {
    if (!payRow || !newCuotaMonto) return;
    setAddingCuota(true);
    try {
      await internalApi.post(`/api/facturacion/agregar-cuota`, {
        facturacionId: payRow.id,
        monto: Number(newCuotaMonto),
        fechaVencimiento: newCuotaVencimiento || null,
      });
      toast.success("Cuota agregada");
      const updated = await internalApi.get<FacturacionItem>(`/api/facturacion/detalle?id=${payRow.id}`);
      setPayRow(updated);
      setNewCuotaMonto("");
      setNewCuotaVencimiento("");
    } catch { toast.error("Error"); }
    setAddingCuota(false);
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <main className="flex-1 py-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <span>Facturacion</span>
            <Badge variant="secondary" className="text-[10px] ml-2">{total} registros</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
          ) : rows.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">No hay registros de facturacion.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Stand</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="text-xs">Monto</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Tipo</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Fecha</TableHead>
                    <TableHead className="text-xs w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs font-mono font-medium">{row.standCode}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] pointer-events-none ${row.estado === ESTADOS_FACTURACION.PAGADO ? BADGE_STYLES.SUCCESS : row.estado === ESTADOS_FACTURACION.PENDIENTE ? BADGE_STYLES.WARNING : BADGE_STYLES.NEUTRAL}`}>
                          {row.estado === ESTADOS_FACTURACION.PAGADO ? "Pagado" : row.estado === ESTADOS_FACTURACION.PENDIENTE ? "Pendiente" : row.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium">{row.montoTotal.toFixed(2)} {row.moneda}</TableCell>
                      <TableCell className="text-xs hidden sm:table-cell">{row.tipo === TIPOS_FACTURACION.NIU_BIZZ ? "Niubizz" : "Manual"}</TableCell>
                      <TableCell className="text-xs text-slate-400 hidden md:table-cell">{dateUtils.formatDateTime(row.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleOpenDetail(row)} title="Ver detalle">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {row.estado === ESTADOS_FACTURACION.PAGADO && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-purple-500 hover:text-purple-600"
                              onClick={() => setArchiveId(row.id)} title="Archivar">
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {row.estado !== ESTADOS_FACTURACION.ARCHIVADO && (
                            <>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditRow(row); setEditTipo(row.tipo); setEditOpen(true); }} title="Configurar">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                                onClick={() => setDeleteId(row.id)} title="Eliminar">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {row.estado === ESTADOS_FACTURACION.PENDIENTE && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-500 hover:text-amber-600" onClick={() => handleOpenPay(row)} title="Pagar">
                              <Wallet className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">{total} resultados — pagina {page} de {totalPages}</span>
                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <Button key={p} size="sm" variant={p === page ? "default" : "outline"} className="h-7 w-7 p-0 text-xs rounded-full" onClick={() => load(p)}>
                        {p}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog — solo lectura */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col !px-0 !py-0 overflow-hidden">
          <div className="shrink-0 px-5 pt-4 pb-2 border-b border-slate-100 !pr-12">
            <h3 className="text-sm font-semibold text-slate-800">Detalle de facturacion</h3>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {detailRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-3 text-xs">
                <div><span className="text-muted-foreground">Stand:</span> <span className="font-mono font-medium">{detailRow.standCode}</span></div>
                <div><span className="text-muted-foreground">Estado:</span> <Badge className={`text-[10px] pointer-events-none ${detailRow.estado === ESTADOS_FACTURACION.PAGADO ? BADGE_STYLES.SUCCESS : detailRow.estado === ESTADOS_FACTURACION.PENDIENTE ? BADGE_STYLES.WARNING : BADGE_STYLES.INDIGO}`}>{detailRow.estado === ESTADOS_FACTURACION.PAGADO ? "Pagado" : detailRow.estado === ESTADOS_FACTURACION.PENDIENTE ? "Pendiente" : detailRow.estado === ESTADOS_FACTURACION.ARCHIVADO ? "Archivado" : detailRow.estado}</Badge></div>
                <div><span className="text-muted-foreground">Monto total:</span> <span className="font-medium">{detailRow.montoTotal.toFixed(2)} {detailRow.moneda}</span></div>
                <div><span className="text-muted-foreground">Tipo:</span> <span>{detailRow.tipo === TIPOS_FACTURACION.NIU_BIZZ ? "Niubizz" : "Manual"}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Modo:</span> <span>{detailRow.modoPago === "completo" ? "Pago completo" : "Pago por cuotas"}</span></div>
              </div>
              {detailRow.cuotas.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">Cuotas ({detailRow.cuotas.length}) — Total: {detailRow.cuotas.reduce((s,c) => s + c.monto, 0).toFixed(2)} {detailRow.moneda}</p>
                  <div className="space-y-1">
                    {detailRow.cuotas.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs">
                        <span className="font-mono font-medium text-slate-600">#{c.numero}</span>
                        <span className="flex-1">{c.monto.toFixed(2)} {detailRow.moneda}</span>
                        {c.fechaVencimiento && <span className="text-[10px] text-slate-400">{dateUtils.formatDateTime(c.fechaVencimiento)}</span>}
                        <Badge className={`text-[9px] pointer-events-none ${c.estado === ESTADOS_CUOTA.PAGADO ? BADGE_STYLES.SUCCESS : BADGE_STYLES.WARNING}`}>
                          {c.estado === ESTADOS_CUOTA.PAGADO ? "Pagado" : "Pendiente"}
                        </Badge>
                        {c.comprobante && (
                          <a href={c.comprobante} target="_blank" className="text-slate-400 hover:text-slate-600" title="Ver comprobante">
                            <FileText className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
          <div className="shrink-0 border-t border-slate-100 px-5 py-3 flex justify-end">
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => setDetailOpen(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pay dialog — editable cuotas */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col !px-0 !py-0 overflow-hidden">
          {/* Header */}
          <div className="shrink-0 px-5 pt-4 pb-2 border-b border-slate-100 !pr-12">
            <h3 className="text-sm font-semibold text-slate-800">Detalle de facturacion</h3>
          </div>
          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {payRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-3 text-xs">
                <div><span className="text-muted-foreground">Stand:</span> <span className="font-mono font-medium">{payRow.standCode}</span></div>
                <div><span className="text-muted-foreground">Estado:</span> <Badge className={`text-[10px] pointer-events-none ${payRow.estado === ESTADOS_FACTURACION.PAGADO ? BADGE_STYLES.SUCCESS : BADGE_STYLES.WARNING}`}>{payRow.estado === ESTADOS_FACTURACION.PAGADO ? "Pagado" : "Pendiente"}</Badge></div>
                <div><span className="text-muted-foreground">Monto total:</span> <span className="font-medium">{payRow.montoTotal.toFixed(2)} {payRow.moneda}</span></div>
                <div><span className="text-muted-foreground">Tipo:</span> <span>{payRow.tipo === TIPOS_FACTURACION.NIU_BIZZ ? "Niubizz" : "Manual"}</span></div>
              </div>

              {/* Modo de pago selector */}
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">Modo de pago</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input type="radio" name="modoPagoDetail" checked={modoPago === "completo"}
                      onChange={async () => {
                        setModoPago("completo");
                        try { await internalApi.patch("/api/facturacion/actualizar", { id: payRow.id, modoPago: "completo" }); }
                        catch { toast.error("Error"); }
                      }} className="text-emerald-600" />
                    Pago completo
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input type="radio" name="modoPagoDetail" checked={modoPago !== "completo"}
                      onChange={async () => {
                        setModoPago("cuotas");
                        try { await internalApi.patch("/api/facturacion/actualizar", { id: payRow.id, modoPago: "cuotas" }); }
                        catch { toast.error("Error"); }
                      }} className="text-emerald-600" />
                    Pago por cuotas
                  </label>
                </div>
              </div>

              {/* Cuotas section — solo si modo cuotas */}
              {modoPago !== "completo" && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">
                  Cuotas ({payRow.cuotas.length})
                  {payRow.cuotas.length > 0 && (
                    <span className="font-normal text-slate-400 ml-1">
                      — Total: {payRow.cuotas.reduce((s, c) => s + c.monto, 0).toFixed(2)} / {payRow.montoTotal.toFixed(2)} {payRow.moneda}
                    </span>
                  )}
                </p>
                {payRow.cuotas.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center">
                    <p className="text-xs text-slate-400">Sin cuotas registradas</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Usa el formulario inferior para agregar cuotas.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {payRow.cuotas.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs">
                        <span className="font-mono font-medium text-slate-600">#{c.numero}</span>
                        <span className="flex-1">{c.monto.toFixed(2)} {payRow.moneda}</span>
                        {c.fechaVencimiento && <span className="text-[10px] text-slate-400">{dateUtils.formatDateTime(c.fechaVencimiento)}</span>}
                        <Badge className={`text-[9px] pointer-events-none ${c.estado === ESTADOS_CUOTA.PAGADO ? BADGE_STYLES.SUCCESS : BADGE_STYLES.WARNING}`}>
                          {c.estado === ESTADOS_CUOTA.PAGADO ? "Pagado" : "Pendiente"}
                        </Badge>
                        {c.estado === ESTADOS_CUOTA.PAGADO && c.comprobante && (
                          <a href={c.comprobante} target="_blank" className="text-slate-400 hover:text-slate-600" title="Ver comprobante">
                            <FileText className="h-3 w-3" />
                          </a>
                        )}
                        {c.estado === ESTADOS_CUOTA.PENDIENTE && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-emerald-600" onClick={() => { setPayCuotaId(c.id); setComprobanteFile(null); }}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                          onClick={() => setDeleteCuotaId(c.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}
            </div>
          )}
          </div>
          {/* Footer — solo si modo cuotas */}
          {payRow && modoPago !== "completo" && (
            (() => {
              const sumaCuotas = payRow.cuotas.reduce((s, c) => s + c.monto, 0);
              const pendiente = payRow.montoTotal - sumaCuotas;
              const excede = sumaCuotas >= payRow.montoTotal;
              const montoValido = newCuotaMonto && Number(newCuotaMonto) > 0;
              const fechaValida = !!newCuotaVencimiento;
              const hoy = dateUtils.todayInputValue();
              const fechaPasada = fechaValida && newCuotaVencimiento < hoy;
              const superaPendiente = montoValido && Number(newCuotaMonto) > pendiente;
              const valido = montoValido && fechaValida && !excede && !superaPendiente && !fechaPasada;

              return (
            <div className="shrink-0 border-t border-slate-100 px-5 py-3 space-y-2">
              <div className="flex gap-2">
                <Input className="text-xs flex-1" type="number" step="0.01" min="0.01"
                  placeholder={`Monto (max ${pendiente.toFixed(2)})`}
                  value={newCuotaMonto} onChange={(e) => setNewCuotaMonto(e.target.value)} />
                <Input className="text-xs w-36" type="date" value={newCuotaVencimiento}
                  min={hoy}
                  onChange={(e) => setNewCuotaVencimiento(e.target.value)} required />
                <Button size="sm" variant="outline" className="rounded-full shrink-0" onClick={handleAddCuota}
                  disabled={addingCuota || !valido}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {excede && <p className="text-[10px] text-red-500 text-center">Las cuotas ya cubren el monto total de {payRow.montoTotal.toFixed(2)}.</p>}
              {!excede && superaPendiente && <p className="text-[10px] text-red-500 text-center">El monto supera el pendiente ({pendiente.toFixed(2)}). Maximo: {pendiente.toFixed(2)}.</p>}
              {!excede && !superaPendiente && fechaPasada && <p className="text-[10px] text-red-500 text-center">La fecha de vencimiento no puede ser anterior a hoy.</p>}
              {!excede && !superaPendiente && !fechaPasada && !valido && <p className="text-[10px] text-amber-500 text-center">Ingresa monto y fecha para agregar.</p>}
              {!excede && !superaPendiente && valido && <p className="text-[10px] text-slate-400 text-center">Pendiente: {pendiente.toFixed(2)} {payRow.moneda} — quedara { (pendiente - Number(newCuotaMonto)).toFixed(2) } despues de agregar.</p>}
            </div>
            );
            })()
          )}
        </DialogContent>
      </Dialog>

      {/* Edit modal — configurar tipo de pago */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              <span>Configurar facturacion</span>
            </DialogTitle>
          </DialogHeader>
          {editRow && (
            <div className="space-y-4 text-sm">
              <div className="text-xs text-slate-500">
                <span className="font-mono font-medium text-slate-700">{editRow.standCode}</span>
                <span className="mx-2">·</span>
                <span>{editRow.montoTotal.toFixed(2)} {editRow.moneda}</span>
              </div>
              <div>
                <Label className="text-xs">Tipo de pago</Label>
                <Select value={editTipo} onValueChange={setEditTipo}>
                  <SelectTrigger className="text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TIPOS_FACTURACION.MANUAL}>Manual</SelectItem>
                    <SelectItem value={TIPOS_FACTURACION.NIU_BIZZ}>Niubizz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" className="rounded-full w-full" onClick={async () => {
                try {
                  await internalApi.patch(`/api/facturacion/actualizar`, { id: editRow.id, tipo: editTipo });
                  toast.success("Actualizado");
                  setEditOpen(false);
                  load(page);
                } catch { toast.error("Error al actualizar"); }
              }}>
                Guardar cambios
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle><span>Confirmar eliminacion</span></DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">El registro sera dado de baja. Esta accion no se puede deshacer.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" className="flex-1 rounded-full" onClick={async () => {
              if (!deleteId) return;
              try { await internalApi.delete(`/api/facturacion/eliminar?id=${deleteId}`); toast.success("Eliminado"); load(page); }
              catch { toast.error("Error"); }
              setDeleteId(null);
            }}>Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm delete cuota */}
      <Dialog open={!!deleteCuotaId} onOpenChange={() => setDeleteCuotaId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle><span>Eliminar cuota</span></DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">La cuota sera eliminada permanentemente. Esta accion no se puede deshacer.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={() => setDeleteCuotaId(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" className="flex-1 rounded-full" onClick={async () => {
              if (!deleteCuotaId) return;
              try { await internalApi.post("/api/facturacion/eliminar-cuota", { cuotaId: deleteCuotaId }); toast.success("Eliminada");
                if (payRow) { const d = await internalApi.get<FacturacionItem>(`/api/facturacion/detalle?id=${payRow.id}`); setPayRow(d); } }
              catch { toast.error("Error"); }
              setDeleteCuotaId(null);
            }}>Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pay cuota — upload comprobante */}
      <Dialog open={!!payCuotaId} onOpenChange={() => setPayCuotaId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle><span>Registrar pago de cuota</span></DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-xs text-slate-500">Adjunta el comprobante de pago (documento o imagen).</p>
            <label className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-4 transition-all ${
              comprobanteFile ? "border-emerald-300 bg-emerald-50/50" : "border-slate-300 bg-slate-50/50 hover:border-emerald-300"
            }`}>
              {comprobanteFile ? (
                <div className="flex items-center gap-2 text-xs text-emerald-700">
                  <Check className="h-4 w-4" />
                  <span className="truncate max-w-[180px]">{comprobanteFile.name}</span>
                </div>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-slate-400" />
                  <span className="text-xs font-medium text-slate-600">Subir comprobante</span>
                  <span className="text-[10px] text-slate-400">PDF, JPG, PNG, DOCX — max 10 MB</span>
                </>
              )}
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.docx"
                onChange={(e) => { const f = e.target.files?.[0] ?? null; setComprobanteFile(f); }} />
            </label>
            <Button size="sm" className="rounded-full w-full" disabled={!comprobanteFile || uploadingComprobante}
              onClick={async () => {
                if (!payCuotaId || !comprobanteFile) return;
                setUploadingComprobante(true);
                try {
                  const fd = new FormData(); fd.append("file", comprobanteFile);
                  const upRes = await fetch("/api/upload", { method: "POST", body: fd });
                  const upJson = await upRes.json() as { success?: boolean; data?: { url: string } };
                  if (!upJson.success || !upJson.data?.url) throw new Error("Error al subir");
                  await internalApi.post("/api/facturacion/pagar-cuota", { cuotaId: payCuotaId, comprobante: upJson.data.url });
                  toast.success("Cuota pagada");
                  setPayCuotaId(null);
                  if (payRow) { const d = await internalApi.get<FacturacionItem>(`/api/facturacion/detalle?id=${payRow.id}`); setPayRow(d); }
                  load(page);
                } catch { toast.error("Error"); }
                setUploadingComprobante(false);
              }}>
              {uploadingComprobante ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Confirmar pago
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm archive dialog */}
      <Dialog open={!!archiveId} onOpenChange={() => setArchiveId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle><span>Archivar facturacion</span></DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Una vez archivado, el registro quedara en modo solo lectura y no se podra volver atras.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={() => setArchiveId(null)}>Cancelar</Button>
            <Button variant="default" size="sm" className="flex-1 rounded-full bg-purple-600 hover:bg-purple-700"
              onClick={async () => {
                if (!archiveId) return;
                try { await internalApi.patch("/api/facturacion/actualizar", { id: archiveId, estado: ESTADOS_FACTURACION.ARCHIVADO }); toast.success("Archivado"); load(page); }
                catch { toast.error("Error"); }
                setArchiveId(null);
              }}>Archivar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
