"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { reservaBorradorDB } from "@/lib/client/indexed-db";
import { gessService } from "@/lib/client/api/services/gess-service";
import { contratosService } from "@/lib/client/api/services/contratos-service";
import { portalEmpresaService } from "@/lib/client/api/services/portal-empresa-service";
import { solicitudesService } from "@/lib/client/api/services/solicitudes-service";
import { uploadService } from "@/lib/client/api/services/upload-service";
import { perfilService } from "@/lib/client/api/services/perfil-service";
import { errorReporting } from "@/lib/client/utils/error-reporting";
import type { PerfilDTO } from "@/lib/client/api/services/perfil-service";
import { isStepDatosCompleto, isValidTelefono, onlyPhoneDigits } from "@/lib/shared/utils/form-validator";
import { configCuotasValida, cronogramaValido, cuotasCoincidenConfig, cuotasPersonalizadasIniciales, cuotasPredeterminadas, type ConfigCuotasEmpresa } from "@/lib/shared/utils/cuotas";
import { dateUtils } from "@/lib/shared/utils/date";
import { idiomaODefecto } from "@/lib/shared/utils/idioma";
import { leerIdiomaCookie } from "@/lib/client/utils/idioma";
import { ANEXOS_REQUERIDOS, ERROR_LOG_PASOS_RESERVA, ETAPAS_ENVIO_RESERVA, type ErrorLogPasoReserva, type EtapaEnvioReserva, TIPOS_COMPROBANTE, TIPOS_DOCUMENTO, TIPOS_DOCUMENTO_SOLICITUD } from "@/lib/shared/constants";
import { datosContratoValidos } from "./interfaces";
import type { DatosContratoForm, FormDatos, GessLinkedInfo } from "./interfaces";
import { erroresRepresentantesAdicionales, representanteAdicionalDesdeDTO, representanteAdicionalPayload, type RepresentanteAdicionalForm } from "@/lib/shared/utils/representantes-adicionales";

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

/** True si las cuotas son una modalidad estandar vigente o el cronograma de la empresa. */
export function cuotasConfigValidas(
  cuotas: CuotaConfig[],
  configCuotas?: ConfigCuotasEmpresa | null,
  hoyISO: string = dateUtils.todayLimaInputValue(),
): boolean {
  const programadas = cuotas.map((c) => ({ porcentaje: c.porcentaje, fechaVencimiento: c.fecha }));
  if (configCuotasValida(configCuotas, hoyISO)) {
    return cuotasCoincidenConfig(programadas, configCuotas, hoyISO);
  }
  return cronogramaValido(programadas, hoyISO);
}

/** True si el contrato ya tiene firma manual o digital pendiente de aplicar al enviar. */
export function firmaReservaLista(
  contratoFirmadoUrl: string | null,
  firmaDigitalAplicada: boolean,
): boolean {
  return Boolean(contratoFirmadoUrl) || firmaDigitalAplicada;
}

/** Cuotas iniciales: cronograma de la empresa o 1 cuota estandar. */
function cuotasIniciales(configCuotas?: ConfigCuotasEmpresa | null): CuotaConfig[] {
  return cuotasPersonalizadasIniciales(configCuotas) ?? cuotasPredeterminadas(1) ?? [];
}

function standIdsKey(ids: string[]): string {
  return [...ids].sort().join("|");
}

function emptyDatos(): FormDatos {
  return { razonSocial: "", tipoDocumento: "", numeroDocumento: "", direccion: "", telefono: "", contacto: "", email: "", tipoComprobante: "" };
}

/** Datos del contrato vacios (paso Cuotas). */
function emptyContratoDatos(): DatosContratoForm {
  return { razonSocial: "", ruc: "", direccion: "", representante: "", representanteDni: "", partidaElectronica: "" };
}

/**
 * Telefono normalizado solo si es valido (9 digitos empezando en 9). La fuente puede
 * traerlo formateado o incompleto (ej. "914-536-27"); en ese caso no se prellena para
 * no bloquear el paso 1.
 */
function telefonoValidoO(value: string | null | undefined): string | null {
  const digits = onlyPhoneDigits(String(value ?? ""));
  return isValidTelefono(digits) ? digits : null;
}

/**
 * Completa los datos comerciales con la empresa fiscal vinculada al usuario
 * (perfil), sin pisar lo que el usuario ya escribio o el borrador guardado.
 */
function prefillEmpresa(prev: FormDatos, empresa: PerfilDTO["empresa"] | null | undefined): FormDatos {
  if (!empresa) return prev;
  /* Telefono: el de la empresa si es valido; si no, el celular del representante. */
  const telefono = telefonoValidoO(empresa.telefono) ?? telefonoValidoO(empresa.representanteCelular) ?? "";
  return {
    razonSocial: prev.razonSocial || empresa.razonSocial || "",
    tipoDocumento: prev.tipoDocumento || (empresa.ruc ? TIPOS_DOCUMENTO.RUC : ""),
    numeroDocumento: prev.numeroDocumento || empresa.ruc || "",
    direccion: prev.direccion || empresa.direccionFiscal || "",
    telefono: prev.telefono || telefono,
    contacto: prev.contacto || empresa.representanteLegalNombre || "",
    email: prev.email || empresa.emailContacto || empresa.representanteCorreo || "",
    tipoComprobante: prev.tipoComprobante || (empresa.ruc ? TIPOS_COMPROBANTE.FACTURA : ""),
  };
}

export function useReservaForm(
  selectedIds: string[],
  linkedMap: Map<string, GessLinkedInfo>,
  opciones: { sinContrato?: boolean } = {},
) {
  const sinContrato = opciones.sinContrato ?? true;
  const [reservaOpen, setReservaOpen] = useState(false);
  const [reservaStep, setReservaStep] = useState(0);
  const [formDatos, setFormDatos] = useState<FormDatos>(emptyDatos);
  /** Documentos del cliente por requisito (ANEXOS_REQUERIDOS): clave -> URL. */
  const [docsRequisitos, setDocsRequisitos] = useState<Record<string, string>>({});
  const [subiendoRequisito, setSubiendoRequisito] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<EtapaEnvioReserva | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [aceptaRepresentante, setAceptaRepresentante] = useState(false);

  /* Paso 3: cuotas + contrato. */
  /** Configuracion personalizada de cuotas de la empresa (Modalidad 4), si existe. */
  const [configCuotas, setConfigCuotas] = useState<ConfigCuotasEmpresa | null>(null);
  /** Cuotas configuradas por el cliente: porcentaje + fecha (1..N, hasta 9). */
  const [cuotasConfig, setCuotasConfig] = useState<CuotaConfig[]>(() => cuotasIniciales());
  /** Datos del exhibidor que van al cuerpo del contrato (paso Cuotas). */
  const [contratoDatos, setContratoDatos] = useState<DatosContratoForm>(emptyContratoDatos);
  /** Representante legal de la empresa del perfil (precarga del contrato). */
  const [representantePerfil, setRepresentantePerfil] = useState("");
  const [contrato, setContrato] = useState<ContratoReserva | null>(null);
  const [generandoContrato, setGenerandoContrato] = useState(false);
  /* Paso 4: contrato firmado por el cliente. */
  const [contratoFirmadoUrl, setContratoFirmadoUrl] = useState<string | null>(null);
  const [subiendoFirmado, setSubiendoFirmado] = useState(false);
  /* Firma digital del perfil (RF-12): permite firmar sin subir el documento. */
  const [firmaPerfilUrl, setFirmaPerfilUrl] = useState<string | null>(null);
  /** La firma digital se aplicara al generar el contrato definitivo al enviar. */
  const [firmaDigitalAplicada, setFirmaDigitalAplicada] = useState(false);
  const [representantesAdicionales, setRepresentantesAdicionales] = useState<RepresentanteAdicionalForm[]>([]);
  const [representantesEditados, setRepresentantesEditados] = useState(false);

  /** Cambiar modalidad invalida el contrato borrador y la firma previos. */
  const actualizarCuotas = useCallback((cuotas: CuotaConfig[]) => {
    setCuotasConfig(cuotas);
    setContrato(null);
    setContratoFirmadoUrl(null);
    setFirmaDigitalAplicada(false);
  }, []);

  const selectedCount = selectedIds.length;
  const singleStand = selectedCount === 1;
  const currentKey = standIdsKey(selectedIds);
  /*
   * Guard anti-cruce entre reservas: las respuestas de generar/firmar/subir
   * borrador se descartan si mientras estaban en vuelo cambio la seleccion de
   * stands o se disparo una peticion mas nueva (evita mostrar/adjuntar un
   * contrato de otra seleccion).
   */
  const contratoSeqRef = useRef(0);
  const keyVigenteRef = useRef(currentKey);
  useEffect(() => { keyVigenteRef.current = currentKey; }, [currentKey]);
  const esRespuestaVigente = (seq: number, key: string) => seq === contratoSeqRef.current && key === keyVigenteRef.current;
  /** Los 3 documentos requeridos (Ficha RUC, Vigencia de Poder, DNI/Pasaporte) estan adjuntos. */
  const anexosCompletos = ANEXOS_REQUERIDOS.every((a) => Boolean(docsRequisitos[a.key]));

  /** Datos del contrato con lo vacio completado desde el paso 1 y el perfil. */
  const contratoEfectivo = useMemo(() => ({
    razonSocial: contratoDatos.razonSocial || formDatos.razonSocial || formDatos.contacto,
    ruc: contratoDatos.ruc || formDatos.numeroDocumento,
    direccion: contratoDatos.direccion || formDatos.direccion,
    representante: contratoDatos.representante || representantePerfil,
    representanteDni: contratoDatos.representanteDni,
    partidaElectronica: contratoDatos.partidaElectronica,
  }), [contratoDatos, formDatos, representantePerfil]);

  const adicionalesValidos = erroresRepresentantesAdicionales(representantesAdicionales).every((e) => Object.keys(e).length === 0);
  const stepDone = useCallback((step: number): boolean => {
    if (selectedCount === 0) return false;
    if (step === 0) return isStepDatosCompleto(formDatos) && adicionalesValidos;
    if (step === 1) return cuotasConfigValidas(cuotasConfig, configCuotas) && (sinContrato || datosContratoValidos(contratoEfectivo));
    if (step === 2) return anexosCompletos && (sinContrato || (Boolean(contrato) && firmaReservaLista(contratoFirmadoUrl, firmaDigitalAplicada)));
    if (step === 3) return confirmado && aceptaRepresentante && (sinContrato || (Boolean(contrato) && firmaReservaLista(contratoFirmadoUrl, firmaDigitalAplicada)));
    return false;
  }, [selectedCount, formDatos, adicionalesValidos, anexosCompletos, cuotasConfig, configCuotas, contratoEfectivo, contrato, confirmado, aceptaRepresentante, contratoFirmadoUrl, firmaDigitalAplicada, sinContrato]);

  const canGoStep = useCallback((step: number): boolean => {
    if (step === 0) return true;
    if (step === 1) return stepDone(0);
    if (step === 2) return stepDone(0) && stepDone(1) && (sinContrato || Boolean(contrato));
    if (step === 3) return stepDone(0) && stepDone(1) && stepDone(2);
    return false;
  }, [stepDone, contrato, sinContrato]);

  /* Prellena los datos del contrato: la fusion vive en `contratoEfectivo` (sin efectos). */

  // Load from IndexedDB when modal opens or key changes
  useEffect(() => {
    if (!reservaOpen || selectedIds.length === 0) return;
    (async () => {
      const [perfil, draft] = await Promise.all([
        perfilService.get().catch(() => null),
        reservaBorradorDB.cargar(selectedIds),
      ]);
      setFirmaPerfilUrl(perfil?.firmaUrl ?? null);
      setRepresentantesAdicionales((perfil?.empresa?.representantesAdicionales ?? []).map(representanteAdicionalDesdeDTO));
      setRepresentantesEditados(false);
      setRepresentantePerfil(perfil?.empresa?.representanteLegalNombre ?? "");
      const config = perfil?.empresa?.configCuotas ?? null;
      setConfigCuotas(config);
      setCuotasConfig(cuotasIniciales(config));
      const base = draft ? { ...emptyDatos(), ...draft.datos } : emptyDatos();
      setFormDatos(prefillEmpresa(base, perfil?.empresa ?? null));
      if (draft) {
        setDocsRequisitos(draft.docsRequisitos ?? {});
        if (typeof draft.step === "number" && draft.step >= 0 && draft.step <= 1) {
          setReservaStep(draft.step);
        }
      } else {
        setDocsRequisitos({});
        setReservaStep(0);
      }
      setConfirmado(false);
      setAceptaRepresentante(false);
      setContratoDatos(emptyContratoDatos());
      setContrato(null);
      setContratoFirmadoUrl(null);
      setFirmaDigitalAplicada(false);
    })();
  }, [reservaOpen, currentKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Prellena los datos del contrato: la fusion vive en `contratoEfectivo` (sin efectos). */

  /** Datos del contrato listos para enviar (contratoEfectivo ya completa lo vacio). */
  const contratoPayload = useCallback(() => ({
    razonSocial: contratoEfectivo.razonSocial.trim(),
    ruc: contratoEfectivo.ruc.trim(),
    direccion: contratoEfectivo.direccion.trim(),
    representante: contratoEfectivo.representante.trim(),
    representanteDni: contratoEfectivo.representanteDni.trim(),
    partidaElectronica: contratoEfectivo.partidaElectronica.trim(),
  }), [contratoEfectivo]);

  // Auto-save to IndexedDB on form changes
  useEffect(() => {
    if (!reservaOpen || selectedIds.length === 0) return;
    const hasData = formDatos.razonSocial || formDatos.numeroDocumento || formDatos.direccion || formDatos.telefono || formDatos.contacto || formDatos.email || formDatos.tipoComprobante || Object.keys(docsRequisitos).length > 0;
    if (!hasData && reservaStep === 0) return;
    reservaBorradorDB.guardar([...selectedIds].sort(), formDatos, [], reservaStep, docsRequisitos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formDatos, docsRequisitos, reservaStep]);

  // Persist on close without submit
  const handleOpenChange = (open: boolean) => {
    if (!open && !submitting) {
      void guardarRepresentantes().catch(() => undefined);
      if (formDatos.razonSocial || formDatos.numeroDocumento || formDatos.direccion || formDatos.tipoComprobante || Object.keys(docsRequisitos).length > 0) {
        reservaBorradorDB.guardar(selectedIds, formDatos, [], reservaStep, docsRequisitos);
      }
      setReservaStep(0);
    }
    setReservaOpen(open);
  };

  const handleUpload = (file: File): Promise<string> => uploadService.subir(file);

  /** Sube el documento de un requisito (Ficha RUC / Vigencia de Poder / DNI o Pasaporte). */
  const addDocRequisito = async (requisito: string, file: File) => {
    setSubiendoRequisito(requisito);
    try {
      const url = await handleUpload(file);
      setDocsRequisitos((prev) => ({ ...prev, [requisito]: url }));
    } catch (err) {
      errorReporting.reserva(ERROR_LOG_PASOS_RESERVA.ANEXOS, err, { stands: selectedIds, extra: { requisito } });
      setSubmitError(err instanceof Error ? err.message : "No se pudo subir el documento. Intenta de nuevo.");
    }
    setSubiendoRequisito(null);
  };

  const removeDocRequisito = (requisito: string) => {
    setDocsRequisitos((prev) => {
      const next = { ...prev };
      delete next[requisito];
      return next;
    });
  };

  /** Sube la firma digital desde el wizard: mismo efecto que en /dashboard/perfil. */
  const subirFirmaPerfil = async (file: File): Promise<void> => {
    try {
      const url = await handleUpload(file);
      await perfilService.update({ firmaUrl: url });
      setFirmaPerfilUrl(url);
    } catch (err) {
      errorReporting.reserva(ERROR_LOG_PASOS_RESERVA.FIRMA_PERFIL, err, { stands: selectedIds });
      throw err;
    }
  };

  /** Crea la reserva (bloquea los stands) y devuelve el id de la solicitud ("" si falla). */
  const crearReserva = useCallback(async (holdId?: string): Promise<string> => {
    const standIds = selectedIds
      .map((id) => linkedMap.get(id)?.dbId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    if (standIds.length === 0) {
      const msg = "No se encontraron los stands seleccionados. Recarga la pagina e intenta de nuevo.";
      errorReporting.reserva(ERROR_LOG_PASOS_RESERVA.CONFIRMAR, new Error(msg), { stands: selectedIds });
      setSubmitError(msg);
      return "";
    }
    const result = await gessService.reservar({
      standIds,
      cuotas: cuotasConfig.map((c) => ({ porcentaje: c.porcentaje, fechaVencimiento: c.fecha })),
      ...(holdId ? { holdId } : {}),
      datos: {
        razonSocial: formDatos.razonSocial || formDatos.numeroDocumento,
        tipoDocumento: formDatos.tipoComprobante === TIPOS_COMPROBANTE.FACTURA ? TIPOS_DOCUMENTO.RUC : (formDatos.tipoDocumento || TIPOS_DOCUMENTO.DNI),
        numeroDocumento: formDatos.numeroDocumento,
        email: formDatos.email,
        /* Snapshot fiscal del paso 1 (payload de facturacion del IIMP). */
        tipoComprobante: formDatos.tipoComprobante,
        direccion: formDatos.direccion,
        telefono: formDatos.telefono,
        contacto: formDatos.contacto,
      },
    });
    if (!result.ok) {
      const msg = result.message ?? "No se pudo crear la reserva. Verifica la disponibilidad de los stands.";
      errorReporting.reserva(ERROR_LOG_PASOS_RESERVA.CONFIRMAR, new Error(msg), { stands: selectedIds, extra: { conflicted: result.conflicted ?? [] } });
      setSubmitError(msg);
      return "";
    }
    if (!result.solicitudId) {
      const msg = "La reserva se creo pero no se obtuvo el identificador de la solicitud.";
      errorReporting.reserva(ERROR_LOG_PASOS_RESERVA.CONFIRMAR, new Error(msg), { stands: selectedIds });
      setSubmitError(msg);
      return "";
    }
    return result.solicitudId;
  }, [selectedIds, linkedMap, formDatos, cuotasConfig]);

  /** IDs (gess_stand) de la seleccion actual; "" si no se pudieron resolver. */
  const standIdsSeleccionados = useCallback((): string[] => {
    return selectedIds
      .map((id) => linkedMap.get(id)?.dbId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  }, [selectedIds, linkedMap]);

  /** Cambios del editor de representantes: se persisten antes del contrato. */
  const actualizarRepresentantes = useCallback((value: RepresentanteAdicionalForm[]) => {
    setRepresentantesAdicionales(value);
    setRepresentantesEditados(true);
  }, []);


  /** Persiste los representantes adicionales solo si el usuario los edito. */
  const guardarRepresentantes = useCallback(async (): Promise<void> => {
    if (!representantesEditados) return;
    await portalEmpresaService.guardarRepresentantes(
      representantesAdicionales.map(representanteAdicionalPayload),
    );
    setRepresentantesEditados(false);
  }, [representantesAdicionales, representantesEditados]);
  /** Sincroniza en segundo plano los representantes adicionales con la empresa. */
  useEffect(() => {
    if (!representantesEditados) return;
    const timer = setTimeout(() => {
      void guardarRepresentantes().catch(() => undefined);
    }, 700);
    return () => clearTimeout(timer);
  }, [representantesAdicionales, representantesEditados, guardarRepresentantes]);

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
    const seq = ++contratoSeqRef.current;
    const key = currentKey;
    setGenerandoContrato(true);
    setSubmitError(null);
    try {
      await guardarRepresentantes();
      const data = await contratosService.borrador({
        standIds,
        cuotas: cuotasConfig.map((c) => ({ porcentaje: c.porcentaje, fechaVencimiento: c.fecha })),
        idioma: idiomaODefecto(leerIdiomaCookie()),
        contrato: contratoPayload(),
      });
      /* Respuesta obsoleta (cambio la seleccion o hay otra generacion en curso): se ignora. */
      if (!esRespuestaVigente(seq, key)) return false;
      setContrato({ solicitudId: "", docxUrl: data.docxUrl, pdfUrl: data.pdfUrl });
      setContratoFirmadoUrl(null);
      setFirmaDigitalAplicada(false);
      return true;
    } catch (err) {
      errorReporting.reserva(ERROR_LOG_PASOS_RESERVA.CUOTAS, err, { stands: selectedIds });
      if (esRespuestaVigente(seq, key)) {
        setSubmitError(err instanceof Error ? err.message : "No se pudo generar el contrato. Intenta de nuevo.");
      }
      return false;
    } finally {
      if (esRespuestaVigente(seq, key)) setGenerandoContrato(false);
    }
  }, [cuotasConfig, standIdsSeleccionados, contratoPayload, currentKey, selectedIds, guardarRepresentantes]);

  /** Paso 4: sube el contrato firmado por el cliente (descargado y firmado manualmente). */
  const subirContratoFirmado = async (file: File) => {
    const key = currentKey;
    setSubiendoFirmado(true);
    try {
      const url = await uploadService.subir(file);
      if (key !== keyVigenteRef.current) return;
      setContratoFirmadoUrl(url);
      setFirmaDigitalAplicada(false);
    } catch (err) {
      errorReporting.reserva(ERROR_LOG_PASOS_RESERVA.FIRMA_MANUAL, err, { stands: selectedIds });
      if (key === keyVigenteRef.current) {
        setSubmitError(err instanceof Error ? err.message : "No se pudo subir el contrato firmado. Intenta de nuevo.");
      }
    } finally {
      if (key === keyVigenteRef.current) setSubiendoFirmado(false);
    }
  };

  /**
   * Firma digital (RF-12): solo valida que el perfil tenga firma y marca la intencion.
   * El contrato definitivo firmado se genera UNA sola vez al enviar la solicitud; no
   * se genera un borrador firmado que luego se descarta.
   */
  const firmarDigitalmente = useCallback((): boolean => {
    if (!contrato) {
      setSubmitError("Primero configura las cuotas y genera el contrato.");
      return false;
    }
    if (!firmaPerfilUrl) {
      setSubmitError("Antes de firmar digitalmente, sube tu firma (imagen) en tu Perfil.");
      return false;
    }
    setSubmitError(null);
    setContratoFirmadoUrl(null);
    setFirmaDigitalAplicada(true);
    return true;
  }, [contrato, firmaPerfilUrl]);

  /**
   * Paso 4 (Confirmar): recien aqui se crea la solicitud (reserva), se adjunta el contrato
   * real, los anexos y el contrato firmado (digital regenerado o el subido por el cliente).
   */
  const handleSubmit = async (holdId?: string): Promise<boolean | string> => {
    if (!sinContrato && !contrato) {
      const msg = "Primero configura las cuotas y genera el contrato.";
      setSubmitError(msg);
      return msg;
    }
    try {
      await guardarRepresentantes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudieron guardar los representantes adicionales.";
      setSubmitError(msg);
      return msg;
    }
    setSubmitting(true);
    setSubmitStage(ETAPAS_ENVIO_RESERVA.CREANDO_SOLICITUD);
    setSubmitError(null);
    let pasoError: ErrorLogPasoReserva = ERROR_LOG_PASOS_RESERVA.CONFIRMAR;
    try {
      const solicitudId = contrato?.solicitudId || (await crearReserva(holdId));
      if (!solicitudId) return "No se pudo crear la solicitud.";
      /* Retry-safe: si un intento previo creo la solicitud, reutilizarla (evita duplicados). */
      const contratoYaTieneArchivo = Boolean(contrato?.docxUrl);
      setContrato((prev) => (
        prev
          ? { ...prev, solicitudId }
          : { solicitudId, docxUrl: "", pdfUrl: null }
      ));

      /*
       * Politica homologada: al enviar la solicitud se genera la PLANTILLA del
       * contrato (sin firma). El revisor solo habilita la firma y el cliente la
       * firma desde Mis solicitudes. En un reintento no se regenera si el
       * archivo ya existe.
       */
      if (!sinContrato && !contratoYaTieneArchivo) {
        pasoError = ERROR_LOG_PASOS_RESERVA.CUOTAS;
        setSubmitStage(ETAPAS_ENVIO_RESERVA.GENERANDO_CONTRATO);
        const generado = await contratosService.generar({
          solicitudId,
          cuotas: cuotasConfig.map((c) => ({ porcentaje: c.porcentaje, fechaVencimiento: c.fecha })),
          idioma: idiomaODefecto(leerIdiomaCookie()),
          contrato: contratoPayload(),
        });
        setContrato({ solicitudId, docxUrl: generado.docxUrl, pdfUrl: generado.pdfUrl });
      }

      /* Si la firma vigente es la digital, se regenera firmada sobre la solicitud. */
      let firmadoUrl = sinContrato ? null : contratoFirmadoUrl;
      if (!sinContrato && firmaDigitalAplicada) {
        pasoError = ERROR_LOG_PASOS_RESERVA.FIRMA_DIGITAL;
        setSubmitStage(ETAPAS_ENVIO_RESERVA.FIRMANDO_CONTRATO);
        const firmado = await contratosService.firmar({
          solicitudId,
          idioma: idiomaODefecto(leerIdiomaCookie()),
          contrato: contratoPayload(),
        });
        firmadoUrl = firmado.pdfUrl ?? firmado.docxUrl;
      }
      pasoError = ERROR_LOG_PASOS_RESERVA.ANEXOS;
      setSubmitStage(ETAPAS_ENVIO_RESERVA.ADJUNTANDO_DOCUMENTOS);

      for (const [requisito, url] of Object.entries(docsRequisitos)) {
        await solicitudesService.uploadDocumento({
          solicitudId,
          url,
          nombre: url.split("/").pop() ?? requisito,
          tipo: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
          requisito,
          permitirAnexosIniciales: sinContrato,
        });
      }
      pasoError = ERROR_LOG_PASOS_RESERVA.CONFIRMAR;
      if (!sinContrato && firmadoUrl) {
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
      errorReporting.reserva(pasoError, err, { stands: selectedIds });
      const msg = err instanceof Error ? err.message : "Error de conexion";
      setSubmitError(msg);
      return msg;
    } finally {
      setSubmitting(false);
      setSubmitStage(null);
    }
  };

  const reset = () => {
    setFormDatos(emptyDatos());
    setDocsRequisitos({});
    setReservaStep(0);
    setConfirmado(false);
    setAceptaRepresentante(false);
    setCuotasConfig(cuotasIniciales());
    setConfigCuotas(null);
    setContratoDatos(emptyContratoDatos());
    setRepresentantePerfil("");
    setContrato(null);
    setContratoFirmadoUrl(null);
    setFirmaDigitalAplicada(false);
    setRepresentantesAdicionales([]);
    setRepresentantesEditados(false);
    setReservaOpen(false);
  };

  return {
    reservaOpen, setReservaOpen,
    reservaStep, setReservaStep,
    formDatos, setFormDatos,
    docsRequisitos,
    subiendoRequisito,
    submitting,
    submitStage,
    submitError,
    selectedCount,
    singleStand,
    stepDone,
    canGoStep,
    handleOpenChange,
    addDocRequisito,
    removeDocRequisito,
    handleSubmit,
    reset,
    confirmado, setConfirmado,
    aceptaRepresentante, setAceptaRepresentante,
    cuotasConfig, setCuotasConfig: actualizarCuotas,
    configCuotas,
    contratoDatos: contratoEfectivo, setContratoDatos,
    contratoValido: datosContratoValidos(contratoEfectivo),
    contrato,
    generandoContrato,
    generarContratoYReservar: generarContratoBorrador,
    contratoFirmadoUrl,
    subiendoFirmado,
    subirContratoFirmado,
    firmaPerfilUrl,
    subirFirmaPerfil,
    firmarDigitalmente,
    firmaDigitalAplicada,
    representantesAdicionales,
    setRepresentantesAdicionales: actualizarRepresentantes,
  };
}
