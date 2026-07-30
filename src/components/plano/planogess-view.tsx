"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@nrivera-iimp/ui-kit-iimp";
import { gessService } from "@/lib/api/services/gess-service";

type PlanogessRow = Record<string, unknown>;

interface Props {
  tipoEvento: number;
  codigoEvento: number;
}

const COL_LABELS: Record<string, string> = {
  STANDID: "ID",
  STAND: "Stand",
  TIPO_STAND: "Tipo",
  MEDIDAS: "Medidas",
  ESTADO: "Estado",
  EMPRESA: "Empresa",
  NOMBRE: "Nombre",
  UBICACION: "Ubicacion",
  PABELLON: "Pabellon",
};

function renderCell(key: string, value: unknown) {
  if (value === null || value === undefined) return "—";
  if (key === "ESTADO") {
    const v = String(value).toLowerCase();
    const variant = v === "disponible" ? "default" : v === "reservado" ? "destructive" : "secondary";
    return <Badge variant={variant}><span>{String(value)}</span></Badge>;
  }
  return String(value);
}

export function PlanogessView({ tipoEvento, codigoEvento }: Props) {
  const [data, setData] = useState<PlanogessRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const json = await gessService.fetchFromApi(tipoEvento, codigoEvento);
        if (!cancelled) setData(Array.isArray(json) ? json as PlanogessRow[] : []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tipoEvento, codigoEvento]);

  const columns = data && data.length > 0
    ? Object.keys(data[0]).filter((k) => typeof data[0][k] !== "object")
    : null;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground"><span>Cargando datos del plano...</span></p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    const is404 = error.includes("404") || error.includes("respondio con 404");
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16">
          <p className="text-sm font-semibold text-muted-foreground">
            {is404 ? "Este evento no tiene datos en KBEventos" : "Error al cargar datos"}
          </p>
          <p className="text-xs text-muted-foreground">{is404 ? "El API externo no tiene planos configurados para este tipo y codigo de evento." : error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!columns || data!.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground"><span>Sin datos para este evento.</span></p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle><span>Stands del plano ({data!.length})</span></CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-semibold uppercase text-muted-foreground">
                {columns.map((col) => (
                  <th key={col} className="whitespace-nowrap p-2">{COL_LABELS[col] ?? col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data!.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                  {columns.map((col) => (
                    <td key={col} className="whitespace-nowrap p-2 text-xs">
                      {renderCell(col, row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
