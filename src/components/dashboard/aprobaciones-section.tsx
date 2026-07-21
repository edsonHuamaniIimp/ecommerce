"use client";

import { Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@nrivera-iimp/ui-kit-iimp";
import type { Reserva } from "@/types/reserva";
import { ESTADOS_RESERVA, AREAS_APROBACION, RESULTADOS_APROBACION } from "@/lib/constants";

interface AprobacionesSectionProps {
  reservas: Reserva[];
}

const AREA_NOMBRE: Record<string, string> = {
  [AREAS_APROBACION.LEGAL]: "Legal",
  [AREAS_APROBACION.LOGISTICA]: "Logística",
  [AREAS_APROBACION.COMUNICACION]: "Comunicacion",
};

export function AprobacionesSection({ reservas }: AprobacionesSectionProps) {
  const enProceso = reservas.filter(
    r => r.estado === ESTADOS_RESERVA.EN_APROBACION || r.estado === ESTADOS_RESERVA.REGISTRADA
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle><span>Flujo de Aprobaciones</span></CardTitle>
      </CardHeader>
      <CardContent>
        {enProceso.length === 0 ? (
          <p className="text-sm text-muted-foreground"><span>No hay reservas pendientes de aprobación.</span></p>
        ) : (
          <div className="space-y-4">
            {enProceso.map((res) => (
              <div key={res.id} className="rounded-lg border bg-muted/20 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary"><span>{res.id}</span></Badge>
                    <span className="text-sm font-medium text-slate-700">{res.empresaNombre}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {res.stands.length} stand(s) · {res.montoTotal.toLocaleString("en-US")} {res.moneda}
                  </span>
                </div>

                {/* Pipeline de aprobaciones */}
                <div className="flex items-center gap-2">
                  {res.aprobaciones.map((apr, idx) => {
                    const pendiente = apr.estado === RESULTADOS_APROBACION.PENDIENTE;
                    const aprobado = apr.estado === RESULTADOS_APROBACION.APROBADO;
                    const rechazado = apr.estado === RESULTADOS_APROBACION.RECHAZADO;
                    return (
                      <Fragment key={idx}>
                        <div
                          className={`flex min-w-0 flex-1 flex-col items-center rounded-lg border px-3 py-2 text-center ${
                            aprobado ? "border-emerald-300 bg-emerald-50" :
                            rechazado ? "border-red-300 bg-red-50" :
                            "border-slate-200 bg-white"
                          }`}
                        >
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            aprobado ? "text-emerald-600" : rechazado ? "text-red-600" : "text-slate-400"
                          }`}>
                            {AREA_NOMBRE[apr.area] ?? apr.area}
                          </span>
                          <span className={`mt-0.5 text-[11px] font-semibold ${
                            pendiente ? "text-amber-600" : aprobado ? "text-emerald-700" : "text-red-700"
                          }`}>
                            {pendiente ? "Pendiente" : aprobado ? "✓ Aprobado" : "✗ Rechazado"}
                          </span>
                        </div>
                        {idx < res.aprobaciones.length - 1 && (
                          <span className="text-[10px] text-slate-300">→</span>
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
