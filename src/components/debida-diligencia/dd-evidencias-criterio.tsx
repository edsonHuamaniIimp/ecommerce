"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@nrivera-iimp/ui-kit-iimp";
import { FileText, MoreHorizontal } from "lucide-react";
import { DdEvidenciaPreviewButton } from "./dd-evidencia-preview-button";
import { DD_MATRIZ_EVIDENCIAS_VISIBLES } from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { ddEvidenciaDetalles } from "@/lib/shared/utils/dd-evidencia-detalles";
import type { DdMatrizAdjuntoDTO } from "@/types/dto/debida-diligencia";

interface Props {
  /** Nombre del criterio (titulo del modal con la lista completa). */
  criterio: string;
  evidencias: DdMatrizAdjuntoDTO[];
}

function Fila({ evidencia }: { evidencia: DdMatrizAdjuntoDTO }) {
  return (
    <div className="flex items-center gap-1.5">
      <a
        href={evidencia.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 items-center gap-1 text-[10px] text-primary hover:underline"
      >
        <FileText className="h-3 w-3 shrink-0" />
        <span className="max-w-[220px] truncate">{evidencia.nombre}</span>
      </a>
      <DdEvidenciaPreviewButton
        url={evidencia.url}
        nombre={evidencia.nombre}
        mimeType={evidencia.mimeType}
        detalles={ddEvidenciaDetalles.deAdjunto(evidencia)}
      />
    </div>
  );
}

/**
 * Evidencias de un criterio: muestra las primeras N y, si hay mas, un boton de tres
 * puntos que abre un modal con la lista completa (la mas reciente primero).
 */
export function DdEvidenciasCriterio({ criterio, evidencias }: Props) {
  const [abierto, setAbierto] = useState(false);

  if (evidencias.length === 0) {
    return <p className="text-[10px] text-muted-foreground">Sin evidencia cargada.</p>;
  }

  const visibles = evidencias.slice(0, DD_MATRIZ_EVIDENCIAS_VISIBLES);
  const ocultas = evidencias.length - visibles.length;
  const ordenadas = [...evidencias].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      {visibles.map((evidencia) => (
        <Fila key={evidencia.id} evidencia={evidencia} />
      ))}
      {ocultas > 0 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 gap-1 px-2 text-[10px]"
          title={`Ver las ${evidencias.length} evidencias`}
          aria-label={`Ver las ${evidencias.length} evidencias de ${criterio}`}
          onClick={() => setAbierto(true)}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
          <span>+{ocultas}</span>
        </Button>
      ) : null}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base font-semibold">Evidencias del criterio</DialogTitle>
            <p className="truncate text-xs text-muted-foreground">
              {criterio} · {evidencias.length} archivo(s)
            </p>
          </DialogHeader>
          <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {ordenadas.map((evidencia) => (
              <li key={evidencia.id} className="flex items-center justify-between gap-2 p-2.5">
                <div className="min-w-0">
                  <a
                    href={evidencia.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{evidencia.nombre}</span>
                  </a>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {evidencia.creadoPor || "—"} · {dateUtils.formatDateTime(evidencia.createdAt)}
                  </p>
                </div>
                <DdEvidenciaPreviewButton
                  url={evidencia.url}
                  nombre={evidencia.nombre}
                  mimeType={evidencia.mimeType}
                  detalles={ddEvidenciaDetalles.deAdjunto(evidencia)}
                />
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(false)}>
              <span>Cerrar</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
