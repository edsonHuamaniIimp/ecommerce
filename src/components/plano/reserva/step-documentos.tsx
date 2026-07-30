"use client";

import { Button } from "@nrivera-iimp/ui-kit-iimp";
import { FileText, Eye, X, Check, Upload, Download } from "lucide-react";

interface Props {
  singleStand: boolean;
  existingDocs: string[];
  formDocs: string[];
  uploading: boolean;
  onAddDoc: (file: File) => Promise<void>;
  onRemoveDoc: (idx: number) => void;
}

function getFileName(url: string): string {
  const name = url.split("/").pop() ?? url;
  try { return decodeURIComponent(name); } catch { return name; }
}

export function StepDocumentos({ singleStand, existingDocs, formDocs, uploading, onAddDoc, onRemoveDoc }: Props) {
  if (!singleStand) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Check className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-slate-700">No se requiere adjuntar documentos</p>
        <p className="text-xs text-muted-foreground">La reserva multiple no gestiona contratos individuales por stand. Continua para confirmar.</p>
      </div>
    );
  }

  const contratosDescargables = existingDocs.filter((url) => url.endsWith(".docx") || url.endsWith(".doc"));
  const otrosDocs = existingDocs.filter((url) => !url.endsWith(".docx") && !url.endsWith(".doc"));

  return (
    <div className="flex flex-col gap-3">
      {(contratosDescargables.length > 0 || otrosDocs.length > 0) && (
        <div className="rounded-lg border bg-muted/30 p-3 text-xs">
          <p className="mb-2 font-semibold text-muted-foreground">Documentos del stand</p>
          <div className="space-y-0.5">
            {contratosDescargables.map((url, i) => (
              <a key={`c-${i}`} href={url} download className="flex items-center gap-1.5 rounded px-1 py-0.5 text-blue-700 hover:bg-blue-50 transition-colors">
                <Download className="h-3 w-3 shrink-0" />
                <span className="truncate">{getFileName(url)}</span>
              </a>
            ))}
            {otrosDocs.map((url, i) => (
              <a key={`o-${i}`} href={url} target="_blank" className="flex items-center gap-1.5 rounded px-1 py-0.5 text-primary hover:bg-primary/5 transition-colors">
                <FileText className="h-3 w-3" />
                <span className="truncate">{getFileName(url)}</span>
                <Eye className="ml-auto h-3 w-3 opacity-50" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-amber-50 p-3 text-xs text-amber-800">
        <p className="font-semibold">Adjunta el contrato firmado</p>
        <p className="mt-0.5">{contratosDescargables.length > 0 ? "Descarga el .docx de arriba, completalo, firmalo y adjuntalo." : "Adjunta el contrato firmado para continuar."}</p>
      </div>
      <label className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed p-4 transition-colors ${uploading ? "border-primary/50 bg-primary/5" : "border-slate-300 bg-slate-50 hover:border-primary hover:bg-primary/5"}`}>
        <Upload className={`h-5 w-5 ${uploading ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
        <span className="text-xs font-medium text-muted-foreground">
          {uploading ? "Subiendo..." : "Adjuntar contrato firmado (PDF, JPG, PNG)"}
        </span>
        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.docx,.doc" disabled={uploading}
          onChange={(e) => { const file = e.target.files?.[0]; if (file) onAddDoc(file); }} />
      </label>
      {formDocs.length > 0 && (
        <div className="space-y-1 rounded-md border p-2">
          {formDocs.map((url, i) => (
            <div key={i} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted/50">
              <FileText className="h-3 w-3 text-emerald-600" />
              <span className="flex-1 truncate">{getFileName(url)}</span>
              <a href={url} target="_blank"><Eye className="h-3 w-3 opacity-50 hover:opacity-100" /></a>
              <button onClick={() => onRemoveDoc(i)} title="Eliminar">
                <X className="h-3 w-3 text-destructive opacity-70 hover:opacity-100" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
