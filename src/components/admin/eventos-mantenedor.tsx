"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Checkbox } from "@nrivera-iimp/ui-kit-iimp";
import { Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { eventosServiceClient } from "@/lib/api/services/eventos-service";
import { dateUtils } from "@/lib/utils/date";
import { listPlanos } from "@/lib/planos/registry";

interface EventoRow {
  id: string;
  tipoEvento: number;
  codigoEvento: number;
  anio: string;
  estado: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  flgActivo: boolean;
  flgVisible: boolean;
  plano: string;
  eventoPadre: { id: string; nombre: string };
  _count: { stands: number; gessStands: number; reservas: number };
}

export function EventosMantenedor() {
  const [rows, setRows] = useState<EventoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [padres] = useState([{ id: "ep-perumin", nombre: "PERUMIN" }, { id: "ep-proexplo", nombre: "ProExplo" }, { id: "ep-wmc", nombre: "WMC" }, { id: "ep-gess", nombre: "GESS" }]);

  /* nuevo */
  const [newDialog, setNewDialog] = useState(false);
  const [newPadreId, setNewPadreId] = useState("");
  const [newAnio, setNewAnio] = useState("");
  const [newInicio, setNewInicio] = useState("");
  const [newFin, setNewFin] = useState("");

  /* editar */
  const [editDialog, setEditDialog] = useState(false);
  const [editId, setEditId] = useState("");
  const [editInicio, setEditInicio] = useState("");
  const [editFin, setEditFin] = useState("");
  const [editFlgVisible, setEditFlgVisible] = useState(false);
  const [editPlano, setEditPlano] = useState("gess");

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [ev] = await Promise.all([eventosServiceClient.listar()]);
      setRows(Array.isArray(ev) ? ev as unknown as EventoRow[] : []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newPadreId || !newAnio) return;
    try {
      await eventosServiceClient.crear({ evento_padre_id: newPadreId, anio: newAnio, fecha_inicio: newInicio || undefined, fecha_fin: newFin || undefined });
      await load();
      setNewDialog(false);
      setNewAnio(""); setNewInicio(""); setNewFin("");
    } catch { /* ignore */ }
  };

  const handleToggleVisible = async (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    try {
      await eventosServiceClient.actualizar({ id, flg_visible: !row.flgVisible });
      await load();
    } catch { /* ignore */ }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await eventosServiceClient.actualizar({ id: deleteId, flg_activo: false });
      await load();
    } catch { /* ignore */ }
    setDeleteId(null);
  };

  const openEdit = (row: EventoRow) => {
    setEditId(row.id);
    setEditInicio(dateUtils.toInputValue(row.fechaInicio));
    setEditFin(dateUtils.toInputValue(row.fechaFin));
    setEditFlgVisible(Boolean(row.flgVisible));
    setEditPlano(row.plano ?? "gess");
    setEditDialog(true);
  };

  const handleEdit = async () => {
    if (!editId) return;
    try {
      await eventosServiceClient.actualizar({
        id: editId,
        fecha_inicio: editInicio || null,
        fecha_fin: editFin || null,
        flg_visible: editFlgVisible,
        plano: editPlano,
      });
      await load();
    } catch {
      // ignore
    }
    setEditDialog(false);
  };

  const grouped = rows.reduce<Record<string, EventoRow[]>>((acc, row) => {
    const key = row.eventoPadre.nombre;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button onClick={() => setNewDialog(true)}><span>Nueva version</span></Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
      ) : (
        Object.entries(grouped).map(([nombre, eventos]) => (
          <Card key={nombre}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base"><span>{nombre}</span></CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><span>Version</span></TableHead>
                    <TableHead><span>Fechas</span></TableHead>
                    <TableHead className="w-20"><span>Visible</span></TableHead>
                    <TableHead className="w-28 text-right"><span>Accion</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventos.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell className="font-mono text-xs font-medium">{ev.anio}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {dateUtils.format(ev.fechaInicio)} — {dateUtils.format(ev.fechaFin)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ev.flgVisible ? "default" : "secondary"}>
                          <span>{ev.flgVisible ? "Si" : "No"}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(ev)} title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleToggleVisible(ev.id)} title={ev.flgVisible ? "Ocultar de presala" : "Mostrar en presala"}>
                            {ev.flgVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDeleteId(ev.id)} title="Eliminar">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
      <Dialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle><span>Confirmar eliminacion</span></DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">La version se ocultara de la presala. Esta accion es reversible desde el icono de visibilidad.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}><span>Cancelar</span></Button>
            <Button variant="destructive" onClick={handleDelete}><span>Eliminar</span></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={newDialog} onOpenChange={setNewDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle><span>Nueva version</span></DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label><span>Evento padre</span></Label>
              <Select value={newPadreId} onValueChange={setNewPadreId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {padres.map((p) => (<SelectItem key={p.id} value={p.id}><span>{p.nombre}</span></SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label><span>Anio</span></Label>
              <Input value={newAnio} onChange={(e) => setNewAnio(e.target.value)} placeholder="2027" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <Label><span>Inicio</span></Label>
                <Input type="date" value={newInicio} onChange={(e) => setNewInicio(e.target.value)} />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label><span>Fin</span></Label>
                <Input type="date" value={newFin} onChange={(e) => setNewFin(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} className="w-full"><span>Crear version</span></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle><span>Editar version</span></DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <Label><span>Fecha inicio</span></Label>
                <Input type="date" value={editInicio} onChange={(e) => setEditInicio(e.target.value)} />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label><span>Fecha fin</span></Label>
                <Input type="date" value={editFin} onChange={(e) => setEditFin(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label><span>Plano 3D</span></Label>
              <Select value={editPlano} onValueChange={setEditPlano}>
                <SelectTrigger><SelectValue><span>{editPlano ? listPlanos().find(p => p.id === editPlano)?.nombre ?? editPlano : "Sin asignar"}</span></SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value=""><span>— Sin asignar —</span></SelectItem>
                  {listPlanos().map((p) => (
                    <SelectItem key={p.id} value={p.id}><span>{p.nombre}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={editFlgVisible} onCheckedChange={(v) => setEditFlgVisible(v === true)} />
              <span>Visible en presala</span>
            </label>
          </div>
          <DialogFooter>
            <Button onClick={handleEdit} className="w-full"><span>Guardar cambios</span></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
