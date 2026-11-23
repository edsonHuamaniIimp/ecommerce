"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Textarea } from "@nrivera-iimp/ui-kit-iimp";
import { Loader2, MessageSquare } from "lucide-react";
import { limiteObservacionAdjunto } from "@/lib/shared/utils/dd-matriz-evaluacion";
import type { DdMatrizAdjuntoDTO } from "@/types/dto/debida-diligencia";

interface Props {
  evidencia: DdMatrizAdjuntoDTO;
  /** Si es null, la observacion es de solo lectura. */
  onGuardar: ((evidencia: DdMatrizAdjuntoDTO, observacion: string | null) => Promise<void>) | null;
}

/** Observacion de una evidencia: se muestra y, con permiso, se edita en linea. */
export function DdEvidenciaObservacion({ evidencia, onGuardar }: Props) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(evidencia.observacion ?? "");
  const [guardando, setGuardando] = useState(false);
  const limite = limiteObservacionAdjunto(evidencia.categoria);

  if (!editando) {
    if (!evidencia.observacion && !onGuardar) return null;
    return (
      <div className="mt-0.5 min-w-0">
        {evidencia.observacion ? (
          <p
            className="line-clamp-3 whitespace-pre-wrap break-words text-[10px] text-muted-foreground"
            title={evidencia.observacion}
          >
            {evidencia.observacion}
          </p>
        ) : null}
        {onGuardar ? (
          <button
            type="button"
            onClick={() => {
              setTexto(evidencia.observacion ?? "");
              setEditando(true);
            }}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
          >
            <MessageSquare className="h-3 w-3" />
            <span>{evidencia.observacion ? "Editar observación" : "Agregar observación"}</span>
          </button>
        ) : null}
      </div>
    );
  }

  const guardar = async () => {
    if (!onGuardar) return;
    setGuardando(true);
    try {
      await onGuardar(evidencia, texto.trim() || null);
      setEditando(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la observación");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mt-1 w-full min-w-[240px] space-y-1">
      <Textarea
        value={texto}
        onChange={(event) => setTexto(event.target.value.slice(0, limite))}
        maxLength={limite}
        placeholder="Observación sobre esta evidencia"
        className="min-h-20 text-xs"
        aria-label={`Observación de ${evidencia.nombre}`}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">
          {texto.length}/{limite}
        </span>
        <div className="flex gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px]"
            disabled={guardando}
            onClick={() => setEditando(false)}
          >
            <span>Cancelar</span>
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-6 gap-1 px-2 text-[10px]"
            disabled={guardando}
            onClick={() => {
              void guardar();
            }}
          >
            {guardando ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            <span>Guardar</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
