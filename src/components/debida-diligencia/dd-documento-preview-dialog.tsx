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

interface Props {
  documento: { url: string; nombre: string } | null;
  onClose: () => void;
}

/** Vista previa inline del documento cargado (PDF o imagen). */
export function DdDocumentoPreviewDialog({ documento, onClose }: Props) {
  const esPdf = archivoUtils.esPdf(documento?.url);

  return (
    <Dialog open={Boolean(documento)} onOpenChange={(valor) => { if (!valor) onClose(); }}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base font-semibold">Vista previa del documento</DialogTitle>
          <p className="truncate text-xs text-muted-foreground">{documento?.nombre}</p>
        </DialogHeader>

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
