"use client";

import { useState, useRef } from "react";
import { Button, Label, Textarea } from "@nrivera-iimp/ui-kit-iimp";
import { FileText, Upload, Trash2, Eye } from "lucide-react";
import { uploadService } from "@/lib/client/api/services/upload-service";

interface Props {
  standCode: string;
  documentos: string[];
  onModificar: (documentos: string[], justificacion: string) => Promise<void>;
  onClose: () => void;
  sending: boolean;
  error: string | null;
}

export function ModificarSolicitudModal({ standCode, documentos: docsIniciales, onModificar, onClose, sending, error }: Props) {
  const [justificacion, setJustificacion] = useState("");
  const [documentos, setDocumentos] = useState<string[]>([...docsIniciales]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadService.subir(file);
      setDocumentos((prev) => [...prev, url]);
    } catch { /* ignore */ }
    setUploading(false);
  };

  const handleRemove = (idx: number) => {
    setDocumentos((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ===== HEADER ===== */}
      <div className="shrink-0 px-5 pt-4 pb-2 border-b border-slate-100 !pr-12">
        <h3 className="text-sm font-semibold text-slate-800">Solicitar Re-evaluacion</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Stand <span className="font-mono font-medium text-slate-700">{standCode}</span> — adjunta nuevos documentos y describe los cambios realizados.
        </p>
      </div>

      {/* ===== BODY ===== */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
        <div>
          <Label className="text-xs mb-1 block">Documentos actuales</Label>
          {documentos.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Sin documentos adjuntos.</p>
          ) : (
            <div className="space-y-1 rounded-md border p-2">
              {documentos.map((url, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs group">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <a href={url} target="_blank" className="text-primary hover:underline truncate flex-1">{url.split("/").pop()}</a>
                  <a href={url} target="_blank" className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-700"><Eye className="h-3 w-3" /></a>
                  <button className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700" onClick={() => handleRemove(i)}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }} />
          <Button variant="outline" size="sm" className="mt-2 rounded-full text-xs"
            disabled={uploading} onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1 h-3 w-3" />
            {uploading ? "Subiendo..." : "Agregar documento"}
          </Button>
        </div>

        <div>
          <Label className="text-xs mb-1 block">Justificacion de la modificacion</Label>
          <Textarea
            value={justificacion}
            onChange={(e) => setJustificacion(e.target.value)}
            placeholder="Describe que cambios realizaste y por que..."
            className="text-xs min-h-[80px]"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}
      </div>

      {/* ===== FOOTER ===== */}
      <div className="shrink-0 border-t border-slate-100 px-5 py-3">
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="outline" size="sm" className="rounded-full px-3 text-xs font-medium" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button size="sm" className="rounded-full px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700"
            disabled={sending || !justificacion.trim()}
            onClick={() => onModificar(documentos, justificacion)}>
            {sending ? "Enviando..." : "Solicitar Re-evaluacion"}
          </Button>
        </div>
      </div>
    </div>
  );
}
