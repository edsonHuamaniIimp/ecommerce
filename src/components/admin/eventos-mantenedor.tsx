"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Checkbox } from "@nrivera-iimp/ui-kit-iimp";
import { Pencil, Power, PowerOff } from "lucide-react";
import { eventosServiceClient } from "@/lib/api/services/eventos-service";

interface EventoRow {
  id: string;
  tipoEvento: number;
  codigoEvento: number;
  anio: string;
  estado: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  flgActivo: boolean;
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
  const [editFlgActivo, setEditFlgActivo] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [ev] = await Promise.all([eventosServiceClient.list()]);
      setRows(Array.isArray(ev) ? ev as unknown as EventoRow[] : []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newPadreId || !newAnio) return;
    try {
      await eventosServiceClient.create({ evento_padre_id: newPadreId, anio: newAnio, fecha_inicio: newInicio || undefined, fecha_fin: newFin || undefined });
      await load();
      setNewDialog(false);
      setNewAnio(""); setNewInicio(""); setNewFin("");
    } catch { /* ignore */ }
  };

  const handleToggle = async (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const nextEstado = row.estado === "active" ? "closed" : "active";
    try {
      await eventosServiceClient.patch(id, { estado: nextEstado });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, estado: nextEstado } : r)));
    } catch { /* ignore */ }
  };

  const openEdit = (row: EventoRow) => {
    setEditId(row.id);
    setEditInicio(row.fechaInicio ? row.fechaInicio.slice(0, 10) : "");
    setEditFin(row.fechaFin ? row.fechaFin.slice(0, 10) : "");
    setEditFlgActivo(row.flgActivo === true);
    setEditDialog(true);
  };

  const handleEdit = async () => {
    if (!editId) return;
    try {
      await eventosServiceClient.patch(editId, {
        fechaInicio: editInicio || null,
        fechaFin: editFin || null,
        flgActivo: editFlgActivo,
      });
      setRows((prev) => prev.map((r) => (r.id === editId ? { ...r, fechaInicio: editInicio || null, fechaFin: editFin || null, flgActivo: editFlgActivo } : r)));
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
                    <TableHead className="w-20"><span>Activo</span></TableHead>
                    <TableHead className="w-28 text-right"><span>Accion</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventos.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell className="font-mono text-xs font-medium">{ev.anio}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ev.fechaInicio ? new Date(ev.fechaInicio + "T00:00:00").toLocaleDateString("es-PE") : "—"} —{" "}
                        {ev.fechaFin ? new Date(ev.fechaFin + "T00:00:00").toLocaleDateString("es-PE") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ev.estado === "active" && ev.flgActivo ? "default" : "secondary"}>
                          <span>{ev.estado === "active" && ev.flgActivo ? "Si" : "No"}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(ev)} title="Editar fechas">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleToggle(ev.id)} title={ev.estado === "active" ? "Cerrar" : "Abrir"}>
                            {ev.estado === "active" ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                          </Button>
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
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={editFlgActivo} onCheckedChange={(v) => setEditFlgActivo(v === true)} />
              <span>Version activa</span>
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
