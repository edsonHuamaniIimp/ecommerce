"use client";

import { useRef } from "react";
import { Download, FileText, Loader2, PenLine, Upload, X } from "lucide-react";
import { Button, Input } from "@nrivera-iimp/ui-kit-iimp";
import { ANEXOS_REQUERIDOS } from "@/lib/shared/constants";
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
  /** Genera el contrato (borrador) si aun no existe (defensivo). */
  generandoContrato: boolean;
  onGenerarContrato: () => Promise<boolean>;
  /** Documentos del cliente por requisito (ANEXOS_REQUERIDOS): clave -> URL. */
  docsRequisitos: Record<string, string>;
  subiendoRequisito: string | null;
  onAddRequisito: (requisito: string, file: File) => Promise<void>;
  onRemoveRequisito: (requisito: string) => void;
}

/**
 * Paso 3: contrato de exhibición (borrador) con la configuración de cuotas/precios.
 * El cliente lo descarga y lo firma (digitalmente con la firma de su Perfil, o manual y subido),
 * y adjunta los 3 documentos requeridos.
 */
export function StepContrato({
  contrato,
  contratoFirmadoUrl,
  subiendoFirmado,
  onSubirFirmado,
  firmaPerfilUrl,
  firmandoDigital,
  onFirmarDigital,
  generandoContrato,
  onGenerarContrato,
  docsRequisitos,
  subiendoRequisito,
  onAddRequisito,
  onRemoveRequisito,
}: Props) {
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
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Aún no se ha generado el contrato. Vuelve al paso de cuotas o genéralo aquí.
              </p>
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5 rounded-full text-xs"
                disabled={generandoContrato}
                onClick={() => { void onGenerarContrato(); }}
              >
                {generandoContrato ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                <span>{generandoContrato ? "Generando..." : "Generar contrato"}</span>
              </Button>
            </div>
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

      {/* Documentos adjuntos (3 requisitos) */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-secondary px-3 py-2">
          <Upload className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold tracking-wider text-primary uppercase">Documentos adjuntos</span>
          <span className="ml-auto rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
            {Object.keys(docsRequisitos).length} de {ANEXOS_REQUERIDOS.length}
          </span>
        </div>
        <div className="space-y-2 px-3 py-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Adjunta los <span className="font-medium text-foreground">3 documentos requeridos</span> (o su equivalente
            para empresas extranjeras). Formato PDF, JPG, PNG o DOCX - max 10 MB.
          </p>
          <div className="space-y-1.5">
            {ANEXOS_REQUERIDOS.map((doc) => {
              const url = docsRequisitos[doc.key];
              const subiendo = subiendoRequisito === doc.key;
              return (
                <div key={doc.key} className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className={`h-3.5 w-3.5 shrink-0 ${url ? "text-success" : "text-muted-foreground"}`} />
                    <span className={`flex-1 ${url ? "truncate font-medium text-foreground" : "font-medium text-foreground"}`}>
                      {doc.label}
                    </span>
                    {url ? (
                      <>
                        <span className="max-w-[130px] truncate text-[10px] text-muted-foreground">{stringUtils.nombreArchivo(url)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Quitar documento"
                          onClick={() => onRemoveRequisito(doc.key)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <label className="shrink-0 cursor-pointer rounded-full border px-3 py-1 text-[11px] font-medium hover:bg-secondary">
                        <span>{subiendo ? "Subiendo..." : "Adjuntar"}</span>
                        <Input
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
                          disabled={subiendoRequisito !== null}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void onAddRequisito(doc.key, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
