"use client";

import { useState } from "react";
import { Button } from "@nrivera-iimp/ui-kit-iimp";
import { ExternalLink, Eye } from "lucide-react";
import { archivoUtils } from "@/lib/shared/utils/archivo";
import { DdDocumentoPreviewDialog } from "./dd-documento-preview-dialog";

interface Props {
  url: string;
  nombre: string;
  mimeType?: string | null;
}

/** Preview inline para PDF/imagen; el resto se abre en una pestaña nueva. */
export function DdEvidenciaPreviewButton({ url, nombre, mimeType }: Props) {
  const [preview, setPreview] = useState<{ url: string; nombre: string; mimeType: string | null } | null>(null);
  const tipo = mimeType?.toLowerCase() ?? "";
  const puedePrevisualizar =
    archivoUtils.esPdf(url) || tipo.includes("pdf") || tipo.startsWith("image/");

  return (
    <>
      {puedePrevisualizar ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-7 shrink-0 p-0"
          title="Vista previa"
          aria-label={`Ver vista previa de ${nombre}`}
          onClick={() => setPreview({ url, nombre, mimeType: mimeType ?? null })}
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm" className="h-7 w-7 shrink-0 p-0" title="Abrir archivo">
          <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${nombre}`}>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      )}
      <DdDocumentoPreviewDialog documento={preview} onClose={() => setPreview(null)} />
    </>
  );
}

