"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, Badge, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Checkbox, Skeleton, Input } from "@nrivera-iimp/ui-kit-iimp";
import { RefreshCw, Pencil, ChevronRight, Eye, Calendar, Hash, Plus, Trash2 } from "lucide-react";
import type { ModalInfoConfig } from "@/domain/models/entities";
import { eventosServiceClient } from "@/lib/client/api/services/eventos-service";
import { planosService } from "@/lib/client/api/services/planos-service";
import { listPlanos } from "@/lib/shared/planos/registry";
import { toast } from "sonner";
import { TIPOS_PLANO } from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";

interface PlanoOpcion { id: string; nombre: string; tipo: string; eventoAsignado: { tipoEvento: number; codigoEvento: number } | null; }

interface VersionItem {
  id: string; anio: string; tipoEvento: number; codigoEvento: number; estado: string;
  fecha_inicio: string | null; fecha_fin: string | null; imagen: string | null; plano: string | null;
  flgVisible?: boolean;
  modal_info?: ModalInfoConfig | null;
}

interface EventoGrupo { id: string; nombre: string; codigo: string; vertical: string; versiones: VersionItem[]; }

/** Contenido sugerido inicial del modal informativo (se puede editar por version). */
const MODAL_INFO_PLANTILLA: ModalInfoConfig = {
  activo: true,
  titulo: "Protocolo de reserva",
  subtitulo: "Antes de reservar tu stand, ten en cuenta lo siguiente:",
  items: [
    { titulo: "Revision por areas", descripcion: "Logistica y Comunicacion revisan tu documentacion antes de aprobar la solicitud." },
    { titulo: "Contrato por SGC", descripcion: "La revision legal del contrato se gestiona a traves del Sistema de Gestion de Contratos." },
    { titulo: "Documentos", descripcion: "Adjunta los documentos del contrato desde Mis solicitudes para continuar con el flujo." },
  ],
  ayuda: {
    titulo: "Asistencia para exhibidores",
    descripcion: "Si necesitas apoyo con la reserva, los documentos del contrato o el estado de tu solicitud, contacta a la Mesa de Ayuda del IIMP.",
    texto_boton: "Ir a Mesa de Ayuda",
    url: "",
  },
};

function toModalInfo(value: unknown): ModalInfoConfig | null {
  if (typeof value !== "object" || value === null) return null;
  const m = value as Record<string, unknown>;
  if (typeof m.activo !== "boolean" || typeof m.titulo !== "string") return null;
  const items = Array.isArray(m.items)
    ? m.items
        .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
        .map((i) => ({ titulo: String(i.titulo ?? ""), descripcion: String(i.descripcion ?? "") }))
    : [];
  const ayudaRaw = typeof m.ayuda === "object" && m.ayuda !== null ? (m.ayuda as Record<string, unknown>) : null;
  return {
    activo: m.activo,
    titulo: m.titulo,
    subtitulo: typeof m.subtitulo === "string" ? m.subtitulo : null,
    items,
    ayuda: ayudaRaw
      ? {
          titulo: String(ayudaRaw.titulo ?? ""),
          descripcion: String(ayudaRaw.descripcion ?? ""),
          texto_boton: String(ayudaRaw.texto_boton ?? ""),
          url: String(ayudaRaw.url ?? ""),
        }
      : null,
  };
}

function toEventoGrupo(value: unknown): EventoGrupo | null {
  if (typeof value !== "object" || value === null) return null;
  const grupo = value as Record<string, unknown>;
  if (typeof grupo.id !== "string" || typeof grupo.nombre !== "string" || typeof grupo.codigo !== "string" || typeof grupo.vertical !== "string" || !Array.isArray(grupo.versiones)) return null;

  const versiones: VersionItem[] = [];
  for (const raw of grupo.versiones) {
    if (typeof raw !== "object" || raw === null) continue;
    const v = raw as Record<string, unknown>;
    if (typeof v.id !== "string" || typeof v.anio !== "string" || typeof v.tipoEvento !== "number" || typeof v.codigoEvento !== "number" || typeof v.estado !== "string") continue;
    versiones.push({
      id: v.id,
      anio: v.anio,
      tipoEvento: v.tipoEvento,
      codigoEvento: v.codigoEvento,
      estado: v.estado,
      fecha_inicio: typeof v.fecha_inicio === "string" ? v.fecha_inicio : null,
      fecha_fin: typeof v.fecha_fin === "string" ? v.fecha_fin : null,
      imagen: typeof v.imagen === "string" ? v.imagen : null,
      plano: typeof v.plano === "string" ? v.plano : null,
      flgVisible: typeof v.flgVisible === "boolean" ? v.flgVisible : undefined,
      modal_info: toModalInfo(v.modal_info),
    });
  }

  return { id: grupo.id, nombre: grupo.nombre, codigo: grupo.codigo, vertical: grupo.vertical, versiones };
}

export function EventosMantenedor() {
  const [grupos, setGrupos] = useState<EventoGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrupo, setSelectedGrupo] = useState<EventoGrupo | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [editItem, setEditItem] = useState<VersionItem | null>(null);
  const [editPlano, setEditPlano] = useState("gess");
  const [editFlgVisible, setEditFlgVisible] = useState(false);
  const [editModalInfo, setEditModalInfo] = useState<ModalInfoConfig>(MODAL_INFO_PLANTILLA);
  const [planosOpciones, setPlanosOpciones] = useState<PlanoOpcion[]>(listPlanos().map((p) => ({ id: p.id, nombre: p.nombre, tipo: TIPOS_PLANO.SIMPLE, eventoAsignado: null })));

  useEffect(() => {
    planosService.listar()
      .then((data) => {
        if (data.length > 0) setPlanosOpciones(data.map((p) => ({ id: p.codigo, nombre: p.nombre, tipo: p.tipo, eventoAsignado: p.eventoAsignado })));
      })
      .catch(() => { /* fallback a lista en codigo */ });
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await eventosServiceClient.listar();
      const list = Array.isArray(data) ? data.map(toEventoGrupo).filter((g): g is EventoGrupo => g !== null) : [];
      setGrupos(list);
      setSelectedGrupo((prev) => (prev ? (list.find((g) => g.id === prev.id) ?? prev) : prev));
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    (async () => { await load(); })();
  }, []);

  const openEdit = (ver: VersionItem) => {
    setEditItem(ver);
    setEditPlano(ver.plano ?? "");
    setEditFlgVisible(ver.flgVisible ?? false);
    setEditModalInfo(ver.modal_info ?? MODAL_INFO_PLANTILLA);
    setEditDialog(true);
  };

  const handleSave = async () => {
    if (!editItem) return;
    try {
      const modalInfo: ModalInfoConfig = {
        activo: editModalInfo.activo,
        titulo: editModalInfo.titulo,
        subtitulo: editModalInfo.subtitulo ?? null,
        items: editModalInfo.items,
        ayuda: editModalInfo.ayuda ?? null,
      };
      const planoOriginal = editItem.plano ?? "";
      const planoNuevo = editPlano ?? "";
      // Solo se envia el plano si cambio: reenviarlo dispara la validacion de
      // "plano unico" aunque el valor sea el mismo.
      await eventosServiceClient.actualizar({
        tipo_evento: editItem.tipoEvento,
        codigo_evento: editItem.codigoEvento,
        ...(planoNuevo !== planoOriginal ? { plano: planoNuevo } : {}),
        flg_visible: editFlgVisible,
        modal_info: modalInfo,
      });
      toast.success("Evento actualizado");
      setSelectedGrupo((prev) => (prev ? {
        ...prev,
        versiones: prev.versiones.map((v) =>
          v.tipoEvento === editItem.tipoEvento && v.codigoEvento === editItem.codigoEvento
            ? { ...v, plano: editPlano || null, flgVisible: editFlgVisible, modal_info: modalInfo }
            : v,
        ),
      } : prev));
      await load();
      setEditDialog(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al actualizar el evento");
    }
  };

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
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="overflow-hidden border-slate-200">
              <Skeleton className="h-1.5 w-full rounded-none" />
              <CardContent className="p-5 space-y-3">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-slate-50 p-2 space-y-1">
                    <Skeleton className="h-3 w-3 mx-auto rounded" />
                    <Skeleton className="h-5 w-6 mx-auto" />
                    <Skeleton className="h-2.5 w-12 mx-auto" />
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2 space-y-1">
                    <Skeleton className="h-3 w-3 mx-auto rounded" />
                    <Skeleton className="h-5 w-6 mx-auto" />
                    <Skeleton className="h-2.5 w-12 mx-auto" />
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2 space-y-1">
                    <Skeleton className="h-3 w-3 mx-auto rounded" />
                    <Skeleton className="h-4 w-10 mx-auto" />
                    <Skeleton className="h-2.5 w-16 mx-auto" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
                      <p className="text-[9px] text-slate-400">{latest ? dateUtils.format(latest.fecha_inicio) : "—"}</p>
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
                    <span className="flex-1 text-slate-500">{dateUtils.format(ver.fecha_inicio)} — {dateUtils.format(ver.fecha_fin)}</span>
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
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden !p-0">
          <div className="shrink-0 px-5 pt-6 pb-3 border-b border-slate-100 !pr-12">
            <DialogHeader>
              <DialogTitle><span>Editar metadata</span></DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
            {editItem && (
              <div className="rounded-lg border bg-muted/20 p-2.5 text-xs text-muted-foreground">
                <span className="font-semibold text-slate-700">Version {editItem.anio}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-600">Plano 3D / Mapa</p>
              <Select value={editPlano} onValueChange={setEditPlano}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value=""><span>Sin asignar</span></SelectItem>
                  {planosOpciones.map((p) => {
                    const enUsoPorOtro = p.eventoAsignado !== null
                      && !(editItem && p.eventoAsignado.tipoEvento === editItem.tipoEvento && p.eventoAsignado.codigoEvento === editItem.codigoEvento);
                    const etiqueta = `${p.nombre}${p.tipo === TIPOS_PLANO.MACRO ? " (macro)" : ""}${enUsoPorOtro ? ` — en uso en ${p.eventoAsignado?.tipoEvento}/${p.eventoAsignado?.codigoEvento}` : ""}`;
                    return (
                      <SelectItem key={p.id} value={p.id} disabled={enUsoPorOtro}>
                        <span className={enUsoPorOtro ? "text-slate-400" : ""}>{etiqueta}</span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-400">Un mapa 3D solo puede estar asignado a un evento a la vez.</p>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={editFlgVisible} onCheckedChange={(v) => setEditFlgVisible(v === true)} />
              <span>Visible en presala</span>
            </label>

            <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs font-semibold text-slate-600">Modal informativo en el plano</p>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={editModalInfo.activo} onCheckedChange={(v) => setEditModalInfo((m) => ({ ...m, activo: v === true }))} />
                <span>Mostrar al ingresar al plano (1 vez por sesion)</span>
              </label>
              <Input value={editModalInfo.titulo} onChange={(e) => setEditModalInfo((m) => ({ ...m, titulo: e.target.value }))} placeholder="Titulo" />
              <Input value={editModalInfo.subtitulo ?? ""} onChange={(e) => setEditModalInfo((m) => ({ ...m, subtitulo: e.target.value }))} placeholder="Subtitulo (opcional)" />

              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground">Items</p>
                {editModalInfo.items.map((it, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <Input value={it.titulo} onChange={(e) => setEditModalInfo((m) => ({ ...m, items: m.items.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)) }))} placeholder="Titulo" className="w-36 shrink-0" />
                    <Input value={it.descripcion} onChange={(e) => setEditModalInfo((m) => ({ ...m, items: m.items.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)) }))} placeholder="Descripcion" />
                    <Button type="button" variant="ghost" size="sm" className="h-9 w-8 shrink-0 p-0 text-destructive" onClick={() => setEditModalInfo((m) => ({ ...m, items: m.items.filter((_, j) => j !== i) }))} title="Quitar item">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => setEditModalInfo((m) => ({ ...m, items: [...m.items, { titulo: "", descripcion: "" }] }))}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  <span>Agregar item</span>
                </Button>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground">Bloque de ayuda (opcional)</p>
                {editModalInfo.ayuda ? (
                  <>
                    <Input value={editModalInfo.ayuda.titulo} onChange={(e) => setEditModalInfo((m) => ({ ...m, ayuda: { titulo: e.target.value, descripcion: m.ayuda?.descripcion ?? "", texto_boton: m.ayuda?.texto_boton ?? "", url: m.ayuda?.url ?? "" } }))} placeholder="Titulo" />
                    <Input value={editModalInfo.ayuda.descripcion} onChange={(e) => setEditModalInfo((m) => ({ ...m, ayuda: { titulo: m.ayuda?.titulo ?? "", descripcion: e.target.value, texto_boton: m.ayuda?.texto_boton ?? "", url: m.ayuda?.url ?? "" } }))} placeholder="Descripcion" />
                    <div className="flex gap-1.5">
                      <Input value={editModalInfo.ayuda.texto_boton} onChange={(e) => setEditModalInfo((m) => ({ ...m, ayuda: { titulo: m.ayuda?.titulo ?? "", descripcion: m.ayuda?.descripcion ?? "", texto_boton: e.target.value, url: m.ayuda?.url ?? "" } }))} placeholder="Texto del boton" />
                      <Input value={editModalInfo.ayuda.url} onChange={(e) => setEditModalInfo((m) => ({ ...m, ayuda: { titulo: m.ayuda?.titulo ?? "", descripcion: m.ayuda?.descripcion ?? "", texto_boton: m.ayuda?.texto_boton ?? "", url: e.target.value } }))} placeholder="URL (https://...)" />
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => setEditModalInfo((m) => ({ ...m, ayuda: null }))}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      <span>Quitar bloque de ayuda</span>
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => setEditModalInfo((m) => ({ ...m, ayuda: { titulo: "", descripcion: "", texto_boton: "", url: "" } }))}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    <span>Agregar ayuda</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-slate-100 px-5 py-3 !mt-0">
            <Button onClick={handleSave} className="w-full"><span>Guardar cambios</span></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
