"use client";

import { useRef, useState } from "react";
import { Button } from "@nrivera-iimp/ui-kit-iimp";
import { FileText, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { solicitudesService } from "@/lib/client/api/services/solicitudes-service";
import { SGC_UPLOAD_ALLOWED_EXTENSIONS, SGC_UPLOAD_MAX_BYTES } from "@/lib/shared/constants";
import type { TipoDocumentoSolicitud } from "@/lib/shared/constants";

/**
 * Adjunta documentos a la solicitud (contrato del administrador o anexos).
 * Se suben a `/api/upload` y se registran en `/api/solicitudes/upload-doc` con el
 * `tipo` indicado: contrato -> `userId` null; anexo -> `userId` no nulo (para el SGC).
 */
export function SgcDocumentoUpload({
  solicitudId,
  tipo,
  titulo,
  hint,
  archivos,
  ctaVacio,
  ctaConArchivos,
  vacioTexto,
  varios = true,
  onAttached,
}: {
  solicitudId: string;
  tipo: TipoDocumentoSolicitud;
  titulo: string;
  hint?: string[];
  archivos: { nombre: string; url: string }[];
  ctaVacio: string;
  ctaConArchivos: string;
  vacioTexto: string;
  varios?: boolean;
  onAttached: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setSubiendo(true);
    try {
      const formatos = SGC_UPLOAD_ALLOWED_EXTENSIONS as readonly string[];
      for (const file of Array.from(files)) {
        const ext = (file.name.split(".").pop() ?? "").toLowerCase();
        if (!formatos.includes(ext)) {
          toast.error(`Formato no permitido (.${ext || "?"}). Admitidos: ${formatos.join(", ")}.`);
          continue;
        }
        if (file.size > SGC_UPLOAD_MAX_BYTES) {
          toast.error(`${file.name} supera el máximo de ${SGC_UPLOAD_MAX_BYTES / 1024 / 1024} MB.`);
          continue;
        }
        const url = await solicitudesService.subirArchivo(file);
        await solicitudesService.uploadDocumento({ solicitudId, url, nombre: file.name, tipo });
      }
      toast.success("Documento(s) adjuntado(s) a la solicitud");
      onAttached();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo adjuntar el documento");
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const vacio = archivos.length === 0;

  return (
    <div className="mt-3 rounded-md border border-slate-200 p-3">
      <p className="text-xs font-semibold text-slate-700">{titulo}</p>
      {hint && hint.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-[11px] text-slate-500">
          {hint.map((h, i) => (
            <li key={i}>· {h}</li>
          ))}
        </ul>
      )}

      {vacio ? (
        <p className="mt-2 text-[11px] font-medium text-amber-600">{vacioTexto}</p>
      ) : (
        <div className="mt-2 space-y-0.5">
          {archivos.map((d, i) => (
            <a
              key={i}
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-xs text-slate-700 hover:text-emerald-700"
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{d.nombre}</span>
            </a>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple={varios}
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button
        size="sm"
        variant="outline"
        className={`mt-2 w-full ${vacio ? "border-dashed border-amber-300 text-amber-700" : ""}`}
        disabled={subiendo}
        onClick={() => inputRef.current?.click()}
      >
        {subiendo ? (
          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
        ) : (
          <Paperclip className="mr-2 h-3 w-3" />
        )}
        {vacio ? ctaVacio : ctaConArchivos}
      </Button>
    </div>
  );
}
