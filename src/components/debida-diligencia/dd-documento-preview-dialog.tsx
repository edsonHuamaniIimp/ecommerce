"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@nrivera-iimp/ui-kit-iimp";
import { ExternalLink } from "lucide-react";
import { archivoUtils } from "@/lib/shared/utils/archivo";
import type { DdEvidenciaDetalle } from "@/lib/shared/utils/dd-evidencia-detalles";

interface Props {
  documento: { url: string; nombre: string; mimeType?: string | null; detalles?: DdEvidenciaDetalle[] } | null;
  onClose: () => void;
}

/** Vista previa inline del documento cargado (PDF o imagen). */
export function DdDocumentoPreviewDialog({ documento, onClose }: Props) {
  const esPdf =
    archivoUtils.esPdf(documento?.url) ||
    Boolean(documento?.mimeType?.toLowerCase().includes("pdf"));

  return (
    <Dialog open={Boolean(documento)} onOpenChange={(valor) => { if (!valor) onClose(); }}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base font-semibold">Vista previa del documento</DialogTitle>
          <p className="truncate text-xs text-muted-foreground">{documento?.nombre}</p>
        </DialogHeader>

        {documento?.detalles && documento.detalles.length > 0 ? (
          <dl className="grid gap-x-4 gap-y-2 rounded-lg border border-border bg-card px-3 py-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {documento.detalles.map((detalle) => (
              <div key={detalle.etiqueta} className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{detalle.etiqueta}</dt>
                <dd className="truncate text-xs font-medium text-foreground" title={detalle.valor}>{detalle.valor}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {documento ? (
          <div className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-secondary/30">
            {esPdf ? (
              <iframe
                src={documento.url}
                title={documento.nombre}
                className="h-[68vh] w-full"
              />
            ) : (
              <img
                src={documento.url}
                alt={documento.nombre}
                className="mx-auto max-h-[68vh] w-auto"
              />
            )}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            <span>Cerrar</span>
          </Button>
          <Button asChild size="sm" className="gap-1.5">
            <a href={documento?.url ?? "#"} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Abrir en nueva pestaña</span>
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
