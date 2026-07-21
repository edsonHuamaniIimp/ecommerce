"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger, Combobox } from "@nrivera-iimp/ui-kit-iimp";
import { BLOQUE_IDS } from "@/lib/bloques";

type ApiRow = Record<string, unknown>;

interface GessStandRow {
  id: string;
  standApiId: string;
  standCode: string;
  tipoStand: string | null;
  medidas: string | null;
  estado: string | null;
  empresa: string | null;
  pabellon: string | null;
  bloqueId: string | null;
}

interface Props {
  eventoId: string;
  tipoEvento: number;
  codigoEvento: number;
}

function getId(row: ApiRow): string {
  return String(row.STANDID ?? row.standId ?? row.stand_id ?? row.STAND ?? row.stand ?? row.standCode ?? "");
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

const BLOQUE_LABEL: Record<string, string> = {
  "EXT-IZQ": "Columna izq", "EXT-DER": "Columna der",
  "INT-IZQ-A": "Matriz izq A", "INT-IZQ-B": "Matriz izq B",
  "INT-DER": "Matriz der", "ISLA-GRANDE": "Isla grande",
};

function bloqueLabel(id: string): string {
  for (const [prefix, label] of Object.entries(BLOQUE_LABEL)) {
    if (id.startsWith(prefix)) return label;
  }
  return "Bloque";
}

export function GessMantenedor({ eventoId, tipoEvento, codigoEvento }: Props) {
  const [apiRows, setApiRows] = useState<ApiRow[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiSelected, setApiSelected] = useState<Set<number>>(new Set());
  const [apiError, setApiError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [dbRows, setDbRows] = useState<GessStandRow[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  /* -- Bloque -> GessStand lookup -- */
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
      const res = await fetch("/api/planogess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipoEvento, codigoEvento }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
      const list = Array.isArray(json) ? json as ApiRow[] : [];
      setApiRows(list);
      setApiSelected(new Set());
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Error");
    } finally {
      setApiLoading(false);
    }
  }, [tipoEvento, codigoEvento]);

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
      const res = await fetch("/api/gess/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventoId, tipoEvento, codigoEvento, seleccionadas: selected }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
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
      const res = await fetch(`/api/gess?eventoId=${eventoId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
      setDbRows(json as GessStandRow[]);
    } catch (err) {
      setDbError(err instanceof Error ? err.message : "Error al cargar BD");
    } finally {
      setDbLoading(false);
    }
  }, [eventoId]);

  useEffect(() => { loadDb(); }, [loadDb]);

  const handleVincular = async (bloqueId: string, gessStandId: string | null) => {
    if (gessStandId) {
      setSaving((prev) => ({ ...prev, [bloqueId]: true }));
      try {
        const res = await fetch("/api/gess", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: gessStandId, bloqueId }),
        });
        if (!res.ok) throw new Error("Error");
        await loadDb();
      } catch {
        // ignore
      } finally {
        setSaving((prev) => ({ ...prev, [bloqueId]: false }));
      }
    } else {
      const current = bloqueMap.get(bloqueId);
      if (!current) return;
      setSaving((prev) => ({ ...prev, [bloqueId]: true }));
      try {
        const res = await fetch("/api/gess", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: current.id, bloqueId: null }),
        });
        if (!res.ok) throw new Error("Error");
        await loadDb();
      } catch {
        // ignore
      } finally {
        setSaving((prev) => ({ ...prev, [bloqueId]: false }));
      }
    }
  };

  const vinculados = dbRows.filter((r) => r.bloqueId).length;

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
                      </tr>
                    </thead>
                    <tbody>
                      {apiRows.map((row, i) => {
                        const selected = apiSelected.has(i);
                        return (
                          <tr key={getId(row) || i} className={`border-b border-slate-100 hover:bg-slate-50 ${selected ? "bg-primary/5" : ""}`}>
                            <td className="p-2">
                              <input type="checkbox" checked={selected} onChange={() => toggleApiSelect(i)} className="h-3.5 w-3.5" />
                            </td>
                            {apiCols.map((col) => (
                              <td key={col} className="max-w-[200px] truncate p-2 text-xs">{formatValue(row[col])}</td>
                            ))}
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

      {/* ============== PASO 2 ============== */}
      <TabsContent value="paso2">
        <Card>
          <CardHeader>
            <CardTitle><span>Vincular bloques del plano isometrico con registros BD</span></CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              {BLOQUE_IDS.length} bloques 3D — {dbRows.length} registros en BD — {vinculados} vinculados
            </p>
            {dbLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground"><span>Cargando...</span></p>
            ) : dbError ? (
              <p className="py-8 text-center text-sm text-red-600">{dbError}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-semibold uppercase text-muted-foreground">
                      <th className="p-2">Bloque 3D</th>
                      <th className="p-2">Tipo</th>
                      <th className="p-2">Registro BD vinculado</th>
                      <th className="p-2">Empresa</th>
                      <th className="p-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                      {BLOQUE_IDS.map((bid) => {
                        const linked = bloqueMap.get(bid);
                        return (
                          <tr key={bid} className={`border-b border-slate-100 hover:bg-slate-50 ${linked ? "bg-emerald-50/50" : ""}`}>
                            <td className="p-2 font-mono text-xs font-bold">{bid}</td>
                            <td className="p-2 text-xs text-muted-foreground">{bloqueLabel(bid)}</td>
                            <td className="p-2">
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
                            </td>
                            <td className="max-w-[160px] truncate p-2 text-xs text-muted-foreground">{linked?.empresa ?? "—"}</td>
                            <td className="p-2">
                              {linked?.estado ? (
                                <Badge variant={linked.estado === "RESERVADO" ? "destructive" : "default"}>
                                  <span>{linked.estado}</span>
                                </Badge>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
