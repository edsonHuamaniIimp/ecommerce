"use client";

import { useRef, useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Label } from "@nrivera-iimp/ui-kit-iimp";
import { FileText, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { solicitudesService } from "@/lib/client/api/services/solicitudes-service";
import { CONTRATO_FIRMADO_EXTENSIONES, SGC_UPLOAD_ALLOWED_EXTENSIONS, SGC_UPLOAD_MAX_BYTES } from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
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
  confirmarSubida,
  subirFirmaAsociado = false,
  declararFirmantes = false,
  subirContratoAsociado = false,
  subirAnexoAsociado = false,
}: {
  solicitudId: string;
  tipo: TipoDocumentoSolicitud;
  titulo: string;
  hint?: string[];
  archivos: {
    nombre: string;
    url: string;
    uploadedBy?: string | null;
    createdAt?: string | null;
  }[];
  ctaVacio: string;
  ctaConArchivos: string;
  vacioTexto: string;
  varios?: boolean;
  onAttached: () => void;
  /** Confirma la carga antes de subir; false cancela. */
  confirmarSubida?: (archivos: File[]) => Promise<boolean>;
  /** Marca la carga como contrato firmado subido por el Asociado. */
  subirFirmaAsociado?: boolean;
  /** Antes de elegir el archivo, pregunta quien firmo (cliente / Gerencia). Solo con `subirFirmaAsociado`. */
  declararFirmantes?: boolean;
  /** Marca la carga como contrato corregido subido por el Asociado. */
  subirContratoAsociado?: boolean;
  /** Marca la carga como anexo subido por el Asociado. */
  subirAnexoAsociado?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [declaracionAbierta, setDeclaracionAbierta] = useState(false);
  const [firmadoCliente, setFirmadoCliente] = useState(false);
  const [firmadoGerencia, setFirmadoGerencia] = useState(false);
  const firmantesRef = useRef({ firmadoCliente: false, firmadoGerencia: false });
  const firmadoPorAmbos = firmadoCliente && firmadoGerencia;

  function confirmarDeclaracion() {
    firmantesRef.current = { firmadoCliente, firmadoGerencia };
    setDeclaracionAbierta(false);
    inputRef.current?.click();
  }

  function alHacerClick() {
    if (subirFirmaAsociado && declararFirmantes) {
      setFirmadoCliente(false);
      setFirmadoGerencia(false);
      setDeclaracionAbierta(true);
      return;
    }
    inputRef.current?.click();
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const seleccionados = Array.from(files);
    setSubiendo(true);
    try {
      if (confirmarSubida && !(await confirmarSubida(seleccionados))) return;
      const formatos: readonly string[] = subirFirmaAsociado
        ? CONTRATO_FIRMADO_EXTENSIONES
        : SGC_UPLOAD_ALLOWED_EXTENSIONS;
      for (const file of seleccionados) {
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
        await solicitudesService.uploadDocumento({
          solicitudId,
          url,
          nombre: file.name,
          tipo,
          subirFirmaAsociado,
          ...(subirFirmaAsociado && declararFirmantes ? firmantesRef.current : {}),
          subirContratoAsociado,
          subirAnexoAsociado,
        });
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
        <div className="mt-2 space-y-1.5">
          {archivos.map((d, i) => (
            <a
              key={i}
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-2 text-xs text-slate-700 hover:text-emerald-700"
            >
              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate font-medium">{d.nombre}</span>
                <span className="mt-0.5 block truncate text-[10px] font-normal text-slate-500">
                  Subido por {d.uploadedBy || "No registrado"}
                  {d.createdAt ? ` · ${dateUtils.formatDateTime(d.createdAt)}` : ""}
                </span>
              </span>
            </a>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple={varios}
        accept={(subirFirmaAsociado ? CONTRATO_FIRMADO_EXTENSIONES : SGC_UPLOAD_ALLOWED_EXTENSIONS)
          .map((ext) => `.${ext}`)
          .join(",")}
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button
        size="sm"
        variant="outline"
        className={`mt-2 w-full ${vacio ? "border-dashed border-amber-300 text-amber-700" : ""}`}
        disabled={subiendo}
        onClick={alHacerClick}
      >
        {subiendo ? (
          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
        ) : (
          <Paperclip className="mr-2 h-3 w-3" />
        )}
        {vacio ? ctaVacio : ctaConArchivos}
      </Button>

      <Dialog open={declaracionAbierta} onOpenChange={setDeclaracionAbierta}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Estás subiendo el contrato firmado</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Indica quién firmó el documento que vas a subir.</p>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id={`firmado-cliente-${solicitudId}`} checked={firmadoCliente} onCheckedChange={(v) => setFirmadoCliente(v === true)} />
              <Label htmlFor={`firmado-cliente-${solicitudId}`}>Firmado por el cliente</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id={`firmado-gerencia-${solicitudId}`} checked={firmadoGerencia} onCheckedChange={(v) => setFirmadoGerencia(v === true)} />
              <Label htmlFor={`firmado-gerencia-${solicitudId}`}>Firmado por Gerencia</Label>
            </div>
          </div>
          <p className="rounded-md border border-info/30 bg-info/10 px-3 py-2 text-[11px] text-muted-foreground">
            {firmadoPorAmbos
              ? "Con ambas firmas no se envía al SGC: la solicitud queda aprobada por el Asociado y el SGC, y pasa a facturación."
              : "Con una sola firma, la solicitud sigue el flujo regular: revisión del Asociado y luego envío al SGC."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclaracionAbierta(false)}>Cancelar</Button>
            <Button disabled={!firmadoCliente && !firmadoGerencia} onClick={confirmarDeclaracion}>Continuar y elegir archivo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
