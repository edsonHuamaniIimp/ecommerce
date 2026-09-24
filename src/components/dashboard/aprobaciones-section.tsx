"use client";

import { Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@nrivera-iimp/ui-kit-iimp";
import { GitBranch } from "lucide-react";
import type { Reserva } from "@/types/reserva";
import { ESTADOS_RESERVA, REVISION_AREAS, REVISION_AREA_LABELS, RESULTADOS_APROBACION } from "@/lib/shared/constants";
import { numberUtils } from "@/lib/shared/utils/number";

interface AprobacionesSectionProps {
  reservas: Reserva[];
}

export function AprobacionesSection({ reservas }: AprobacionesSectionProps) {
  const enProceso = reservas.filter(
    (r) => r.estado === ESTADOS_RESERVA.EN_APROBACION || r.estado === ESTADOS_RESERVA.REGISTRADA,
  );

  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <CardTitle>
          <span className="flex items-center gap-2 text-base font-bold text-primary">
            <GitBranch className="h-4 w-4 text-primary" />
            <span>Flujo de aprobaciones</span>
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Reservas pendientes de revision por {REVISION_AREA_LABELS[REVISION_AREAS.LOGISTICA]} y{" "}
          {REVISION_AREA_LABELS[REVISION_AREAS.COMUNICACION]}.
        </p>
      </CardHeader>
      <CardContent className="pt-4">
        {enProceso.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            <span>No hay reservas pendientes de aprobacion.</span>
          </p>
        ) : (
          <div className="space-y-4">
            {enProceso.map((res) => (
              <div key={res.id} className="rounded-xl border border-border bg-secondary p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className="pointer-events-none border-transparent bg-primary/10 text-primary">
                      <span>{res.id}</span>
                    </Badge>
                    <span className="text-sm font-medium text-foreground">{res.empresaNombre}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {res.stands.length} stand(s) - {numberUtils.monto(res.montoTotal, res.moneda)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {res.aprobaciones.map((apr, idx) => {
                    const pendiente = apr.estado === RESULTADOS_APROBACION.PENDIENTE;
                    const aprobado = apr.estado === RESULTADOS_APROBACION.APROBADO;
                    const rechazado = apr.estado === RESULTADOS_APROBACION.RECHAZADO;
                    return (
                      <Fragment key={idx}>
                        <div
                          className={`flex min-w-0 flex-1 flex-col items-center rounded-lg border px-3 py-2 text-center ${
                            aprobado
                              ? "border-success/30 bg-success/10"
                              : rechazado
                                ? "border-destructive/30 bg-destructive/10"
                                : "border-border bg-card"
                          }`}
                        >
                          <span
                            className={`text-[10px] font-bold tracking-wider uppercase ${
                              aprobado ? "text-success" : rechazado ? "text-destructive" : "text-muted-foreground"
                            }`}
                          >
                            {REVISION_AREA_LABELS[apr.area as keyof typeof REVISION_AREA_LABELS] ?? apr.area}
                          </span>
                          <span
                            className={`mt-0.5 text-[11px] font-semibold ${
                              pendiente ? "text-warning" : aprobado ? "text-success" : "text-destructive"
                            }`}
                          >
                            {pendiente ? "Pendiente" : aprobado ? "Aprobado" : "Rechazado"}
                          </span>
                        </div>
                        {idx < res.aprobaciones.length - 1 && (
                          <span className="text-[10px] text-muted-foreground">-</span>
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
