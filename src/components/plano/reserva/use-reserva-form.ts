"use client";

import { useEffect, useState, useCallback } from "react";
import { reservaBorradorDB } from "@/lib/client/indexed-db";
import { gessService } from "@/lib/client/api/services/gess-service";
import { contratosService } from "@/lib/client/api/services/contratos-service";
import { solicitudesService } from "@/lib/client/api/services/solicitudes-service";
import { uploadService } from "@/lib/client/api/services/upload-service";
import { perfilService } from "@/lib/client/api/services/perfil-service";
import { isStepDatosCompleto } from "@/lib/shared/utils/form-validator";
import { fechasCuotasValidas, porcentajesValidos, siguienteFechaCuota } from "@/lib/shared/utils/cuotas";
import { idiomaODefecto } from "@/lib/shared/utils/idioma";
import { leerIdiomaCookie } from "@/lib/client/utils/idioma";
import { TIPOS_COMPROBANTE, TIPOS_DOCUMENTO, TIPOS_DOCUMENTO_SOLICITUD } from "@/lib/shared/constants";
import type { FormDatos, GessLinkedInfo } from "./interfaces";

/** Contrato generado en el paso de cuotas (se descarga y firma en el paso final). */
export interface ContratoReserva {
  solicitudId: string;
  docxUrl: string;
  pdfUrl: string | null;
}

/** Cuota configurada por el cliente: porcentaje (%) y fecha de pago (yyyy-mm-dd). */
export interface CuotaConfig {
  porcentaje: number;
  fecha: string;
}

/** True si las cuotas configuradas son validas: porcentajes suman 100% y fechas validas. */
export function cuotasConfigValidas(cuotas: CuotaConfig[]): boolean {
  return (
    porcentajesValidos(cuotas.map((c) => c.porcentaje)) &&
    fechasCuotasValidas(cuotas.map((c) => c.fecha))
  );
}

function standIdsKey(ids: string[]): string {
  return [...ids].sort().join("|");
}

function emptyDatos(): FormDatos {
  return { razonSocial: "", tipoDocumento: "", numeroDocumento: "", direccion: "", telefono: "", contacto: "", email: "", tipoComprobante: "" };
}

export function useReservaForm(selectedIds: string[], linkedMap: Map<string, GessLinkedInfo>) {
  const [reservaOpen, setReservaOpen] = useState(false);
  const [reservaStep, setReservaStep] = useState(0);
  const [formDatos, setFormDatos] = useState<FormDatos>(emptyDatos);
  const [formDocs, setFormDocs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);

  /* Paso 3: cuotas + contrato. */
  /** Cuotas configuradas por el cliente: porcentaje + fecha de pago (1..3). */
  const [cuotasConfig, setCuotasConfig] = useState<CuotaConfig[]>([{ porcentaje: 100, fecha: siguienteFechaCuota(null) }]);
  const [contrato, setContrato] = useState<ContratoReserva | null>(null);
  const [generandoContrato, setGenerandoContrato] = useState(false);
  /* Paso 4: contrato firmado por el cliente. */
  const [contratoFirmadoUrl, setContratoFirmadoUrl] = useState<string | null>(null);
  const [subiendoFirmado, setSubiendoFirmado] = useState(false);
  /* Firma digital del perfil (RF-12): permite firmar sin subir el documento. */
  const [firmaPerfilUrl, setFirmaPerfilUrl] = useState<string | null>(null);
  const [firmandoDigital, setFirmandoDigital] = useState(false);
  /** La firma vigente es la digital del perfil (se regenera al crear la solicitud). */
  const [firmaDigitalAplicada, setFirmaDigitalAplicada] = useState(false);

  const selectedCount = selectedIds.length;
  const singleStand = selectedCount === 1;
  const currentKey = standIdsKey(selectedIds);

  const stepDone = useCallback((step: number): boolean => {
    if (step === 0) return isStepDatosCompleto(formDatos);
    if (step === 1) return cuotasConfigValidas(cuotasConfig);
    if (step === 2) return Boolean(contrato) && (!singleStand || (formDocs.length > 0 && Boolean(contratoFirmadoUrl)));
    if (step === 3) return Boolean(contrato) && confirmado && (!singleStand || Boolean(contratoFirmadoUrl));
    return false;
  }, [formDatos, formDocs, singleStand, cuotasConfig, contrato, confirmado, contratoFirmadoUrl]);

  const canGoStep = useCallback((step: number): boolean => {
    if (step === 0) return true;
    if (step === 1) return stepDone(0);
    if (step === 2) return stepDone(0) && stepDone(1);
    if (step === 3) return stepDone(0) && stepDone(1) && stepDone(2);
    return false;
  }, [stepDone]);

  // Load from IndexedDB when modal opens or key changes
  useEffect(() => {
    if (!reservaOpen || selectedIds.length === 0) return;
    (async () => {
      perfilService.get().then((perfil) => setFirmaPerfilUrl(perfil.firmaUrl ?? null)).catch(() => setFirmaPerfilUrl(null));
      const draft = await reservaBorradorDB.cargar(selectedIds);
      if (draft) {
        setFormDatos({ ...emptyDatos(), ...draft.datos });
        setFormDocs(draft.documentos);
        if (typeof draft.step === "number" && draft.step >= 0 && draft.step <= 1) {
          setReservaStep(draft.step);
        }
      } else {
        setFormDatos(emptyDatos());
        setFormDocs([]);
        setReservaStep(0);
      }
      setConfirmado(false);
      setContrato(null);
      setContratoFirmadoUrl(null);
    })();
  }, [reservaOpen, currentKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save to IndexedDB on form changes
  useEffect(() => {
    if (!reservaOpen || selectedIds.length === 0) return;
    const hasData = formDatos.razonSocial || formDatos.numeroDocumento || formDatos.direccion || formDatos.telefono || formDatos.contacto || formDatos.email || formDatos.tipoComprobante || formDocs.length > 0;
    if (!hasData && reservaStep === 0) return;
    reservaBorradorDB.guardar([...selectedIds].sort(), formDatos, formDocs, reservaStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formDatos, formDocs, reservaStep]);

  // Persist on close without submit
  const handleOpenChange = (open: boolean) => {
    if (!open && !submitting) {
      if (formDatos.razonSocial || formDatos.numeroDocumento || formDatos.direccion || formDatos.tipoComprobante || formDocs.length > 0) {
        reservaBorradorDB.guardar(selectedIds, formDatos, formDocs, reservaStep);
      }
      setReservaStep(0);
    }
    setReservaOpen(open);
  };

  const handleUpload = (file: File): Promise<string> => uploadService.subir(file);

  const addDoc = async (file: File) => {
    setUploading(true);
    try {
      const url = await handleUpload(file);
      setFormDocs((prev) => [...prev, url]);
    } catch { /* ignore */ }
    setUploading(false);
  };

  const removeDoc = (idx: number) => setFormDocs((prev) => prev.filter((_, i) => i !== idx));

  /** Crea la reserva (bloquea los stands) y devuelve el id de la solicitud ("" si falla). */
  const crearReserva = useCallback(async (): Promise<string> => {
    const standIds = selectedIds
      .map((id) => linkedMap.get(id)?.dbId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    if (standIds.length === 0) {
      setSubmitError("No se encontraron los stands seleccionados. Recarga la pagina e intenta de nuevo.");
      return "";
    }
    const result = await gessService.reservar({
      standIds,
      datos: {
        razonSocial: formDatos.razonSocial || formDatos.numeroDocumento,
        tipoDocumento: formDatos.tipoComprobante === TIPOS_COMPROBANTE.FACTURA ? TIPOS_DOCUMENTO.RUC : (formDatos.tipoDocumento || TIPOS_DOCUMENTO.DNI),
        numeroDocumento: formDatos.numeroDocumento,
        email: formDatos.email,
      },
    });
    if (!result.ok) {
      setSubmitError(result.message ?? "No se pudo crear la reserva. Verifica la disponibilidad de los stands.");
      return "";
    }
    if (!result.solicitudId) {
      setSubmitError("La reserva se creo pero no se obtuvo el identificador de la solicitud.");
      return "";
    }
    return result.solicitudId;
  }, [selectedIds, linkedMap, formDatos]);

  /** IDs (gess_stand) de la seleccion actual; "" si no se pudieron resolver. */
  const standIdsSeleccionados = useCallback((): string[] => {
    return selectedIds
      .map((id) => linkedMap.get(id)?.dbId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  }, [selectedIds, linkedMap]);

  /**
   * Paso 2 (cuotas): genera el contrato BORRADOR con la modalidad elegida.
   * No crea la solicitud: esta se crea recien al enviar (paso Confirmar).
   */
  const generarContratoBorrador = useCallback(async (): Promise<boolean> => {
    const standIds = standIdsSeleccionados();
    if (standIds.length === 0) {
      setSubmitError("No se encontraron los stands seleccionados. Recarga la pagina e intenta de nuevo.");
      return false;
    }
    setGenerandoContrato(true);
    setSubmitError(null);
    try {
      const data = await contratosService.borrador({
        standIds,
        cuotas: cuotasConfig.map((c) => ({ porcentaje: c.porcentaje, fechaVencimiento: c.fecha })),
        idioma: idiomaODefecto(leerIdiomaCookie()),
      });
      setContrato({ solicitudId: "", docxUrl: data.docxUrl, pdfUrl: data.pdfUrl });
      setContratoFirmadoUrl(null);
      setFirmaDigitalAplicada(false);
      return true;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "No se pudo generar el contrato. Intenta de nuevo.");
      return false;
    } finally {
      setGenerandoContrato(false);
    }
  }, [cuotasConfig, standIdsSeleccionados]);

  /** Paso 4: sube el contrato firmado por el cliente. */
  const subirContratoFirmado = async (file: File) => {
    setSubiendoFirmado(true);
    try {
      setContratoFirmadoUrl(await uploadService.subir(file));
      setFirmaDigitalAplicada(false);
    } catch {
      setSubmitError("No se pudo subir el contrato firmado. Intenta de nuevo.");
    }
    setSubiendoFirmado(false);
  };

  /**
   * Firma digital (RF-12): estampa la firma del perfil en el contrato BORRADOR y lo deja
   * listo como contrato firmado. Al enviar la solicitud se regenera firmado sobre esta.
   */
  const firmarDigitalmente = useCallback(async (): Promise<boolean> => {
    if (!contrato) {
      setSubmitError("Primero configura las cuotas y genera el contrato.");
      return false;
    }
    const standIds = standIdsSeleccionados();
    if (standIds.length === 0) {
      setSubmitError("No se encontraron los stands seleccionados. Recarga la pagina e intenta de nuevo.");
      return false;
    }
    setFirmandoDigital(true);
    setSubmitError(null);
    try {
      const data = await contratosService.firmarBorrador({
        standIds,
        cuotas: cuotasConfig.map((c) => ({ porcentaje: c.porcentaje, fechaVencimiento: c.fecha })),
        idioma: idiomaODefecto(leerIdiomaCookie()),
      });
      setContratoFirmadoUrl(data.pdfUrl ?? data.docxUrl);
      setFirmaDigitalAplicada(true);
      return true;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "No se pudo firmar digitalmente el contrato.");
      return false;
    } finally {
      setFirmandoDigital(false);
    }
  }, [contrato, cuotasConfig, standIdsSeleccionados]);

  /**
   * Paso 4 (Confirmar): recien aqui se crea la solicitud (reserva), se adjunta el contrato
   * real, los anexos y el contrato firmado (digital regenerado o el subido por el cliente).
   */
  const handleSubmit = async (): Promise<boolean | string> => {
    if (!contrato) {
      const msg = "Primero configura las cuotas y genera el contrato.";
      setSubmitError(msg);
      return msg;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const solicitudId = contrato.solicitudId || (await crearReserva());
      if (!solicitudId) return "No se pudo crear la solicitud.";

      /* Contrato definitivo adjunto a la solicitud (recalculado en el servidor). */
      await contratosService.generar({
        solicitudId,
        cuotas: cuotasConfig.map((c) => ({ porcentaje: c.porcentaje, fechaVencimiento: c.fecha })),
        idioma: idiomaODefecto(leerIdiomaCookie()),
      });

      /* Si la firma vigente es la digital, se regenera firmada sobre la solicitud. */
      let firmadoUrl = contratoFirmadoUrl;
      if (firmaDigitalAplicada) {
        const firmado = await contratosService.firmar({
          solicitudId,
          idioma: idiomaODefecto(leerIdiomaCookie()),
        });
        firmadoUrl = firmado.pdfUrl ?? firmado.docxUrl;
      }

      for (const url of formDocs) {
        await solicitudesService.uploadDocumento({
          solicitudId,
          url,
          nombre: url.split("/").pop() ?? "anexo",
          tipo: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
        });
      }
      if (firmadoUrl) {
        await solicitudesService.uploadDocumento({
          solicitudId,
          url: firmadoUrl,
          nombre: firmadoUrl.split("/").pop() ?? "contrato-firmado",
          tipo: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
        });
      }
      await reservaBorradorDB.eliminar(selectedIds);
      setReservaOpen(false);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de conexion";
      setSubmitError(msg);
      return msg;
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setFormDatos(emptyDatos());
    setFormDocs([]);
    setReservaStep(0);
    setConfirmado(false);
    setCuotasConfig([{ porcentaje: 100, fecha: siguienteFechaCuota(null) }]);
    setContrato(null);
    setContratoFirmadoUrl(null);
    setFirmaDigitalAplicada(false);
    setReservaOpen(false);
  };

  return {
    reservaOpen, setReservaOpen,
    reservaStep, setReservaStep,
    formDatos, setFormDatos,
    formDocs,
    uploading,
    submitting,
    submitError,
    selectedCount,
    singleStand,
    stepDone,
    canGoStep,
    handleOpenChange,
    addDoc,
    removeDoc,
    handleSubmit,
    reset,
    confirmado, setConfirmado,
    cuotasConfig, setCuotasConfig,
    contrato,
    generandoContrato,
    generarContratoYReservar: generarContratoBorrador,
    contratoFirmadoUrl,
    subiendoFirmado,
    subirContratoFirmado,
    firmaPerfilUrl,
    firmandoDigital,
    firmarDigitalmente,
  };
}
