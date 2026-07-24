"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@nrivera-iimp/ui-kit-iimp";
import { eventosServiceClient } from "@/lib/api/services/eventos-service";

interface EventoRow {
  id: string;
  tipoEvento: number;
  codigoEvento: number;
  anio: string;
  estado: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  imagen: string | null;
  flgActivo: boolean;
  eventoPadre: { id: string; nombre: string; codigo: string };
  _count: { stands: number; gessStands: number; reservas: number };
}

export function EventosMantenedor() {
  const [rows, setRows] = useState<EventoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [padres] = useState<{ id: string; nombre: string }[]>([
    { id: "ep-perumin", nombre: "PERUMIN" },
    { id: "ep-proexplo", nombre: "ProExplo" },
    { id: "ep-wmc", nombre: "WMC" },
    { id: "ep-gess", nombre: "GESS" },
  ]);
  const [newDialog, setNewDialog] = useState(false);
  const [newPadreId, setNewPadreId] = useState("");
  const [newAnio, setNewAnio] = useState("");
  const [newInicio, setNewInicio] = useState("");
  const [newFin, setNewFin] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [ev] = await Promise.all([eventosServiceClient.list()]);
      setRows(Array.isArray(ev) ? ev as unknown as EventoRow[] : []);
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
      await eventosServiceClient.create({ evento_padre_id: newPadreId, anio: newAnio, fecha_inicio: newInicio || undefined, fecha_fin: newFin || undefined });
      await load();
      setNewDialog(false);
      setNewAnio("");
      setNewInicio("");
      setNewFin("");
    } catch {
      // ignore
    }
  };

  const handleToggle = async (id: string, key: "estado" | "flgActivo", current: string | boolean) => {
    const data: Record<string, unknown> = key === "flgActivo"
      ? { flgActivo: !current }
      : { estado: current === "active" ? "closed" : "active" };
    try {
      await eventosServiceClient.patch(id, data);
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } as EventoRow : r)));
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
                        <TableHead><span>Activo</span></TableHead>
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
                          <TableCell>
                            <Badge variant={ev.flgActivo ? "default" : "secondary"}>
                              <span>{ev.flgActivo ? "Si" : "No"}</span>
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right flex gap-1 justify-end">
                            <Button
                              variant={ev.estado === "active" ? "outline" : "default"}
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleToggle(ev.id, "estado", ev.estado)}
                            >
                              <span>{ev.estado === "active" ? "Cerrar" : "Activar"}</span>
                            </Button>
                            <Button
                              variant={ev.flgActivo ? "outline" : "default"}
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleToggle(ev.id, "flgActivo", ev.flgActivo)}
                            >
                              <span>{ev.flgActivo ? "Desactivar" : "Activar"}</span>
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
