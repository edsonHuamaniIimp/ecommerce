"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Input, Dialog, DialogContent, DialogHeader, DialogTitle } from "@nrivera-iimp/ui-kit-iimp";
import { Search, Eye, FileText } from "lucide-react";
import { Pagination } from "@/components/shared/pagination";
import { authService } from "@/lib/api/services/auth-service";
import { maestraService } from "@/lib/api/services/maestra-service";
import { ESTADOS_STAND, MAESTRA_TABLAS, ESTADOS_STAND_MAESTRA_ID } from "@/lib/constants";

interface ReservaRow {
  id: string;
  standCode: string;
  tipoStand: string | null;
  medidas: string | null;
  estado: string | null;
  empresa: string | null;
  bloqueId: string | null;
  documentos: string[];
  imagenes: string[];
  updatedAt: string;
}

export function ReservasManager({ eventoId }: { eventoId: string }) {
  const [rows, setRows] = useState<ReservaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<ReservaRow | null>(null);
  const [imgCarousel, setImgCarousel] = useState<{ images: string[]; idx: number } | null>(null);
  const [hasPermiso, setHasPermiso] = useState(false);
  const [estadoLabels, setEstadoLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    maestraService.listar(MAESTRA_TABLAS.STAND_ESTADO).then((items) => {
      const map: Record<string, string> = {};
      for (const item of items) {
        if (item.itemId !== null) {
          map[String(item.itemId)] = item.nombre;
        }
      }
      for (const [key, itemId] of Object.entries(ESTADOS_STAND_MAESTRA_ID)) {
        if (map[String(itemId)]) {
          map[key] = map[String(itemId)];
        }
      }
      setEstadoLabels(map);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      const session = await authService.getSession();
      setHasPermiso(session.permissions?.includes("read:reservas") ?? false);
    })();
  }, []);

  const load = async (p?: number, s?: string) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        eventoId,
        estado: ESTADOS_STAND.EN_EVALUACION,
        page: String(p ?? page),
        per_page: String(perPage),
      });
      if (s) qs.set("search", s);

      const res = await fetch(`/api/gess/listar?${qs.toString()}`, { credentials: "include" });
      const json = await res.json() as { data: ReservaRow[]; pagination: { page: number; total: number; total_pages: number } };
      setRows(json.data ?? []);
      setPagination({ page: json.pagination.page, total: json.pagination.total, totalPages: json.pagination.total_pages });
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [eventoId]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Solicitudes de reserva ({pagination.total})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-xs">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); load(1, e.currentTarget.value); } }}
              className="pl-8 text-xs h-8" />
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No hay solicitudes de reserva pendientes.</p>
              <p className="text-xs text-muted-foreground mt-1">Cuando un expositor solicite una reserva desde el plano interactivo, aparecera aqui.</p>
            </div>
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
                      <TableHead className="hidden sm:table-cell"><span>Docs</span></TableHead>
                      <TableHead className="hidden md:table-cell"><span>Fecha</span></TableHead>
                      <TableHead className="text-right"><span>Accion</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs font-medium">{row.standCode}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{row.bloqueId ?? "—"}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs">{row.tipoStand ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="default" className="text-[10px] bg-amber-100 text-amber-800 border-amber-200">
                            <span>{estadoLabels[row.estado ?? ""] ?? estadoLabels[ESTADOS_STAND.EN_EVALUACION]}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell max-w-[140px] truncate text-xs text-muted-foreground" title={row.empresa ?? ""}>
                          {row.empresa ?? "—"}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">
                          {row.documentos?.length ?? 0} doc(s)
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {formatDate(row.updatedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {hasPermiso && (
                            <Button variant="outline" size="sm" className="h-7 text-xs"
                              onClick={() => { setDetailRow(row); setDetailOpen(true); }}>
                              <Eye className="mr-1 h-3 w-3" />
                              <span>Ver</span>
                            </Button>
                          )}
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
                  onPageChange={(p) => { setPage(p); load(p, search); }}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle><span>Detalle de reserva</span></DialogTitle>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-3 text-xs">
                <div><span className="text-muted-foreground">Stand:</span> <span className="font-mono font-medium">{detailRow.standCode}</span></div>
                <div><span className="text-muted-foreground">Bloque:</span> <span className="font-mono">{detailRow.bloqueId ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Tipo:</span> <span>{detailRow.tipoStand ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Precio:</span> <span>{detailRow.medidas ?? "—"}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Empresa:</span> <span>{detailRow.empresa ?? "—"}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Fecha solicitud:</span> <span>{formatDate(detailRow.updatedAt)}</span></div>
              </div>

              {detailRow.imagenes.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Imagenes ({detailRow.imagenes.length})</p>
                  <div className="flex gap-1.5">
                    {detailRow.imagenes.slice(0, 4).map((url, i) => (
                      <button key={i}
                        className="h-14 w-14 overflow-hidden rounded border hover:opacity-80 transition-opacity"
                        onClick={() => setImgCarousel({ images: detailRow.imagenes, idx: i })}>
                        <img src={url} className="h-full w-full object-cover" />
                      </button>
                    ))}
                    {detailRow.imagenes.length > 4 && (
                      <span className="flex h-14 w-14 items-center justify-center rounded border bg-muted text-xs text-muted-foreground">
                        +{detailRow.imagenes.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {detailRow.documentos.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Documentos ({detailRow.documentos.length})</p>
                  <div className="space-y-0.5 rounded-md border p-2">
                    {detailRow.documentos.map((url, i) => (
                      <a key={i} href={url} target="_blank" className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs text-primary hover:bg-primary/5 transition-colors">
                        <FileText className="h-3 w-3" />
                        <span className="truncate">{url.split("/").pop()}</span>
                        <Eye className="ml-auto h-3 w-3 opacity-50" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {imgCarousel && (
        <Dialog open={true} onOpenChange={() => setImgCarousel(null)}>
          <DialogContent className="sm:max-w-2xl bg-black/90 border-slate-700">
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 z-10"
              onClick={() => setImgCarousel((prev) => prev ? { ...prev, idx: Math.max(0, prev.idx - 1) } : null)}
              disabled={imgCarousel.idx === 0}
            >
              <span className="text-lg">‹</span>
            </button>
            <img src={imgCarousel.images[imgCarousel.idx]} className="max-h-[70vh] w-full object-contain" />
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 z-10"
              onClick={() => setImgCarousel((prev) => prev ? { ...prev, idx: Math.min(prev.images.length - 1, prev.idx + 1) } : null)}
              disabled={imgCarousel.idx === imgCarousel.images.length - 1}
            >
              <span className="text-lg">›</span>
            </button>
            <p className="text-center text-xs text-white/60">{imgCarousel.idx + 1} / {imgCarousel.images.length}</p>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
