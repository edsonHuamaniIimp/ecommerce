"use client";

import { AlertTriangle } from "lucide-react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@nrivera-iimp/ui-kit-iimp";
import { DD_MATRIZ_TIPO_VINCULO_LABELS, type DdMatrizTipoVinculo } from "@/lib/shared/constants";
import type { ComunicacionesPendiente } from "@/lib/shared/utils/dd-matriz-evaluacion";

interface Props {
  /** Vinculos sin el veredicto de Comunicaciones sin hallazgos. */
  pendientes: ComunicacionesPendiente[];
  /** Total de vinculos del expediente. */
  total: number;
  /** "Entendido, salir": no declara APTO. */
  onCancel: () => void;
  /** "Declarar APTO de todos modos": bypass explicito. */
  onConfirm: () => void;
}

/**
 * Aviso previo a declarar APTO cuando faltan veredictos de Comunicaciones. Explica que falta y que hacer,
 * y deja elegir entre salir o continuar (bypass). Ancho amplio y cuerpo con scroll: la lista de vinculos puede ser larga.
 */
export function DdBypassComunicacionesDialog({ pendientes, total, onCancel, onConfirm }: Props) {
  const motivos = Array.from(new Set(pendientes.map((pendiente) => pendiente.motivo)));

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto) onCancel(); }}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="space-y-2 border-b border-border px-6 pb-4 pt-6 text-left">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            <span>Faltan revisiones para declarar APTO</span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            La regla general pide que Comunicaciones haya cerrado <strong className="text-foreground">sin hallazgos</strong> a
            cada vínculo antes de declarar APTO. Faltan <strong className="text-foreground">{pendientes.length}</strong> de {total}.
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {motivos.map((motivo) => {
            const grupo = pendientes.filter((pendiente) => pendiente.motivo === motivo);
            return (
              <section key={motivo} className="space-y-2 rounded-lg border border-border bg-secondary/30 p-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">
                    {motivo} <span className="font-normal text-muted-foreground">({grupo.length})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Qué hacer: {grupo[0]?.accion}</p>
                </div>
                <ul className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                  {grupo.map((pendiente) => (
                    <li key={`${pendiente.tipo}-${pendiente.nombre}`} className="min-w-0 break-words">
                      <span className="text-foreground">{pendiente.nombre}</span>{" "}
                      <span className="text-muted-foreground">
                        ({DD_MATRIZ_TIPO_VINCULO_LABELS[pendiente.tipo as DdMatrizTipoVinculo] ?? pendiente.tipo})
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="space-y-1 border-t border-border bg-secondary/20 px-6 py-3 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">Para cumplir la regla:</strong> sal y resuelve lo anterior.
          </p>
          <p>
            <strong className="text-foreground">Para continuar ahora:</strong> declara APTO de todos modos. El comentario interno
            que escribiste será el sustento y quedará registrado en la auditoría con quién lo hizo y qué vínculos faltaban.
          </p>
        </div>

        <DialogFooter className="flex-wrap gap-2 border-t border-border px-6 py-4 sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            <span>Entendido, salir</span>
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            <span>Declarar APTO de todos modos</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
