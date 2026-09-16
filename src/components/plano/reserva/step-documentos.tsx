"use client";

import { FileText, Eye, X, Check, Upload, Download, ScrollText, ClipboardCheck, Bell, FileCheck, PenLine } from "lucide-react";

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
    const steps = [
      { icon: ScrollText, color: "bg-emerald-100 text-emerald-600", title: "Solicitud creada", desc: "Al confirmar, tu solicitud multiple se registrara y el administrador del IIMP sera notificado." },
      { icon: Upload, color: "bg-blue-100 text-blue-600", title: "El admin sube el contrato", desc: "El administrador adjuntara el contrato oficial en tu solicitud. Recibiras un correo cuando este listo." },
      { icon: FileText, color: "bg-amber-100 text-amber-600", title: "Adjunta tus documentos", desc: "Ingresa a Mis solicitudes en el dashboard, busca tu solicitud y adjunta los documentos requeridos." },
      { icon: ClipboardCheck, color: "bg-purple-100 text-purple-600", title: "Revision por areas", desc: "Tres areas del IIMP (Comunicacion, Legal y Logistica) revisaran tu solicitud." },
      { icon: Bell, color: "bg-emerald-100 text-emerald-600", title: "Resultado final", desc: "Recibiras un correo con el resultado. Si es rechazada, podras solicitar una re-evaluacion adjuntando nuevos documentos." },
    ];

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-center">
          <Check className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-emerald-800">Reserva multiple — no necesitas adjuntar documentos ahora</p>
          <p className="text-xs text-emerald-600 mt-1">Al confirmar la reserva, sigue este flujo para completar tu solicitud:</p>
        </div>

        <div className="space-y-0">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                {i < steps.length - 1 && (
                  <div className="w-0.5 flex-1 bg-slate-200 my-0.5" />
                )}
              </div>
              <div className={`pb-3 ${i === steps.length - 1 ? "" : ""}`}>
                <p className="text-xs font-semibold text-slate-700">{s.title}</p>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-[11px] text-slate-500">
            <span className="font-semibold text-slate-600">Importante:</span> puedes monitorear el estado de tu solicitud en cualquier momento desde{" "}
            <span className="font-mono text-emerald-600 font-medium">Mis solicitudes</span> en el menu del dashboard.
          </p>
        </div>
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

      {/* Visual flow explanation */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        <p className="text-xs font-semibold text-blue-700 mb-3">Como completar tu solicitud:</p>
        <div className="space-y-0">
          {[
            { icon: Download, title: "Descarga el formato", desc: "Descarga el documento .docx de la seccion superior. Es el contrato oficial del IIMP." },
            { icon: PenLine, title: "Completa y firma", desc: "Abre el archivo descargado, completa tus datos y firma digital o manualmente." },
            { icon: Upload, title: "Sube el documento", desc: "Adjunta el archivo firmado en el area inferior. Formatos aceptados: PDF, JPG, PNG, DOCX." },
          ].map((s, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <s.icon className="h-3.5 w-3.5" />
                </div>
                {i < 2 && <div className="w-0.5 flex-1 bg-blue-200 my-0.5" />}
              </div>
              <div className="pb-2">
                <p className="text-xs font-semibold text-blue-800">{i + 1}. {s.title}</p>
                <p className="text-[11px] text-blue-600/70 leading-relaxed mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
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
