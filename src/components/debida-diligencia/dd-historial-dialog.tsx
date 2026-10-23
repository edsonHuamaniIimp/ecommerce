"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from "@nrivera-iimp/ui-kit-iimp";
import { AlertCircle, History } from "lucide-react";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import { dateUtils } from "@/lib/shared/utils/date";
import {
  DD_ESTADO_LABELS,
  DD_HISTORIAL_TIPOS,
  DD_OBSERVACION_ESTADOS,
} from "@/lib/shared/constants";
import type { DdHistorialResponseDTO } from "@/types/dto/debida-diligencia";

interface Props {
  expedienteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Linea de tiempo compartida por cliente, Logistica y Legal. */
export function DdHistorialDialog({ expedienteId, open, onOpenChange }: Props) {
  const [resultado, setResultado] = useState<{
    expedienteId: string;
    data: DdHistorialResponseDTO | null;
    error: boolean;
  } | null>(null);

  useEffect(() => {
    if (!open || !expedienteId) return;
    let activo = true;
    debidaDiligenciaService
      .historial(expedienteId)
      .then((data) => {
        if (activo) setResultado({ expedienteId, data, error: false });
      })
      .catch(() => {
        if (activo) setResultado({ expedienteId, data: null, error: true });
      });
    return () => {
      activo = false;
    };
  }, [open, expedienteId]);

  const historial = resultado?.expedienteId === expedienteId ? resultado.data : null;
  const loading = open && Boolean(expedienteId) && resultado?.expedienteId !== expedienteId;
  const error = resultado?.expedienteId === expedienteId && resultado.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <History className="h-4 w-4 text-primary" />
            <span>Historial del expediente</span>
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Observaciones, subsanaciones y decisiones registradas durante la evaluación.
        </p>
        {loading ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>No se pudo cargar el historial. Intenta nuevamente.</AlertDescription>
          </Alert>
        ) : !historial || historial.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <History className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-xs text-muted-foreground">
              Aún no hay movimientos registrados para este expediente.
            </p>
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {historial.items.map((item) => {
              const esObservacion = item.tipo === DD_HISTORIAL_TIPOS.OBSERVACION;
              const pendiente = esObservacion && item.estado === DD_OBSERVACION_ESTADOS.ABIERTA;
              return (
                <div key={item.id} className="relative rounded-lg border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={pendiente ? "border-warning/50 text-warning" : "text-muted-foreground"}
                    >
                      {item.tipoLabel}
                    </Badge>
                    {item.areaLabel ? (
                      <span className="text-[11px] font-medium text-muted-foreground">{item.areaLabel}</span>
                    ) : null}
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {dateUtils.formatDateTime(item.fecha)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-foreground">{item.titulo}</p>
                  {item.detalle ? (
                    <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{item.detalle}</p>
                  ) : null}
                  {item.documentoTitulo ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Documento: {item.documentoTitulo}
                    </p>
                  ) : null}
                  {esObservacion ? (
                    <p className={`mt-2 text-[11px] font-medium ${pendiente ? "text-warning" : "text-success"}`}>
                      {pendiente
                        ? "Pendiente de corrección"
                        : item.fechaResolucion
                          ? `Resuelta el ${dateUtils.format(item.fechaResolucion)}`
                          : "Resuelta"}
                    </p>
                  ) : item.estado ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Estado: {DD_ESTADO_LABELS[item.estado] ?? item.estado}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
