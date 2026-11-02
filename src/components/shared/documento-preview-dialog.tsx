"use client";

import { Download, ExternalLink } from "lucide-react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@nrivera-iimp/ui-kit-iimp";

/** Formato del documento segun su extension (sin query string). */
function tipoPreview(url: string): "pdf" | "imagen" | "otro" {
  const limpio = url.split("?")[0]?.toLowerCase() ?? "";
  if (limpio.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|webp|gif|bmp)$/.test(limpio)) return "imagen";
  return "otro";
}

interface Props {
  documento: { url: string; nombre: string } | null;
  onClose: () => void;
}

/**
 * Vista previa de un documento en un modal de la misma vista (PDF o imagen),
 * con acciones para descargarlo o abrirlo en otra pestaña.
 */
export function DocumentoPreviewDialog({ documento, onClose }: Props) {
  return (
    <Dialog open={!!documento} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-6 text-sm font-semibold"><span>{documento?.nombre ?? ""}</span></DialogTitle>
        </DialogHeader>
        {documento && (
          <div className="space-y-3">
            {tipoPreview(documento.url) === "pdf" && (
              <iframe
                src={documento.url}
                title={documento.nombre}
                className="h-[65vh] w-full rounded-lg border border-border bg-white"
              />
            )}
            {tipoPreview(documento.url) === "imagen" && (
              <img
                src={documento.url}
                alt={documento.nombre}
                className="mx-auto max-h-[65vh] rounded-lg border border-border object-contain"
              />
            )}
            {tipoPreview(documento.url) === "otro" && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                <span>Vista previa no disponible para este formato. Descárgalo o ábrelo en otra pestaña.</span>
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" className="text-xs" asChild>
                <a href={documento.url} download={documento.nombre}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  <span>Descargar</span>
                </a>
              </Button>
              <Button size="sm" className="text-xs" asChild>
                <a href={documento.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  <span>Abrir en otra pestaña</span>
                </a>
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
