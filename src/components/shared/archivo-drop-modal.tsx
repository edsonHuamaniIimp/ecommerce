"use client";

import { useRef, useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@nrivera-iimp/ui-kit-iimp";
import { FileText, UploadCloud, X } from "lucide-react";
import { archivoUtils } from "@/lib/shared/utils/archivo";

interface Props {
  open: boolean;
  title: string;
  /** Extensiones permitidas, sin punto (p. ej. ["pdf", "png", "jpg"]). */
  extensionesPermitidas: readonly string[];
  maxBytes: number;
  confirmLabel?: string;
  /** Solo entrega el archivo ya validado; la subida la realiza quien lo invoca. */
  onConfirm: (file: File) => void;
  onClose: () => void;
}

/**
 * Modal transversal de carga de un archivo con drag & drop: el usuario puede
 * arrastrar el documento desde otra ventana o hacer clic para seleccionarlo.
 * Valida formato y peso antes de habilitar la confirmacion.
 */
export function ArchivoDropModal({
  open,
  title,
  extensionesPermitidas,
  maxBytes,
  confirmLabel = "Subir documento",
  onConfirm,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = extensionesPermitidas.map((extension) => `.${extension}`).join(",");
  const formatoTexto = extensionesPermitidas.map((extension) => extension.toUpperCase()).join(", ");
  const maxMb = maxBytes / 1024 / 1024;

  const seleccionar = (file: File | null | undefined) => {
    if (!file) return;
    if (!archivoUtils.extensionPermitida(file.name, extensionesPermitidas)) {
      setError(`Formato no permitido. Adjunta ${formatoTexto}.`);
      return;
    }
    if (file.size > maxBytes) {
      setError(`El archivo supera el maximo de ${maxMb} MB.`);
      return;
    }
    setError(null);
    setArchivo(file);
  };

  const cerrar = () => {
    setArchivo(null);
    setError(null);
    setArrastrando(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) cerrar(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base font-semibold"><span>{title}</span></DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          {!archivo ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastrando(false); seleccionar(e.dataTransfer.files?.[0]); }}
              className={`flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
                arrastrando ? "border-primary bg-primary/5" : "border-border bg-secondary/40 hover:border-primary/50 hover:bg-primary/5"
              }`}
            >
              <UploadCloud className={`h-7 w-7 ${arrastrando ? "text-primary" : "text-primary/70"}`} />
              <span className="text-xs font-semibold text-foreground">
                {arrastrando ? "Suelta el archivo aqui" : "Arrastra tu archivo o haz clic para seleccionarlo"}
              </span>
              <span className="text-[11px] text-muted-foreground">Formatos: {formatoTexto} - maximo {maxMb} MB</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{archivo.name}</span>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{Math.round(archivo.size / 1024)} KB</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 shrink-0 p-0"
                onClick={() => setArchivo(null)}
                title="Quitar archivo"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <span>{error}</span>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => { seleccionar(e.target.files?.[0]); e.target.value = ""; }}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" className="rounded-full px-3 text-xs font-medium" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="rounded-full px-4 text-xs font-semibold"
            disabled={!archivo}
            onClick={() => { if (archivo) { onConfirm(archivo); cerrar(); } }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
