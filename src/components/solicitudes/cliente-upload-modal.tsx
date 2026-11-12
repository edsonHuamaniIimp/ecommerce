"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Badge, Button, Label, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@nrivera-iimp/ui-kit-iimp";
import { CheckCircle2, Download, ExternalLink, Eye, FileText, Upload, X, Trash2, PenLine, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { solicitudesService } from "@/lib/client/api/services/solicitudes-service";
import { contratosService } from "@/lib/client/api/services/contratos-service";
import { perfilService } from "@/lib/client/api/services/perfil-service";
import { portalEmpresaService } from "@/lib/client/api/services/portal-empresa-service";
import { uploadService } from "@/lib/client/api/services/upload-service";
import { ANEXOS_BLOQUEANTES, ANEXOS_OTROS_EXTENSIONES, ANEXOS_REQUERIDOS, ANEXOS_UPLOAD_EXTENSIONES_TODAS, ANEXOS_UPLOAD_MAX_BYTES, ESTADOS_DOCUMENTO_SOLICITUD, FIRMA_PERFIL_EXTENSIONES, FIRMA_PERFIL_MAX_BYTES, ORIGENES_DOCUMENTO, TIPOS_DOCUMENTO_SOLICITUD, SGC_OBSERVACION_ESTADOS, extensionesPermitidasAnexo } from "@/lib/shared/constants";
import { archivoUtils } from "@/lib/shared/utils/archivo";
import { dateUtils } from "@/lib/shared/utils/date";
import { esObservacionSgcContrato, estadoCorreccionSgc, observacionContratoSgcPendiente, observacionesSgcSubsanadas } from "@/lib/shared/utils/solicitud-documentos";
import { FirmaContratoWorkspace } from "./firma-contrato-workspace";
import type { SolicitudDTO } from "@/types/dto/solicitudes/solicitudes-response.dto";
import type { EmpresaRepresentanteAdicionalDTO } from "@/types/dto/empresas";

interface Props {
  solicitud: SolicitudDTO;
  /** "contrato" = subir el contrato firmado; "anexos" = documentos anexos del SGC. */
  modo?: "contrato" | "anexos";
  /** Modo prueba (solo admin en "Ver como"): permite probar la firma sin guardar ni firmar nada. */
  modoPrueba?: boolean;
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
  nombre: string;
  requisito: string | null;
  observacionId?: string | null;
}

interface Firmante {
  key: string;
  nombre: string;
  nombres?: string;
  apellidos?: string;
  rol: string;
  firmaUrl: string | null;
  principal: boolean;
  rep?: EmpresaRepresentanteAdicionalDTO;
}

/** Separa un nombre completo en nombres y apellidos (dos ultimas palabras). */
function separarNombreCompleto(nombre: string): { nombres: string; apellidos: string } {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 2) return { nombres: partes[0] ?? "", apellidos: partes.slice(1).join(" ") };
  return { nombres: partes.slice(0, -2).join(" "), apellidos: partes.slice(-2).join(" ") };
}

export function ClienteUploadModal({ solicitud, modo = "anexos", modoPrueba = false, onClose, onSaved }: Props) {
  const esContrato = modo === "contrato";
  /** Politica fija: solo firma digital, sin subida manual del contrato. */
  /* Politica fija: todo contrato se firma digitalmente desde Mis solicitudes. */
  const soloFirmaDigital = esContrato;
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [firmaWorkspaceOpen, setFirmaWorkspaceOpen] = useState(false);
  const [abriendoFirma, setAbriendoFirma] = useState(false);
  const [pngOriginales, setPngOriginales] = useState<Record<string, string>>({});
  const [contratoPreviewUrl, setContratoPreviewUrl] = useState<string | null>(null);
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
  const [firmantes, setFirmantes] = useState<Firmante[]>([]);
  const [subiendoFirmaId, setSubiendoFirmaId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const firmaRef = useRef<HTMLInputElement>(null);
  const resumeAutomaticoRef = useRef<(() => void) | null>(null);
  const firmaObjetivoRef = useRef<string | null>(null);
  const requisitoRef = useRef<string | null>(null);
  const observacionRef = useRef<string | null>(null);

  /* Firmas de todos los representantes: principal + adicionales de la empresa. */
  const cargarFirmantes = useCallback(async (): Promise<void> => {
    const perfil = await perfilService.get().catch(() => null);
    const nombrePrincipal = perfil?.representanteNombre?.trim() ||
      perfil?.empresa?.representanteLegalNombre?.trim() ||
      perfil?.email ||
      "Representante legal";
    const partesPrincipal = separarNombreCompleto(nombrePrincipal);
    /* El nombre del firmante SIEMPRE sale del Representante legal (nombre completo),
     * nunca de los campos de identidad de la cuenta (nombre/apellidos del usuario). */
    const principal: Firmante = {
      key: "principal",
      nombre: nombrePrincipal,
      nombres: partesPrincipal.nombres,
      apellidos: partesPrincipal.apellidos,
      rol: "Representante legal principal",
      firmaUrl: perfil?.firmaUrl ?? null,
      principal: true,
    };
    const adicionales: Firmante[] = (perfil?.empresa?.representantesAdicionales ?? []).map((rep) => {
      const partes = separarNombreCompleto(rep.nombre);
      return {
        key: rep.id,
        nombre: rep.nombre,
        nombres: partes.nombres,
        apellidos: partes.apellidos,
        rol: "Representante legal adicional",
        firmaUrl: rep.firmaUrl ?? null,
        principal: false,
        rep,
      };
    });
    setFirmantes([principal, ...adicionales]);
    const originales: Record<string, string> = {};
    if (perfil?.firmaUrl) originales.principal = perfil.firmaUrl;
    for (const rep of perfil?.empresa?.representantesAdicionales ?? []) {
      if (rep.firmaUrl) originales[rep.id] = rep.firmaUrl;
    }
    setPngOriginales(originales);
  }, []);

  useEffect(() => {
    const tarea = setTimeout(() => { void cargarFirmantes(); }, 0);
    return () => clearTimeout(tarea);
  }, [solicitud.id, cargarFirmantes]);

  const handleUpload = async (file: File) => {
    if (modoPrueba) { toast.info("Modo prueba: no se guardan documentos."); return; }
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
      setPendientes(prev => [...prev, { url, nombre: file.name, requisito: requisitoRef.current, observacionId: observacionRef.current }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir");
    }
    setUploading(false);
  };

  const abrirSelector = (requisito: string | null, observacionId: string | null = null) => {
    requisitoRef.current = requisito;
    observacionRef.current = observacionId;
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
    if (modoPrueba) { toast.info("Modo prueba: no se envía nada."); return; }
    if (pendientes.length === 0) return;
    setSending(true);
    setError(null);
    try {
      for (const p of pendientes) {
        const esFirmado = esContrato && !p.requisito;
        await solicitudesService.uploadDocumento({
          solicitudId: solicitud.id,
          url: p.url,
          nombre: p.nombre || p.url.split("/").pop() || "documento",
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

  /** Sube la firma PNG del representante seleccionado y la persiste. */
  const onFirmaFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const objetivo = firmaObjetivoRef.current;
    e.target.value = "";
    if (!file || !objetivo) return;
    if (!archivoUtils.extensionPermitida(file.name, FIRMA_PERFIL_EXTENSIONES)) {
      setError("La firma debe ser una imagen PNG.");
      return;
    }
    if (file.size > FIRMA_PERFIL_MAX_BYTES) {
      setError(`La firma supera el máximo de ${FIRMA_PERFIL_MAX_BYTES / 1024 / 1024} MB.`);
      return;
    }
    setSubiendoFirmaId(objetivo);
    setError(null);
    try {
      const url = await uploadService.subir(file);
      setPngOriginales((prev) => ({ ...prev, [objetivo]: url }));
      if (objetivo === "principal") {
        await perfilService.update({ firmaUrl: url });
        setFirmantes((prev) => prev.map((f) => f.principal ? { ...f, firmaUrl: url } : f));
        toast.success("Firma del representante principal cargada.");
        setTimeout(() => { resumeAutomaticoRef.current?.(); }, 150);
        return;
      }

      const actualizados = firmantes.map((f) => {
        if (f.key !== objetivo || !f.rep) return f;
        const rep = { ...f.rep, firmaUrl: url };
        return { ...f, firmaUrl: url, rep };
      });
      const adicionales = actualizados
        .filter((f): f is Firmante & { rep: EmpresaRepresentanteAdicionalDTO } => !f.principal && Boolean(f.rep))
        .map((f) => ({
          id: f.rep.id,
          nombre: f.rep.nombre,
          tipoDocumento: f.rep.tipoDocumento,
          documento: f.rep.documento,
          correo: f.rep.correo,
          celular: f.rep.celular,
          direccion: f.rep.direccion,
          firmaUrl: f.firmaUrl,
        }));
      await portalEmpresaService.guardarRepresentantes(adicionales);
      setFirmantes(actualizados);
      toast.success("Firma del representante adicional cargada.");
      setTimeout(() => { resumeAutomaticoRef.current?.(); }, 150);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la firma.");
    } finally {
      setSubiendoFirmaId(null);
      firmaObjetivoRef.current = null;
    }
  };

  const abrirSelectorFirma = (id: string) => {
    firmaObjetivoRef.current = id;
    firmaRef.current?.click();
  };

  const adminDocs = [...(solicitud.docsAdjuntos ?? [])]
    .filter(d => d.userId !== solicitud.userId)
    .sort((a, b) => (dateUtils.toMs(b.createdAt) ?? 0) - (dateUtils.toMs(a.createdAt) ?? 0));
  /* Contrato mas reciente del admin/contrato generado por el sistema: habilita la firma digital. */
  const contratoAdmin = esContrato
    ? adminDocs.find(d => (!d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO) && (d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO || d.categoria === null))
    : null;
  /* Observaciones por documento del SGC (campo OPCIONAL; si no vienen, todo sigue como antes). */
  const observacionesSgc = (solicitud.sgcObservaciones ?? []).filter(
    (o) => o.status !== SGC_OBSERVACION_ESTADOS.RESOLVED && o.message.trim().length > 0,
  );
  const observacionesSgcAnexos = observacionesSgc.filter((o) => !esObservacionSgcContrato(o));
  const correccionSgcAnexos = estadoCorreccionSgc({
    ...solicitud,
    sgcObservaciones: observacionesSgcAnexos,
  });
  const observacionesSgcAnexosCorregidas =
    observacionesSgcAnexos.length > 0 && correccionSgcAnexos.faltantes.length === 0;
  const observacionesSgcCorregidas = observacionesSgc.length > 0 && observacionesSgcSubsanadas(solicitud);
  const correccionSgc = estadoCorreccionSgc(solicitud);
  const observacionesSgcSinFila = observacionesSgc.filter(
    (o) =>
      !ANEXOS_REQUERIDOS.some((a) => a.key === o.requisito) &&
      /* El contrato no es un anexo: se firma desde el flujo de contrato. */
      !esObservacionSgcContrato(o),
  );
  const observacionContratoSgc = observacionesSgc.find(esObservacionSgcContrato) ?? null;
  const contratoSgcPendiente = observacionContratoSgcPendiente(solicitud);
  const requiereNuevoContratoSgc = contratoSgcPendiente && (
    !contratoAdmin ||
    contratoAdmin.origen !== ORIGENES_DOCUMENTO.GENERADO ||
    !observacionContratoSgc?.createdAt ||
    dateUtils.isBefore(contratoAdmin.createdAt, observacionContratoSgc.createdAt)
  );
  const firmantesSinFirma = firmantes.filter((f) => !pngOriginales[f.key]);
  const firmasCompletas = firmantes.length > 0 && firmantesSinFirma.length === 0;


  /** Firma digital: el servidor regenera el contrato de la plantilla y estampa la firma de cada representante. */
  const handleFirmarDigital = async (sellos?: Array<{
    esSello: boolean;
    nombres: string;
    apellidos: string;
    fecha: string;
    imagen?: string;
    secciones: Array<{ pagina: number; x: number; y: number; w: number; h: number }>;
  }>) => {
    if (modoPrueba) {
      toast.info("Modo prueba: no se firmó nada.");
      onClose();
      return;
    }
    const capturasCompletas = Boolean(sellos?.length) &&
      sellos!.every((s) => s.esSello || Boolean(s.imagen));
    if (!capturasCompletas && !firmasCompletas) {
      const nombres = firmantesSinFirma.map((f) => f.nombre).join(", ");
      setError(nombres
        ? `Sube la firma PNG de: ${nombres}.`
        : "Sube la firma PNG de todos los representantes antes de firmar el contrato.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      if (soloFirmaDigital && !contratoAdmin && !contratoPreviewUrl) {
        await contratosService.generar({ solicitudId: solicitud.id });
      }
      const firmado = await contratosService.firmar({ solicitudId: solicitud.id, sellos });
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
      setError(e instanceof Error ? e.message : "No se pudo firmar digitalmente. Verifica las firmas de los representantes e intenta de nuevo.");
    }
    setSending(false);
  };

  /** Abre el lienzo de firma; genera el PDF si aun no existe. */
  const abrirFirmaWorkspace = async () => {
    if (abriendoFirma) return;
    const existente = contratoPreviewUrl ?? (requiereNuevoContratoSgc ? null : (contratoAdmin?.url ?? null));
    if (modoPrueba && !existente) {
      toast.info("Modo prueba: esta solicitud aún no tiene contrato para probar.");
      return;
    }
    if (existente) {
      if (!/\.pdf($|\?)/i.test(existente)) {
        setError("El contrato vigente no tiene una version PDF para previsualizar.");
        return;
      }
      setContratoPreviewUrl(existente);
      setFirmaWorkspaceOpen(true);
      return;
    }
    if (requiereNuevoContratoSgc) {
      setError("El administrador aún no generó la versión corregida del contrato. Espera esa versión para firmar.");
      return;
    }
    setAbriendoFirma(true);
    setError(null);
    try {
      const generado = await contratosService.generar({ solicitudId: solicitud.id });
      const url = generado.pdfUrl;
      if (!url) throw new Error("El contrato se genero sin PDF; no se puede mostrar la vista de firma.");
      setContratoPreviewUrl(url);
      setFirmaWorkspaceOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo preparar la vista de firma.");
    } finally {
      setAbriendoFirma(false);
    }
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
  /* La vista de firma solo aplica a la plantilla generada y sin una firma manual vigente. */
  const puedeAbrirFirma = firmantes.length > 0 &&
    !firmaManualPendiente &&
    (contratoSgcPendiente || (!firmaManualVigente && (!contratoAdmin || contratoAdmin.origen === ORIGENES_DOCUMENTO.GENERADO)));
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
  /** Contrato firmado observado sin reemplazo activo posterior: se debe volver a firmar. */
  const firmadoObservado = esContrato
    ? firmados.find((obs) =>
        obs.estado === ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO &&
        !firmados.some((d) =>
          (!d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO) &&
          dateUtils.isAfter(d.createdAt, obs.createdAt),
        ),
      )
    : null;
  const obligatorios = ANEXOS_REQUERIDOS.filter(a => ANEXOS_BLOQUEANTES.includes(a.key));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 border-b border-border px-5 pt-4 pb-3">
        <h3 className="text-sm font-semibold text-foreground">
          {soloFirmaDigital
            ? observacionContratoSgc ? "Subsanar contrato" : "Firmar contrato"
            : esContrato ? "Subir contrato firmado" : "Adjuntar documentos"}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Stands: <span className="font-mono font-medium text-foreground">{solicitud.standCodes?.join(", ")}</span>
        </p>
        {modoPrueba && (
          <p className="mt-2 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-2 text-[11px] font-semibold text-warning">
            MODO PRUEBA: puedes probar el flujo de firma, pero no se guardará ni se firmará nada.
          </p>
        )}
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
            ) : puedeAbrirFirma ? (
              <p className="text-[11px] font-semibold text-foreground">
                Este contrato usa la <span className="text-primary">plantilla del sistema</span>: puedes <span className="text-primary">firmarlo digitalmente</span> con la firma de cada representante, o descargarlo, firmarlo y subir tu versión firmada.
              </p>
            ) : (
              <p className="text-[11px] font-semibold text-foreground">
                Descarga la <span className="text-primary">versión más reciente</span> del contrato del administrador (abajo), fírmala y sube el archivo firmado para continuar con tu solicitud.
              </p>
            )
          ) : (
            <p className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Obligatorios para la revisión del área legal:</span>{" "}
              {obligatorios.map(a => a.label).join(" y ")}. Sin ellos no se puede enviar el trámite.
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
        {esContrato && observacionContratoSgc && (
          <div className={`mt-2 rounded-md border px-2.5 py-2 ${observacionesSgcCorregidas ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${observacionesSgcCorregidas ? "text-success" : "text-destructive"}`}>
              {observacionesSgcCorregidas ? "Corrección registrada" : "Observación del área legal"}
            </p>
            <p className="mt-0.5 text-[11px] text-foreground">
              {observacionesSgcCorregidas
                ? "Tu corrección fue enviada. Solicita una nueva revisión para que el área legal la valide."
                : observacionContratoSgc.message}
            </p>
          </div>
        )}
        {esContrato && observacionContratoSgc && !observacionesSgcCorregidas && (
          <p className="mt-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-2 text-[11px] text-primary">
            Para subsanar, haz clic en <strong>Firmar contrato corregido</strong>. No debes subir el contrato.
          </p>
        )}
        {!esContrato && observacionContratoSgc && (
          <p className="mt-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-2 text-[11px] text-primary">
            El contrato se subsana aparte con <strong>Subsanar observación</strong>. En esta ventana reemplaza solo los anexos.
          </p>
        )}
        {!esContrato && observacionesSgcAnexos.length > 0 && (
          <div className={`mt-2 rounded-md border px-2.5 py-2 ${observacionesSgcAnexosCorregidas ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${observacionesSgcAnexosCorregidas ? "text-success" : "text-destructive"}`}>
              {observacionesSgcAnexosCorregidas ? "Corrección registrada" : `Te piden ${correccionSgcAnexos.requeridos} archivos; llevas ${correccionSgcAnexos.cubiertos}.`}
            </p>
            {observacionesSgcAnexosCorregidas ? (
              <p className="mt-0.5 text-[11px] text-foreground">Tu corrección fue enviada. Solicita una nueva revisión para que el área legal la valide.</p>
            ) : (
              <ul className="mt-0.5 space-y-0.5 text-[11px] text-foreground">
                {observacionesSgcAnexos.map((o, i) => (
                  <li key={o.observationId ?? `obs-sgc-${i}`}>
                    • {o.title ?? o.nombre ?? "Documento"}
                    {o.versionNumber ? ` (v${o.versionNumber})` : ""}: {o.message}
                  </li>
                ))}
              </ul>
            )}
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
          <div className="mt-2 space-y-2 rounded-md border border-border bg-secondary/40 px-2.5 py-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
                Firmas de los representantes legales
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Sube la firma PNG de cada representante. Todas se estamparán en el contrato.
              </p>
            </div>
            <input
              ref={firmaRef}
              type="file"
              accept=".png,image/png"
              className="hidden"
              onChange={(e) => { void onFirmaFile(e); }}
            />
            {firmantes.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Cargando representantes...</p>
            ) : (
              <div className="space-y-1.5">
                {firmantes.map((f) => {
                  const png = pngOriginales[f.key];
                  return (
                  <div key={f.key} className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-background px-2.5 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-[11px] font-semibold text-foreground">{f.nombre}</p>
                        <Badge className="pointer-events-none text-[9px] bg-muted text-muted-foreground border-border">
                          <span>{f.principal ? "Principal" : "Adicional"}</span>
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {png ? "Firma cargada" : "Firma pendiente"} · {f.rol}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {png && (
                        <img
                          src={png}
                          alt={`Firma de ${f.nombre}`}
                          className="h-8 max-w-[90px] object-contain"
                        />
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-1.5 rounded-full text-xs"
                        disabled={subiendoFirmaId !== null}
                        onClick={() => abrirSelectorFirma(f.key)}
                      >
                        {subiendoFirmaId === f.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        <span>
                          {subiendoFirmaId === f.key
                            ? "Subiendo..."
                            : png ? "Cambiar firma" : "Subir firma"}
                        </span>
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
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
                const existente = anexos
                  .filter(d => d.requisito === a.key && (!d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO))
                  .sort((x, y) => (dateUtils.toMs(y.createdAt) ?? 0) - (dateUtils.toMs(x.createdAt) ?? 0))[0];
                const observado = anexos.find(d => d.requisito === a.key && d.estado === ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO);
                const observacionSgc = observacionesSgc.find(o => o.requisito === a.key) ?? null;
                const observacionFaltante = Boolean(observacionSgc && (!observacionSgc.documentId || observacionSgc.requiresNewDocument));
                const observacionCorregida = Boolean(
                  observacionSgc &&
                    !correccionSgc.faltantes.some((f) =>
                      observacionSgc.observationId
                        ? f.observationId === observacionSgc.observationId
                        : f.title === (observacionSgc.title ?? observacionSgc.nombre ?? "Documento"),
                    ),
                );
                const motivoPropio = observado?.motivoObservacion?.trim() && observado.motivoObservacion.trim() !== motivoGeneral
                  ? observado.motivoObservacion.trim()
                  : null;
                const idxPendiente = pendientes.findIndex(p => p.requisito === a.key);
                const pendiente = idxPendiente >= 0 ? pendientes[idxPendiente] : null;
                return (
                  <div key={a.key} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs ${(!existente && observado) || (observacionSgc && !observacionCorregida) ? "border-warning/50 bg-warning/5" : "border-border/70 bg-background"}`}>
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
                          Observado{motivoPropio ? `: ${motivoPropio}` : ""} - sube una nueva version
                        </span>
                      )}
                      {observacionSgc && (
                        observacionCorregida
                          ? <span className="block text-[10px] text-emerald-600">Corregido — pendiente de validación del área legal</span>
                          : <span className="block text-[10px] text-destructive">Área legal: {observacionSgc.message}</span>
                      )}
                    </span>
                    {pendiente ? (
                      <span className="flex shrink-0 items-center gap-2">
                        {existente && (
                          <a href={existente.url} target="_blank" className="text-primary hover:underline">Ver</a>
                        )}
                        <span className="text-[10px] font-medium text-emerald-600">Listo para enviar</span>
                        <button className="text-red-500 hover:text-destructive" onClick={() => handleRemove(idxPendiente)}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-2">
                        {existente && (
                          <a href={existente.url} target="_blank" className="text-primary hover:underline">Ver</a>
                        )}
                        {(!existente || (observacionSgc && !observacionCorregida) || observado) && (
                          <Button variant="outline" size="sm" className="h-7 shrink-0 rounded-full px-2.5 text-[11px]"
                            disabled={uploading} onClick={() => abrirSelector(a.key)}>
                            {observacionFaltante || !existente || observado ? "Adjuntar" : "Reemplazar"}
                          </Button>
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
              {observacionesSgcSinFila.map((o, i) => {
                const local = (o.documentoLocalId
                  ? anexos.find((d) => d.id === o.documentoLocalId)
                  : undefined)
                  ?? (o.nombre ? anexos.find((d) => d.nombre === o.nombre) : undefined)
                  ?? null;
                const corregida = !correccionSgcAnexos.faltantes.some((f) =>
                  o.observationId
                    ? f.observationId === o.observationId
                    : f.title === (o.title ?? o.nombre ?? "Documento"),
                );
                const idxPendiente = pendientes.findIndex((p) =>
                  o.observationId ? p.observacionId === o.observationId : p.requisito === null,
                );
                const pendiente = idxPendiente >= 0 ? pendientes[idxPendiente] : null;
                return (
                  <div
                    key={o.observationId ?? `obs-sgc-sin-fila-${i}`}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs ${corregida ? "border-border/70 bg-background" : "border-warning/50 bg-warning/5"}`}
                  >
                    {local
                      ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      : <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    <span className="flex-1">
                      {o.title ?? o.nombre ?? "Documento adicional"}
                      {corregida
                        ? <span className="block text-[10px] text-emerald-600">Corregido - pendiente de validación del área legal</span>
                        : <span className="block text-[10px] text-destructive">Área legal: {o.message}</span>}
                    </span>
                    {pendiente ? (
                      <span className="flex shrink-0 items-center gap-2">
                        {local && (
                          <a href={local.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">Ver</a>
                        )}
                        <span className="text-[10px] font-medium text-emerald-600">Listo para enviar</span>
                        <button className="text-red-500 hover:text-destructive" onClick={() => handleRemove(idxPendiente)}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-2">
                        {local && (
                          <a href={local.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">Ver</a>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 shrink-0 rounded-full px-2.5 text-[11px]"
                          disabled={uploading}
                          onClick={() => abrirSelector(null, o.observationId ?? null)}
                        >
                          {local ? "Reemplazar" : "Adjuntar"}
                        </Button>
                      </span>
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
                  {!modoPrueba && !soloFirmaDigital && puedeEliminarDoc(doc) && (
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
                  <span className="truncate flex-1">{p.nombre || p.url.split("/").pop()}</span>
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
            {esContrato && (
              <Button
                size="sm"
                className="w-full rounded-full text-xs font-semibold sm:w-auto"
                disabled={uploading || sending || abriendoFirma || !puedeAbrirFirma}
                title={!puedeAbrirFirma ? contratoSgcPendiente ? "Se preparará la nueva versión del contrato para firmar." : "No hay una version PDF del contrato para firmar." : firmantesSinFirma.length > 0 ? `Faltan ${firmantesSinFirma.length} firma(s); puedes capturarlas en la vista de firma.` : undefined}
                onClick={() => { void abrirFirmaWorkspace(); }}
              >
                {abriendoFirma ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <PenLine className="mr-1 h-3 w-3" />}
                {abriendoFirma ? "Preparando contrato..." : observacionContratoSgc ? "Firmar contrato corregido" : "Firmar contrato"}
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

      {firmaWorkspaceOpen && contratoPreviewUrl && (
        <FirmaContratoWorkspace
          contratoUrl={contratoPreviewUrl}
          firmantes={firmantes}
          pngOriginales={pngOriginales}
          modoPrueba={modoPrueba}
          onPendienteAutomatico={(fn) => { resumeAutomaticoRef.current = fn; }}
          onRepresentantesActualizados={async () => {
            await cargarFirmantes();
            const detalle = await solicitudesService.detalle(solicitud.id).catch(() => null);
            const contratosAdmin = (detalle?.docsAdjuntos ?? [])
              .filter((d) =>
                d.userId === null &&
                (d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO || d.categoria == null) &&
                (!d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO),
              )
              .sort((a, b) => (dateUtils.toMs(b.createdAt) ?? 0) - (dateUtils.toMs(a.createdAt) ?? 0));
            const nuevo = contratosAdmin[0];
            if (nuevo?.url) setContratoPreviewUrl(nuevo.url);
          }}
          onFinalizar={async (sellos) => {
            await handleFirmarDigital(sellos);
            setFirmaWorkspaceOpen(false);
          }}
          onFaltaFirma={(key) => {
            toast.info("Selecciona la firma PNG del representante.");
            abrirSelectorFirma(key);
          }}
          onClose={() => setFirmaWorkspaceOpen(false)}
        />
      )}
    </div>
  );
}
