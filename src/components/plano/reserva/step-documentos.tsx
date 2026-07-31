"use client";

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
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
          <Check className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-slate-700">No se requiere adjuntar documentos</p>
        <p className="text-xs text-muted-foreground">Reserva multiple. Continua para confirmar.</p>
      </div>
    );
  }

  const contratosDescargables = existingDocs.filter((url) => url.endsWith(".docx") || url.endsWith(".doc"));
  const otrosDocs = existingDocs.filter((url) => !url.endsWith(".docx") && !url.endsWith(".doc"));

  return (
    <div className="flex flex-col gap-3">
      {(contratosDescargables.length > 0 || otrosDocs.length > 0) && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Documentos del stand</p>
          <div className="space-y-1">
            {contratosDescargables.map((url, i) => (
              <a key={`c-${i}`} href={url} download
                className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-emerald-700 bg-white border border-emerald-100 hover:bg-emerald-50 transition-colors">
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate font-medium">{getFileName(url)}</span>
                <span className="ml-auto shrink-0 text-[10px] text-emerald-500">Descargar</span>
              </a>
            ))}
            {otrosDocs.map((url, i) => (
              <a key={`o-${i}`} href={url} target="_blank"
                className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-slate-600 bg-white border border-slate-100 hover:bg-slate-50 transition-colors">
                <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{getFileName(url)}</span>
                <Eye className="ml-auto h-3 w-3 text-slate-400" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5">
        <Upload className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-amber-800">Adjunta el contrato firmado</p>
          <p className="text-[10px] text-amber-700/80">
            {contratosDescargables.length > 0 ? "Descarga, completa, firma y adjunta." : "Adjunta el contrato firmado."}
          </p>
        </div>
      </div>

      <label className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 transition-all ${
        uploading ? "border-emerald-300 bg-emerald-50/50" : "border-slate-300 bg-slate-50/50 hover:border-emerald-300 hover:bg-emerald-50/30"
      }`}>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${uploading ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
          <Upload className={`h-4 w-4 ${uploading ? "animate-bounce" : ""}`} />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-600">{uploading ? "Subiendo..." : "Adjuntar contrato firmado"}</p>
          <p className="text-[10px] text-muted-foreground">PDF, JPG, PNG, DOCX — max 10 MB</p>
        </div>
        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.docx,.doc" disabled={uploading}
          onChange={(e) => { const file = e.target.files?.[0]; if (file) onAddDoc(file); }} />
      </label>

      {formDocs.length > 0 && (
        <div className="space-y-1">
          {formDocs.map((url, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs hover:border-emerald-200 transition-colors">
              <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span className="flex-1 truncate font-medium text-slate-700">{getFileName(url)}</span>
              <a href={url} target="_blank" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <Eye className="h-3 w-3" />
              </a>
              <button onClick={() => onRemoveDoc(i)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
