"use client";

import Image from "next/image";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { Eye, Trash2, Search, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/shared/pagination";
import { gessService } from "@/lib/client/api/services/gess-service";
import { internalApi } from "@/lib/client/api/services/internal-api";
import { uploadService } from "@/lib/client/api/services/upload-service";
import { maestraService } from "@/lib/client/api/services/maestra-service";
import { MAESTRA_TABLAS, ESTADOS_STAND, ESTADOS_STAND_MAESTRA_ID, BADGE_STYLES, CATEGORIAS_IMAGEN, CATEGORIA_IMAGEN_LABELS, CATEGORIA_IMAGEN_ORDER, CATEGORIAS_DOCUMENTO, CATEGORIA_DOCUMENTO_LABELS, CATEGORIA_DOCUMENTO_ORDER, normalizarCategorias } from "@/lib/shared/constants";
import { stringUtils } from "@/lib/shared/utils/string";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import type { GessStandDTO } from "@/types/dto/gess";
import type { TipoStandImagenDTO } from "@/types/dto/gess/tipo-stand-imagen.dto";

interface StandDoc {
  id: string;
  standCode: string;
  tipoStand: string | null;
  /** Imagen referencial del tipo (aplica a todos los stands del tipo). */
  tipoImagen: string | null;
  medidas: string | null;
  estado: string | null;
  empresa: string | null;
  bloqueId: string | null;
  documentos: string[];
  imagenes: string[];
  /** Categoria por url de imagen. */
  imagenesCategorias: Record<string, string>;
  documentosCategorias: Record<string, string>;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toStandDoc(dto: GessStandDTO): StandDoc {
  return {
    id: dto.id,
    standCode: dto.standCode,
    tipoStand: dto.tipoStand,
    tipoImagen: dto.tipoImagen ?? null,
    medidas: dto.medidas,
    estado: dto.estado,
    empresa: dto.empresa,
    bloqueId: dto.bloqueId,
    documentos: toStringArray(dto.documentos),
    imagenes: toStringArray(dto.imagenes),
    imagenesCategorias: normalizarCategorias(dto.imagenesCategorias),
    documentosCategorias: normalizarCategorias(dto.documentosCategorias),
  };
}

export function StandsManager({ eventoId }: { eventoId: string }) {
  const [rows, setRows] = useState<StandDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editDocs, setEditDocs] = useState<string[]>([]);
  const [editImgs, setEditImgs] = useState<string[]>([]);
  const [editImgCats, setEditImgCats] = useState<Record<string, string>>({});
  const [editDocCats, setEditDocCats] = useState<Record<string, string>>({});

  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, perPage: 10, total: 0, totalPages: 0 });
  const [estadoLabels, setEstadoLabels] = useState<Record<string, string>>({});

  // Imagen referencial por tipo de stand (RF-08)
  const [editTipoImagen, setEditTipoImagen] = useState<string | null>(null);
  const [tiposOpen, setTiposOpen] = useState(false);
  const [tiposImagen, setTiposImagen] = useState<TipoStandImagenDTO[]>([]);
  const [tiposLoading, setTiposLoading] = useState(false);
  const [subiendoTipo, setSubiendoTipo] = useState<string | null>(null);

  useEffect(() => {
    maestraService.listar(MAESTRA_TABLAS.STAND_ESTADO).then((items) => {
      const map: Record<string, string> = {};
      for (const item of items) {
        if (item.itemId !== null) {
          map[String(item.itemId)] = item.nombre;
        }
      }
      // Map constant keys to maestra labels
      for (const [key, itemId] of Object.entries(ESTADOS_STAND_MAESTRA_ID)) {
        const label = map[String(itemId)];
        if (label) {
          map[key] = label;
        }
      }
      setEstadoLabels(map);
    }).catch(() => {});
  }, []);

  const load = useCallback(async (p: number = 1, pp?: number, s?: string) => {
    setLoading(true);
    try {
      const res = await gessService.list(eventoId, {
        page: p,
        per_page: pp ?? 10,
        search: s || undefined,
      });
      const list = Array.isArray(res.data) ? res.data : [];
      setRows(list.map(toStandDoc));
      setPagination({
        page: res.pagination.page,
        perPage: res.pagination.per_page,
        total: res.pagination.total,
        totalPages: res.pagination.total_pages,
      });
    } catch { /* ignore */ }
    setLoading(false);
  }, [eventoId]);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  const handleUpload = async (file: File): Promise<string> => {
    return uploadService.subir(file);
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await handleUpload(file);
      setEditDocs((prev) => [...prev, url]);
      setEditDocCats((prev) => ({ ...prev, [url]: CATEGORIAS_DOCUMENTO.OTRO }));
    } catch { /* ignore */ }
  };

  const handleImgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await handleUpload(file);
      setEditImgs((prev) => [...prev, url]);
      setEditImgCats((prev) => ({ ...prev, [url]: CATEGORIAS_IMAGEN.OTRO }));
    } catch { /* ignore */ }
  };

  const openEdit = (row: StandDoc) => {
    setEditId(row.id);
    setEditDocs(row.documentos ?? []);
    setEditImgs(row.imagenes ?? []);
    setEditImgCats(row.imagenesCategorias ?? {});
    setEditDocCats(row.documentosCategorias ?? {});
    setEditTipoImagen(row.tipoImagen);
    setEditOpen(true);
  };

  const openTipos = async () => {
    setTiposOpen(true);
    setTiposLoading(true);
    try {
      setTiposImagen(await gessService.tiposImagenListar());
    } catch {
      toast.error("No se pudieron cargar las imágenes por tipo");
    }
    setTiposLoading(false);
  };

  /** Sube la imagen de un tipo y la aplica a todos los stands de ese tipo. */
  const subirImagenTipo = async (tipo: string, file: File) => {
    setSubiendoTipo(tipo);
    try {
      const url = await uploadService.subir(file);
      await gessService.tipoImagenGuardar({ tipo, imagenUrl: url });
      setTiposImagen((prev) => prev.map((t) => (t.tipo === tipo ? { ...t, imagenUrl: url } : t)));
      toast.success("Imagen del tipo actualizada");
      await load(pagination.page, perPage, search);
    } catch {
      toast.error("No se pudo subir la imagen del tipo");
    }
    setSubiendoTipo(null);
  };

  const quitarImagenTipo = async (tipo: string) => {
    try {
      await gessService.tipoImagenEliminar(tipo);
      setTiposImagen((prev) => prev.map((t) => (t.tipo === tipo ? { ...t, imagenUrl: null } : t)));
      toast.success("Imagen del tipo eliminada");
      await load(pagination.page, perPage, search);
    } catch {
      toast.error("No se pudo eliminar la imagen del tipo");
    }
  };

  const handleSave = async () => {
    try {
      const imgCategorias = Object.fromEntries(editImgs.map((url) => [url, editImgCats[url] ?? CATEGORIAS_IMAGEN.OTRO]));
      const docCategorias = Object.fromEntries(editDocs.map((url) => [url, editDocCats[url] ?? CATEGORIAS_DOCUMENTO.OTRO]));
      await internalApi.patch("/api/gess/actualizar", { id: editId, documentos: editDocs, documentosCategorias: docCategorias, imagenes: editImgs, imagenesCategorias: imgCategorias });
      setRows((prev) => prev.map((r) => (r.id === editId ? { ...r, documentos: editDocs, documentosCategorias: docCategorias, imagenes: editImgs, imagenesCategorias: imgCategorias } : r)));
      toast.success("Documentos guardados");
      setEditOpen(false);
    } catch (err) {
      console.error("Error al guardar documentos del stand:", err);
      toast.error("Error al guardar los cambios");
    }
  };

  const removeDoc = (idx: number) => {
    const url = editDocs[idx];
    setEditDocs((prev) => prev.filter((_, i) => i !== idx));
    if (url) {
      setEditDocCats((prev) => {
        const next = { ...prev };
        delete next[url];
        return next;
      });
    }
  };
  const removeImg = (idx: number) => {
    const url = editImgs[idx];
    setEditImgs((prev) => prev.filter((_, i) => i !== idx));
    if (url) {
      setEditImgCats((prev) => {
        const next = { ...prev };
        delete next[url];
        return next;
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle><span>Gestión de Stands</span></CardTitle>
            <Badge variant="outline"><span>{pagination.total}</span></Badge>
          </div>
          <p className="text-xs text-muted-foreground">Administra el expediente digital (documentos e imágenes) de los stands vinculados.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={(e) => { setSearch(e.target.value); }} onKeyDown={(e) => { if (e.key === "Enter") load(1, perPage, e.currentTarget.value); }} className="pl-8 text-xs h-8" />
            </div>
            <Select value={String(perPage)} onValueChange={(v) => { const n = Number(v); setPerPage(n); load(1, n, search); }}>
              <SelectTrigger className="w-[90px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[5, 10, 25, 50].map((n) => (<SelectItem key={n} value={String(n)}><span>{n} / pag</span></SelectItem>))}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button variant="outline" size="sm" className="h-8 rounded-full text-xs" onClick={() => { void openTipos(); }}>
              <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
              <span>Imágenes por tipo</span>
            </Button>
          </div>

          {loading ? (
            <TableSkeleton rows={perPage} columns={7} />
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay stands vinculados. Vincula en Vinculacion de Stands primero.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] uppercase tracking-wide"><span>Stand</span></TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide sm:table-cell"><span>Bloque</span></TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide md:table-cell"><span>Tipo</span></TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide"><span>Estado</span></TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell"><span>Empresa</span></TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide sm:table-cell"><span>Archivos</span></TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wide"><span>Acción</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const est = row.estado?.toLowerCase();
                      return (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs font-medium">{row.standCode}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{row.bloqueId}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs">{row.tipoStand ?? "—"}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] pointer-events-none ${est === ESTADOS_STAND.DISPONIBLE ? BADGE_STYLES.SUCCESS : est === ESTADOS_STAND.RESERVADO ? BADGE_STYLES.DESTRUCTIVE : BADGE_STYLES.WARNING}`}>
                            {estadoLabels[est ?? ""] ?? row.estado ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell max-w-[120px] truncate text-xs text-muted-foreground">{row.empresa ?? "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">{row.documentos?.length ?? 0} doc, {row.imagenes?.length ?? 0} img</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => openEdit(row)}><span>Docs</span></Button>
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">
                  {pagination.total} resultados — pagina {pagination.page} de {pagination.totalPages || 1}
                </span>
                <Pagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  onPageChange={(p) => { load(p, perPage, search); }}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle><span>Documentos e Imagenes</span></DialogTitle></DialogHeader>
          <div className="space-y-5">
            {/* Imagen referencial del tipo (RF-08) */}
            {editTipoImagen && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Imagen referencial del tipo</p>
                <Image
                  width={640}
                  height={360}
                  src={editTipoImagen}
                  alt="Imagen referencial del tipo de stand"
                  className="max-h-40 w-full rounded-md border bg-white object-contain"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Aplica a todos los stands de este tipo; se administra en &quot;Imágenes por tipo&quot;.
                </p>
              </div>
            )}
            {/* Contrato */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Contrato ({editDocs.length})</p>
              </div>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary py-3 text-xs text-muted-foreground hover:border-primary hover:bg-primary/5 transition-colors">
                <span>📄</span>
                <span>Subir contrato (PDF, DOC, DOCX)</span>
                <input type="file" className="hidden" onChange={handleDocUpload} accept=".pdf,.doc,.docx" />
              </label>
              {editDocs.length > 0 && (
                <div className="mt-2 divide-y rounded-md border">
                  {editDocs.map((url, i) => {
                    const isPdf = url.endsWith(".pdf");
                    const name = stringUtils.nombreArchivo(url);
                    return (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs">
                        <span className="shrink-0">{isPdf ? "📕" : "📎"}</span>
                        <span className="min-w-0 flex-1 truncate font-mono">{name}</span>
                        <Select
                          value={editDocCats[url] ?? CATEGORIAS_DOCUMENTO.OTRO}
                          onValueChange={(v) => setEditDocCats((prev) => ({ ...prev, [url]: v }))}
                        >
                          <SelectTrigger className="h-7 w-[120px] shrink-0 text-[11px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIA_DOCUMENTO_ORDER.map((c) => (
                              <SelectItem key={c} value={c}><span>{CATEGORIA_DOCUMENTO_LABELS[c]}</span></SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isPdf && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0" asChild title="Ver">
                            <a href={url} target="_blank"><Eye className="h-3.5 w-3.5" /></a>
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0 text-destructive" onClick={() => removeDoc(i)} title="Eliminar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Imagenes */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Imagenes ({editImgs.length})</p>
              </div>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary py-3 text-xs text-muted-foreground hover:border-primary hover:bg-primary/5 transition-colors">
                <span>🖼️</span>
                <span>Subir imagenes (JPG, PNG, WEBP)</span>
                <input type="file" className="hidden" onChange={handleImgUpload} accept="image/*" multiple />
              </label>
              {editImgs.length > 0 && (
                <div className="mt-2 divide-y rounded-md border">
                  {editImgs.map((url, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs">
                      <Image width={28} height={28} src={url} alt={stringUtils.nombreArchivo(url) || "Imagen del stand"} className="h-7 w-7 shrink-0 rounded object-cover" />
                      <span className="min-w-0 flex-1 truncate font-mono">{stringUtils.nombreArchivo(url)}</span>
                      <Select
                        value={editImgCats[url] ?? CATEGORIAS_IMAGEN.OTRO}
                        onValueChange={(v) => setEditImgCats((prev) => ({ ...prev, [url]: v }))}
                      >
                        <SelectTrigger className="h-7 w-[128px] shrink-0 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIA_IMAGEN_ORDER.map((c) => (
                            <SelectItem key={c} value={c}><span>{CATEGORIA_IMAGEN_LABELS[c]}</span></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0" asChild title="Ver">
                        <a href={url} target="_blank"><Eye className="h-3.5 w-3.5" /></a>
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0 text-destructive" onClick={() => removeImg(i)} title="Eliminar">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} className="w-full"><span>Guardar cambios</span></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Imagenes referenciales por tipo de stand (RF-08) */}
      <Dialog open={tiposOpen} onOpenChange={setTiposOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle><span>Imágenes por tipo de stand</span></DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">
            La imagen de un tipo se usa como referencia en <strong>todos los stands de ese tipo</strong> del
            evento activo. Si un tipo no tiene imagen en este evento, se usa la <strong>global</strong> de respaldo.
          </p>
          {tiposLoading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Cargando...</p>
          ) : (
            <div className="divide-y rounded-md border">
              {tiposImagen.map((t) => (
                <div key={t.tipo} className="flex items-center gap-3 px-3 py-2.5 text-xs">
                  {t.imagenUrl ? (
                    <Image width={56} height={36} src={t.imagenUrl} alt={`Imagen referencial: ${t.label}`} className="h-9 w-14 shrink-0 rounded border bg-white object-cover" />
                  ) : (
                    <span className="flex h-9 w-14 shrink-0 items-center justify-center rounded border border-dashed text-muted-foreground">
                      <ImagePlus className="h-4 w-4" />
                    </span>
                  )}
                  <span className="flex-1">
                    <span className="font-medium">{t.label}</span>
                    <span className="ml-2 font-mono text-[10px] text-muted-foreground">{t.tipo}</span>
                  </span>
                  <label className="shrink-0 cursor-pointer rounded-full border px-3 py-1 text-[11px] font-medium hover:bg-secondary">
                    <span>{subiendoTipo === t.tipo ? "Subiendo..." : t.imagenUrl ? "Cambiar" : "Subir"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={subiendoTipo !== null}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void subirImagenTipo(t.tipo, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {t.imagenUrl && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0 text-destructive" title="Quitar imagen" onClick={() => { void quitarImagenTipo(t.tipo); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTiposOpen(false)}><span>Cerrar</span></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
