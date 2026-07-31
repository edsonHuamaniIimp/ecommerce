"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, Badge, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Checkbox } from "@nrivera-iimp/ui-kit-iimp";
import { RefreshCw, Pencil, ChevronRight, Eye, EyeOff, Calendar, Map, Hash } from "lucide-react";
import { eventosServiceClient } from "@/lib/api/services/eventos-service";
import { listPlanos } from "@/lib/planos/registry";

interface VersionItem {
  id: string; anio: string; tipoEvento: number; codigoEvento: number; estado: string;
  fecha_inicio: string | null; fecha_fin: string | null; imagen: string | null; plano: string | null;
  flgVisible?: boolean;
}

interface EventoGrupo { id: string; nombre: string; codigo: string; vertical: string; versiones: VersionItem[]; }

export function EventosMantenedor() {
  const [grupos, setGrupos] = useState<EventoGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrupo, setSelectedGrupo] = useState<EventoGrupo | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [editItem, setEditItem] = useState<VersionItem | null>(null);
  const [editPlano, setEditPlano] = useState("gess");
  const [editFlgVisible, setEditFlgVisible] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await eventosServiceClient.listar();
      setGrupos(Array.isArray(data) ? (data as unknown as EventoGrupo[]) : []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (ver: VersionItem) => {
    setEditItem(ver);
    setEditPlano(ver.plano ?? "gess");
    setEditFlgVisible(ver.flgVisible ?? false);
    setEditDialog(true);
  };

  const handleSave = async () => {
    if (!editItem) return;
    try {
      await eventosServiceClient.actualizar({
        tipo_evento: editItem.tipoEvento,
        codigo_evento: editItem.codigoEvento,
        plano: editPlano || undefined,
        flg_visible: editFlgVisible,
      });
      await load();
    } catch { /* ignore */ }
    setEditDialog(false);
  };

  const formatDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const VERTICAL_COLORS: Record<string, string> = {
    proexplo: "#d97706", wmc: "#0891b2", gess: "#16a34a", perumin: "#b45309",
    "difusion-minera": "#7c3aed", eventos: "#0ea5e9",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Datos del API KBServicios. Gestiona metadata por version.</p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Actualizar</span>
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-6"><div className="h-4 w-24 rounded bg-slate-200 mb-3" /><div className="h-3 w-16 rounded bg-slate-100" /></CardContent></Card>)}
        </div>
      ) : grupos.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No se pudieron cargar eventos del API.</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {grupos.map((g) => {
            const vColor = VERTICAL_COLORS[g.vertical] ?? "#6b7280";
            const visible = g.versiones.filter((v) => v.flgVisible).length;
            const latest = g.versiones[g.versiones.length - 1];
            return (
              <Card key={g.id} className="group cursor-pointer overflow-hidden border-slate-200 transition-all hover:border-slate-300 hover:shadow-md" onClick={() => setSelectedGrupo(g)}>
                <div className="h-1.5 w-full" style={{ backgroundColor: vColor }} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">{g.nombre}</h3>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">{g.vertical}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 mt-0.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-slate-50 p-2 text-center">
                      <Hash className="mx-auto h-3 w-3 text-slate-400 mb-0.5" />
                      <p className="text-lg font-bold text-slate-700">{g.versiones.length}</p>
                      <p className="text-[9px] text-slate-400">Versiones</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2 text-center">
                      <Eye className="mx-auto h-3 w-3 text-slate-400 mb-0.5" />
                      <p className="text-lg font-bold text-slate-700">{visible}</p>
                      <p className="text-[9px] text-slate-400">Visibles</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2 text-center">
                      <Calendar className="mx-auto h-3 w-3 text-slate-400 mb-0.5" />
                      <p className="text-xs font-medium text-slate-700">{latest?.anio ?? "—"}</p>
                      <p className="text-[9px] text-slate-400">{latest ? formatDate(latest.fecha_inicio) : "—"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de versiones */}
      <Dialog open={!!selectedGrupo} onOpenChange={() => setSelectedGrupo(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden !p-0">
          {/* Header */}
          <div className="shrink-0 px-6 pt-6 pb-3 border-b border-slate-100 !pr-14">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>{selectedGrupo?.nombre}</span>
                <Badge variant="outline" className="text-[10px]"><span>{selectedGrupo?.vertical}</span></Badge>
                <span className="ml-auto text-xs font-normal text-muted-foreground">{selectedGrupo?.versiones.length} versiones</span>
              </DialogTitle>
            </DialogHeader>
          </div>
          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-3">
            {selectedGrupo && (
              <div className="space-y-1">
                {selectedGrupo.versiones.map((ver) => (
                  <div key={ver.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-4 py-2.5 text-xs hover:bg-slate-50 transition-colors">
                    <span className="font-mono font-semibold text-slate-700 w-10">{ver.anio}</span>
                    <span className="flex-1 text-slate-500">{formatDate(ver.fecha_inicio)} — {formatDate(ver.fecha_fin)}</span>
                    <span className="text-slate-400">{ver.plano ?? "—"}</span>
                    <Badge variant={ver.flgVisible ? "default" : "secondary"} className="text-[10px] shrink-0">
                      <span>{ver.flgVisible ? "Visible" : "Oculta"}</span>
                    </Badge>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={(e) => { e.stopPropagation(); openEdit(ver); }} title="Editar metadata">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Footer */}
          <DialogFooter className="shrink-0 border-t border-slate-100 px-6 py-3 !mt-0">
            <Button variant="outline" size="sm" onClick={() => setSelectedGrupo(null)}>
              <span>Cerrar</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de edicion metadata */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-sm !p-0">
          <div className="shrink-0 px-5 pt-6 pb-3 border-b border-slate-100 !pr-12">
            <DialogHeader>
              <DialogTitle><span>Editar metadata</span></DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-5 py-3 space-y-3">
            {editItem && (
              <div className="rounded-lg border bg-muted/20 p-2.5 text-xs text-muted-foreground">
                <span className="font-semibold text-slate-700">Version {editItem.anio}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-600">Plano 3D</p>
              <Select value={editPlano} onValueChange={setEditPlano}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value=""><span>Sin asignar</span></SelectItem>
                  {listPlanos().map((p) => (<SelectItem key={p.id} value={p.id}><span>{p.nombre}</span></SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={editFlgVisible} onCheckedChange={(v) => setEditFlgVisible(v === true)} />
              <span>Visible en presala</span>
            </label>
          </div>
          <DialogFooter className="border-t border-slate-100 px-5 py-3 !mt-0">
            <Button onClick={handleSave} className="w-full"><span>Guardar cambios</span></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
