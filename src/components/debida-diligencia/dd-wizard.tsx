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
  Input,
  Label,
  Progress,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nrivera-iimp/ui-kit-iimp";
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Eye,
  FileText,
  Info,
  Loader2,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { DdStepper } from "./dd-stepper";
import { DdDocumentoBadge } from "./dd-estado-badge";
import { DdDocumentoPreviewDialog } from "./dd-documento-preview-dialog";
import { DdRadioIndicator } from "./dd-radio-indicator";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import { sunatService } from "@/lib/client/api/services/sunat-service";
import { useConfirm } from "@/hooks/use-confirm";
import {
  DD_ACTIVIDADES_ECONOMICAS,
  DD_ACTIVIDAD_OTRO,
  BADGE_STYLES,
  BYTES_POR_MB,
  DD_DOCUMENTO_ACCEPT,
  DD_DOCUMENTO_ESTADOS,
  DD_DOCUMENTO_EXTENSIONES,
  DD_DOCUMENTO_MAX_BYTES,
  DD_DOCUMENTOS_REQUERIDOS,
  DD_ESTADOS,
  DD_OBSERVACION_ESTADOS,
  DD_PAIS_DEFAULT,
  DD_PORCENTAJE_PARTICIPACION_MIN,
  DD_TIPOS_DOCUMENTO_REPRESENTANTE,
  DD_PASOS,
  DD_RUTAS,
  DD_VINCULO_LABELS,
  DD_VINCULOS,
  type DdDocumentoEstado,
  type DdDocumentoTipo,
  type DdVinculo,
} from "@/lib/shared/constants";
import { archivoUtils } from "@/lib/shared/utils/archivo";
import { ddUtils } from "@/lib/shared/utils/debida-diligencia";
import { dateUtils } from "@/lib/shared/utils/date";
import type {
  DdDocumentoVersionDTO,
  DdEmpresaDTO,
  DdExpedienteDTO,
  DdGuardarRequestDTO,
} from "@/types/dto/debida-diligencia";

interface BeneficiarioForm {
  id: string;
  nombre: string;
  documento: string;
  nacionalidad: string;
  porcentaje: string;
}

interface Props {
  empresa: DdEmpresaDTO | null;
  expediente: DdExpedienteDTO | null;
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

interface FormState {
  tipoRelacionComercial: DdVinculo | "";
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
    nacionalidad: "",
    porcentaje: "",
  };
}

function formDesde(empresa: DdEmpresaDTO | null, expediente: DdExpedienteDTO | null): FormState {
  return {
    tipoRelacionComercial: (expediente?.tipoRelacionComercial as DdVinculo | null | undefined) ?? "",
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
    representanteTipoDocumento:
      expediente?.representanteTipoDocumento ?? DD_TIPOS_DOCUMENTO_REPRESENTANTE.DNI,
    representanteDocumento:
      expediente?.representanteDocumento ?? empresa?.representanteLegalDni ?? "",
    representanteNacionalidad: expediente?.representanteNacionalidad ?? DD_PAIS_DEFAULT,
  };
}

function beneficiariosDesde(expediente: DdExpedienteDTO | null): BeneficiarioForm[] {
  if (!expediente || expediente.beneficiarios.length === 0) return [];
  return expediente.beneficiarios.map((b) => ({
    id: b.id,
    nombre: b.nombre,
    documento: b.documento,
    nacionalidad: b.nacionalidad,
    porcentaje: String(b.porcentaje),
  }));
}

/** Wizard de 4 pasos de Debida Diligencia (Portal del Expositor). */
export function DdWizard({ empresa, expediente: expedienteInicial }: Props) {
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
  const lookupTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
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
  const enSubsanacion =
    expedienteInicial?.estado === DD_ESTADOS.OBSERVADA || observacionesAbiertas.length > 0;
  const tiposObservados = new Set([
    ...documentosObservados.map((documento) => documento.tipo),
    ...observacionesAbiertas.flatMap((observacion) => observacion.documentoTipo ? [observacion.documentoTipo] : []),
  ]);
  const estaEnCorreccion = (documento: DocumentoForm) =>
    documento.estado === DD_DOCUMENTO_ESTADOS.OBSERVADO ||
    (documento.estado === DD_DOCUMENTO_ESTADOS.CARGADO && tiposObservados.has(documento.tipo));
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

  const setCampo = <K extends keyof FormState>(campo: K, valor: FormState[K]) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    setError(null);
  };

  const cambiarBeneficiario = (id: string, campo: keyof Omit<BeneficiarioForm, "id">, valor: string) => {
    setBeneficiarios((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [campo]: valor } : b)),
    );
    if (campo === "documento") {
      setBeneficiariosValidados((prev) => {
        const siguiente = { ...prev };
        delete siguiente[id];
        return siguiente;
      });
    }
    setError(null);
  };

  const consultarBeneficiario = async (beneficiario: BeneficiarioForm) => {
    if (buscandoBeneficiario === beneficiario.id) return;
    const documento = beneficiario.documento.trim();
    const esDni = /^\d{8}$/.test(documento);
    const esRuc = /^\d{11}$/.test(documento);
    if (!esDni && !esRuc) {
      toast.error("Ingrese un DNI de 8 dígitos o un RUC de 11 dígitos para buscar.");
      return;
    }
    setBuscandoBeneficiario(beneficiario.id);
    try {
      if (esDni) {
        const resultado = await sunatService.consultarDni(documento);
        if (resultado.error || !resultado.nombreCompleto) {
          toast.error(resultado.error ?? "No se encontró el DNI.");
          return;
        }
        setBeneficiarios((prev) =>
          prev.map((b) => (b.id === beneficiario.id ? { ...b, nombre: resultado.nombreCompleto ?? b.nombre } : b)),
        );
        setBeneficiariosValidados((prev) => ({ ...prev, [beneficiario.id]: "DNI" }));
        toast.success("Nombre validado con RENIEC.");
      } else {
        const resultado = await sunatService.consultarRuc(documento);
        if (resultado.error || !resultado.razonSocial) {
          toast.error(resultado.error ?? "No se encontró el RUC.");
          return;
        }
        setBeneficiarios((prev) =>
          prev.map((b) => (b.id === beneficiario.id ? { ...b, nombre: resultado.razonSocial ?? b.nombre } : b)),
        );
        setBeneficiariosValidados((prev) => ({ ...prev, [beneficiario.id]: "RUC" }));
        toast.success("Razón social validada con SUNAT.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo consultar el documento.");
    } finally {
      setBuscandoBeneficiario(null);
    }
  };

  const actualizarDocumentoBeneficiario = (beneficiario: BeneficiarioForm, valor: string) => {
    const documento = valor.replace(/\D/g, "").slice(0, 11);
    cambiarBeneficiario(beneficiario.id, "documento", documento);
    const temporizador = lookupTimers.current[beneficiario.id];
    if (temporizador) clearTimeout(temporizador);
    if (/^\d{8}$|^\d{11}$/.test(documento)) {
      lookupTimers.current[beneficiario.id] = setTimeout(() => {
        void consultarBeneficiario({ ...beneficiario, documento });
      }, 500);
    }
  };

  const documentoDe = (tipo: string) => documentos.find((d) => d.tipo === tipo) ?? null;

  const validarPaso = (numero: number): string | null => {
    if (numero === 1) return ddUtils.validarConsentimientos(form);
    if (numero === 2) return ddUtils.validarEmpresa(form);
    if (numero === 3) return ddUtils.validarRepresentante({ ...form, beneficiarios });
    return ddUtils.validarDocumentos({
      documentos: documentos.map((d) => ({ tipo: d.tipo, url: d.url, estado: d.estado })),
      declaraVerdad: form.declaraVerdad,
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
    tipoRelacionComercial: form.tipoRelacionComercial || null,
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
      nacionalidad: b.nacionalidad.trim(),
      porcentaje: Number(b.porcentaje),
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
    if (!archivoUtils.extensionPermitida(file.name, DD_DOCUMENTO_EXTENSIONES)) {
      toast.error("Formato no permitido. Use PDF, JPG o PNG.");
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
                  El expediente tiene {observacionesAbiertas.length} observación(es) abierta(s)
                </span>
                <ul className="list-disc space-y-1 pl-4 text-xs text-foreground">
                  {observacionesAbiertas.map((o) => (
                    <li key={o.id}>
                      <span className="font-medium">{o.texto}</span>
                      {o.documentoTipo ? (
                        <span className="text-muted-foreground">
                          {" "}
                          ({DD_DOCUMENTOS_REQUERIDOS.find((d) => d.tipo === o.documentoTipo)?.titulo ?? o.documentoTipo})
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
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
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs"><span>Tipo de relación comercial con el IIMP *</span></Label>
                  <Select
                    value={form.tipoRelacionComercial || undefined}
                    onValueChange={(valor) => setCampo("tipoRelacionComercial", valor as DdVinculo)}
                  >
                    <SelectTrigger className="mt-1 h-9 w-full text-sm">
                      <SelectValue placeholder="Seleccione una opción" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(DD_VINCULOS).map((vinculo) => (
                        <SelectItem key={vinculo} value={vinculo}>
                          <span>{DD_VINCULO_LABELS[vinculo]}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs"><span>País de constitución *</span></Label>
                  <Input
                    value={form.paisConstitucion}
                    onChange={(e) => setCampo("paisConstitucion", e.target.value)}
                    className="mt-1 h-9 text-sm"
                    placeholder={DD_PAIS_DEFAULT}
                  />
                </div>

                <div>
                  <Label className="text-xs"><span>Razón social</span></Label>
                  <Input value={empresa?.razonSocial ?? ""} readOnly className="mt-1 h-9 bg-secondary text-sm" />
                </div>

                <div>
                  <Label className="text-xs"><span>RUC</span></Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input value={empresa?.ruc ?? ""} readOnly className="h-9 bg-secondary font-mono text-sm" />
                    <Badge className={`pointer-events-none shrink-0 gap-1 text-[10px] ${BADGE_STYLES.SUCCESS}`}>
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      <span>Registrado</span>
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-xs"><span>Actividad económica principal *</span></Label>
                  <Select
                    value={form.actividadEconomica || undefined}
                    onValueChange={(valor) => setCampo("actividadEconomica", valor)}
                  >
                    <SelectTrigger className="mt-1 h-9 w-full text-sm">
                      <SelectValue placeholder="Seleccione el sector" />
                    </SelectTrigger>
                    <SelectContent>
                      {DD_ACTIVIDADES_ECONOMICAS.map((actividad) => (
                        <SelectItem key={actividad} value={actividad}>
                          <span>{actividad}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {form.actividadEconomica === DD_ACTIVIDAD_OTRO ? (
                  <div>
                    <Label className="text-xs"><span>En caso de haber marcado Otro, indicar cuál *</span></Label>
                    <Input
                      value={form.actividadEconomicaOtro}
                      onChange={(e) => setCampo("actividadEconomicaOtro", e.target.value)}
                      className="mt-1 h-9 text-sm"
                      placeholder="Detalle la actividad económica"
                    />
                  </div>
                ) : null}

                <div>
                  <Label className="text-xs"><span>Sitio web de la empresa *</span></Label>
                  <Input
                    value={form.sitioWeb}
                    onChange={(e) => setCampo("sitioWeb", e.target.value)}
                    className="mt-1 h-9 text-sm"
                    placeholder="https://www.empresa.com"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground"><span>Se usa para la revisión reputacional de Comunicaciones.</span></p>
                </div>

                <div>
                  <Label className="text-xs"><span>Correo de contacto del representante legal *</span></Label>
                  <Input
                    type="email"
                    value={form.emailRepresentante}
                    onChange={(e) => setCampo("emailRepresentante", e.target.value)}
                    className="mt-1 h-9 text-sm"
                    placeholder="representante@empresa.com"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground"><span>Aquí recibirá las observaciones.</span></p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-gold-soft/60 border-l-[3px] border-l-gold bg-gold/10 p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <p className="text-xs leading-relaxed text-foreground">
                  Puede reservar un stand, pero no avanzará en las aprobaciones hasta completar la debida diligencia.
                </p>
              </div>
            </div>
          ) : null}

          {paso === 3 ? (
            <div className="space-y-6">
              <section className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Representante legal</h2>
                  <p className="text-xs text-muted-foreground">Persona que actúa en nombre de la empresa.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label className="text-xs"><span>Nombre completo *</span></Label>
                    <Input
                      value={form.representanteNombre}
                      onChange={(e) => setCampo("representanteNombre", e.target.value)}
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs"><span>Tipo de documento *</span></Label>
                    <Select
                      value={form.representanteTipoDocumento}
                      onValueChange={(valor) => setCampo("representanteTipoDocumento", valor)}
                    >
                      <SelectTrigger className="mt-1 h-9 w-full text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(DD_TIPOS_DOCUMENTO_REPRESENTANTE).map((tipo) => (
                          <SelectItem key={tipo} value={tipo}><span>{tipo}</span></SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs"><span>Número de documento *</span></Label>
                    <Input
                      value={form.representanteDocumento}
                      onChange={(e) => setCampo("representanteDocumento", e.target.value)}
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs"><span>Nacionalidad *</span></Label>
                    <Input
                      value={form.representanteNacionalidad}
                      onChange={(e) => setCampo("representanteNacionalidad", e.target.value)}
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4 border-t border-border pt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Beneficiarios finales (10% o más)</h2>
                    <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                      Declare todas las personas naturales o jurídicas que posean directa o indirectamente el
                      10% o más de participación.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={agregarBeneficiario}>
                    <Plus className="h-3.5 w-3.5" />
                    <span>Agregar beneficiario</span>
                  </Button>
                </div>

                {beneficiarios.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-secondary/40 px-4 py-6 text-center">
                    <p className="text-xs text-muted-foreground">
                      No se declararon beneficiarios finales. Agregue uno si alguna persona posee el 10% o más.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {beneficiarios.map((b, indice) => (
                      <div key={b.id} className="rounded-lg border border-border bg-card p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Beneficiario {indice + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => quitarBeneficiario(b.id)}
                            aria-label={`Eliminar beneficiario ${indice + 1}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
                          <div className="lg:col-span-3">
                            <Label className="text-[11px]"><span>Documento *</span></Label>
                            <div className="mt-1 flex items-center gap-2">
                              <Input
                                value={b.documento}
                                onChange={(e) => actualizarDocumentoBeneficiario(b, e.target.value)}
                                className="h-8 w-full text-xs"
                                placeholder="DNI / RUC"
                                inputMode="numeric"
                                autoComplete="off"
                                maxLength={11}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 shrink-0 p-0"
                                disabled={buscandoBeneficiario === b.id}
                                onClick={() => void consultarBeneficiario(b)}
                                title="Buscar DNI o RUC"
                                aria-label={`Buscar documento del beneficiario ${indice + 1}`}
                              >
                                {buscandoBeneficiario === b.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Search className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                            {beneficiariosValidados[b.id] ? (
                              <p className="mt-1 text-[10px] font-medium text-success">
                                Validado con {beneficiariosValidados[b.id] === "DNI" ? "RENIEC" : "SUNAT"}
                              </p>
                            ) : null}
                          </div>
                          <div className="sm:col-span-2 lg:col-span-5">
                            <Label className="text-[11px]"><span>Nombre o razón social *</span></Label>
                            <Input
                              value={b.nombre}
                              onChange={(e) => cambiarBeneficiario(b.id, "nombre", e.target.value)}
                              className="mt-1 h-8 text-xs"
                            />
                          </div>
                          <div className="lg:col-span-2">
                            <Label className="text-[11px]"><span>Nacionalidad *</span></Label>
                            <Input
                              value={b.nacionalidad}
                              onChange={(e) => cambiarBeneficiario(b.id, "nacionalidad", e.target.value)}
                              className="mt-1 h-8 text-xs"
                            />
                          </div>
                          <div className="lg:col-span-2">
                            <Label className="text-[11px]"><span>% de participación *</span></Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={DD_PORCENTAJE_PARTICIPACION_MIN}
                              max={100}
                              step={0.01}
                              value={b.porcentaje}
                              onChange={(e) => cambiarBeneficiario(b.id, "porcentaje", e.target.value)}
                              className="mt-1 h-8 w-full max-w-[140px] text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="flex items-start gap-3 rounded-lg border border-gold-soft/60 border-l-[3px] border-l-gold bg-gold/10 p-4">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <p className="text-xs leading-relaxed text-foreground">
                  Esta información se contrasta con registros públicos y listas restrictivas.
                </p>
              </div>
            </div>
          ) : null}

          {paso === 4 ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Documentos de sustento</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Todos son obligatorios. Formatos PDF o imagen, máximo {DD_DOCUMENTO_MAX_BYTES / BYTES_POR_MB} MB.
                </p>
                {enSubsanacion ? (
                  <p className="mt-1 text-[11px] font-medium text-warning">
                    {documentosObservados.length > 0
                      ? `Tienes ${documentosObservados.length} documento(s) observado(s). Solo esos debes subirlos como una nueva versión.`
                      : "La observación es general y no tiene un documento asociado. Contacta al IIMP para que Logística indique el documento a subsanar."}
                  </p>
                ) : null}
              </div>

              <div className="space-y-3">
                {DD_DOCUMENTOS_REQUERIDOS.map((requisito) => {
                  const documento = documentoDe(requisito.tipo);
                  const subiendoEste = subiendo === requisito.tipo;
                  return (
                    <div
                      key={requisito.tipo}
                      id={`dd-doc-${requisito.tipo}`}
                      className={`scroll-mt-24 rounded-lg border p-4 ${documento?.estado === DD_DOCUMENTO_ESTADOS.OBSERVADO ? "border-warning bg-warning/5 shadow-sm ring-2 ring-warning/20" : "border-border bg-card"}`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <FileText className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground">{requisito.titulo}</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{requisito.ayuda}</p>
                            {documento ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <DdDocumentoBadge estado={documento.estado} />
                                <span className="truncate text-[11px] text-muted-foreground">{documento.nombre}</span>
                              </div>
                            ) : null}
                            {documento?.observacion ? (
                              <p className="mt-1 text-[11px] text-warning">{documento.observacion}</p>
                            ) : null}
                            {documento?.estado === DD_DOCUMENTO_ESTADOS.OBSERVADO ? (
                              <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-warning">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                <span>Documento observado: suba una nueva versión.</span>
                              </p>
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
                            {requisito.permiteFormato ? (
                              <Button asChild variant="link" size="sm" className="mt-1 h-auto p-0 text-[11px] text-primary">
                                <a href="/api/debida-diligencia/declaracion-jurada" download>
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
                                accept={DD_DOCUMENTO_ACCEPT}
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
                    {DD_DOCUMENTOS_REQUERIDOS.filter((d) => documentoDe(d.tipo)).length} de {DD_DOCUMENTOS_REQUERIDOS.length} cargados
                  </span>
                </div>
                <Progress
                  className="mt-2 h-1.5"
                  value={(DD_DOCUMENTOS_REQUERIDOS.filter((d) => documentoDe(d.tipo)).length / DD_DOCUMENTOS_REQUERIDOS.length) * 100}
                />
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                <Checkbox
                  checked={form.declaraVerdad}
                  onCheckedChange={(valor) => setCampo("declaraVerdad", valor === true)}
                  className="mt-0.5"
                />
                <span className="text-xs leading-relaxed text-foreground">
                  Declaro que la información es veraz y me comprometo a actualizarla.
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
              {paso === 1 ? "Siguiente: Datos de la empresa" : paso === 2 ? "Siguiente: Representante y beneficiarios" : paso === 3 ? "Siguiente: Documentos" : "Último paso"}
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
