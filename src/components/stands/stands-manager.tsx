"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { Eye, Trash2, Search } from "lucide-react";
import { Pagination } from "@/components/shared/pagination";
import { gessService } from "@/lib/api/services/gess-service";
import { internalApi } from "@/lib/api/services/internal-api";

interface StandDoc {
  id: string;
  standCode: string;
  tipoStand: string | null;
  medidas: string | null;
  estado: string | null;
  empresa: string | null;
  bloqueId: string | null;
  documentos: string[];
  imagenes: string[];
}

export function StandsManager({ eventoId }: { eventoId: string }) {
  const [rows, setRows] = useState<StandDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editDocs, setEditDocs] = useState<string[]>([]);
  const [editImgs, setEditImgs] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, perPage: 10, total: 0, totalPages: 0 });

  const load = async (p?: number, pp?: number, s?: string) => {
    setLoading(true);
    try {
      const res = await gessService.list(eventoId, {
        page: p ?? 1,
        per_page: pp ?? 10,
        search: s || undefined,
      });
      const list = Array.isArray(res.data) ? res.data : [];
      setRows(list as unknown as StandDoc[]);
      setPagination({
        page: res.pagination.page,
        perPage: res.pagination.per_page,
        total: res.pagination.total,
        totalPages: res.pagination.total_pages,
      });
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [eventoId]);

  const handleUpload = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json();
    if (json.success) return json.data.url;
    throw new Error(json.error?.message ?? "Error al subir");
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await handleUpload(file);
      setEditDocs((prev) => [...prev, url]);
    } catch { /* ignore */ }
  };

  const handleImgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await handleUpload(file);
      setEditImgs((prev) => [...prev, url]);
    } catch { /* ignore */ }
  };

  const openEdit = (row: StandDoc) => {
    setEditId(row.id);
    setEditDocs(row.documentos ?? []);
    setEditImgs(row.imagenes ?? []);
    setEditOpen(true);
  };

  const handleSave = async () => {
    try {
      await internalApi.patch("/api/gess", { id: editId, documentos: editDocs, imagenes: editImgs });
      setRows((prev) => prev.map((r) => (r.id === editId ? { ...r, documentos: editDocs, imagenes: editImgs } : r)));
      setEditOpen(false);
    } catch { /* ignore */ }
  };

  const removeDoc = (idx: number) => setEditDocs((prev) => prev.filter((_, i) => i !== idx));
  const removeImg = (idx: number) => setEditImgs((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle><span>Stands vinculados ({pagination.total})</span></CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={(e) => { setSearch(e.target.value); }} onKeyDown={(e) => { if (e.key === "Enter") load(1, perPage, e.currentTarget.value); }} className="pl-8 text-xs h-8" />
            </div>
            <Select value={String(perPage)} onValueChange={(v) => { const n = Number(v); setPerPage(n); setPage(1); load(1, n, search); }}>
              <SelectTrigger className="w-[90px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[5, 10, 25, 50].map((n) => (<SelectItem key={n} value={String(n)}><span>{n} / pag</span></SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay stands vinculados. Vincula en Vinculacion de Stands primero.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><span>Stand</span></TableHead>
                      <TableHead className="hidden sm:table-cell"><span>Bloque</span></TableHead>
                      <TableHead className="hidden md:table-cell"><span>Tipo</span></TableHead>
                      <TableHead><span>Estado</span></TableHead>
                      <TableHead className="hidden lg:table-cell"><span>Empresa</span></TableHead>
                      <TableHead className="hidden sm:table-cell"><span>Archivos</span></TableHead>
                      <TableHead className="text-right"><span>Accion</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs font-medium">{row.standCode}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{row.bloqueId}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs">{row.tipoStand ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={row.estado === "Reservado" ? "destructive" : "default"}>
                            <span>{row.estado ?? "—"}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell max-w-[120px] truncate text-xs text-muted-foreground">{row.empresa ?? "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">{row.documentos?.length ?? 0} doc, {row.imagenes?.length ?? 0} img</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => openEdit(row)}><span>Docs</span></Button>
                        </TableCell>
                      </TableRow>
                    ))}
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
                  onPageChange={(p) => { setPage(p); load(p, perPage, search); }}
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
            {/* Contrato */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Contrato ({editDocs.length})</p>
              </div>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 py-3 text-xs text-muted-foreground hover:border-primary hover:bg-primary/5 transition-colors">
                <span>📄</span>
                <span>Subir contrato (PDF, DOC, DOCX)</span>
                <input type="file" className="hidden" onChange={handleDocUpload} accept=".pdf,.doc,.docx" />
              </label>
              {editDocs.length > 0 && (
                <div className="mt-2 divide-y rounded-md border">
                  {editDocs.map((url, i) => {
                    const isPdf = url.endsWith(".pdf");
                    const name = url.split("/").pop() ?? url;
                    return (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
                        <span>{isPdf ? "📕" : "📎"}</span>
                        <span className="flex-1 truncate font-mono">{name}</span>
                        {isPdf && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild title="Ver">
                            <a href={url} target="_blank"><Eye className="h-3.5 w-3.5" /></a>
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeDoc(i)} title="Eliminar">
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
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 py-3 text-xs text-muted-foreground hover:border-primary hover:bg-primary/5 transition-colors">
                <span>🖼️</span>
                <span>Subir imagenes (JPG, PNG, WEBP)</span>
                <input type="file" className="hidden" onChange={handleImgUpload} accept="image/*" multiple />
              </label>
              {editImgs.length > 0 && (
                <div className="mt-2 divide-y rounded-md border">
                  {editImgs.map((url, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
                      <img src={url} className="h-7 w-7 rounded object-cover" />
                      <span className="flex-1 truncate font-mono">{url.split("/").pop()}</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild title="Ver">
                        <a href={url} target="_blank"><Eye className="h-3.5 w-3.5" /></a>
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeImg(i)} title="Eliminar">
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
    </div>
  );
}
