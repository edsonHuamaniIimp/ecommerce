"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Tabs, TabsContent, TabsList, TabsTrigger, Checkbox, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Input, Popover, PopoverContent, PopoverTrigger, Label } from "@nrivera-iimp/ui-kit-iimp";
import { Search, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Pagination } from "@/components/shared/pagination";
import { getPlano, requirePlano } from "@/lib/shared/planos/registry";
import { gessService } from "@/lib/client/api/services/gess-service";
import { planosService } from "@/lib/client/api/services/planos-service";
import { ESTADOS_STAND, BADGE_STYLES } from "@/lib/shared/constants";
import { stringUtils } from "@/lib/shared/utils/string";
import { mapGessStandFromDTO, type GessStandDomain } from "@/lib/shared/mappers/gess-mapper";

type ApiRow = Record<string, unknown>;

interface GessStandRow extends GessStandDomain {
  createdAt: string;
}

interface BloqueEvento {
  bloqueId: string;
  tipoCodigo: string;
  tipologia: string | null;
  plano: string;
  planoNombre: string;
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

interface StandOpcion {
  id: string;
  label: string;
  /** Texto plano por el que filtra el buscador (pabellon, numero, tipo, precio). */
  busqueda: string;
}

/**
 * Selector de stand de la BD con filtro propio: buscador controlado (Input del kit),
 * coincidencia sin acentos y tope de resultados visibles hasta que se escribe.
 * Se compone con Popover/Button/Input del UI Kit para no romper el estilo.
 */
function StandPicker({ opciones, seleccionadoLabel, onSelect }: {
  opciones: StandOpcion[];
  seleccionadoLabel: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filtro, setFiltro] = useState("");
  const VISIBLES_MAX = 60;

  const filtradas = useMemo(() => {
    const clave = stringUtils.claveComparacion(filtro);
    if (!clave) return opciones;
    return opciones.filter((o) => stringUtils.claveComparacion(o.busqueda).includes(clave));
  }, [opciones, filtro]);

  const visibles = filtradas.slice(0, VISIBLES_MAX);

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setFiltro(""); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" role="combobox" aria-expanded={open} className="w-[260px] justify-between font-normal">
          <span className="truncate text-xs">{seleccionadoLabel ?? "Buscar stand..."}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <div className="border-b p-2">
          <Input
            autoFocus
            placeholder="Filtrar por pabellon, numero, tipo o precio..."
            value={filtro}
            onChange={(e) => { setFiltro(e.target.value); }}
            className="h-8 text-xs"
          />
        </div>
        <div className="max-h-[260px] overflow-y-auto p-1">
          <Button variant="ghost" size="sm" className="h-7 w-full justify-start px-2 text-xs" onClick={() => { onSelect(null); setOpen(false); }}>
            <span>— Sin vincular —</span>
          </Button>
          {visibles.map((o) => (
            <Button key={o.id} variant="ghost" size="sm" className="h-7 w-full justify-start px-2 text-xs font-normal" onClick={() => { onSelect(o.id); setOpen(false); }}>
              <span className="truncate">{o.label}</span>
            </Button>
          ))}
          {filtradas.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground"><span>Sin resultados</span></p>
          )}
          {filtradas.length > VISIBLES_MAX && (
            <p className="px-2 py-2 text-center text-[10px] text-muted-foreground">
              <span>{filtradas.length - VISIBLES_MAX} resultados mas — escribe para acotar</span>
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function GessMantenedor({ eventoId, tipoEvento, codigoEvento, plano: planoId }: Props) {
  const planoFallback = getPlano(planoId) ?? requirePlano("gess");
  const [bloquesEvento, setBloquesEvento] = useState<BloqueEvento[]>([]);
  const [bloquesCargados, setBloquesCargados] = useState(false);

  // Carga TODOS los bloques de los planos del evento (macro + pabellones hijos, o simple)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const planes = await planosService.planosDeEvento(tipoEvento, codigoEvento);
        const items: BloqueEvento[] = [];
        for (const p of planes) {
          for (const b of p.bloques) {
            items.push({ bloqueId: b.bloqueId, tipoCodigo: b.tipoCodigo, tipologia: b.tipologia, plano: p.codigo, planoNombre: p.nombre ?? getPlano(p.codigo)?.nombre ?? p.codigo });
          }
        }
        if (!cancelled) setBloquesEvento(items);
      } catch { /* fallback al registro en codigo */ }
      if (!cancelled) setBloquesCargados(true);
    })();
    return () => { cancelled = true; };
  }, [tipoEvento, codigoEvento]);

  const BLOQUE_IDS = useMemo(
    () => (bloquesCargados && bloquesEvento.length > 0 ? bloquesEvento.map((b) => b.bloqueId) : [...planoFallback.bloqueIds]),
    [bloquesCargados, bloquesEvento, planoFallback],
  );
  const PER_PAGE = 15;

  const bloqueLabel = (id: string): string => {
    const b = bloquesEvento.find((x) => x.bloqueId === id);
    if (b) return `[${b.plano}] ${b.tipoCodigo}${b.tipologia ? ` · Tip.${b.tipologia}` : ""}`;
    const labels = planoFallback.blockLabel;
    const prefix = Object.keys(labels).find((p) => id.startsWith(p));
    const entry = prefix ? labels[prefix] : undefined;
    return entry ? entry.nombre : "Bloque";
  };

  const [apiRows, setApiRows] = useState<ApiRow[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiSelected, setApiSelected] = useState<Set<number>>(new Set());
  const [apiError, setApiError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [dbRows, setDbRows] = useState<GessStandRow[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [pabellonesSel, setPabellonesSel] = useState<Set<string>>(new Set());

  const pabellones = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const b of bloquesEvento) {
      if (!vistos.has(b.plano)) vistos.set(b.plano, b.planoNombre);
    }
    return [...vistos].map(([codigo, nombre]) => ({ codigo, nombre }));
  }, [bloquesEvento]);

  const togglePabellon = (codigo: string) => {
    setPabellonesSel((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo); else next.add(codigo);
      return next;
    });
    setPage(1);
  };

  const limpiarPabellones = () => {
    setPabellonesSel(new Set());
    setPage(1);
  };

  /** Claves normalizadas de los pabellones seleccionados (para emparejar con el nombre del API). */
  const clavesPabellonSel = useMemo(
    () => pabellones.filter((p) => pabellonesSel.has(p.codigo)).map((p) => stringUtils.claveComparacion(p.nombre)),
    [pabellones, pabellonesSel],
  );

  /** plano(codigo) por bloque, para filtrar los bloques por los pabellones seleccionados. */
  const planoDeBloque = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of bloquesEvento) m.set(b.bloqueId, b.plano);
    return m;
  }, [bloquesEvento]);

  /**
   * Candidatos para vincular un bloque: sin vinculo previo o ya vinculados al bloque.
   * Si hay pabellones filtrados, se acotan a los stands de esos pabellones (la API los agrupa asi);
   * el combobox sigue permitiendo buscar por numero/tipo/precio.
   */
  const opcionesParaBloque = (bloqueId: string): GessStandRow[] => {
    const base = dbRows.filter((row) => !row.bloqueId || row.bloqueId === bloqueId);
    if (clavesPabellonSel.length === 0) return base;
    const delFiltro = base.filter((row) => clavesPabellonSel.includes(stringUtils.claveComparacion(row.pabellon)));
    return delFiltro.length > 0 ? delFiltro : base;
  };

  const importadosApiIds = useMemo(() => new Set(dbRows.map((r) => r.standApiId)), [dbRows]);

  /** Indices del API aun no importados (los "Ya importado" no se pueden seleccionar). */
  const selectableApiIdxs = useMemo(
    () => apiRows.map((row, i) => ({ row, i })).filter(({ row }) => !importadosApiIds.has(getId(row))).map(({ i }) => i),
    [apiRows, importadosApiIds],
  );

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
    if (!first) return [];
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
      setApiError(msg.includes("404") ? "Este evento no existe en el API de stands del IIMP." : msg);
    } finally {
      setApiLoading(false);
    }
  }, [tipoEvento, codigoEvento]);

  const toggleApiSelect = (idx: number) => {
    const row = apiRows[idx];
    if (!row || importadosApiIds.has(getId(row))) return;
    setApiSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const selectAllApi = () => {
    if (selectableApiIdxs.length > 0 && apiSelected.size === selectableApiIdxs.length) {
      setApiSelected(new Set());
    } else {
      setApiSelected(new Set(selectableApiIdxs));
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
      setDbRows(list.map((dto) => ({ ...mapGessStandFromDTO(dto), createdAt: dto.createdAt })));
    } catch (err) {
      setDbError(err instanceof Error ? err.message : "Error al cargar BD");
    } finally {
      setDbLoading(false);
    }
  }, [eventoId]);

  useEffect(() => { loadDb(); }, [loadDb]);

  const handleVincular = async (bloqueId: string, gessStandId: string | null) => {
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
    }
  };

  const vinculados = dbRows.filter((r) => r.bloqueId).length;

  const bloquesDelPabellon = useMemo(() => {
    if (pabellonesSel.size === 0) return BLOQUE_IDS;
    return BLOQUE_IDS.filter((bid) => {
      const plano = planoDeBloque.get(bid);
      return plano ? pabellonesSel.has(plano) : false;
    });
  }, [pabellonesSel, BLOQUE_IDS, planoDeBloque]);

  const filteredBloques = useMemo(() => {
    if (!search.trim()) return bloquesDelPabellon;
    const term = search.toLowerCase();
    return bloquesDelPabellon.filter((bid) => {
      const linked = bloqueMap.get(bid);
      return bid.toLowerCase().includes(term)
        || (linked?.standCode?.toLowerCase().includes(term))
        || (linked?.empresa?.toLowerCase().includes(term))
        || (linked?.tipoStand?.toLowerCase().includes(term));
    });
  }, [bloquesDelPabellon, bloqueMap, search]);

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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={fetchApi} disabled={apiLoading}>
                  <span>{apiLoading ? "Cargando..." : "Cargar datos del API"}</span>
                </Button>
              </div>
              {apiRows.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" size="sm" onClick={selectAllApi} disabled={selectableApiIdxs.length === 0}>
                    <span>{selectableApiIdxs.length > 0 && apiSelected.size === selectableApiIdxs.length ? "Deseleccionar todo" : "Seleccionar todo"}</span>
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {apiSelected.size} de {selectableApiIdxs.length} nuevos · {apiRows.length - selectableApiIdxs.length} ya importados
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Carga los stands del evento desde el API del IIMP (login + liststand). El API solo devuelve eventos con informacion cargada.</p>
            {apiError && <p className="text-sm text-muted-foreground">{apiError}</p>}

            {apiRows.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">
                          <Checkbox checked={selectableApiIdxs.length > 0 && apiSelected.size === selectableApiIdxs.length} disabled={selectableApiIdxs.length === 0} onCheckedChange={() => { selectAllApi(); }} />
                        </TableHead>
                        {apiCols.map((col) => (
                          <TableHead key={col} className="text-[10px]">{col}</TableHead>
                        ))}
                        <TableHead className="text-[10px]">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiRows.map((row, i) => {
                        const selected = apiSelected.has(i);
                        const rowId = getId(row);
                        const yaImportado = importadosApiIds.has(rowId);
                        return (
                          <TableRow key={rowId || i} className={`${selected ? "bg-primary/5" : ""} ${yaImportado ? "opacity-70" : ""}`}>
                            <TableCell>
                              <Checkbox checked={selected} disabled={yaImportado} onCheckedChange={() => { toggleApiSelect(i); }} />
                            </TableCell>
                            {apiCols.map((col) => (
                              <TableCell key={col} className="max-w-[200px] truncate text-xs">
                                <span>{formatValue(row[col])}</span>
                              </TableCell>
                            ))}
                            <TableCell>
                              {yaImportado ? (
                                <Badge variant="outline" className="text-[10px]"><span>Ya importado</span></Badge>
                              ) : (
                                <Badge variant="default" className="text-[10px]"><span>Nuevo</span></Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleImport} disabled={apiSelected.size === 0 || importing}>
                    <span>{importing ? "Importando..." : `Importar ${apiSelected.size} nuevos a BD`}</span>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {filteredBloques.length} de {BLOQUE_IDS.length} bloques 3D — {dbRows.length} registros en BD — {vinculados} vinculados
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {pabellones.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                        <span>{pabellonesSel.size === 0 ? "Todos los pabellones" : `Pabellones (${pabellonesSel.size})`}</span>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-[220px] p-2">
                      {pabellonesSel.size > 0 && (
                        <Button variant="ghost" size="sm" className="mb-1 h-7 w-full justify-start text-xs" onClick={limpiarPabellones}>
                          <span>Limpiar seleccion</span>
                        </Button>
                      )}
                      <div className="space-y-0.5">
                        {pabellones.map((p) => (
                          <div key={p.codigo} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted">
                            <Checkbox
                              id={`filtro-pab-${p.codigo}`}
                              checked={pabellonesSel.has(p.codigo)}
                              onCheckedChange={() => { togglePabellon(p.codigo); }}
                            />
                            <Label htmlFor={`filtro-pab-${p.codigo}`} className="cursor-pointer text-xs font-normal">
                              <span>{p.nombre}</span>
                            </Label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                <div className="relative max-w-xs">
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="pl-8 text-xs h-8" />
                </div>
              </div>
            </div>
            {dbLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground"><span>Cargando...</span></p>
            ) : dbError ? (
              <p className="py-8 text-center text-sm text-destructive">{dbError}</p>
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
                              <StandPicker
                                opciones={opcionesParaBloque(bid).map((row) => ({
                                  id: row.id,
                                  label: `${row.pabellon ? `${row.pabellon} · ` : ""}${row.standCode} · ${row.tipoStand ?? "—"} · ${row.medidas ?? "—"}`,
                                  busqueda: `${row.pabellon ?? ""} ${row.standCode} ${row.tipoStand ?? ""} ${row.medidas ?? ""} ${row.id}`,
                                }))}
                                seleccionadoLabel={linked ? `${linked.standCode} · ${linked.tipoStand ?? "—"} · ${linked.medidas ?? "—"}` : null}
                                onSelect={(value) => handleVincular(bid, value)}
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
