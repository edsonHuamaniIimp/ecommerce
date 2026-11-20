"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Progress,
  RadioGroup,
  RadioGroupItem,
} from "@nrivera-iimp/ui-kit-iimp";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  FileText,
  Info,
  Loader2,
  Lock,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { DdStepper } from "./dd-stepper";
import { DdWizardPaso2 } from "./dd-wizard-paso2";
import { DdWizardPaso3 } from "./dd-wizard-paso3";
import { DdDocumentoBadge } from "./dd-estado-badge";
import { DdDocumentoPreviewDialog } from "./dd-documento-preview-dialog";
import { DdRadioIndicator } from "./dd-radio-indicator";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import { sunatService } from "@/lib/client/api/services/sunat-service";
import { useConfirm } from "@/hooks/use-confirm";
import {
  BADGE_STYLES,
  BYTES_POR_MB,
  DD_DOCUMENTO_ACCEPT,
  DD_DOCUMENTO_ACCEPT_ADICIONAL,
  DD_DOCUMENTO_ACCEPT_DECLARACION,
  DD_DOCUMENTO_ACCEPT_VIGENCIA,
  DD_DOCUMENTO_ADICIONAL,
  DD_DOCUMENTO_ESTADOS,
  DD_DOCUMENTO_EXTENSIONES,
  DD_DOCUMENTO_EXTENSIONES_ADICIONAL,
  DD_DOCUMENTO_EXTENSIONES_VIGENCIA,
  DD_DOCUMENTO_VIGENCIA,
  DD_DECLARACION_COMPROMISO,
  DD_DOCUMENTO_EXTENSIONES_DECLARACION,
  DD_DOCUMENTO_MAX_BYTES,
  DD_DOCUMENTOS,
  DD_DOCUMENTOS_REQUERIDOS,
  DD_ESTADOS,
  DD_OBSERVACION_AREA_LABELS,
  DD_OBSERVACION_ESTADOS,
  DD_OBSERVACION_VINCULO_TIPOS,
  DD_PAIS_DEFAULT,
  DD_TIPOS_DOCUMENTO_REPRESENTANTE,
  DD_TIPOS_DOCUMENTO_VINCULO,
  DD_PASOS,
  DD_RUTAS,
  REGEX_DNI,
  REGEX_RUC,
  type DdDocumentoEstado,
  type DdDocumentoTipo,
  type DdTipoDocumentoVinculo,
  type DdTipoVinculoPersona,
  type DdVinculo,
} from "@/lib/shared/constants";
import { archivoUtils } from "@/lib/shared/utils/archivo";
import { ddUtils } from "@/lib/shared/utils/debida-diligencia";
import {
  esEmpresaVinculada,
  normalizarTipoDocumentoVinculo,
  tipoDocumentoVinculoConConsulta,
} from "@/lib/shared/utils/debida-diligencia-v2";
import { dateUtils } from "@/lib/shared/utils/date";
import { esPaisPeru } from "@/lib/shared/utils/pais";
import type {
  DdDocumentoVersionDTO,
  DdEmpresaDTO,
  DdExpedienteDTO,
  DdGuardarRequestDTO,
} from "@/types/dto/debida-diligencia";

export interface BeneficiarioForm {
  id: string;
  nombre: string;
  documento: string;
  tipoDocumento: string;
  nacionalidad: string;
  porcentaje: string;
  tipoVinculoPersona: string;
}

interface Props {
  empresa: DdEmpresaDTO | null;
  expediente: DdExpedienteDTO | null;
  requiereDeclaracionVigencia?: boolean;
}

interface DocumentoForm {
  id: string;
  tipo: DdDocumentoTipo;
  nombre: string;
  url: string;
  estado: DdDocumentoEstado;
  observacion: string | null;
  updatedAt: string;
  versiones: DdDocumentoVersionDTO[];
}

function documentosDesde(expediente: DdExpedienteDTO | null): DocumentoForm[] {
  return (expediente?.documentos ?? []).map((documento) => ({
    ...documento,
    tipo: documento.tipo as DdDocumentoTipo,
    estado: documento.estado as DdDocumentoEstado,
    versiones: documento.versiones ?? [],
  }));
}

export interface FormState {
  tipoRelacionComercial: DdVinculo[];
  tipoRelacionComercialOtro: string;
  actividadEconomica: string;
  actividadEconomicaOtro: string;
  paisConstitucion: string;
  sitioWeb: string;
  emailRepresentante: string;
  aceptaDatos: boolean;
  aceptaVerificacion: boolean;
  declaraVerdad: boolean;
  representanteNombre: string;
  representanteTipoDocumento: string;
  representanteDocumento: string;
  representanteNacionalidad: string;
}

function nuevoBeneficiario(): BeneficiarioForm {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `b-${Math.random().toString(36).slice(2, 12)}`,
    nombre: "",
    documento: "",
    tipoDocumento: DD_TIPOS_DOCUMENTO_VINCULO.DNI,
    nacionalidad: "",
    porcentaje: "0",
    tipoVinculoPersona: "",
  };
}

function formDesde(empresa: DdEmpresaDTO | null, expediente: DdExpedienteDTO | null): FormState {
  const representanteNacionalidad =
    expediente?.representanteNacionalidad ?? DD_PAIS_DEFAULT;
  const representanteTipoDocumento =
    expediente?.representanteTipoDocumento ??
    (esPaisPeru(representanteNacionalidad)
      ? DD_TIPOS_DOCUMENTO_REPRESENTANTE.DNI
      : DD_TIPOS_DOCUMENTO_REPRESENTANTE.PASAPORTE);
  return {
    tipoRelacionComercial: (expediente?.tipoRelacionComercial as DdVinculo[] | undefined) ?? [],
    tipoRelacionComercialOtro: expediente?.tipoRelacionComercialOtro ?? "",
    actividadEconomica: expediente?.actividadEconomica ?? "",
    actividadEconomicaOtro: expediente?.actividadEconomicaOtro ?? "",
    paisConstitucion: expediente?.paisConstitucion ?? DD_PAIS_DEFAULT,
    sitioWeb: expediente?.sitioWeb ?? empresa?.sitioWeb ?? "",
    emailRepresentante:
      expediente?.emailRepresentante ??
      empresa?.representanteCorreo ??
      empresa?.emailContacto ??
      "",
    aceptaDatos: expediente?.aceptaDatos ?? false,
    aceptaVerificacion: expediente?.aceptaVerificacion ?? false,
    declaraVerdad: expediente?.declaraVerdad ?? false,
    representanteNombre:
      expediente?.representanteNombre ?? empresa?.representanteLegalNombre ?? "",
    representanteTipoDocumento,
    representanteDocumento:
      expediente?.representanteDocumento ?? empresa?.representanteLegalDni ?? "",
    representanteNacionalidad,
  };
}

function beneficiariosDesde(expediente: DdExpedienteDTO | null): BeneficiarioForm[] {
  if (!expediente || expediente.beneficiarios.length === 0) return [];
  return expediente.beneficiarios.map((b) => ({
    id: b.id,
    nombre: b.nombre,
    documento: b.documento,
    tipoDocumento: normalizarTipoDocumentoVinculo(
      b.tipoVinculoPersona,
      b.tipoDocumento,
      b.nacionalidad,
    ),
    nacionalidad: b.nacionalidad,
    porcentaje: String(b.porcentaje),
    tipoVinculoPersona: b.tipoVinculoPersona ?? "",
  }));
}

/** Wizard de 4 pasos de Debida Diligencia (Portal del Expositor). */
export function DdWizard({
  empresa,
  expediente: expedienteInicial,
  requiereDeclaracionVigencia = false,
}: Props) {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();
  const [paso, setPaso] = useState(() =>
    expedienteInicial?.estado === DD_ESTADOS.OBSERVADA ||
    expedienteInicial?.documentos.some((documento) => documento.estado === DD_DOCUMENTO_ESTADOS.OBSERVADO)
      ? 4
      : 1,
  );
  const [form, setForm] = useState<FormState>(() => formDesde(empresa, expedienteInicial));
  const [beneficiarios, setBeneficiarios] = useState<BeneficiarioForm[]>(
    () => beneficiariosDesde(expedienteInicial),
  );
  const [documentos, setDocumentos] = useState<DocumentoForm[]>(
    () => documentosDesde(expedienteInicial),
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [buscandoBeneficiario, setBuscandoBeneficiario] = useState<string | null>(null);
  const [buscandoRepresentante, setBuscandoRepresentante] = useState(false);
  const lookupTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lookupSeq = useRef<Record<string, number>>({});
  const representanteLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const representanteLookupSeq = useRef(0);
  const [representanteValidado, setRepresentanteValidado] = useState<"DNI" | "RUC" | null>(null);
  const [previewDocumento, setPreviewDocumento] = useState<{ url: string; nombre: string } | null>(null);
  const [beneficiariosValidados, setBeneficiariosValidados] = useState<Record<string, "DNI" | "RUC">>({});
  const inputsArchivo = useRef<Record<string, HTMLInputElement | null>>({});
  const observadoScrolledRef = useRef(false);
  const documentosObservados = documentos.filter(
    (documento) => documento.estado === DD_DOCUMENTO_ESTADOS.OBSERVADO,
  );
  const observacionesAbiertas = (expedienteInicial?.observaciones ?? []).filter((observacion) => {
    if (observacion.estado !== DD_OBSERVACION_ESTADOS.ABIERTA) return false;
    if (!observacion.documentoTipo) return true;
    const documento = documentos.find((item) => item.tipo === observacion.documentoTipo);
    return documento?.estado !== DD_DOCUMENTO_ESTADOS.APROBADO;
  });
  const observacionesGenerales = observacionesAbiertas.filter(
    (observacion) => !observacion.vinculoTipo,
  );
  const observacionesRepresentante = [...new Set(
    observacionesAbiertas
      .filter((observacion) => observacion.vinculoTipo === DD_OBSERVACION_VINCULO_TIPOS.REPRESENTANTE)
      .map((observacion) => observacion.texto.trim())
      .filter((texto) => texto.length > 0),
  )];
  const observacionesVinculoFaltante = [...new Set(
    observacionesAbiertas
      .filter((observacion) => observacion.vinculoTipo === DD_OBSERVACION_VINCULO_TIPOS.FALTANTE)
      .map((observacion) => observacion.texto.trim())
      .filter((texto) => texto.length > 0),
  )];
  const observacionesBeneficiario = observacionesAbiertas.reduce<Record<string, string[]>>(
    (mapa, observacion) => {
      if (
        observacion.vinculoTipo === DD_OBSERVACION_VINCULO_TIPOS.BENEFICIARIO &&
        observacion.beneficiarioId &&
        observacion.texto.trim()
      ) {
        mapa[observacion.beneficiarioId] = [
          ...new Set([...(mapa[observacion.beneficiarioId] ?? []), observacion.texto.trim()]),
        ];
      }
      return mapa;
    },
    {},
  );
  const observacionesAgrupadas = ddUtils.agruparObservacionesPorComentario(observacionesGenerales);
  const textosObservaciones = new Set(observacionesAgrupadas.map((observacion) => observacion.texto.trim()));
  const documentosVisibles: {
    tipo: DdDocumentoTipo;
    titulo: string;
    ayuda: string;
    permiteFormato: boolean;
    formatoUrl?: string | null;
  }[] = [
    ...DD_DOCUMENTOS_REQUERIDOS,
    DD_DOCUMENTO_VIGENCIA,
    DD_DOCUMENTO_ADICIONAL,
  ];
  const enSubsanacion =
    expedienteInicial?.estado === DD_ESTADOS.OBSERVADA || observacionesAbiertas.length > 0;
  /* Comentarios de documentos observados (se muestran una sola vez). */
  const comentariosDocumentos = [...new Set(
    documentosObservados
      .map((documento) => documento.observacion?.trim() ?? "")
      .filter((texto) => texto.length > 0 && !textosObservaciones.has(texto)),
  )];
  const tiposObservados = new Set([
    ...documentosObservados.map((documento) => documento.tipo),
    ...observacionesAbiertas.flatMap((observacion) => observacion.documentoTipo ? [observacion.documentoTipo] : []),
  ]);
  const tituloDocumento = (tipo: string) =>
    DD_DOCUMENTOS_REQUERIDOS.find((documento) => documento.tipo === tipo)?.titulo ??
    (tipo === DD_DOCUMENTOS.DECLARACION_VIGENCIA
      ? DD_DOCUMENTO_VIGENCIA.titulo
      : tipo === DD_DOCUMENTOS.ADICIONAL
        ? DD_DOCUMENTO_ADICIONAL.titulo
        : tipo);
  const tiposObservadosLabels = [...tiposObservados].map(tituloDocumento);
  const estaEnCorreccion = (documento: DocumentoForm) =>
    documento.estado === DD_DOCUMENTO_ESTADOS.OBSERVADO ||
    (documento.estado === DD_DOCUMENTO_ESTADOS.CARGADO && tiposObservados.has(documento.tipo));
  const documentosObligatoriosPendientes = DD_DOCUMENTOS_REQUERIDOS.filter((requisito) => {
    const documento = documentos.find((item) => item.tipo === requisito.tipo);
    return !documento || (enSubsanacion && documento.estado === DD_DOCUMENTO_ESTADOS.OBSERVADO);
  });
  const obligatoriosCargados =
    DD_DOCUMENTOS_REQUERIDOS.length - documentosObligatoriosPendientes.length;
  const puedeSubirDocumento = (documento: DocumentoForm | null) =>
    !enSubsanacion || !documento || estaEnCorreccion(documento);
  const etiquetaSubida = (documento: DocumentoForm | null) => {
    if (!documento) return "Seleccionar archivo";
    return estaEnCorreccion(documento) ? "Subir nueva versión" : "Reemplazar";
  };

  useEffect(() => {
    if (paso === 1) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [paso]);

  useEffect(() => {
    if (paso !== 4 || observadoScrolledRef.current) return;
    const primero = documentos.find((documento) => documento.estado === DD_DOCUMENTO_ESTADOS.OBSERVADO);
    if (!primero) return;
    observadoScrolledRef.current = true;
    document.getElementById(`dd-doc-${primero.tipo}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [paso, documentos]);

  useEffect(() => () => {
    if (representanteLookupTimer.current) clearTimeout(representanteLookupTimer.current);
    Object.values(lookupTimers.current).forEach((temporizador) => clearTimeout(temporizador));
  }, []);

  const setCampo = <K extends keyof FormState>(campo: K, valor: FormState[K]) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    setError(null);
  };

  const cambiarNacionalidadRepresentante = (valor: string) => {
    representanteLookupSeq.current += 1;
    if (representanteLookupTimer.current) clearTimeout(representanteLookupTimer.current);
    setBuscandoRepresentante(false);
    setRepresentanteValidado(null);
    setCampo("representanteNacionalidad", valor);
    if (esPaisPeru(valor)) {
      if (form.representanteTipoDocumento !== DD_TIPOS_DOCUMENTO_REPRESENTANTE.DNI) {
        setCampo("representanteTipoDocumento", DD_TIPOS_DOCUMENTO_REPRESENTANTE.DNI);
      }
    } else if (form.representanteTipoDocumento === DD_TIPOS_DOCUMENTO_REPRESENTANTE.DNI) {
      setCampo("representanteTipoDocumento", DD_TIPOS_DOCUMENTO_REPRESENTANTE.PASAPORTE);
    }
  };

  const cambiarTipoDocumentoRepresentante = (valor: string) => {
    representanteLookupSeq.current += 1;
    if (representanteLookupTimer.current) clearTimeout(representanteLookupTimer.current);
    setBuscandoRepresentante(false);
    setRepresentanteValidado(null);
    setCampo("representanteTipoDocumento", valor);
  };

  const cambiarBeneficiario = (id: string, campo: keyof Omit<BeneficiarioForm, "id">, valor: string) => {
    setBeneficiarios((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        if (campo === "tipoVinculoPersona") {
          return {
            ...b,
            tipoVinculoPersona: valor,
            tipoDocumento: esEmpresaVinculada(valor)
              ? DD_TIPOS_DOCUMENTO_VINCULO.RUC
              : esPaisPeru(b.nacionalidad)
                ? DD_TIPOS_DOCUMENTO_VINCULO.DNI
                : DD_TIPOS_DOCUMENTO_VINCULO.PASAPORTE,
          };
        }
        if (campo === "tipoDocumento") {
          if (esEmpresaVinculada(b.tipoVinculoPersona)) return b;
          return { ...b, tipoDocumento: valor };
        }
        if (campo === "nacionalidad") {
          if (esEmpresaVinculada(b.tipoVinculoPersona)) return { ...b, nacionalidad: valor };
          return {
            ...b,
            nacionalidad: valor,
            tipoDocumento: esPaisPeru(valor)
              ? DD_TIPOS_DOCUMENTO_VINCULO.DNI
              : DD_TIPOS_DOCUMENTO_VINCULO.PASAPORTE,
          };
        }
        return { ...b, [campo]: valor };
      }),
    );
    if (
      campo === "documento" ||
      campo === "tipoDocumento" ||
      campo === "tipoVinculoPersona" ||
      campo === "nacionalidad"
    ) {
      setBeneficiariosValidados((prev) => {
        const siguiente = { ...prev };
        delete siguiente[id];
        return siguiente;
      });
    }
    setError(null);
  };

  const consultarDocumento = async (
    documento: string,
    tipoDocumento: DdTipoDocumentoVinculo,
  ): Promise<{ tipo: "DNI" | "RUC"; nombre: string }> => {
    if (tipoDocumento === DD_TIPOS_DOCUMENTO_VINCULO.RUC) {
      if (!REGEX_RUC.test(documento)) {
        throw new Error("Ingrese un RUC de 11 dígitos para buscar.");
      }
      const resultado = await sunatService.consultarRuc(documento);
      if (resultado.error || !resultado.razonSocial) {
        throw new Error(resultado.error ?? "No se encontró el RUC.");
      }
      return { tipo: "RUC", nombre: resultado.razonSocial };
    }

    if (tipoDocumento === DD_TIPOS_DOCUMENTO_VINCULO.DNI) {
      if (!REGEX_DNI.test(documento)) {
        throw new Error("Ingrese un DNI de 8 dígitos para buscar.");
      }
      const resultado = await sunatService.consultarDni(documento);
      const nombre = (
        resultado.nombreCompleto ??
        [resultado.nombres, resultado.apellidoPaterno, resultado.apellidoMaterno]
          .filter(Boolean)
          .join(" ")
      ).trim();
      if (resultado.error || !nombre) {
        throw new Error(resultado.error ?? "No se encontró el DNI.");
      }
      return { tipo: "DNI", nombre };
    }

    throw new Error("La consulta RENIEC/SUNAT solo aplica a DNI o RUC.");
  };

  const consultarBeneficiario = async (
    beneficiario: BeneficiarioForm,
    secuencia: number,
    buscarManual = false,
  ) => {
    if (secuencia !== (lookupSeq.current[beneficiario.id] ?? 0)) return;
    if (!esPaisPeru(beneficiario.nacionalidad)) {
      if (buscarManual) {
        toast.error("Solo se consulta RENIEC/SUNAT para vínculos con nacionalidad peruana.");
      }
      return;
    }

    const tipoConsulta = tipoDocumentoVinculoConConsulta(
      beneficiario.tipoVinculoPersona,
      beneficiario.tipoDocumento,
    );
    const documento = beneficiario.documento.trim();
    if (!tipoConsulta) {
      if (buscarManual) {
        toast.error("Seleccione DNI o RUC para consultar.");
      }
      return;
    }
    if (
      (tipoConsulta === "DNI" && !REGEX_DNI.test(documento)) ||
      (tipoConsulta === "RUC" && !REGEX_RUC.test(documento))
    ) {
      if (buscarManual) {
        toast.error(
          tipoConsulta === "RUC"
            ? "Ingrese un RUC de 11 dígitos para buscar."
            : "Ingrese un DNI de 8 dígitos para buscar.",
        );
      }
      return;
    }

    setBuscandoBeneficiario(beneficiario.id);
    try {
      const resultado = await consultarDocumento(documento, tipoConsulta);
      if (secuencia !== (lookupSeq.current[beneficiario.id] ?? 0)) return;
      setBeneficiarios((prev) =>
        prev.map((b) => (b.id === beneficiario.id ? { ...b, nombre: resultado.nombre } : b)),
      );
      setBeneficiariosValidados((prev) => ({ ...prev, [beneficiario.id]: resultado.tipo }));
      toast.success(
        resultado.tipo === "DNI"
          ? "Nombre validado con RENIEC."
          : "Razón social validada con SUNAT.",
      );
    } catch (err) {
      if (secuencia === (lookupSeq.current[beneficiario.id] ?? 0)) {
        toast.error(err instanceof Error ? err.message : "No se pudo consultar el documento.");
      }
    } finally {
      if (secuencia === (lookupSeq.current[beneficiario.id] ?? 0)) {
        setBuscandoBeneficiario(null);
      }
    }
  };

  const actualizarDocumentoBeneficiario = (beneficiario: BeneficiarioForm, valor: string) => {
    const tipoDocumento = normalizarTipoDocumentoVinculo(
      beneficiario.tipoVinculoPersona,
      beneficiario.tipoDocumento,
      beneficiario.nacionalidad,
    );
    const documentoNumerico =
      tipoDocumento === DD_TIPOS_DOCUMENTO_VINCULO.DNI ||
      tipoDocumento === DD_TIPOS_DOCUMENTO_VINCULO.RUC;
    const maximo = tipoDocumento === DD_TIPOS_DOCUMENTO_VINCULO.DNI ? 8 : 11;
    const documento = documentoNumerico
      ? valor.replace(/\D/g, "").slice(0, maximo)
      : valor.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 20);
    cambiarBeneficiario(beneficiario.id, "documento", documento);
    const temporizador = lookupTimers.current[beneficiario.id];
    if (temporizador) clearTimeout(temporizador);
    const secuencia = (lookupSeq.current[beneficiario.id] ?? 0) + 1;
    lookupSeq.current[beneficiario.id] = secuencia;
    setBuscandoBeneficiario(null);
    if (!esPaisPeru(beneficiario.nacionalidad)) return;
    const tipoConsulta = tipoDocumentoVinculoConConsulta(
      beneficiario.tipoVinculoPersona,
      tipoDocumento,
    );
    if (
      (tipoConsulta === "DNI" && REGEX_DNI.test(documento)) ||
      (tipoConsulta === "RUC" && REGEX_RUC.test(documento))
    ) {
      lookupTimers.current[beneficiario.id] = setTimeout(() => {
        void consultarBeneficiario({ ...beneficiario, documento, tipoDocumento }, secuencia);
      }, 500);
    }
  };

  const buscarBeneficiario = (beneficiario: BeneficiarioForm) => {
    const temporizador = lookupTimers.current[beneficiario.id];
    if (temporizador) clearTimeout(temporizador);
    const secuencia = (lookupSeq.current[beneficiario.id] ?? 0) + 1;
    lookupSeq.current[beneficiario.id] = secuencia;
    void consultarBeneficiario(beneficiario, secuencia, true);
  };

  const actualizarDocumentoRepresentante = (valor: string) => {
    const documento = valor.trim();
    setCampo("representanteDocumento", documento);
    setRepresentanteValidado(null);
    setBuscandoRepresentante(false);
    representanteLookupSeq.current += 1;
    const secuencia = representanteLookupSeq.current;
    if (representanteLookupTimer.current) clearTimeout(representanteLookupTimer.current);
    if (
      !esPaisPeru(form.representanteNacionalidad) ||
      form.representanteTipoDocumento !== DD_TIPOS_DOCUMENTO_REPRESENTANTE.DNI ||
      (!REGEX_DNI.test(documento) && !REGEX_RUC.test(documento))
    ) {
      return;
    }

    representanteLookupTimer.current = setTimeout(() => {
      void (async () => {
        if (secuencia !== representanteLookupSeq.current) return;
        setBuscandoRepresentante(true);
        try {
          const resultado = await consultarDocumento(
            documento,
            DD_TIPOS_DOCUMENTO_VINCULO.DNI,
          );
          if (secuencia !== representanteLookupSeq.current) return;
          setCampo("representanteNombre", resultado.nombre);
          setRepresentanteValidado(resultado.tipo);
          toast.success(
            resultado.tipo === "DNI"
              ? "Nombre validado con RENIEC."
              : "Razón social validada con SUNAT.",
          );
        } catch (err) {
          if (secuencia === representanteLookupSeq.current) {
            toast.error(err instanceof Error ? err.message : "No se pudo consultar el documento.");
          }
        } finally {
          if (secuencia === representanteLookupSeq.current) setBuscandoRepresentante(false);
        }
      })();
    }, 500);
  };

  const documentoDe = (tipo: string) => documentos.find((d) => d.tipo === tipo) ?? null;

  const validarPaso = (numero: number): string | null => {
    if (numero === 1) return ddUtils.validarConsentimientos(form);
    if (numero === 2) return ddUtils.validarEmpresa(form);
    if (numero === 3) return ddUtils.validarRepresentante({ ...form, beneficiarios });
    return ddUtils.validarDocumentos({
      documentos: documentos.map((d) => ({ tipo: d.tipo, url: d.url, estado: d.estado })),
      declaraVerdad: form.declaraVerdad,
      requiereDeclaracionVigencia,
    });
  };

  const errorPasoActual = validarPaso(paso);
  const pasosCompletados: number[] = [];
  for (const definicion of DD_PASOS) {
    if (validarPaso(definicion.numero) !== null) break;
    pasosCompletados.push(definicion.numero);
  }
  const pasosNavegables = [...new Set([paso, ...pasosCompletados])];
  const irAPaso = (numero: number) => {
    if (!pasosNavegables.includes(numero)) return;
    setPaso(numero);
    setError(null);
  };

  const construirPayload = (): DdGuardarRequestDTO => ({
    tipoRelacionComercial: form.tipoRelacionComercial,
    tipoRelacionComercialOtro: form.tipoRelacionComercialOtro || null,
    actividadEconomica: form.actividadEconomica || null,
    actividadEconomicaOtro: form.actividadEconomicaOtro || null,
    paisConstitucion: form.paisConstitucion || null,
    sitioWeb: form.sitioWeb || null,
    emailRepresentante: form.emailRepresentante || null,
    aceptaDatos: form.aceptaDatos,
    aceptaVerificacion: form.aceptaVerificacion,
    declaraVerdad: form.declaraVerdad,
    representanteNombre: form.representanteNombre || null,
    representanteTipoDocumento: form.representanteTipoDocumento || null,
    representanteDocumento: form.representanteDocumento || null,
    representanteNacionalidad: form.representanteNacionalidad || null,
    beneficiarios: beneficiarios.map((b) => ({
      nombre: b.nombre.trim(),
      documento: b.documento.trim(),
      tipoDocumento: normalizarTipoDocumentoVinculo(
        b.tipoVinculoPersona,
        b.tipoDocumento,
        b.nacionalidad,
      ),
      nacionalidad: b.nacionalidad.trim(),
      porcentaje: Number(b.porcentaje || 0),
      tipoVinculoPersona: b.tipoVinculoPersona
        ? (b.tipoVinculoPersona as DdTipoVinculoPersona)
        : null,
    })),
    documentos: documentos.map((d) => ({
      tipo: d.tipo,
      nombre: d.nombre,
      url: d.url,
      estado: DD_DOCUMENTO_ESTADOS.CARGADO,
    })),
  });

  const guardar = async (avanzar: boolean): Promise<boolean> => {
    if (avanzar) {
      const mensaje = validarPaso(paso);
      if (mensaje) {
        setError(mensaje);
        toast.error(mensaje);
        return false;
      }
    }
    setGuardando(true);
    try {
      await debidaDiligenciaService.guardar(construirPayload());
      if (avanzar) setPaso((p) => Math.min(DD_PASOS.length, p + 1));
      else toast.success("Borrador guardado");
      return true;
    } catch (err) {
      const mensajeError = err instanceof Error ? err.message : "No se pudo guardar el formulario";
      setError(mensajeError);
      toast.error(mensajeError);
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const enviar = async () => {
    for (const numero of DD_PASOS.map((p) => p.numero)) {
      const mensaje = validarPaso(numero);
      if (mensaje) {
        setPaso(numero);
        setError(mensaje);
        toast.error(mensaje);
        return;
      }
    }
    const ok = await confirm({
      title: "Enviar a revisión",
      description:
        "Al enviar, Logística revisará los documentos. Si hay observaciones, recibirás un correo en el contacto declarado y podrás corregir y solicitar una nueva evaluación.",
      confirmLabel: "Enviar a revisión",
    });
    if (!ok) return;
    setEnviando(true);
    try {
      await debidaDiligenciaService.guardar(construirPayload());
      await debidaDiligenciaService.enviar();
      toast.success("Debida diligencia enviada a revisión");
      router.push(DD_RUTAS.BASE);
      router.refresh();
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "No se pudo enviar la debida diligencia";
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setEnviando(false);
    }
  };

  const subirDocumento = async (tipo: DdDocumentoTipo, file: File) => {
    const esDeclaracion = tipo === DD_DOCUMENTOS.DECLARACION_JURADA;
    const esVigencia = tipo === DD_DOCUMENTOS.DECLARACION_VIGENCIA;
    const esAdicional = tipo === DD_DOCUMENTOS.ADICIONAL;
    const extensiones = esDeclaracion
      ? DD_DOCUMENTO_EXTENSIONES_DECLARACION
      : esVigencia
        ? DD_DOCUMENTO_EXTENSIONES_VIGENCIA
        : esAdicional
          ? DD_DOCUMENTO_EXTENSIONES_ADICIONAL
          : DD_DOCUMENTO_EXTENSIONES;
    if (!archivoUtils.extensionPermitida(file.name, extensiones)) {
      toast.error(
        esDeclaracion
          ? "Formato no permitido. Use PDF, DOCX, JPG o PNG."
          : esVigencia || esAdicional
            ? "Formato no permitido. Use PDF."
            : "Formato no permitido. Use PDF, JPG o PNG.",
      );
      return;
    }
    if (file.size > DD_DOCUMENTO_MAX_BYTES) {
      toast.error(`El archivo supera el máximo de ${DD_DOCUMENTO_MAX_BYTES / BYTES_POR_MB} MB.`);
      return;
    }
    setSubiendo(tipo);
    try {
      const subida = await debidaDiligenciaService.subirDocumento(tipo, file);
      setDocumentos((prev) => {
        const anterior = prev.find((d) => d.tipo === tipo);
        const versiones = anterior?.versiones ?? [];
        const restantes = prev.filter((d) => d.tipo !== tipo);
        return [
          ...restantes,
          {
            id: `nuevo-${tipo}`,
            tipo,
            nombre: subida.nombre || file.name,
            url: subida.url,
            estado: DD_DOCUMENTO_ESTADOS.CARGADO,
            observacion: null,
            updatedAt: dateUtils.nowIso(),
            versiones: [
              ...versiones,
              {
                id: `nuevo-${tipo}-${subida.url}`,
                version: versiones.length + 1,
                nombre: subida.nombre || file.name,
                url: subida.url,
                creadoPor: null,
                createdAt: dateUtils.nowIso(),
              },
            ],
          },
        ];
      });
      toast.success("Documento cargado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir el documento");
    } finally {
      setSubiendo(null);
    }
  };

  const agregarBeneficiario = () => {
    setBeneficiarios((prev) => [...prev, nuevoBeneficiario()]);
  };

  const quitarBeneficiario = (id: string) => {
    const temporizador = lookupTimers.current[id];
    if (temporizador) clearTimeout(temporizador);
    delete lookupTimers.current[id];
    delete lookupSeq.current[id];
    setBeneficiarios((prev) => prev.filter((b) => b.id !== id));
    setBeneficiariosValidados((prev) => {
      const siguiente = { ...prev };
      delete siguiente[id];
      return siguiente;
    });
  };

  return (
    <div className="w-full space-y-4">
      <nav aria-label="Ruta de navegación" className="text-xs text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link className="hover:text-primary" href="/dashboard">Mi Panel</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link className="hover:text-primary" href={DD_RUTAS.BASE}>Debida Diligencia</Link></li>
          <li aria-hidden="true">/</li>
          <li className="font-semibold text-primary">Paso {paso}: {DD_PASOS.find((p) => p.numero === paso)?.label ?? ""}</li>
        </ol>
      </nav>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
              Fase preliminar
            </span>
            {expedienteInicial?.codigo ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                <span>Expediente {expedienteInicial.codigo}</span>
              </span>
            ) : null}
          </div>
          <CardTitle className="mt-1">
            <span className="text-2xl font-bold tracking-tight text-primary">Debida Diligencia</span>
          </CardTitle>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Fase preliminar obligatoria de cumplimiento y prevención de LA/FT para empresas y aliados del IIMP.
          </p>
          <div className="mt-5">
            <DdStepper
            actual={paso}
            completados={pasosCompletados.filter((numero) => numero !== paso)}
            navegables={pasosNavegables}
            onStepClick={irAPaso}
          />
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-5">
          {expedienteInicial?.estado === DD_ESTADOS.OBSERVADA && observacionesAbiertas.length > 0 ? (
            <Alert className="border-warning/40 bg-warning/10">
              <Info className="h-4 w-4 text-warning" />
              <AlertDescription>
                <span className="mb-1 block text-xs font-semibold text-warning">
                  {observacionesAgrupadas.length === 1
                    ? "El expediente tiene 1 observación abierta"
                    : `El expediente tiene ${observacionesAgrupadas.length} observaciones abiertas`}
                </span>
                {tiposObservadosLabels.length > 0 ? (
                  <p className="text-xs text-foreground">
                    <span className="font-semibold">Documentos observados:</span>{" "}
                    {tiposObservadosLabels.join(", ")}.
                  </p>
                ) : null}
                {observacionesAgrupadas.map((observacion) => (
                  <p key={observacion.id} className="mt-1 text-xs text-foreground">
                    <span className="font-semibold">
                      {DD_OBSERVACION_AREA_LABELS[observacion.area] ?? observacion.area}:
                    </span>{" "}
                    {observacion.texto}
                  </p>
                ))}
                {comentariosDocumentos.map((texto) => (
                  <p key={texto} className="mt-1 text-xs text-foreground">
                    <span className="font-semibold">Documento observado:</span> {texto}
                  </p>
                ))}
              </AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertDescription><span>{error}</span></AlertDescription>
            </Alert>
          ) : null}

          {paso === 1 ? (
            <div className="space-y-7">
              <div className="flex items-start gap-3 rounded-r-lg border-l-[3px] border-primary bg-secondary p-4">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="text-xs leading-relaxed text-foreground sm:text-[13px]">
                  <p className="mb-0.5 font-semibold text-primary">Base legal y marco regulatorio</p>
                  <p>
                    En cumplimiento de la Ley N.° 29733 (Protección de Datos Personales) y las directrices del
                    Sistema de Prevención de Lavado de Activos y Financiamiento del Terrorismo, solicitamos su
                    autorización previa para continuar con la verificación y registro de la empresa.
                  </p>
                </div>
              </div>

              <fieldset className="space-y-4 border-t border-border pt-6">
                <legend className="sr-only">Tratamiento de datos personales</legend>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                    Tratamiento de datos personales y ejercicio de derechos ARCO
                  </h2>
                  <p className="mt-1.5 pl-7 text-xs leading-relaxed text-muted-foreground">
                    Autorizo de manera libre, previa, expresa e inequívoca al IIMP a dar tratamiento a los datos
                    personales facilitados para fines de homologación, contacto y acreditación institucional,
                    garantizando mis derechos de Acceso, Rectificación, Cancelación y Oposición (ARCO).
                  </p>
                </div>
                <RadioGroup
                  value={form.aceptaDatos ? "si" : "no"}
                  onValueChange={(valor) => setCampo("aceptaDatos", valor === "si")}
                  className="grid grid-cols-1 gap-3 pl-0 sm:grid-cols-2 sm:pl-7"
                >
                  <label className={`flex cursor-pointer items-center rounded-lg border-2 p-3.5 transition-colors ${form.aceptaDatos ? "border-primary bg-secondary" : "border-border bg-card hover:bg-secondary/60"}`}>
                    <RadioGroupItem value="si" className="peer sr-only" />
                    <DdRadioIndicator selected={form.aceptaDatos} className="peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30" />
                    <span className="ml-3 text-xs font-semibold text-foreground">Sí, acepto</span>
                  </label>
                  <label className={`flex cursor-pointer items-center rounded-lg border p-3.5 transition-colors ${!form.aceptaDatos ? "border-primary bg-secondary" : "border-border bg-card hover:bg-secondary/60"}`}>
                    <RadioGroupItem value="no" className="peer sr-only" />
                    <DdRadioIndicator selected={!form.aceptaDatos} className="peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30" />
                    <span className="ml-3 text-xs font-medium text-muted-foreground">No acepto</span>
                  </label>
                </RadioGroup>
              </fieldset>

              <fieldset className="space-y-4 border-t border-border pt-6">
                <legend className="sr-only">Verificación y debida diligencia reforzada</legend>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                    Autorización para verificación y debida diligencia reforzada
                  </h2>
                  <p className="mt-1.5 pl-7 text-xs leading-relaxed text-muted-foreground">
                    Autorizo al oficial de cumplimiento del IIMP a realizar indagaciones en fuentes públicas y
                    listas restrictivas locales e internacionales (OFAC, Consejo de Seguridad ONU, SBS,
                    Contraloría General de la República, Interpol y antecedentes penales/judiciales) de la empresa
                    y sus beneficiarios finales.
                  </p>
                </div>
                <RadioGroup
                  value={form.aceptaVerificacion ? "si" : "no"}
                  onValueChange={(valor) => setCampo("aceptaVerificacion", valor === "si")}
                  className="grid grid-cols-1 gap-3 pl-0 sm:grid-cols-2 sm:pl-7"
                >
                  <label className={`flex cursor-pointer items-center rounded-lg border-2 p-3.5 transition-colors ${form.aceptaVerificacion ? "border-primary bg-secondary" : "border-border bg-card hover:bg-secondary/60"}`}>
                    <RadioGroupItem value="si" className="peer sr-only" />
                    <DdRadioIndicator selected={form.aceptaVerificacion} className="peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30" />
                    <span className="ml-3 text-xs font-semibold text-foreground">Sí, acepto</span>
                  </label>
                  <label className={`flex cursor-pointer items-center rounded-lg border p-3.5 transition-colors ${!form.aceptaVerificacion ? "border-primary bg-secondary" : "border-border bg-card hover:bg-secondary/60"}`}>
                    <RadioGroupItem value="no" className="peer sr-only" />
                    <DdRadioIndicator selected={!form.aceptaVerificacion} className="peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30" />
                    <span className="ml-3 text-xs font-medium text-muted-foreground">No acepto</span>
                  </label>
                </RadioGroup>
              </fieldset>

              <div className="flex items-start gap-3 rounded-lg border border-gold-soft/60 border-l-[3px] border-l-gold bg-gold/10 p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <p className="text-xs leading-relaxed text-foreground">
                  <span className="mb-0.5 block font-semibold">Nota de conformidad y fiscalización</span>
                  Las respuestas y autorizaciones serán auditadas y validadas por las áreas de Logística y
                  Comunicaciones del IIMP antes de la habilitación formal de la empresa.
                </p>
              </div>
            </div>
          ) : null}

          {paso === 2 ? (
            <DdWizardPaso2 empresa={empresa} form={form} setCampo={setCampo} />
          ) : null}

          {paso === 3 ? (
            <DdWizardPaso3
              form={form}
              setCampo={setCampo}
              beneficiarios={beneficiarios}
              beneficiariosValidados={beneficiariosValidados}
              buscandoBeneficiario={buscandoBeneficiario}
              buscandoRepresentante={buscandoRepresentante}
              representanteValidado={representanteValidado}
              observacionesRepresentante={observacionesRepresentante}
              observacionesVinculoFaltante={observacionesVinculoFaltante}
              observacionesBeneficiario={observacionesBeneficiario}
              actualizarDocumentoRepresentante={actualizarDocumentoRepresentante}
              cambiarNacionalidadRepresentante={cambiarNacionalidadRepresentante}
              cambiarTipoDocumentoRepresentante={cambiarTipoDocumentoRepresentante}
              actualizarDocumentoBeneficiario={actualizarDocumentoBeneficiario}
              buscarBeneficiario={buscarBeneficiario}
              cambiarBeneficiario={cambiarBeneficiario}
              agregarBeneficiario={agregarBeneficiario}
              quitarBeneficiario={quitarBeneficiario}
            />
          ) : null}

          {paso === 4 ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Documentos de sustento</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Los documentos marcados como <span className="font-semibold text-foreground">Obligatorio</span>{" "}
                    deben estar cargados para enviar. Los marcados como{" "}
                    <span className="font-semibold text-foreground">Opcional</span> no bloquean el envío.
                  </p>
                </div>
                <Badge
                  className={`pointer-events-none shrink-0 text-[10px] ${
                    obligatoriosCargados === DD_DOCUMENTOS_REQUERIDOS.length
                      ? BADGE_STYLES.SUCCESS
                      : BADGE_STYLES.WARNING
                  }`}
                >
                  <span>{obligatoriosCargados} de {DD_DOCUMENTOS_REQUERIDOS.length} obligatorios</span>
                </Badge>
              </div>

              {documentosObligatoriosPendientes.length > 0 ? (
                <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
                  <p className="font-semibold text-warning">
                    {documentosObligatoriosPendientes.length === 1
                      ? enSubsanacion
                        ? "Falta 1 documento obligatorio por subsanar:"
                        : "Falta 1 documento obligatorio:"
                      : enSubsanacion
                        ? `Faltan ${documentosObligatoriosPendientes.length} documentos obligatorios por subsanar:`
                        : `Faltan ${documentosObligatoriosPendientes.length} documentos obligatorios:`}
                  </p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {documentosObligatoriosPendientes.map((requisito) => (
                      <li key={requisito.tipo}>{requisito.titulo}</li>
                    ))}
                  </ul>
                </div>
              ) : enSubsanacion ? (
                <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs font-medium text-warning">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Documentos obligatorios completos. Envía la subsanación para que Logística los revise.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-xs font-medium text-success">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Todos los documentos obligatorios están cargados.</span>
                </div>
              )}

              <div className="space-y-3">
                {documentosVisibles.map((requisito) => {
                  const documento = documentoDe(requisito.tipo);
                  const subiendoEste = subiendo === requisito.tipo;
                  const extensionesDocumento = requisito.tipo === DD_DOCUMENTOS.DECLARACION_JURADA
                    ? DD_DOCUMENTO_EXTENSIONES_DECLARACION
                    : requisito.tipo === DD_DOCUMENTOS.DECLARACION_VIGENCIA
                      ? DD_DOCUMENTO_EXTENSIONES_VIGENCIA
                      : requisito.tipo === DD_DOCUMENTOS.ADICIONAL
                        ? DD_DOCUMENTO_EXTENSIONES_ADICIONAL
                        : DD_DOCUMENTO_EXTENSIONES;
                  const formatosDocumento = [...new Set(
                    extensionesDocumento.map((ext) => (ext === "jpeg" ? "jpg" : ext)),
                  )].map((ext) => ext.toUpperCase()).join(", ");
                  const observado =
                    documento?.estado === DD_DOCUMENTO_ESTADOS.OBSERVADO ||
                    (!documento && tiposObservados.has(requisito.tipo));
                  const obligatorio =
                    DD_DOCUMENTOS_REQUERIDOS.some((item) => item.tipo === requisito.tipo) ||
                    (requisito.tipo === DD_DOCUMENTOS.DECLARACION_VIGENCIA &&
                      requiereDeclaracionVigencia);
                  return (
                    <div
                      key={requisito.tipo}
                      id={`dd-doc-${requisito.tipo}`}
                      className={`scroll-mt-24 rounded-lg border p-4 ${observado ? "border-warning bg-warning/5 shadow-sm ring-2 ring-warning/20" : "border-border bg-card"}`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <FileText className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-semibold text-foreground">
                                {requisito.titulo}
                                {obligatorio ? (
                                  <span className="ml-1 text-destructive" aria-label="Obligatorio">*</span>
                                ) : null}
                              </p>
                              <Badge
                                className={`pointer-events-none text-[9px] ${
                                  obligatorio ? BADGE_STYLES.WARNING : BADGE_STYLES.NEUTRAL
                                }`}
                              >
                                <span>{obligatorio ? "Obligatorio" : "Opcional"}</span>
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{requisito.ayuda}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              <span>Formatos: {formatosDocumento}. Máximo {DD_DOCUMENTO_MAX_BYTES / BYTES_POR_MB} MB.</span>
                            </p>
                            {documento ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <DdDocumentoBadge estado={documento.estado} />
                                <span className="truncate text-[11px] text-muted-foreground">{documento.nombre}</span>
                              </div>
                            ) : observado ? (
                              <Badge className={`pointer-events-none mt-2 text-[10px] ${BADGE_STYLES.WARNING}`}>
                                <span>Observado</span>
                              </Badge>
                            ) : null}
                            {documento && documento.versiones.length > 0 ? (
                              <details className="mt-2 max-w-full rounded-md border border-border/70 bg-secondary/30 px-2.5 py-2">
                                <summary className="cursor-pointer text-[11px] font-semibold text-primary">
                                  Versiones ({documento.versiones.length})
                                </summary>
                                <ul className="mt-1.5 space-y-1">
                                  {documento.versiones.map((version, index) => {
                                    const esActual = index === documento.versiones.length - 1;
                                    return (
                                      <li
                                        key={version.id}
                                        className="flex flex-wrap items-center gap-1.5 text-[11px]"
                                      >
                                        <Badge
                                          className={
                                            esActual ? BADGE_STYLES.SUCCESS : BADGE_STYLES.NEUTRAL
                                          }
                                        >
                                          v{version.version}
                                        </Badge>
                                        <span
                                          className="max-w-[220px] truncate text-foreground"
                                          title={version.nombre}
                                        >
                                          {version.nombre}
                                        </span>
                                        <span className="text-muted-foreground">
                                          {dateUtils.formatDateTime(version.createdAt)}
                                        </span>
                                        {esActual ? (
                                          <span className="font-semibold text-success">Actual</span>
                                        ) : null}
                                        <Button
                                          type="button"
                                          variant="link"
                                          size="sm"
                                          className="h-auto p-0 text-[11px]"
                                          onClick={() =>
                                            setPreviewDocumento({
                                              url: version.url,
                                              nombre: version.nombre,
                                            })
                                          }
                                        >
                                          Ver
                                        </Button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </details>
                            ) : null}
                            {requisito.permiteFormato && requisito.formatoUrl ? (
                              <Button asChild variant="link" size="sm" className="mt-1 h-auto p-0 text-[11px] text-primary">
                                <a href={requisito.formatoUrl} download>
                                  Descargar formato
                                </a>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                          {documento ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 text-xs"
                              onClick={() => setPreviewDocumento(documento)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Ver</span>
                            </Button>
                          ) : null}
                          {puedeSubirDocumento(documento) ? (
                            <>
                              <input
                                ref={(el) => { inputsArchivo.current[requisito.tipo] = el; }}
                                type="file"
                                accept={
                                  requisito.tipo === DD_DOCUMENTOS.DECLARACION_JURADA
                                    ? DD_DOCUMENTO_ACCEPT_DECLARACION
                                    : requisito.tipo === DD_DOCUMENTOS.DECLARACION_VIGENCIA
                                      ? DD_DOCUMENTO_ACCEPT_VIGENCIA
                                      : requisito.tipo === DD_DOCUMENTOS.ADICIONAL
                                        ? DD_DOCUMENTO_ACCEPT_ADICIONAL
                                        : DD_DOCUMENTO_ACCEPT
                                }
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  e.target.value = "";
                                  if (file) void subirDocumento(requisito.tipo, file);
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 text-xs"
                                disabled={subiendoEste}
                                onClick={() => inputsArchivo.current[requisito.tipo]?.click()}
                              >
                                {subiendoEste ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                <span>{etiquetaSubida(documento)}</span>
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-lg border border-border bg-secondary/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">Resumen de documentos</span>
                  <span className="text-xs text-muted-foreground">
                    {obligatoriosCargados} de {DD_DOCUMENTOS_REQUERIDOS.length} obligatorios listos
                  </span>
                </div>
                <Progress
                  className="mt-2 h-1.5"
                  value={(obligatoriosCargados / DD_DOCUMENTOS_REQUERIDOS.length) * 100}
                />
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                <Checkbox
                  checked={form.declaraVerdad}
                  onCheckedChange={(valor) => setCampo("declaraVerdad", valor === true)}
                  className="mt-0.5"
                />
                <span className="text-xs leading-relaxed text-foreground">
                  {DD_DECLARACION_COMPROMISO}
                </span>
              </label>

              <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-xs leading-relaxed text-foreground">
                  Al enviar, Logística revisará los documentos. Si hay observaciones, recibirá un correo en el
                  contacto declarado y podrá corregir y solicitar una nueva evaluación.
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>

        <div className="border-t border-border bg-secondary/30 px-5 py-4">
          <div className="mb-3 flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-primary">Paso {paso} de {DD_PASOS.length}</span>
            <span className="text-[11px] text-muted-foreground">
              {paso === 1 ? "Siguiente: Datos de la empresa" : paso === 2 ? "Siguiente: Representante y vínculos" : paso === 3 ? "Siguiente: Documentos" : "Último paso"}
            </span>
          </div>
          <Progress className="mb-4 h-1.5" value={(paso / DD_PASOS.length) * 100} />
          {errorPasoActual ? (
            <p className="mb-3 text-[11px] font-medium text-warning">
              Completa los campos obligatorios para continuar: {errorPasoActual}
            </p>
          ) : null}
          {paso === 4 && documentosObservados.length > 0 ? (
            <p className="mb-3 text-[11px] font-medium text-warning">
              Sube una nueva versión de los documentos observados antes de enviar.
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs"
                disabled={paso === 1 || guardando || enviando}
                onClick={() => setPaso((p) => Math.max(1, p - 1))}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Atrás</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-xs text-muted-foreground"
                disabled={guardando || enviando}
                onClick={() => void guardar(false)}
              >
                <span>Guardar borrador</span>
              </Button>
            </div>
            <div className="flex items-center justify-end">
              {paso < DD_PASOS.length ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-1.5 text-xs"
                  disabled={guardando || enviando || Boolean(errorPasoActual)}
                  onClick={() => void guardar(true)}
                >
                  {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                  <span>Continuar</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-1.5 bg-gold text-xs text-gold-foreground hover:bg-gold/90"
                  disabled={guardando || enviando || documentosObservados.length > 0}
                  onClick={() => void enviar()}
                >
                  {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  <span>Enviar a revisión</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
        <Lock className="h-3.5 w-3.5 text-success" />
        <span>Transmisión cifrada. Sus datos se resguardan de forma confidencial.</span>
      </p>
      <DdDocumentoPreviewDialog documento={previewDocumento} onClose={() => setPreviewDocumento(null)} />
      {confirmDialog}
    </div>
  );
}



