"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { Search, RefreshCw } from "lucide-react";
import { Pagination } from "@/components/shared/pagination";
import { Tooltip, TooltipTrigger, TooltipContent } from "@nrivera-iimp/ui-kit-iimp";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { gessService } from "@/lib/client/api/services/gess-service";
import { ESTADOS_STAND, BADGE_STYLES } from "@/lib/shared/constants";
import type { GessStandDTO } from "@/types/dto/gess/gess-stand.dto";

export function DatosEventoManager({ eventoId }: { eventoId: string }) {
  const [rows, setRows] = useState<GessStandDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  const load = async (p?: number, pp?: number, s?: string) => {
    setLoading(true);
    try {
      const result = await gessService.list(eventoId, { page: p ?? page, per_page: pp ?? perPage, search: s });
      setRows(result.data ?? []);
      setPagination({ page: result.pagination.page, total: result.pagination.total, totalPages: result.pagination.total_pages });
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    void (async () => { await load(); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Stands del plano ({pagination.total})</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => load(page, perPage, search)} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent><span>Recargar</span></TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative max-w-xs w-full sm:w-auto sm:flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); load(1, perPage, e.currentTarget.value); } }}
              className="pl-8 text-xs h-8" />
          </div>
          <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); load(1, Number(v), search); }}>
            <SelectTrigger className="w-[70px] h-8 text-xs shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 15, 50].map((n) => (
                <SelectItem key={n} value={String(n)}><span>{n}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <TableSkeleton rows={perPage} columns={6} />
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Sin stands vinculados para este evento.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Stand</TableHead>
                    <TableHead className="hidden sm:table-cell text-[10px]">Tipo</TableHead>
                    <TableHead className="text-[10px]">Estado</TableHead>
                    <TableHead className="hidden md:table-cell text-[10px]">Empresa</TableHead>
                    <TableHead className="hidden lg:table-cell text-[10px]">Bloque</TableHead>
                    <TableHead className="hidden md:table-cell text-[10px]">Medidas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs font-medium">{r.standCode}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs">{r.tipoStand ?? "—"}</TableCell>
                      <TableCell>
                        {(() => {
                          const est = r.estado?.toLowerCase();
                          return (
                            <Badge className={`text-[10px] pointer-events-none ${
                              est === ESTADOS_STAND.DISPONIBLE ? BADGE_STYLES.SUCCESS
                              : est === ESTADOS_STAND.RESERVADO ? BADGE_STYLES.DESTRUCTIVE
                              : est === ESTADOS_STAND.EN_EVALUACION ? BADGE_STYLES.WARNING
                              : BADGE_STYLES.NEUTRAL
                            }`}>
                              {est === ESTADOS_STAND.EN_EVALUACION ? "En evaluacion" : est === ESTADOS_STAND.DISPONIBLE ? "Disponible" : est === ESTADOS_STAND.RESERVADO ? "Reservado" : r.estado ?? "—"}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[140px] truncate">
                        {r.empresa ?? "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs font-mono text-muted-foreground">
                        {r.bloqueId ?? "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {r.medidas ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-2 gap-2">
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
  );
}
