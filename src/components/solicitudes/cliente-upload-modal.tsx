"use client";

import { useState, useRef } from "react";
import { Button, Label, Dialog, DialogContent, DialogHeader, DialogTitle } from "@nrivera-iimp/ui-kit-iimp";
import { CheckCircle2, FileText, Upload, X, Trash2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { solicitudesService } from "@/lib/client/api/services/solicitudes-service";
import { contratosService } from "@/lib/client/api/services/contratos-service";
import { ANEXOS_BLOQUEANTES, ANEXOS_OTROS_EXTENSIONES, ANEXOS_REQUERIDOS, ANEXOS_UPLOAD_EXTENSIONES_TODAS, ANEXOS_UPLOAD_MAX_BYTES, ESTADOS_DOCUMENTO_SOLICITUD, ORIGENES_DOCUMENTO, TIPOS_DOCUMENTO_SOLICITUD, extensionesPermitidasAnexo } from "@/lib/shared/constants";
import { archivoUtils } from "@/lib/shared/utils/archivo";
import type { SolicitudDTO } from "@/types/dto/solicitudes/solicitudes-response.dto";

interface Props {
  solicitud: SolicitudDTO;
  /** "contrato" = subir el contrato firmado; "anexos" = documentos anexos del SGC. */
  modo?: "contrato" | "anexos";
  onClose: () => void;
  onSaved: () => void;
}

/** Archivo elegido aun no enviado: su URL y el requisito que cubre (null = otro anexo). */
interface Pendiente {
  url: string;
  requisito: string | null;
}

export function ClienteUploadModal({ solicitud, modo = "anexos", onClose, onSaved }: Props) {
  const esContrato = modo === "contrato";
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const requisitoRef = useRef<string | null>(null);

  const handleUpload = async (file: File) => {
    /* Anexos: formatos por requisito (mismas constantes que el wizard y el backend). */
    if (requisitoRef.current || !esContrato) {
      const permitidas = extensionesPermitidasAnexo(requisitoRef.current);
      if (!archivoUtils.extensionPermitida(file.name, permitidas)) {
        setError(`Formato no permitido. Adjunta ${permitidas.map((extension) => extension.toUpperCase()).join(", ")}.`);
        return;
      }
      if (file.size > ANEXOS_UPLOAD_MAX_BYTES) {
        setError(`El archivo supera el maximo de ${ANEXOS_UPLOAD_MAX_BYTES / 1024 / 1024} MB.`);
        return;
      }
    }
    setUploading(true);
    try {
      const url = await solicitudesService.subirArchivo(file);
      setPendientes(prev => [...prev, { url, requisito: requisitoRef.current }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir");
    }
    setUploading(false);
  };

  const abrirSelector = (requisito: string | null) => {
    requisitoRef.current = requisito;
    const input = fileRef.current;
    if (!input) return;
    const extensiones = requisito ? extensionesPermitidasAnexo(requisito) : ANEXOS_OTROS_EXTENSIONES;
    input.accept = extensiones.map((extension) => `.${extension}`).join(",");
    input.click();
  };

  const handleRemove = (idx: number) => {
    setPendientes(prev => prev.filter((_, i) => i !== idx));
  };

  const handleEnviar = async () => {
    if (pendientes.length === 0) return;
    setSending(true);
    setError(null);
    try {
      for (const p of pendientes) {
        const esFirmado = esContrato && !p.requisito;
        await solicitudesService.uploadDocumento({
          solicitudId: solicitud.id,
          url: p.url,
          nombre: p.url.split("/").pop() ?? "documento",
          tipo: esFirmado ? TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO : TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
          requisito: p.requisito,
        });
      }
      toast.success(
        pendientes.some((p) => esContrato && !p.requisito)
          ? "Contrato firmado y documentos enviados correctamente"
          : "Documentos enviados correctamente",
      );
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar");
    }
    setSending(false);
  };

  const adminDocs = [...(solicitud.docsAdjuntos ?? [])]
    .filter(d => d.userId !== solicitud.userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  /* Contrato mas reciente del admin/contrato generado por el sistema: habilita la firma digital. */
  const contratoAdmin = esContrato ? adminDocs.find(d => d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO || d.categoria === null) : null;
  const puedeFirmarDigital = contratoAdmin?.origen === ORIGENES_DOCUMENTO.GENERADO;

  /** Firma digital: el servidor regenera el contrato de la plantilla y estampa la firma del perfil. */
  const handleFirmarDigital = async () => {
    setSending(true);
    setError(null);
    try {
      const firmado = await contratosService.firmar({ solicitudId: solicitud.id });
      const urlFirmado = firmado.pdfUrl ?? firmado.docxUrl;
      await solicitudesService.uploadDocumento({
        solicitudId: solicitud.id,
        url: urlFirmado,
        nombre: urlFirmado.split("/").pop() ?? "contrato-firmado",
        tipo: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
        requisito: null,
      });
      toast.success("Contrato firmado digitalmente");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo firmar digitalmente. Carga tu firma en tu perfil e intenta de nuevo.");
    }
    setSending(false);
  };
  /* Documentos del cliente: anexos y contrato firmado (el modo define cual se muestra). */
  const misDocs = (solicitud.docsAdjuntos ?? []).filter(d => d.userId === solicitud.userId);
  const firmados = misDocs.filter(d => d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO);
  const anexos = misDocs.filter(d => d.categoria !== TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO);
  const otrosDocs = (esContrato ? firmados : anexos)
    .filter(d => !d.requisito && (!d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO));
  /** Contrato firmado observado por el revisor: se debe subir una nueva version. */
  const firmadoObservado = esContrato
    ? firmados.find(d => d.estado === ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO)
    : null;
  const obligatorios = ANEXOS_REQUERIDOS.filter(a => ANEXOS_BLOQUEANTES.includes(a.key));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 border-b border-border px-5 pt-4 pb-3">
        <h3 className="text-sm font-semibold text-foreground">{esContrato ? "Subir contrato firmado" : "Adjuntar documentos"}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Stands: <span className="font-mono font-medium text-foreground">{solicitud.standCodes?.join(", ")}</span>
        </p>
        <div className="mt-2 rounded-md border border-info/30 bg-info/10 px-2.5 py-2">
          {esContrato ? (
            firmadoObservado ? (
              <p className="text-[11px] font-semibold text-warning">
                Tu contrato firmado fue observado{firmadoObservado.motivoObservacion ? `: ${firmadoObservado.motivoObservacion}` : "."}{" "}
                Descarga el contrato vigente, firmalo de nuevo y sube la version corregida.
              </p>
            ) : puedeFirmarDigital ? (
              <p className="text-[11px] font-semibold text-foreground">
                Este contrato usa la <span className="text-primary">plantilla del sistema</span>: puedes <span className="text-primary">firmarlo digitalmente</span> con la firma de tu perfil, o descargarlo, firmarlo y subir tu versión firmada.
              </p>
            ) : (
              <p className="text-[11px] font-semibold text-foreground">
                Descarga la <span className="text-primary">versión más reciente</span> del contrato del administrador (abajo), fírmala y sube el archivo firmado para continuar con tu solicitud.
              </p>
            )
          ) : (
            <p className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Obligatorios para la revisión Legal:</span>{" "}
              {obligatorios.map(a => a.label).join(" y ")}. Sin ellos no se puede enviar el trámite al SGC.
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
        {adminDocs.length > 0 && (
          <div>
            <Label className="text-xs mb-1 block">{esContrato ? "Contrato del administrador (descarga y firma)" : "Documentos del administrador"}</Label>
            <div className="space-y-1 rounded-md border bg-secondary p-2">
              {adminDocs.map((doc, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <a href={doc.url} target="_blank" className="text-primary hover:underline truncate flex-1">{doc.nombre}</a>
                  {esContrato && i === 0 && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">versión más reciente</span>
                  )}
                  {doc.uploadedBy && <span className="shrink-0 text-[10px] text-muted-foreground">{doc.uploadedBy}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {(
          <div>
            <Label className="text-xs mb-1 block">{esContrato ? "Documentos requeridos (anexos del contrato)" : "Documentos requeridos"}</Label>
            <div className="space-y-1">
              {ANEXOS_REQUERIDOS.map((a) => {
                const existente = anexos.find(d => d.requisito === a.key && (!d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO));
                const observado = anexos.find(d => d.requisito === a.key && d.estado === ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO);
                const idxPendiente = pendientes.findIndex(p => p.requisito === a.key);
                const pendiente = idxPendiente >= 0 ? pendientes[idxPendiente] : null;
                return (
                  <div key={a.key} className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs">
                    {existente
                      ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      : <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    <span className="flex-1">
                      {a.label}
                      {ANEXOS_BLOQUEANTES.includes(a.key) && (
                        <span className="ml-1 text-[10px] font-semibold text-red-500">obligatorio</span>
                      )}
                      {!existente && observado && (
                        <span className="block text-[10px] text-warning">
                          Observado{observado.motivoObservacion ? `: ${observado.motivoObservacion}` : ""} — sube una nueva version
                        </span>
                      )}
                    </span>
                    {existente ? (
                      <a href={existente.url} target="_blank" className="shrink-0 text-primary hover:underline">Ver</a>
                    ) : pendiente ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <span className="text-[10px] font-medium text-emerald-600">Listo para enviar</span>
                        <button className="text-red-500 hover:text-destructive" onClick={() => handleRemove(idxPendiente)}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ) : (
                      <Button variant="outline" size="sm" className="h-7 shrink-0 rounded-full px-2.5 text-[11px]"
                        disabled={uploading} onClick={() => abrirSelector(a.key)}>
                        Adjuntar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <Label className="text-xs mb-1 block">{esContrato ? "Tu contrato firmado" : "Otros documentos (opcional)"}</Label>
          {otrosDocs.length > 0 && (
            <div className="space-y-1 rounded-md border p-2 mb-2">
              {otrosDocs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs group">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <a href={doc.url} target="_blank" className="text-primary hover:underline truncate flex-1">{doc.nombre}</a>
                  {doc.uploadedBy && <span className="shrink-0 text-[10px] text-muted-foreground">{doc.uploadedBy}</span>}
                  <button className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-destructive"
                    onClick={() => setDeleteConfirm(doc.id)}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {pendientes.some(p => !p.requisito) && (
            <div className="space-y-1 rounded-md border p-2 mb-2">
              {pendientes.map((p, i) => p.requisito ? null : (
                <div key={i} className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs group">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate flex-1">{p.url.split("/").pop()}</span>
                  <button className="opacity-0 group-hover:opacity-100 text-red-500" onClick={() => handleRemove(i)}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" className="hidden" accept={esContrato ? ANEXOS_OTROS_EXTENSIONES.map((extension) => `.${extension}`).join(",") : ANEXOS_UPLOAD_EXTENSIONES_TODAS.map((extension) => `.${extension}`).join(",")} onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }} />
          <Button variant="outline" size="sm" className="rounded-full text-xs" disabled={uploading} onClick={() => abrirSelector(null)}>
            <Upload className="mr-1 h-3 w-3" />
            {uploading ? "Subiendo..." : esContrato ? "Subir contrato firmado" : "Agregar otro documento"}
          </Button>
          {esContrato && puedeFirmarDigital && (
            <Button size="sm" className="ml-2 rounded-full text-xs font-semibold" disabled={uploading || sending} onClick={() => { void handleFirmarDigital(); }}>
              <PenLine className="mr-1 h-3 w-3" />
              {sending ? "Firmando..." : "Firmar digitalmente"}
            </Button>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-100 px-5 py-3">
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="outline" size="sm" className="rounded-full px-3 text-xs font-medium" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" className="rounded-full px-4 text-xs font-semibold"
            disabled={sending || pendientes.length === 0} onClick={handleEnviar}>
            {sending ? "Enviando..." : "Enviar documentos"}
          </Button>
        </div>
      </div>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle><span>Eliminar documento</span></DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Estas seguro de eliminar este documento?</p>
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
