"use client";

import { useRef, useState } from "react";
import { Download, FileText, Loader2, PenLine, Upload, X } from "lucide-react";
import { Button } from "@nrivera-iimp/ui-kit-iimp";
import { toast } from "sonner";
import { ANEXOS_REQUERIDOS, ANEXOS_UPLOAD_MAX_BYTES, CONTRATO_FIRMADO_EXTENSIONES, FIRMA_PERFIL_EXTENSIONES, FIRMA_PERFIL_MAX_BYTES, extensionesPermitidasAnexo } from "@/lib/shared/constants";
import { archivoUtils } from "@/lib/shared/utils/archivo";
import { stringUtils } from "@/lib/shared/utils/string";
import { ArchivoDropModal } from "@/components/shared/archivo-drop-modal";

interface Props {
  contrato: { docxUrl: string; pdfUrl: string | null } | null;
  contratoFirmadoUrl: string | null;
  subiendoFirmado: boolean;
  onSubirFirmado: (file: File) => void;
  /** Firma digital del perfil (RF-12); null = aun no subida en /dashboard/perfil. */
  firmaPerfilUrl: string | null;
  /** Sube la firma del usuario sin salir del wizard; queda asignada a su perfil. */
  onSubirFirmaPerfil: (file: File) => Promise<void>;
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
  onSubirFirmaPerfil,
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
  /** Requisito cuyo modal de carga (drag & drop) esta abierto; null = cerrado. */
  const [requisitoModal, setRequisitoModal] = useState<{ key: string; label: string } | null>(null);
  /** Modal de carga de la firma digital (mismo efecto que en /dashboard/perfil). */
  const [firmaModalOpen, setFirmaModalOpen] = useState(false);
  const [subiendoFirmaPerfil, setSubiendoFirmaPerfil] = useState(false);

  /** Sube la firma elegida y queda asignada al usuario sin salir del wizard. */
  const subirFirma = async (file: File) => {
    setSubiendoFirmaPerfil(true);
    try {
      await onSubirFirmaPerfil(file);
      toast.success("Firma subida. Ya puedes firmar digitalmente.");
    } catch {
      toast.error("No se pudo subir la firma. Intenta de nuevo.");
    }
    setSubiendoFirmaPerfil(false);
  };

  /** Valida el contrato firmado (solo PDF, max 10 MB) antes de subirlo. */
  const validarFirmado = (file: File): boolean => {
    if (!archivoUtils.extensionPermitida(file.name, CONTRATO_FIRMADO_EXTENSIONES)) {
      toast.error("Formato no permitido. Adjunta un PDF.");
      return false;
    }
    if (file.size > ANEXOS_UPLOAD_MAX_BYTES) {
      toast.error(`El archivo supera el maximo de ${ANEXOS_UPLOAD_MAX_BYTES / 1024 / 1024} MB.`);
      return false;
    }
    return true;
  };

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
            <>
              <p className="text-[11px] text-muted-foreground">
                Para firmar digitalmente sube tu firma (imagen PNG/JPG, fondo claro) aquí mismo o desde{" "}
                <a href="/dashboard/perfil" className="font-medium text-primary hover:underline">tu Perfil</a>.
                Tambien puedes descargar, firmar manualmente y adjuntar el contrato.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-full gap-1.5 rounded-full text-xs"
                disabled={subiendoFirmaPerfil}
                onClick={() => setFirmaModalOpen(true)}
              >
                {subiendoFirmaPerfil ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                <span>{subiendoFirmaPerfil ? "Subiendo firma..." : "Subir firma aquí"}</span>
              </Button>
            </>
          )}
          <input
            ref={firmadoRef}
            type="file"
            accept={CONTRATO_FIRMADO_EXTENSIONES.map((extension) => `.${extension}`).join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && validarFirmado(file)) onSubirFirmado(file);
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
            para empresas extranjeras): Ficha RUC y Vigencia de Poder en formato PDF; DNI o Pasaporte en PDF, PNG o JPG.
            Max. 10 MB por archivo.
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 rounded-full px-3 text-[11px]"
                        disabled={subiendoRequisito !== null}
                        onClick={() => setRequisitoModal({ key: doc.key, label: doc.label })}
                      >
                        <span>{subiendo ? "Subiendo..." : "Adjuntar"}</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ArchivoDropModal
        open={requisitoModal !== null}
        title={requisitoModal ? `Adjuntar: ${requisitoModal.label}` : "Adjuntar documento"}
        extensionesPermitidas={requisitoModal ? extensionesPermitidasAnexo(requisitoModal.key) : []}
        maxBytes={ANEXOS_UPLOAD_MAX_BYTES}
        onConfirm={(file) => { if (requisitoModal) void onAddRequisito(requisitoModal.key, file); }}
        onClose={() => setRequisitoModal(null)}
      />

      <ArchivoDropModal
        open={firmaModalOpen}
        title="Subir firma digital"
        extensionesPermitidas={FIRMA_PERFIL_EXTENSIONES}
        maxBytes={FIRMA_PERFIL_MAX_BYTES}
        confirmLabel="Subir firma"
        onConfirm={(file) => { void subirFirma(file); }}
        onClose={() => setFirmaModalOpen(false)}
      />
    </div>
  );
}
