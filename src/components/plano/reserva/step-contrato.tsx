"use client";

import { useRef } from "react";
import { Download, FileText, Loader2, PenLine, Upload, X } from "lucide-react";
import { Button, Input } from "@nrivera-iimp/ui-kit-iimp";
import { stringUtils } from "@/lib/shared/utils/string";

interface Props {
  contrato: { docxUrl: string; pdfUrl: string | null } | null;
  contratoFirmadoUrl: string | null;
  subiendoFirmado: boolean;
  onSubirFirmado: (file: File) => void;
  /** Firma digital del perfil (RF-12); null = aun no subida en /dashboard/perfil. */
  firmaPerfilUrl: string | null;
  firmandoDigital: boolean;
  onFirmarDigital: () => void;
  /** Anexos del cliente (Vigencia de Poderes, DNI del representante, etc.). */
  formDocs: string[];
  uploading: boolean;
  onAddDoc: (file: File) => Promise<void>;
  onRemoveDoc: (idx: number) => void;
}

/**
 * Paso 3: contrato de exhibición generado con la configuración de cuotas/precios.
 * El cliente lo descarga y lo firma (digitalmente con la firma de su Perfil, o manual y subido),
 * y adjunta los anexos requeridos.
 */
export function StepContrato({ contrato, contratoFirmadoUrl, subiendoFirmado, onSubirFirmado, firmaPerfilUrl, firmandoDigital, onFirmarDigital, formDocs, uploading, onAddDoc, onRemoveDoc }: Props) {
  const firmadoRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-3 pt-3">
      {/* Contrato generado */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary px-3 py-2">
          <span className="flex items-center gap-2 text-[10px] font-semibold tracking-wider text-primary uppercase">
            <FileText className="h-3.5 w-3.5" />
            Contrato de exhibición
          </span>
          {contrato && (
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">Generado</span>
          )}
        </div>
        <div className="space-y-3 px-3 py-3">
          {contrato ? (
            <>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Este contrato (borrador) ya incluye tus datos, los stands, los precios y el cronograma de pagos
                elegido. Descárgalo, fírmalo (digital o manualmente) y súbelo firmado. La solicitud de reserva
                se crea recién al confirmar el paso final.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full text-xs" asChild>
                  <a href={contrato.pdfUrl ?? contrato.docxUrl} target="_blank" rel="noreferrer">
                    <Download className="h-3.5 w-3.5" />
                    <span>Descargar contrato {contrato.pdfUrl ? "(PDF)" : "(DOCX)"}</span>
                  </a>
                </Button>
                {contrato.pdfUrl && (
                  <Button variant="ghost" size="sm" className="h-8 rounded-full text-xs" asChild>
                    <a href={contrato.docxUrl} target="_blank" rel="noreferrer">
                      <span>Versión DOCX</span>
                    </a>
                  </Button>
                )}
              </div>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Aún no se ha generado el contrato. Vuelve al paso de cuotas para generarlo.
            </p>
          )}
        </div>
      </div>

      {/* Contrato firmado */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-secondary px-3 py-2">
          <PenLine className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold tracking-wider text-primary uppercase">Contrato firmado</span>
        </div>
        <div className="space-y-2 px-3 py-3">
          {/* Firma digital: estampa la imagen de firma del Perfil en el contrato. */}
          <Button
            type="button"
            size="sm"
            className="h-9 w-full gap-1.5 rounded-full text-xs"
            disabled={firmandoDigital || !contrato || !firmaPerfilUrl}
            onClick={onFirmarDigital}
          >
            {firmandoDigital ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
            <span>{firmandoDigital ? "Firmando..." : "Firmar digitalmente"}</span>
          </Button>
          {!firmaPerfilUrl && (
            <p className="text-[11px] text-muted-foreground">
              Para firmar digitalmente primero{" "}
              <a href="/dashboard/perfil" className="font-medium text-primary hover:underline">sube tu firma en tu Perfil</a>{" "}
              (imagen PNG/JPG). Tambien puedes descargar, firmar manualmente y adjuntar el contrato.
            </p>
          )}
          <input
            ref={firmadoRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onSubirFirmado(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full gap-1.5 rounded-full text-xs"
            disabled={subiendoFirmado || !contrato}
            onClick={() => firmadoRef.current?.click()}
          >
            {subiendoFirmado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            <span>{contratoFirmadoUrl ? "Reemplazar contrato firmado" : "O adjuntar contrato firmado"}</span>
          </Button>
          {contratoFirmadoUrl && (
            <a href={contratoFirmadoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[11px] font-medium text-success hover:underline">
              <FileText className="h-3.5 w-3.5" />
              <span>Contrato firmado adjunto</span>
            </a>
          )}
        </div>
      </div>

      {/* Anexos */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-secondary px-3 py-2">
          <Upload className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold tracking-wider text-primary uppercase">Anexos requeridos</span>
          {formDocs.length > 0 && (
            <span className="ml-auto rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
              {formDocs.length} archivo{formDocs.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="space-y-2 px-3 py-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Adjunta la <span className="font-medium text-foreground">Vigencia de Poderes</span> y el{" "}
            <span className="font-medium text-foreground">DNI o Pasaporte del representante legal</span> (y Ficha RUC si aplica).
          </p>
          <label className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 transition-all ${
            uploading ? "border-success/40 bg-success/10" : "border-border bg-secondary hover:border-primary/40"
          }`}>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${uploading ? "bg-success/15 text-success" : "bg-card text-muted-foreground"}`}>
              <Upload className={`h-4 w-4 ${uploading ? "animate-bounce" : ""}`} />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">{uploading ? "Subiendo..." : "Adjuntar documento"}</p>
              <p className="text-[10px] text-muted-foreground">PDF, JPG, PNG, DOCX - max 10 MB</p>
            </div>
            <Input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.docx,.doc" disabled={uploading}
              onChange={(e) => { const file = e.target.files?.[0]; if (file) void onAddDoc(file); }} />
          </label>
          {formDocs.length > 0 && (
            <div className="space-y-1">
              {formDocs.map((url, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-success" />
                  <span className="flex-1 truncate font-medium text-foreground">{stringUtils.nombreArchivo(url)}</span>
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
      </div>
    </div>
  );
}
