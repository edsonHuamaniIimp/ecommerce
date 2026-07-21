"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@nrivera-iimp/ui-kit-iimp";

interface EventoRow {
  id: string;
  tipoEvento: number;
  codigoEvento: number;
  anio: string;
  estado: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  imagen: string | null;
  eventoPadre: { id: string; nombre: string; codigo: string };
  _count: { stands: number; gessStands: number; reservas: number };
}

export function EventosMantenedor() {
  const [rows, setRows] = useState<EventoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [padres, setPadres] = useState<{ id: string; nombre: string }[]>([]);
  const [newDialog, setNewDialog] = useState(false);
  const [newPadreId, setNewPadreId] = useState("");
  const [newAnio, setNewAnio] = useState("");
  const [newInicio, setNewInicio] = useState("");
  const [newFin, setNewFin] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [ev, ep] = await Promise.all([
        fetch("/api/eventos").then((r) => r.json()),
        fetch("/eventos-padre").then((r) => r.json()).catch(() => [
          { id: "ep-perumin", nombre: "PERUMIN" },
          { id: "ep-proexplo", nombre: "ProExplo" },
          { id: "ep-wmc", nombre: "WMC" },
          { id: "ep-gess", nombre: "GESS" },
        ]),
      ]);
      setRows(Array.isArray(ev) ? ev : []);
      setPadres(Array.isArray(ep) ? ep : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newPadreId || !newAnio) return;
    try {
      const res = await fetch("/api/eventos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventoPadreId: newPadreId,
          anio: newAnio,
          fechaInicio: newInicio || undefined,
          fechaFin: newFin || undefined,
        }),
      });
      if (!res.ok) throw new Error("Error");
      await load();
      setNewDialog(false);
      setNewAnio("");
      setNewInicio("");
      setNewFin("");
    } catch {
      // ignore
    }
  };

  const handleToggle = async (id: string, estado: string) => {
    const nuevo = estado === "active" ? "closed" : "active";
    try {
      await fetch("/api/eventos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, estado: nuevo }),
      });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, estado: nuevo } : r)));
    } catch {
      // ignore
    }
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
            <CardHeader>
              <CardTitle><span>{nombre}</span></CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead><span>Version</span></TableHead>
                        <TableHead><span>Fechas</span></TableHead>
                        <TableHead><span>Estado</span></TableHead>
                        <TableHead><span>Stands</span></TableHead>
                        <TableHead><span>Reservas</span></TableHead>
                        <TableHead className="text-right"><span>Accion</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eventos.map((ev) => (
                        <TableRow key={ev.id}>
                          <TableCell className="font-mono text-xs font-medium">{ev.anio}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {ev.fechaInicio ? new Date(ev.fechaInicio).toLocaleDateString("es-PE") : "—"} —{" "}
                            {ev.fechaFin ? new Date(ev.fechaFin).toLocaleDateString("es-PE") : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={ev.estado === "active" ? "default" : ev.estado === "draft" ? "secondary" : "outline"}>
                              <span>{ev.estado}</span>
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{ev._count.stands + ev._count.gessStands}</TableCell>
                          <TableCell className="text-xs">{ev._count.reservas}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant={ev.estado === "active" ? "outline" : "default"}
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleToggle(ev.id, ev.estado)}
                            >
                              <span>{ev.estado === "active" ? "Cerrar" : "Activar"}</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
              </div>
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
                  {padres.map((p) => (
                    <SelectItem key={p.id} value={p.id}><span>{p.nombre}</span></SelectItem>
                  ))}
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
    </div>
  );
}
