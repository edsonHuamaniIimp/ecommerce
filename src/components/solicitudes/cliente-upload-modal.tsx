"use client";

import { useEffect, useState, useRef } from "react";
import { Badge, Button, Label, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@nrivera-iimp/ui-kit-iimp";
import { CheckCircle2, Download, ExternalLink, Eye, FileText, Upload, X, Trash2, PenLine, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { solicitudesService } from "@/lib/client/api/services/solicitudes-service";
import { contratosService } from "@/lib/client/api/services/contratos-service";
import { perfilService } from "@/lib/client/api/services/perfil-service";
import { uploadService } from "@/lib/client/api/services/upload-service";
import { ANEXOS_BLOQUEANTES, ANEXOS_OTROS_EXTENSIONES, ANEXOS_REQUERIDOS, ANEXOS_UPLOAD_EXTENSIONES_TODAS, ANEXOS_UPLOAD_MAX_BYTES, ESTADOS_DOCUMENTO_SOLICITUD, FIRMA_PERFIL_EXTENSIONES, FIRMA_PERFIL_MAX_BYTES, ORIGENES_DOCUMENTO, TIPOS_DOCUMENTO_SOLICITUD, extensionesPermitidasAnexo } from "@/lib/shared/constants";
import { archivoUtils } from "@/lib/shared/utils/archivo";
import { dateUtils } from "@/lib/shared/utils/date";
import type { SolicitudDTO } from "@/types/dto/solicitudes/solicitudes-response.dto";

interface Props {
  solicitud: SolicitudDTO;
  /** "contrato" = subir el contrato firmado; "anexos" = documentos anexos del SGC. */
  modo?: "contrato" | "anexos";
  onClose: () => void;
  onSaved: () => void;
}

/** Archivo elegido aun no enviado: su URL y el requisito que cubre (null = otro anexo). */
/** Tipo de vista previa segun la extension del archivo. */
function tipoPreview(url: string): "pdf" | "imagen" | "otro" {
  const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext)) return "imagen";
  return "otro";
}

interface Pendiente {
  url: string;
  requisito: string | null;
}

export function ClienteUploadModal({ solicitud, modo = "anexos", onClose, onSaved }: Props) {
  const esContrato = modo === "contrato";
  /** Politica fija: solo firma digital, sin subida manual del contrato. */
  /* Politica fija: todo contrato se firma digitalmente desde Mis solicitudes. */
  const soloFirmaDigital = esContrato;
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; nombre: string } | null>(null);
  /** Corte de la iteracion actual: solo se elimina lo subido despues de la ultima revision. */
  const ultimaRevision = (solicitud.revisiones ?? []).reduce<string | Date | null>(
    (ultima, r) => (!ultima || dateUtils.isAfter(r.updatedAt, ultima) ? r.updatedAt : ultima),
    null,
  );
  const puedeEliminarDoc = (doc: { estado?: string | null; createdAt: string | Date }) =>
    (!doc.estado || doc.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO) &&
    (!ultimaRevision || dateUtils.isAfter(doc.createdAt, ultimaRevision));
  const [error, setError] = useState<string | null>(null);
  const [firmaPerfilUrl, setFirmaPerfilUrl] = useState<string | null>(null);
  const [subiendoFirma, setSubiendoFirma] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const firmaRef = useRef<HTMLInputElement>(null);
  const requisitoRef = useRef<string | null>(null);

  /* La firma es requisito del servidor para estampar el contrato. */
  useEffect(() => {
    let activo = true;
    void perfilService.get()
      .then((perfil) => {
        if (activo) setFirmaPerfilUrl(perfil?.firmaUrl ?? null);
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, [solicitud.id]);

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

  /** Sube la firma PNG directamente desde el modal y la guarda en el perfil. */
  const onFirmaFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!archivoUtils.extensionPermitida(file.name, FIRMA_PERFIL_EXTENSIONES)) {
      setError("La firma debe ser una imagen PNG.");
      return;
    }
    if (file.size > FIRMA_PERFIL_MAX_BYTES) {
      setError(`La firma supera el máximo de ${FIRMA_PERFIL_MAX_BYTES / 1024 / 1024} MB.`);
      return;
    }
    setSubiendoFirma(true);
    setError(null);
    try {
      const url = await uploadService.subir(file);
      await perfilService.update({ firmaUrl: url });
      setFirmaPerfilUrl(url);
      toast.success("Firma PNG cargada. Ya puedes firmar el contrato.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la firma.");
    } finally {
      setSubiendoFirma(false);
    }
  };

  const adminDocs = [...(solicitud.docsAdjuntos ?? [])]
    .filter(d => d.userId !== solicitud.userId)
    .sort((a, b) => (dateUtils.toMs(b.createdAt) ?? 0) - (dateUtils.toMs(a.createdAt) ?? 0));
  /* Contrato mas reciente del admin/contrato generado por el sistema: habilita la firma digital. */
  const contratoAdmin = esContrato
    ? adminDocs.find(d => (!d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO) && (d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO || d.categoria === null))
    : null;


  /** Firma digital: el servidor regenera el contrato de la plantilla y estampa la firma del perfil. */
  const handleFirmarDigital = async () => {
    if (!firmaPerfilUrl) {
      setError("Sube tu firma en formato PNG antes de firmar el contrato.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      if (soloFirmaDigital && !contratoAdmin) {
        await contratosService.generar({ solicitudId: solicitud.id });
      }
      const firmado = await contratosService.firmar({ solicitudId: solicitud.id });
      const urlFirmado = firmado.pdfUrl ?? firmado.docxUrl;
      await solicitudesService.uploadDocumento({
        solicitudId: solicitud.id,
        url: urlFirmado,
        nombre: urlFirmado.split("/").pop() ?? "contrato-firmado",
        tipo: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
        requisito: null,
        firmaDigital: true,
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
  const firmadoActivo = firmados
    .filter(d => !d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO)
    .sort((a, b) => (dateUtils.toMs(b.createdAt) ?? 0) - (dateUtils.toMs(a.createdAt) ?? 0))[0];
  /* La firma vigente es anterior al contrato corregido: hay que volver a firmar. */
  const firmadoAnterior = Boolean(
    contratoAdmin && firmadoActivo &&
    dateUtils.isBefore(firmadoActivo.createdAt, contratoAdmin.createdAt),
  );
  const firmaManualPendiente = pendientes.some(p => !p.requisito);
  const firmaManualVigente = Boolean(
    contratoAdmin && firmadoActivo &&
    dateUtils.isSameOrAfter(firmadoActivo.createdAt, contratoAdmin.createdAt),
  );
  /* La firma digital solo aplica a la plantilla generada y si no hay una firma manual vigente. */
  const puedeFirmarDigital = (soloFirmaDigital || contratoAdmin?.origen === ORIGENES_DOCUMENTO.GENERADO) &&
    Boolean(firmaPerfilUrl) && !firmaManualVigente && !firmaManualPendiente;
  const motivoGeneral = solicitud.revisionAsociado?.comentario?.trim() ?? null;
  const observadosAnexos = anexos.filter(d => d.estado === ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO);
  const faltanObs = observadosAnexos.filter((obs) => {
    const reemplazo = anexos.some((d) =>
      (!d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO) &&
      (d.categoria ?? null) === (obs.categoria ?? null) &&
      (d.requisito ?? null) === (obs.requisito ?? null) &&
      dateUtils.isAfter(d.createdAt, obs.createdAt));
    const pendiente = pendientes.some((p) => (p.requisito ?? null) === (obs.requisito ?? null));
    return !reemplazo && !pendiente;
  });
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
        <h3 className="text-sm font-semibold text-foreground">
          {soloFirmaDigital ? "Firmar contrato" : esContrato ? "Subir contrato firmado" : "Adjuntar documentos"}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Stands: <span className="font-mono font-medium text-foreground">{solicitud.standCodes?.join(", ")}</span>
        </p>
        <div className="mt-2 rounded-md border border-info/30 bg-info/10 px-2.5 py-2">
          {soloFirmaDigital ? (
            <p className="text-[11px] font-semibold text-foreground">
              El contrato de esta solicitud se firma <span className="text-primary">solo digitalmente</span>.
              Puedes descargar el contrato vigente; no se admite subir un contrato firmado manualmente.
            </p>
          ) : esContrato ? (
            firmadoObservado ? (
              <p className="text-[11px] font-semibold text-warning">
                Tu contrato firmado fue observado{firmadoObservado.motivoObservacion ? `: ${firmadoObservado.motivoObservacion}` : "."}{" "}
                Descarga el contrato vigente, firmalo de nuevo y sube la version corregida.
              </p>
            ) : (firmaManualVigente || firmaManualPendiente) ? (
              <p className="text-[11px] font-semibold text-foreground">
                Ya tienes una firma manual vigente. Si deseas firmar digitalmente, elimina primero esa firma.
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
        {solicitud.revisionAsociado?.comentario && (
          <div className="mt-2 rounded-md border border-border bg-muted/40 px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Observacion del area revisora
            </p>
            <p className="mt-0.5 text-[11px] text-foreground">{solicitud.revisionAsociado.comentario}</p>
          </div>
        )}
        {esContrato && contratoAdmin && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Contrato vigente del administrador
                </p>
                <Badge className="pointer-events-none text-[9px] bg-primary/10 text-primary border-primary/20">
                  <span>Version vigente</span>
                </Badge>
              </div>
              <p className="truncate text-[11px] font-medium text-foreground">{contratoAdmin.nombre}</p>
              <p className="text-[10px] text-muted-foreground">{dateUtils.formatDateTime(contratoAdmin.createdAt)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 p-0 text-primary hover:bg-primary/10"
                title="Vista previa"
                onClick={() => setPreviewDoc({ url: contratoAdmin.url, nombre: contratoAdmin.nombre })}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <a
                href={contratoAdmin.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
              >
                <Eye className="h-3 w-3" />
                <span>Ver</span>
              </a>
              <a
                href={contratoAdmin.url}
                download
                className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
              >
                <Download className="h-3 w-3" />
                <span>Descargar</span>
              </a>
            </div>
          </div>
        )}
        {soloFirmaDigital && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-secondary/40 px-2.5 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground">Firma para el contrato</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {firmaPerfilUrl
                  ? "Firma PNG cargada. Puedes firmar digitalmente."
                  : "Sube tu firma en formato PNG (fondo claro) para firmar digitalmente."}
              </p>
            </div>
            <input
              ref={firmaRef}
              type="file"
              accept=".png,image/png"
              className="hidden"
              onChange={(e) => { void onFirmaFile(e); }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 rounded-full text-xs"
              disabled={subiendoFirma}
              onClick={() => firmaRef.current?.click()}
            >
              {subiendoFirma ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              <span>{subiendoFirma ? "Subiendo..." : firmaPerfilUrl ? "Cambiar firma PNG" : "Subir firma PNG"}</span>
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-5">
        {!esContrato && adminDocs.length > 0 && (
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

        {!soloFirmaDigital && (
          <div className="space-y-2 rounded-xl border border-border/70 p-3">
            <div>
              <Label className="text-xs">{esContrato ? "Documentos requeridos (anexos del contrato)" : "Documentos requeridos"}</Label>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {esContrato
                  ? "Anexos que acompanan al contrato firmado; adjunta los que fueron observados."
                  : "Adjunta los documentos solicitados por el area revisora."}
              </p>
            </div>
            <div className="space-y-1">
              {ANEXOS_REQUERIDOS.map((a) => {
                const existente = anexos.find(d => d.requisito === a.key && (!d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO));
                const observado = anexos.find(d => d.requisito === a.key && d.estado === ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO);
                const motivoPropio = observado?.motivoObservacion?.trim() && observado.motivoObservacion.trim() !== motivoGeneral
                  ? observado.motivoObservacion.trim()
                  : null;
                const idxPendiente = pendientes.findIndex(p => p.requisito === a.key);
                const pendiente = idxPendiente >= 0 ? pendientes[idxPendiente] : null;
                return (
                  <div key={a.key} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs ${!existente && observado ? "border-warning/50 bg-warning/5" : "border-border/70 bg-background"}`}>
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
                          Observado{motivoPropio ? `: ${motivoPropio}` : ""} — sube una nueva version
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

        <div className="space-y-2 rounded-xl border border-border/70 p-3">
          <Label className="text-xs">
            {esContrato ? (firmadoAnterior ? "Tu firma anterior" : "Tu contrato firmado") : "Otros documentos (opcional)"}
          </Label>
          {esContrato && firmadoAnterior && (
            <p className="rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-[11px] text-warning">
              Firmaste el {dateUtils.formatDateTime(firmadoActivo?.createdAt)}; la version vigente es del{" "}
              {dateUtils.formatDateTime(contratoAdmin?.createdAt)}. Descarga la version vigente y firmala de nuevo.
            </p>
          )}
          {otrosDocs.length > 0 && (
            <div className="space-y-1 rounded-md border p-2 mb-2">
              {otrosDocs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs group">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <a href={doc.url} target="_blank" className="text-primary hover:underline truncate flex-1">{doc.nombre}</a>
                  {firmadoAnterior && doc.id === firmadoActivo?.id && (
                    <Badge className="pointer-events-none shrink-0 text-[9px] bg-muted text-muted-foreground border-border">
                      <span>Version anterior</span>
                    </Badge>
                  )}
                  {doc.uploadedBy && <span className="shrink-0 text-[10px] text-muted-foreground">{doc.uploadedBy}</span>}
                  {!soloFirmaDigital && puedeEliminarDoc(doc) && (
                    <button className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-destructive"
                      onClick={() => setDeleteConfirm(doc.id)}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!soloFirmaDigital && pendientes.some(p => !p.requisito) && (
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
          {!soloFirmaDigital && (
            <input ref={fileRef} type="file" className="hidden" accept={esContrato ? ANEXOS_OTROS_EXTENSIONES.map((extension) => `.${extension}`).join(",") : ANEXOS_UPLOAD_EXTENSIONES_TODAS.map((extension) => `.${extension}`).join(",")} onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }} />
          )}
          {!soloFirmaDigital && faltanObs.length > 0 && (
            <p className="rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-[11px] text-warning">
              Faltan reemplazar {faltanObs.length} anexo(s) observado(s) antes de enviar.
            </p>
          )}
          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center">
            {esContrato && (contratoAdmin?.origen === ORIGENES_DOCUMENTO.GENERADO || soloFirmaDigital) && (
              <Button size="sm" className="w-full rounded-full text-xs font-semibold sm:w-auto" disabled={uploading || sending || !puedeFirmarDigital} title={!firmaPerfilUrl ? "Sube tu firma en formato PNG para firmar digitalmente." : !puedeFirmarDigital ? "Ya tienes una firma manual vigente. Eliminala para firmar digitalmente." : undefined} onClick={() => { void handleFirmarDigital(); }}>
                <PenLine className="mr-1 h-3 w-3" />
                {sending ? "Firmando..." : "Firmar digitalmente"}
              </Button>
            )}
            {!soloFirmaDigital && (
              <Button variant="outline" size="sm" className="w-full rounded-full text-xs sm:w-auto" disabled={uploading} onClick={() => abrirSelector(null)}>
                <Upload className="mr-1 h-3 w-3" />
                {uploading ? "Subiendo..." : esContrato ? "Subir contrato firmado" : "Agregar otro documento"}
              </Button>
            )}
          </div>
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
          {!soloFirmaDigital && (
            <Button size="sm" className="rounded-full px-4 text-xs font-semibold"
              disabled={sending || pendientes.length === 0 || faltanObs.length > 0}
              title={faltanObs.length > 0 ? "Reemplaza todos los anexos observados antes de enviar" : undefined}
              onClick={handleEnviar}>
              {sending ? "Enviando..." : "Enviar documentos"}
            </Button>
          )}
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

      <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) setPreviewDoc(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-6 text-sm font-semibold"><span>{previewDoc?.nombre ?? ""}</span></DialogTitle>
          </DialogHeader>
          {previewDoc && (
            <div className="space-y-3">
              {tipoPreview(previewDoc.url) === "pdf" && (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.nombre}
                  className="h-[65vh] w-full rounded-lg border border-border bg-white"
                />
              )}
              {tipoPreview(previewDoc.url) === "imagen" && (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.nombre}
                  className="mx-auto max-h-[65vh] rounded-lg border border-border object-contain"
                />
              )}
              {tipoPreview(previewDoc.url) === "otro" && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Vista previa no disponible para este formato. Descargalo o abrelo en otra pestana.
                </p>
              )}
              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" className="text-xs" asChild>
                  <a href={previewDoc.url} download={previewDoc.nombre}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    <span>Descargar</span>
                  </a>
                </Button>
                <Button size="sm" className="text-xs" asChild>
                  <a href={previewDoc.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    <span>Abrir en otra pestana</span>
                  </a>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
