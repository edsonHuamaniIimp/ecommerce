"use client";

import { Fragment } from "react";
import { FileText, Eye, X, Check, Upload, Download, Send, PenLine, ShieldCheck, ClipboardCheck, Workflow, Package } from "lucide-react";
import { Input, Button } from "@nrivera-iimp/ui-kit-iimp";
import { REVISION_AREA_LABELS, REVISION_AREA_ORDER, REVISION_AREA_SGC_LABEL } from "@/lib/shared/constants";
import { stringUtils } from "@/lib/shared/utils/string";

interface Props {
  singleStand: boolean;
  reservaStands: { id: string; medidas: string | null }[];
  existingDocs: string[];
  formDocs: string[];
  uploading: boolean;
  onAddDoc: (file: File) => Promise<void>;
  onRemoveDoc: (idx: number) => void;
}

export function StepDocumentos({ singleStand, reservaStands, existingDocs, formDocs, uploading, onAddDoc, onRemoveDoc }: Props) {
  if (!singleStand) {
    const total = reservaStands.length;
    const standsResumen = reservaStands.map((s) => (s.medidas ? `${s.id} (${s.medidas})` : s.id)).join(", ");
    const areas = [...REVISION_AREA_ORDER.map((a) => REVISION_AREA_LABELS[a]), REVISION_AREA_SGC_LABEL];

    const steps = [
      { icon: Send, badge: "En este paso", areas: false, title: "Solicitud creada", desc: `Confirmas tus datos corporativos y bloqueas temporalmente los ${total} stands seleccionados.` },
      { icon: Upload, badge: null, areas: false, title: "El admin sube el contrato", desc: `El área comercial del IIMP revisa la disponibilidad y carga el contrato marco personalizado con los ${total} stands.` },
      { icon: PenLine, badge: null, areas: false, title: "Adjunta tus documentos", desc: "Descargas la plantilla, firmas digitalmente el contrato y lo subes al portal desde tu panel de reservas." },
      { icon: ShieldCheck, badge: null, areas: true, title: "Revisión por áreas", desc: "Las comisiones organizadoras validan especificaciones técnicas, diseño de stands y conformidad legal." },
      { icon: ClipboardCheck, badge: null, areas: false, title: "Resultado final", desc: "Emisión de la confirmación formal, asignación definitiva de stands y generación de la orden de pago." },
    ];

    return (
      <div className="flex flex-col gap-4 pt-3">
        <div className="flex items-start gap-3.5 rounded-xl border border-info/30 bg-info/10 p-4">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
            <Check className="h-4 w-4" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-bold text-foreground">Reserva múltiple: no necesitas adjuntar documentos ahora</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Al reservar {total} stands ({standsResumen}), el IIMP consolida un contrato marco unificado. El equipo comercial
              generará este documento para que lo descargues y firmes en el siguiente paso de la solicitud.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-secondary/50 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">Flujo de atención y aprobación</span>
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">{steps.length} etapas</span>
          </div>

          <div className="relative">
            <div className="absolute bottom-5 left-[13px] top-4 w-0.5 bg-border" />
            {steps.map((s, i) => (
              <div key={i} className={`relative flex items-start gap-3.5 ${i < steps.length - 1 ? "pb-5" : ""}`}>
                <div className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-background ${
                  i === 0 ? "border border-info/30 bg-info/15 text-info" : "border-2 border-border bg-card text-muted-foreground"
                }`}>
                  <s.icon className="h-3.5 w-3.5" />
                </div>
                <div className="pt-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold text-foreground">{i + 1}. {s.title}</p>
                    {s.badge && (
                      <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">{s.badge}</span>
                    )}
                  </div>
                  {s.areas && (
                    <div className="my-1 inline-flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground">
                      {areas.map((label, idx) => (
                        <Fragment key={label}>
                          {idx > 0 && <span className="text-muted-foreground">→</span>}
                          <span>{label}</span>
                        </Fragment>
                      ))}
                    </div>
                  )}
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-secondary p-3.5 text-xs">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-medium text-muted-foreground">Stands en esta solicitud:</span>
            <span className="font-bold text-foreground">{standsResumen}</span>
          </div>
          <span className="font-semibold text-muted-foreground">Total: {total} {total === 1 ? "stand" : "stands"}</span>
        </div>
      </div>
    );
  }

  const contratosDescargables = existingDocs.filter((url) => url.endsWith(".docx") || url.endsWith(".doc"));
  const otrosDocs = existingDocs.filter((url) => !url.endsWith(".docx") && !url.endsWith(".doc"));

  return (
    <div className="flex flex-col gap-3 pt-3">
      {(contratosDescargables.length > 0 || otrosDocs.length > 0) && (
        <div className="rounded-lg border border-border bg-secondary px-3 py-2.5">
          <p className="mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Documentos del stand</p>
          <div className="space-y-1">
            {contratosDescargables.map((url, i) => (
              <a key={`c-${i}`} href={url} download
                className="flex items-center gap-2 rounded-md border border-success/30 bg-card px-2.5 py-2 text-xs text-success transition-colors hover:bg-success/10">
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate font-medium">{stringUtils.nombreArchivo(url)}</span>
                <span className="ml-auto shrink-0 text-[10px]">Descargar</span>
              </a>
            ))}
            {otrosDocs.map((url, i) => (
              <a key={`o-${i}`} href={url} target="_blank"
                className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{stringUtils.nombreArchivo(url)}</span>
                <Eye className="ml-auto h-3 w-3" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Flujo explicativo */}
      <div className="rounded-xl border border-info/30 bg-info/10 p-4">
        <p className="mb-3 text-xs font-semibold text-info">Como completar tu solicitud:</p>
        <div className="space-y-0">
          {[
            { icon: Download, title: "Descarga el formato", desc: "Descarga el documento .docx de la seccion superior. Es el contrato oficial del IIMP." },
            { icon: PenLine, title: "Completa y firma", desc: "Abre el archivo descargado, completa tus datos y firma digital o manualmente." },
            { icon: Upload, title: "Sube el documento", desc: "Adjunta el archivo firmado en el area inferior. Formatos aceptados: PDF, JPG, PNG, DOCX." },
          ].map((s, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-info/15 text-info">
                  <s.icon className="h-3.5 w-3.5" />
                </div>
                {i < 2 && <div className="my-0.5 w-0.5 flex-1 bg-info/30" />}
              </div>
              <div className="pb-2">
                <p className="text-xs font-semibold text-foreground">{i + 1}. {s.title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <label className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 transition-all ${
        uploading ? "border-success/40 bg-success/10" : "border-border bg-secondary hover:border-primary/40"
      }`}>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${uploading ? "bg-success/15 text-success" : "bg-card text-muted-foreground"}`}>
          <Upload className={`h-4 w-4 ${uploading ? "animate-bounce" : ""}`} />
        </div>
        <div>
          <p className="text-xs font-medium text-foreground">{uploading ? "Subiendo..." : "Adjuntar contrato firmado"}</p>
          <p className="text-[10px] text-muted-foreground">PDF, JPG, PNG, DOCX - max 10 MB</p>
        </div>
        <Input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.docx,.doc" disabled={uploading}
          onChange={(e) => { const file = e.target.files?.[0]; if (file) onAddDoc(file); }} />
      </label>

      {formDocs.length > 0 && (
        <div className="space-y-1">
          {formDocs.map((url, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs transition-colors hover:border-success/30">
              <FileText className="h-3.5 w-3.5 shrink-0 text-success" />
              <span className="flex-1 truncate font-medium text-foreground">{stringUtils.nombreArchivo(url)}</span>
              <a href={url} target="_blank" className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                <Eye className="h-3 w-3" />
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Quitar documento"
                onClick={() => onRemoveDoc(i)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
