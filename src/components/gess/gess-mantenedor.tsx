"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger, Combobox, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Input } from "@nrivera-iimp/ui-kit-iimp";
import { Search } from "lucide-react";
import { Pagination } from "@/components/shared/pagination";
import { getPlano } from "@/lib/shared/planos/registry";
import { gessService } from "@/lib/client/api/services/gess-service";
import { ESTADOS_STAND, BADGE_STYLES } from "@/lib/shared/constants";
import type { GessStandDomain } from "@/lib/shared/mappers/gess-mapper";

type ApiRow = Record<string, unknown>;

interface GessStandRow extends GessStandDomain {
  createdAt: string;
}

interface BloqueEvento {
  bloqueId: string;
  tipoCodigo: string;
  tipologia: string | null;
  plano: string;
}

interface Props {
  eventoId: string;
  tipoEvento: number;
  codigoEvento: number;
  plano: string;
}

function getId(row: ApiRow): string {
  return String(row.uid ?? row.UID ?? row.codigo ?? row.stand ?? row.STANDID ?? row.standId ?? row.stand_id ?? row.STAND ?? row.standCode ?? "");
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

export function GessMantenedor({ eventoId, tipoEvento, codigoEvento, plano: planoId }: Props) {
  const planoFallback = getPlano(planoId) ?? getPlano("gess")!;
  const [bloquesEvento, setBloquesEvento] = useState<BloqueEvento[]>([]);
  const [bloquesCargados, setBloquesCargados] = useState(false);

  // Carga TODOS los bloques de los planos del evento (macro + pabellones hijos, o simple)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/planos/planos-evento?tipoEvento=${tipoEvento}&codigoEvento=${codigoEvento}`);
        const json = (await res.json()) as { success?: boolean; data?: Array<{ codigo: string; bloques: Array<{ bloqueId: string; tipoCodigo: string; tipologia: string | null }> }> };
        if (json.success && json.data) {
          const items: BloqueEvento[] = [];
          for (const p of json.data) {
            for (const b of p.bloques) {
              items.push({ bloqueId: b.bloqueId, tipoCodigo: b.tipoCodigo, tipologia: b.tipologia, plano: p.codigo });
            }
          }
          if (!cancelled) setBloquesEvento(items);
        }
      } catch { /* fallback al registro en codigo */ }
      if (!cancelled) setBloquesCargados(true);
    })();
    return () => { cancelled = true; };
  }, [tipoEvento, codigoEvento]);

  const BLOQUE_IDS = bloquesCargados && bloquesEvento.length > 0 ? bloquesEvento.map((b) => b.bloqueId) : planoFallback.bloqueIds;
  const PER_PAGE = 15;

  const bloqueLabel = (id: string): string => {
    const b = bloquesEvento.find((x) => x.bloqueId === id);
    if (b) return `[${b.plano}] ${b.tipoCodigo}${b.tipologia ? ` · Tip.${b.tipologia}` : ""}`;
    const labels = planoFallback.blockLabel;
    const prefix = Object.keys(labels).find((p) => id.startsWith(p));
    return prefix ? labels[prefix].nombre : "Bloque";
  };

  const [apiRows, setApiRows] = useState<ApiRow[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiSelected, setApiSelected] = useState<Set<number>>(new Set());
  const [apiError, setApiError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [dbRows, setDbRows] = useState<GessStandRow[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const importadosApiIds = useMemo(() => new Set(dbRows.map((r) => r.standApiId)), [dbRows]);

  const bloqueMap = useMemo(() => {
    const m = new Map<string, GessStandRow>();
    for (const r of dbRows) {
      if (r.bloqueId) m.set(r.bloqueId, r);
    }
    return m;
  }, [dbRows]);

  const apiCols = useMemo(() => {
    if (apiRows.length === 0) return [];
    const first = apiRows[0];
    return Object.keys(first).filter((k) => typeof first[k] !== "object" || first[k] === null).slice(0, 6);
  }, [apiRows]);

  const fetchApi = useCallback(async () => {
    setApiLoading(true);
    setApiError(null);
    try {
      const list = await gessService.fetchFromApi(tipoEvento, codigoEvento);
      setApiRows(list);
      setApiSelected(new Set());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      setApiError(msg.includes("404") ? "Este evento no tiene datos en KBEventos." : msg);
    } finally {
      setApiLoading(false);
    }
  }, [tipoEvento, codigoEvento]);

  const handleMockup = async () => {
    setApiLoading(true);
    setApiError(null);
    try {
      const json = await gessService.mockup({ eventoId, tipoEvento, codigoEvento });
      setApiError(`Datos demo generados: ${json.creados} nuevos, ${json.actualizados} actualizados de ${json.total} (planos: ${(json.planos ?? []).join(", ")})`);
      await loadDb();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Error al generar datos demo");
    } finally {
      setApiLoading(false);
    }
  };

  const toggleApiSelect = (idx: number) => {
    setApiSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const selectAllApi = () => {
    if (apiSelected.size === apiRows.length) {
      setApiSelected(new Set());
    } else {
      setApiSelected(new Set(apiRows.map((_, i) => i)));
    }
  };

  const handleImport = async () => {
    if (apiSelected.size === 0) return;
    setImporting(true);
    setApiError(null);
    try {
      const selected = apiRows.filter((_, i) => apiSelected.has(i));
      const json = await gessService.sync({ eventoId, tipoEvento, codigoEvento, seleccionadas: selected });
      setApiSelected(new Set());
      setApiError(`Importado: ${json.creados} nuevos, ${json.actualizados} actualizados de ${json.total}`);
      await loadDb();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  };

  const loadDb = useCallback(async () => {
    setDbLoading(true);
    setDbError(null);
    try {
      const list = await gessService.all(eventoId);
      setDbRows(list as unknown as GessStandRow[]);
    } catch (err) {
      setDbError(err instanceof Error ? err.message : "Error al cargar BD");
    } finally {
      setDbLoading(false);
    }
  }, [eventoId]);

  useEffect(() => { loadDb(); }, [loadDb]);

  const handleVincular = async (bloqueId: string, gessStandId: string | null) => {
    setSaving((prev) => ({ ...prev, [bloqueId]: true }));
    try {
      const previous = bloqueMap.get(bloqueId);
      if (previous && previous.id !== gessStandId) {
        await gessService.vincular(previous.id, null);
      }
      if (gessStandId) {
        await gessService.vincular(gessStandId, bloqueId);
      }
      await loadDb();
    } catch {
      // ignore
    } finally {
      setSaving((prev) => ({ ...prev, [bloqueId]: false }));
    }
  };

  const vinculados = dbRows.filter((r) => r.bloqueId).length;

  const filteredBloques = useMemo(() => {
    if (!search.trim()) return BLOQUE_IDS;
    const term = search.toLowerCase();
    return BLOQUE_IDS.filter((bid) => {
      const linked = bloqueMap.get(bid);
      return bid.toLowerCase().includes(term)
        || (linked?.standCode?.toLowerCase().includes(term))
        || (linked?.empresa?.toLowerCase().includes(term))
        || (linked?.tipoStand?.toLowerCase().includes(term));
    });
  }, [BLOQUE_IDS, bloqueMap, search]);

  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.max(1, Math.ceil(filteredBloques.length / PER_PAGE));
  const paged = filteredBloques.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <Tabs defaultValue="paso1" className="space-y-4">
      <TabsList>
        <TabsTrigger value="paso1"><span>Paso 1 — Importar desde API</span></TabsTrigger>
        <TabsTrigger value="paso2"><span>Paso 2 — Vincular a bloques 3D</span></TabsTrigger>
      </TabsList>

      <TabsContent value="paso1">
        <Card>
          <CardHeader>
            <CardTitle><span>Importar stands desde API externo</span></CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Button onClick={fetchApi} disabled={apiLoading}>
                <span>{apiLoading ? "Cargando..." : "Cargar datos del API"}</span>
              </Button>
              <Button variant="outline" onClick={handleMockup} disabled={apiLoading}>
                <span>{apiLoading ? "Generando..." : "Generar datos demo"}</span>
              </Button>
              <p className="text-[10px] text-muted-foreground">El API solo trae datos de eventos con informacion. Para eventos sin datos (ej. PERUMIN), usa "Generar datos demo" — crea stands vinculados a los bloques de tus planos.</p>
              {apiRows.length > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={selectAllApi}>
                    <span>{apiSelected.size === apiRows.length ? "Deseleccionar todo" : "Seleccionar todo"}</span>
                  </Button>
                  <span className="text-xs text-muted-foreground">{apiSelected.size} de {apiRows.length} seleccionados</span>
                </>
              )}
            </div>
            {apiError && <p className="text-sm text-muted-foreground">{apiError}</p>}

            {apiRows.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs font-semibold uppercase text-muted-foreground">
                        <th className="w-8 p-2">
                          <input type="checkbox" checked={apiSelected.size === apiRows.length && apiRows.length > 0} onChange={selectAllApi} className="h-3.5 w-3.5" />
                        </th>
                        {apiCols.map((col) => (
                          <th key={col} className="p-2">{col}</th>
                        ))}
                        <th className="p-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiRows.map((row, i) => {
                        const selected = apiSelected.has(i);
                        const rowId = getId(row);
                        const yaImportado = importadosApiIds.has(rowId);
                        return (
                          <tr key={rowId || i} className={`border-b border-slate-100 hover:bg-slate-50 ${selected ? "bg-primary/5" : ""} ${yaImportado ? "opacity-70" : ""}`}>
                            <td className="p-2">
                              <input type="checkbox" checked={selected} onChange={() => toggleApiSelect(i)} className="h-3.5 w-3.5" />
                            </td>
                            {apiCols.map((col) => (
                              <td key={col} className="max-w-[200px] truncate p-2 text-xs">
                                <span>{formatValue(row[col])}</span>
                              </td>
                            ))}
                            <td className="p-2">
                              {yaImportado ? (
                                <Badge variant="outline" className="text-[10px]"><span>Ya importado</span></Badge>
                              ) : (
                                <Badge variant="default" className="text-[10px]"><span>Nuevo</span></Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleImport} disabled={apiSelected.size === 0 || importing}>
                    <span>{importing ? "Importando..." : `Importar ${apiSelected.size} seleccionados a BD`}</span>
                  </Button>
                </div>
              </>
            )}

            {!apiLoading && !apiError && apiRows.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                <span>Hace clic en Cargar datos del API para ver los stands disponibles.</span>
              </p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="paso2">
        <Card>
          <CardHeader>
            <CardTitle><span>Vincular bloques del plano isometrico con registros BD</span></CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {BLOQUE_IDS.length} bloques 3D — {dbRows.length} registros en BD — {vinculados} vinculados
              </p>
              <div className="relative max-w-xs">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 text-xs h-8" />
              </div>
            </div>
            {dbLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground"><span>Cargando...</span></p>
            ) : dbError ? (
              <p className="py-8 text-center text-sm text-red-600">{dbError}</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Bloque 3D</TableHead>
                        <TableHead className="text-[10px]">Tipo</TableHead>
                        <TableHead className="text-[10px]">Registro BD vinculado</TableHead>
                        <TableHead className="text-[10px]">Empresa</TableHead>
                        <TableHead className="text-[10px]">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.map((bid) => {
                        const linked = bloqueMap.get(bid);
                        return (
                          <TableRow key={bid}>
                            <TableCell className="font-mono text-xs font-bold">{bid}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{bloqueLabel(bid)}</TableCell>
                            <TableCell>
                              <Combobox
                                items={[
                                  { value: "__none__", label: "— Sin vincular —" },
                                  ...dbRows
                                    .filter((row) => !row.bloqueId || row.bloqueId === bid)
                                    .map((row) => ({
                                      value: row.id,
                                      label: `${row.standCode} · ${row.tipoStand ?? "—"} · ${row.medidas ?? "—"}`,
                                    })),
                                ]}
                                placeholder={linked ? `${linked.standCode} · ${linked.tipoStand ?? "—"} · ${linked.medidas ?? "—"}` : "Buscar stand..."}
                                emptyMessage="Sin resultados"
                                onSelect={(value) => handleVincular(bid, value === "__none__" ? null : value)}
                                className="w-[260px]"
                              />
                            </TableCell>
                            <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">{linked?.empresa ?? "—"}</TableCell>
                            <TableCell>
                              {linked?.estado ? (
                                <Badge className={`text-[10px] border pointer-events-none ${
                                  (linked.estado?.toLowerCase()) === ESTADOS_STAND.DISPONIBLE ? BADGE_STYLES.SUCCESS
                                  : (linked.estado?.toLowerCase()) === ESTADOS_STAND.RESERVADO ? BADGE_STYLES.DESTRUCTIVE
                                  : (linked.estado?.toLowerCase()) === ESTADOS_STAND.EN_EVALUACION ? BADGE_STYLES.WARNING
                                  : BADGE_STYLES.NEUTRAL
                                }`}>
                                  {linked.estado}
                                </Badge>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">
                    {filteredBloques.length} bloques — pagina {page} de {totalPages}
                  </span>
                  <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
