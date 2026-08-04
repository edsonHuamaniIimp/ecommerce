"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Input } from "@nrivera-iimp/ui-kit-iimp";
import { Search, RefreshCw } from "lucide-react";
import { Pagination } from "@/components/shared/pagination";
import { gessService } from "@/lib/api/services/gess-service";
import { Tooltip, TooltipTrigger, TooltipContent } from "@nrivera-iimp/ui-kit-iimp";

type PlanogessRow = Record<string, unknown>;

interface Props {
  tipoEvento: number;
  codigoEvento: number;
}

const PER_PAGE = 15;

export function PlanogessView({ tipoEvento, codigoEvento }: Props) {
  const [allData, setAllData] = useState<PlanogessRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await gessService.fetchFromApi(tipoEvento, codigoEvento);
      setAllData(Array.isArray(json) ? json as PlanogessRow[] : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tipoEvento, codigoEvento]);

  const columns = useMemo(() => {
    if (!allData || allData.length === 0) return null;
    const first = allData[0];
    return Object.keys(first).filter((k) => typeof first[k] !== "object");
  }, [allData]);

  const filtered = useMemo(() => {
    if (!allData || !columns) return [];
    if (!search.trim()) return allData;
    const term = search.toLowerCase();
    return allData.filter((row) =>
      columns.some((col) => String(row[col] ?? "").toLowerCase().includes(term))
    );
  }, [allData, columns, search]);

  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const renderCell = (key: string, value: unknown) => {
    if (value === null || value === undefined) return "—";
    if (key === "status" || key === "estado" || key === "ESTADO" || key === "Estado") {
      const v = String(value).toLowerCase();
      return (
        <Badge variant="default" className={`text-[10px] ${
          v === "disponible" || v === "available" ? "bg-green-100 text-green-800 border-green-200"
          : v === "reservado" || v === "reserved" ? "bg-red-100 text-red-800 border-red-200"
          : "bg-slate-100 text-slate-600 border-slate-200"
        }`}>
          {String(value)}
        </Badge>
      );
    }
    if (key === "precio" || key === "monto" || key === "y") {
      const num = Number(value);
      if (!isNaN(num) && num > 0) return `USD ${num.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    }
    return String(value);
  };

  const columnLabel = (col: string) => col.charAt(0).toUpperCase() + col.slice(1).replace(/_/g, " ");

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">Cargando datos del plano...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    const is404 = error.includes("404");
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16">
          <p className="text-sm font-semibold text-slate-600">
            {is404 ? "Sin datos en KBEventos" : "Error al cargar datos"}
          </p>
          <p className="text-xs text-muted-foreground">
            {is404 ? "El API externo no tiene planos para este tipo/codigo de evento." : error}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!columns || filtered.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">
            {search ? "Sin resultados para tu busqueda." : "Sin datos para este evento."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Stands del plano ({filtered.length})</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={load} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent><span>Recargar</span></TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-8"
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col} className="whitespace-nowrap text-[10px] uppercase">
                    {columnLabel(col)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col} className="whitespace-nowrap text-xs">
                      {renderCell(col, row[col])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {filtered.length} resultados — pagina {page} de {totalPages}
          </span>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      </CardContent>
    </Card>
  );
}
