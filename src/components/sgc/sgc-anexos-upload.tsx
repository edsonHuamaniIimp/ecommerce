"use client";

import { useRef, useState } from "react";
import { Button } from "@nrivera-iimp/ui-kit-iimp";
import { FileText, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { solicitudesService } from "@/lib/client/api/services/solicitudes-service";
import { ANEXOS_REQUERIDOS, TIPOS_DOCUMENTO_SOLICITUD } from "@/lib/shared/constants";

/**
 * Permite adjuntar a la solicitud los anexos requeridos por el SGC
 * (Ficha RUC, Vigencia de Poder, DNI/Pasaporte del Representante Legal).
 * Se suben a `/api/upload` y se registran como documentos tipo `anexo`
 * (userId no nulo) para que `subirAnexosDeSolicitud` los empuje al SGC.
 */
export function SgcAnexosUpload({
  solicitudId,
  anexos,
  onAttached,
}: {
  solicitudId: string;
  anexos: { nombre: string; url: string }[];
  onAttached: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setSubiendo(true);
    try {
      for (const file of Array.from(files)) {
        const url = await solicitudesService.subirArchivo(file);
        await solicitudesService.uploadDocumento({
          solicitudId,
          url,
          nombre: file.name,
          tipo: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
        });
      }
      toast.success("Anexo(s) adjuntado(s) a la solicitud");
      onAttached();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo adjuntar el anexo");
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-3 rounded-md border border-slate-200 p-3">
      <p className="text-xs font-semibold text-slate-700">Anexos requeridos</p>
      <ul className="mt-1 space-y-0.5 text-[11px] text-slate-500">
        {ANEXOS_REQUERIDOS.map((a) => (
          <li key={a.key}>· {a.label}</li>
        ))}
      </ul>

      {anexos.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {anexos.map((d, i) => (
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
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button
        size="sm"
        variant="outline"
        className="mt-2 w-full"
        disabled={subiendo}
        onClick={() => inputRef.current?.click()}
      >
        {subiendo ? (
          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
        ) : (
          <Paperclip className="mr-2 h-3 w-3" />
        )}
        Adjuntar anexos
      </Button>
    </div>
  );
}
