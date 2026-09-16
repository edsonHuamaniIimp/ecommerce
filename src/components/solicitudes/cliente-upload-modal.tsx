"use client";

import { useState, useRef } from "react";
import { Button, Label, Dialog, DialogContent, DialogHeader, DialogTitle } from "@nrivera-iimp/ui-kit-iimp";
import { FileText, Upload, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { solicitudesService } from "@/lib/client/api/services/solicitudes-service";
import type { SolicitudDTO } from "@/types/dto/solicitudes/solicitudes-response.dto";

interface Props {
  solicitud: SolicitudDTO;
  onClose: () => void;
  onSaved: () => void;
}

export function ClienteUploadModal({ solicitud, onClose, onSaved }: Props) {
  const [clienteDocs, setClienteDocs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await solicitudesService.subirArchivo(file);
      setClienteDocs(prev => [...prev, url]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir");
    }
    setUploading(false);
  };

  const handleRemove = (idx: number) => {
    setClienteDocs(prev => prev.filter((_, i) => i !== idx));
  };

  const handleEnviar = async () => {
    if (clienteDocs.length === 0) return;
    setSending(true);
    setError(null);
    try {
      for (const url of clienteDocs) {
        await solicitudesService.uploadDocumento({
          solicitudId: solicitud.id,
          url,
          nombre: url.split("/").pop() ?? "documento",
        });
      }
      toast.success("Documentos enviados correctamente");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar");
    }
    setSending(false);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 px-5 pt-4 pb-2 border-b border-slate-100 !pr-12">
        <h3 className="text-sm font-semibold text-slate-800">Adjuntar documentos</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Stands: <span className="font-mono font-medium text-slate-700">{solicitud.standCodes?.join(", ")}</span>
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
        {(() => {
          const adminDocs = solicitud.docsAdjuntos?.filter(d => d.userId !== solicitud.userId) ?? [];
          const misDocs = solicitud.docsAdjuntos?.filter(d => d.userId === solicitud.userId) ?? [];
          return (
            <>
              {adminDocs.length > 0 && (
                <div>
                  <Label className="text-xs mb-1 block">Documentos del administrador</Label>
                  <div className="space-y-1 rounded-md border bg-slate-50 p-2">
                    {adminDocs.map((doc, i) => (
                      <div key={i} className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs">
                        <FileText className="h-3 w-3 text-slate-400" />
                        <a href={doc.url} target="_blank" className="text-primary hover:underline truncate flex-1">{doc.nombre}</a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs mb-1 block">Tus documentos</Label>
                {misDocs.length > 0 && (
                  <div className="space-y-1 rounded-md border p-2 mb-2">
                    {misDocs.map((doc, i) => (
                      <div key={i} className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs group">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <a href={doc.url} target="_blank" className="text-primary hover:underline truncate flex-1">{doc.nombre}</a>
                        <button className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                          onClick={() => setDeleteConfirm(doc.id)}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {clienteDocs.length > 0 && (
                  <div className="space-y-1 rounded-md border p-2 mb-2">
                    {clienteDocs.map((url, i) => (
                      <div key={i} className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs group">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate flex-1">{url.split("/").pop()}</span>
                        <button className="opacity-0 group-hover:opacity-100 text-red-500" onClick={() => handleRemove(i)}>
                          <X className="h-3 w-3" />
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
                <Button variant="outline" size="sm" className="rounded-full text-xs" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-1 h-3 w-3" />
                  {uploading ? "Subiendo..." : "Agregar documento"}
                </Button>
              </div>
            </>
          );
        })()}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-100 px-5 py-3">
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="outline" size="sm" className="rounded-full px-3 text-xs font-medium" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" className="rounded-full px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700"
            disabled={sending || clienteDocs.length === 0} onClick={handleEnviar}>
            {sending ? "Enviando..." : "Enviar documentos"}
          </Button>
        </div>
      </div>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle><span>Eliminar documento</span></DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">Estas seguro de eliminar este documento?</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1 rounded-full text-xs" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" className="flex-1 rounded-full text-xs" onClick={async () => {
              if (!deleteConfirm) return;
              try {
                await solicitudesService.eliminarDocumento(deleteConfirm);
                toast.success("Documento eliminado");
                onSaved();
                onClose();
              } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
              setDeleteConfirm(null);
            }}>Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
