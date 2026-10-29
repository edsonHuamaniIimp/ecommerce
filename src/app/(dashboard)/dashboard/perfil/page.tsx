"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@nrivera-iimp/ui-kit-iimp";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Building2, CheckCircle2, Loader2, Image as ImageIcon, Upload, PenLine, ShieldCheck, UserRound, LockKeyhole, Bell } from "lucide-react";
import { authService } from "@/lib/client/api/services/auth-service";
import { maestraService } from "@/lib/client/api/services/maestra-service";
import { perfilService } from "@/lib/client/api/services/perfil-service";
import { portalEmpresaService } from "@/lib/client/api/services/portal-empresa-service";
import { uploadService } from "@/lib/client/api/services/upload-service";
import { sunatService } from "@/lib/client/api/services/sunat-service";
import { reservaDatosService } from "@/lib/client/api/services/reserva-datos-service";
import type { PerfilDTO } from "@/lib/client/api/services/perfil-service";
import { FIRMA_PERFIL_EXTENSIONES, FIRMA_PERFIL_MAX_BYTES, MAESTRA_TABLAS, TIPO_COMPROBANTE_LABELS, TIPOS_COMPROBANTE, TIPOS_DOCUMENTO_EMPRESA, TIPOS_DOCUMENTO_EMPRESA_LABELS, TIPOS_DOCUMENTO_PERSONA, TIPOS_DOCUMENTO_PERSONA_LABELS, VALIDACIONES } from "@/lib/shared/constants";
import { PaisSelect } from "@/components/shared/pais-select";
import { TelefonoInput } from "@/components/shared/telefono-input";
import { erroresFormularioEmpresa, type EmpresaFormErrores, type EmpresaFormValidacionLike } from "@/lib/shared/utils/empresa-form-validacion";
import { camposAutocompletadosDni, camposAutocompletadosRuc, nombreCompletoDesdeDni } from "@/lib/shared/utils/autocompletado-empresa";
import { resolverTipoDocumentoEmpresa } from "@/lib/shared/utils/documento-empresa";
import { archivoUtils } from "@/lib/shared/utils/archivo";
import type { MaestraItemDTO } from "@/types/dto/maestra";

function CampoError({ error, resaltado = false }: { error?: string; resaltado?: boolean }) {
  return error ? <p className={`text-[11px] ${resaltado ? "text-warning" : "text-destructive"}`}>{error}</p> : null;
}

function InputEmpresa({
  error,
  resaltado = false,
  autocompletado = false,
  nota,
  className,
  ...props
}: ComponentProps<typeof Input> & { error?: string; resaltado?: boolean; autocompletado?: boolean; nota?: string }) {
  const estado = error
    ? "border-destructive"
    : resaltado
      ? "border-warning bg-warning/10 ring-2 ring-warning/20"
      : autocompletado
        ? "border-success bg-success/10 ring-2 ring-success/20 transition-colors duration-500"
        : "";
  return (
    <>
      <Input {...props} aria-invalid={Boolean(error)} className={`${className ?? ""} ${estado}`} />
      <CampoError error={error} resaltado={resaltado} />
      {nota && <p className="text-[10px] text-muted-foreground">{nota}</p>}
    </>
  );
}
function TelefonoEmpresa({
  error,
  resaltado = false,
  autocompletado = false,
  ...props
}: ComponentProps<typeof TelefonoInput> & { error?: string; resaltado?: boolean; autocompletado?: boolean }) {
  return (
    <>
      <TelefonoInput {...props} error={error} resaltado={resaltado} autocompletado={autocompletado} />
      <CampoError error={error} resaltado={resaltado} />
    </>
  );
}
function PerfilPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetToken = searchParams.get("reset");
  const tabsPerfil = ["cuenta", "empresa", "recursos", "seguridad", "notificaciones"] as const;
  const tabParam = searchParams.get("tab") ?? "";
  const [activeTab, setActiveTab] = useState<string>(tabsPerfil.includes(tabParam as never) ? tabParam : "cuenta");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const [firmaUrl, setFirmaUrl] = useState("");
  const [subiendoFirma, setSubiendoFirma] = useState(false);
  const firmaRef = useRef<HTMLInputElement>(null);
  const [tipoUsuarioId, setTipoUsuarioId] = useState<number | null>(null);
  const [, setTiposUsuario] = useState<MaestraItemDTO[]>([]);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  /* Correo de notificaciones: seleccion + verificacion por codigo. */
  const [notifCandidates, setNotifCandidates] = useState<{ email: string; label: string; activo: boolean }[]>([]);
  const [notifActive, setNotifActive] = useState("");
  const [notifPending, setNotifPending] = useState("");
  const [notifSelected, setNotifSelected] = useState("");
  const [notifCode, setNotifCode] = useState("");
  const [notifSending, setNotifSending] = useState(false);
  const [notifConfirming, setNotifConfirming] = useState(false);
  const [emailFacturacion, setEmailFacturacion] = useState("");
  const [emailContacto, setEmailContacto] = useState("");
  const [nombreFriso, setNombreFriso] = useState("");
  const [facturarANombre, setFacturarANombre] = useState("");
  const [actividadEconomica, setActividadEconomica] = useState("");
  const [estadoContribuyente, setEstadoContribuyente] = useState("");
  const [exteminNombre, setExteminNombre] = useState("");
  const [exteminTelefono, setExteminTelefono] = useState("");
  const [exteminDni, setExteminDni] = useState("");
  const [exteminEmail, setExteminEmail] = useState("");
  const [pagosNombre, setPagosNombre] = useState("");
  const [pagosTelefono, setPagosTelefono] = useState("");
  const [pagosDni, setPagosDni] = useState("");
  const [pagosEmail, setPagosEmail] = useState("");

  // Datos contractuales de la empresa
  const [razonSocialEmpresa, setRazonSocialEmpresa] = useState("");
  const [nombreComercialEmpresa, setNombreComercialEmpresa] = useState("");
  const [direccionFiscal, setDireccionFiscal] = useState("");
  const [telefonoEmpresa, setTelefonoEmpresa] = useState("");
  const [tipoComprobante, setTipoComprobante] = useState<string>(TIPOS_COMPROBANTE.FACTURA);
  const [sitioWebEmpresa, setSitioWebEmpresa] = useState("");
  const [tipoDocumentoEmpresa, setTipoDocumentoEmpresa] = useState<string>(TIPOS_DOCUMENTO_EMPRESA.RUC);
  const [paisEmpresa, setPaisEmpresa] = useState("PE");
  const [inicioOperaciones, setInicioOperaciones] = useState("");
  const [savingEmpresa, setSavingEmpresa] = useState(false);
  const [confirmadoEmpresa, setConfirmadoEmpresa] = useState(false);
  const [resaltarPendientesEmpresa, setResaltarPendientesEmpresa] = useState(false);

  // Empresa
  const [idEmpresa, setIdEmpresa] = useState<string | null>(null);
  const [nombreEmpresa, setNombreEmpresa] = useState<string | null>(null);
  const [rucEmpresa, setRucEmpresa] = useState<string | null>(null);
  /* Representante legal (ficha de la empresa vinculada): todos los campos del formulario. */
  const [empresaVinculada, setEmpresaVinculada] = useState(false);
  const [repNombre, setRepNombre] = useState("");
  const [repDni, setRepDni] = useState("");
  const [repPartida, setRepPartida] = useState("");
  const [repDireccion, setRepDireccion] = useState("");
  const [repCorreo, setRepCorreo] = useState("");
  const [repCelular, setRepCelular] = useState("");
  const [repDniValidado, setRepDniValidado] = useState(false);
  const [repDniConsultando, setRepDniConsultando] = useState(false);
  const [exteminDniConsultando, setExteminDniConsultando] = useState(false);
  const [exteminDniValidado, setExteminDniValidado] = useState(false);
  const [pagosDniConsultando, setPagosDniConsultando] = useState(false);
  const [pagosDniValidado, setPagosDniValidado] = useState(false);
  const [sunatCargandoEmpresa, setSunatCargandoEmpresa] = useState(false);
  const [sunatValidadoEmpresa, setSunatValidadoEmpresa] = useState(false);
  const [repTipoDocumento, setRepTipoDocumento] = useState<string>(TIPOS_DOCUMENTO_PERSONA.DNI);
  const [exteminTipoDocumento, setExteminTipoDocumento] = useState<string>(TIPOS_DOCUMENTO_PERSONA.DNI);
  const [pagosTipoDocumento, setPagosTipoDocumento] = useState<string>(TIPOS_DOCUMENTO_PERSONA.DNI);
  /* Cuenta creada solo con RUC: el representante registra su correo la primera vez. */

  const [camposAutocompletados, setCamposAutocompletados] = useState<string[]>([]);
  const autocompletadoTimer = useRef<number | null>(null);
  const marcarAutocompletados = useCallback((campos: string[]) => {
    const unicos = Array.from(new Set(campos.filter(Boolean)));
    if (unicos.length === 0) return;
    setCamposAutocompletados(unicos);
    if (autocompletadoTimer.current !== null) window.clearTimeout(autocompletadoTimer.current);
    autocompletadoTimer.current = window.setTimeout(() => setCamposAutocompletados([]), 3000);
  }, []);
  const estaAutocompletado = (campo: string) => camposAutocompletados.includes(campo);
  useEffect(() => () => {
    if (autocompletadoTimer.current !== null) window.clearTimeout(autocompletadoTimer.current);
  }, []);
  const datosValidacionEmpresa: EmpresaFormValidacionLike = {
    ruc: rucEmpresa ?? "",
    tipoDocumento: tipoDocumentoEmpresa,
    pais: paisEmpresa,
    razonSocial: razonSocialEmpresa,
    nombreComercial: nombreComercialEmpresa,
    telefono: telefonoEmpresa,
    tipoComprobante,
    sitioWeb: sitioWebEmpresa,
    nombreFriso,
    facturarANombre,
    actividadEconomica,
    estadoContribuyente,
    inicioOperaciones,
    partidaElectronica: repPartida,
    emailContacto,
    emailFacturacion,
    direccionFiscal,
    representanteLegalNombre: repNombre,
    representanteLegalTipoDocumento: repTipoDocumento,
    representanteLegalDni: repDni,
    representanteCorreo: repCorreo,
    representanteCelular: repCelular,
    representanteDireccion: repDireccion,
    responsableExteminNombre: exteminNombre,
    responsableExteminTelefono: exteminTelefono,
    responsableExteminTipoDocumento: exteminTipoDocumento,
    responsableExteminDni: exteminDni,
    responsableExteminEmail: exteminEmail,
    responsablePagosNombre: pagosNombre,
    responsablePagosTelefono: pagosTelefono,
    responsablePagosTipoDocumento: pagosTipoDocumento,
    responsablePagosDni: pagosDni,
    responsablePagosEmail: pagosEmail,
  };
  const erroresEmpresa: EmpresaFormErrores = erroresFormularioEmpresa(datosValidacionEmpresa, { requerirTodos: true });
  const pendientesEmpresa = Object.values(erroresEmpresa);
  const puedeGuardarEmpresa = pendientesEmpresa.length === 0 && confirmadoEmpresa;
  const marcarPendienteEmpresa = (campo: keyof EmpresaFormValidacionLike) =>
    resaltarPendientesEmpresa && Boolean(erroresEmpresa[campo]);
  const errorVisibleEmpresa = (campo: keyof EmpresaFormValidacionLike) => {
    if (!String(datosValidacionEmpresa[campo] ?? "").trim()) return undefined;
    return erroresEmpresa[campo];
  };
  useEffect(() => {
    (async () => {
      const session = await authService.getSession();
      setEmail(session.email ?? "");

      const [perfilData, , empresaPortal] = await Promise.all([
        perfilService.get().catch(() => ({} as PerfilDTO)),
        maestraService.listar(MAESTRA_TABLAS.USUARIO_TIPO).then(setTiposUsuario).catch(() => {}),
        portalEmpresaService.misDatos().catch(() => null),
      ]);
      setEmail(session.email ?? perfilData.email ?? "");
      setNombre(perfilData.nombre ?? "");
      setApellidos(perfilData.apellidos ?? "");
      setTelefono(perfilData.telefono ?? "");
      setLogoUrl(perfilData.logoUrl ?? "");
      setFirmaUrl(perfilData.firmaUrl ?? "");
      setTipoUsuarioId(perfilData.tipoUsuarioId ?? null);
      setIdEmpresa(perfilData.idEmpresa ?? null);
      setNombreEmpresa(perfilData.nombreEmpresa ?? null);
      setRucEmpresa(empresaPortal?.ruc ?? perfilData.empresa?.ruc ?? perfilData.ruc ?? null);
      setTipoDocumentoEmpresa(empresaPortal?.tipoDocumento ?? TIPOS_DOCUMENTO_EMPRESA.RUC);
      setPaisEmpresa(empresaPortal?.pais ?? "PE");
      setInicioOperaciones(empresaPortal?.inicioOperaciones ?? "");
      setEmpresaVinculada(Boolean(empresaPortal ?? perfilData.empresa));
      setRazonSocialEmpresa(perfilData.empresa?.razonSocial ?? perfilData.nombreEmpresa ?? "");
      setNombreComercialEmpresa(perfilData.empresa?.nombreComercial ?? "");
      setDireccionFiscal(perfilData.empresa?.direccionFiscal ?? "");
      setTelefonoEmpresa(perfilData.empresa?.telefono ?? "");
      setEmailFacturacion(perfilData.empresa?.emailFacturacion ?? "");
      setEmailContacto(perfilData.empresa?.emailContacto ?? "");
      setNombreFriso(perfilData.empresa?.nombreFriso ?? "");
      setFacturarANombre(perfilData.empresa?.facturarANombre ?? "");
      setActividadEconomica(perfilData.empresa?.actividadEconomica ?? "");
      setEstadoContribuyente(perfilData.empresa?.estadoContribuyente ?? "");
      setExteminNombre(perfilData.empresa?.responsableExteminNombre ?? "");
      setExteminTelefono(perfilData.empresa?.responsableExteminTelefono ?? "");
      setExteminDni(perfilData.empresa?.responsableExteminDni ?? "");
      setExteminEmail(perfilData.empresa?.responsableExteminEmail ?? "");
      setPagosNombre(perfilData.empresa?.responsablePagosNombre ?? "");
      setPagosTelefono(perfilData.empresa?.responsablePagosTelefono ?? "");
      setPagosDni(perfilData.empresa?.responsablePagosDni ?? "");
      setPagosEmail(perfilData.empresa?.responsablePagosEmail ?? "");
      setTipoComprobante(perfilData.empresa?.tipoComprobante ?? TIPOS_COMPROBANTE.FACTURA);
      setSitioWebEmpresa(perfilData.empresa?.sitioWeb ?? "");
      setRepNombre(perfilData.empresa?.representanteLegalNombre ?? "");
      setRepDni(perfilData.empresa?.representanteLegalDni ?? "");
      setRepPartida(empresaPortal?.partidaElectronica ?? perfilData.empresa?.representantePartida ?? "");
      setRepTipoDocumento(empresaPortal?.representanteLegalTipoDocumento ?? TIPOS_DOCUMENTO_PERSONA.DNI);
      setExteminTipoDocumento(empresaPortal?.responsableExteminTipoDocumento ?? TIPOS_DOCUMENTO_PERSONA.DNI);
      setPagosTipoDocumento(empresaPortal?.responsablePagosTipoDocumento ?? TIPOS_DOCUMENTO_PERSONA.DNI);
      setRepDireccion(perfilData.empresa?.representanteDireccion ?? "");
      setRepCorreo(perfilData.empresa?.representanteCorreo ?? "");
      setRepCelular(perfilData.empresa?.representanteCelular ?? "");
      const candidatos = perfilData.emailsNotificacion ?? [];
      setNotifCandidates(candidatos);
      const activo = candidatos.find((c) => c.activo)?.email ?? perfilData.email ?? session.email ?? "";
      setNotifActive(activo);
      setNotifSelected(activo);
      setNotifPending(perfilData.notificationEmailPending ?? "");
      setLoading(false);
    })();
  }, []);

  /* Autocompleta los datos de la empresa desde SUNAT al tener un RUC de 11 digitos. */
  useEffect(() => {
    if (!empresaVinculada) return;
    const ruc = (rucEmpresa ?? "").trim();
    if (tipoDocumentoEmpresa !== TIPOS_DOCUMENTO_EMPRESA.RUC || !/^\d{11}$/.test(ruc)) return;
    let vigente = true;
    void (async () => {
      setSunatCargandoEmpresa(true);
      setSunatValidadoEmpresa(false);
      try {
        const r = await sunatService.consultarRuc(ruc);
        if (!vigente || !r.razonSocial) return;
        setRazonSocialEmpresa((prev) => r.razonSocial || prev);
        setNombreComercialEmpresa((prev) => (prev.trim() ? prev : (r.nombreComercial || r.razonSocial || prev)));
        setDireccionFiscal((prev) => r.direccion || prev);
        setActividadEconomica((prev) => r.actividadEconomica || prev);
        setEstadoContribuyente((prev) => [r.estado, r.condicion].filter(Boolean).join(" / ") || prev);
        setFacturarANombre((prev) => (prev.trim() ? prev : (r.razonSocial || prev)));
        const autos = camposAutocompletadosRuc(r);
        marcarAutocompletados(autos);
        setSunatValidadoEmpresa(true);
      } catch {
        if (vigente) setSunatValidadoEmpresa(false);
      } finally {
        if (vigente) setSunatCargandoEmpresa(false);
      }
    })();
    return () => { vigente = false; };
  }, [empresaVinculada, tipoDocumentoEmpresa, rucEmpresa, marcarAutocompletados]);
  /* Llena los datos del representante con la API cuando hay DNI completo:
     RENIEC (nombre oficial) + servicio-persona (prellenado propio, solo el del usuario). La fuente sobrescribe. */
  useEffect(() => {
    if (!empresaVinculada) return;
    const dni = repDni.trim();
    if (dni.length !== VALIDACIONES.DNI_LONGITUD) return;
    let vigente = true;
    void (async () => {
      setRepDniConsultando(true);
      setRepDniValidado(false);
      try {
        const [ren, pre] = await Promise.allSettled([
          sunatService.consultarDni(dni),
          reservaDatosService.prellenar(TIPOS_DOCUMENTO_PERSONA.DNI, dni),
        ]);
        if (!vigente) return;
        const r = ren.status === "fulfilled" ? ren.value : null;
        const p = pre.status === "fulfilled" ? pre.value : null;
        const nombreOficial = p?.contacto || r?.nombreCompleto || r?.nombres || "";
        if (nombreOficial) setRepNombre(nombreOficial);
        if (r?.nombreCompleto || p?.contacto) setRepDniValidado(true);
        const autos = (r?.nombreCompleto || p?.contacto)
          ? camposAutocompletadosDni("representante", Boolean(nombreOficial))
          : [];
        if (p?.correo) { setRepCorreo(p.correo); autos.push("representanteCorreo"); }
        if (p?.telefono) { setRepCelular(p.telefono); autos.push("representanteCelular"); }
        if (p?.direccion) { setRepDireccion(p.direccion); autos.push("representanteDireccion"); }
        marcarAutocompletados(autos);
      } finally {
        if (vigente) setRepDniConsultando(false);
      }
    })();
    return () => { vigente = false; };
  }, [empresaVinculada, repDni, marcarAutocompletados]);

  /* Consulta RENIEC solo para el DNI de EXTEMIN. */
  useEffect(() => {
    if (!empresaVinculada || exteminTipoDocumento !== TIPOS_DOCUMENTO_PERSONA.DNI) return;
    const dni = exteminDni.trim();
    if (!/^\d{8}$/.test(dni)) return;
    let vigente = true;
    void (async () => {
      setExteminDniConsultando(true);
      setExteminDniValidado(false);
      try {
        const r = await sunatService.consultarDni(dni);
        if (!vigente || r.error) return;
        const nombre = nombreCompletoDesdeDni(r);
        if (nombre) setExteminNombre(nombre);
        setExteminDniValidado(true);
        marcarAutocompletados(camposAutocompletadosDni("extemin", Boolean(nombre)));
      } finally {
        if (vigente) setExteminDniConsultando(false);
      }
    })();
    return () => { vigente = false; };
  }, [empresaVinculada, exteminTipoDocumento, exteminDni, marcarAutocompletados]);

  /* Consulta RENIEC solo para el DNI del responsable de pagos. */
  useEffect(() => {
    if (!empresaVinculada || pagosTipoDocumento !== TIPOS_DOCUMENTO_PERSONA.DNI) return;
    const dni = pagosDni.trim();
    if (!/^\d{8}$/.test(dni)) return;
    let vigente = true;
    void (async () => {
      setPagosDniConsultando(true);
      setPagosDniValidado(false);
      try {
        const r = await sunatService.consultarDni(dni);
        if (!vigente || r.error) return;
        const nombre = nombreCompletoDesdeDni(r);
        if (nombre) setPagosNombre(nombre);
        setPagosDniValidado(true);
        marcarAutocompletados(camposAutocompletadosDni("pagos", Boolean(nombre)));
      } finally {
        if (vigente) setPagosDniConsultando(false);
      }
    })();
    return () => { vigente = false; };
  }, [empresaVinculada, pagosTipoDocumento, pagosDni, marcarAutocompletados]);
  const handleSave = async () => {
    setSaving(true);
    try {
      await perfilService.update({
        nombre,
        apellidos,
        telefono,
        tipoUsuarioId,
        idEmpresa,
        nombreEmpresa,
        logoUrl: logoUrl || null,
        firmaUrl: firmaUrl || null,
      });
      toast.success("Perfil actualizado");
    } catch { toast.error("Error al guardar"); }
    setSaving(false);
  };

  const handleSaveEmpresa = async () => {
    if (!puedeGuardarEmpresa) return;
    setSavingEmpresa(true);
    try {
      await portalEmpresaService.validarDatos({
        ruc: rucEmpresa ?? "",
        tipoDocumento: tipoDocumentoEmpresa,
        pais: paisEmpresa,
        inicioOperaciones: inicioOperaciones || null,
        razonSocial: razonSocialEmpresa.trim(),
        nombreComercial: nombreComercialEmpresa.trim() || null,
        direccionFiscal: direccionFiscal.trim() || null,
        telefono: telefonoEmpresa.trim() || null,
        emailFacturacion: emailFacturacion.trim() || null,
        emailContacto: emailContacto.trim() || null,
        nombreFriso: nombreFriso.trim() || null,
        facturarANombre: facturarANombre.trim() || null,
        actividadEconomica: actividadEconomica.trim() || null,
        estadoContribuyente: estadoContribuyente.trim() || null,
        responsableExteminNombre: exteminNombre.trim() || null,
        responsableExteminTelefono: exteminTelefono.trim() || null,
        responsableExteminDni: exteminDni.trim() || null,
        responsableExteminEmail: exteminEmail.trim() || null,
        responsablePagosNombre: pagosNombre.trim() || null,
        responsablePagosTelefono: pagosTelefono.trim() || null,
        responsablePagosDni: pagosDni.trim() || null,
        responsablePagosEmail: pagosEmail.trim() || null,
        representanteLegalNombre: repNombre.trim(),
        representanteLegalTipoDocumento: repTipoDocumento,
        representanteLegalDni: repDni.trim(),
        representanteCorreo: repCorreo.trim(),
        representanteCelular: repCelular.trim(),
        representanteDireccion: repDireccion.trim(),
        partidaElectronica: repPartida.trim() || null,
        tipoComprobante,
        sitioWeb: sitioWebEmpresa.trim() || null,
      });
      toast.success("Datos de la empresa actualizados");
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron guardar los datos de la empresa");
    } finally {
      setSavingEmpresa(false);
    }
  };

  const esRucEmpresa = resolverTipoDocumentoEmpresa(tipoDocumentoEmpresa, rucEmpresa ?? "") === TIPOS_DOCUMENTO_EMPRESA.RUC;

  const notifDatosCompletos = Boolean(
    empresaVinculada && repCorreo.trim() && emailFacturacion.trim(),
  );

  const onLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSubiendoLogo(true);
    try {
      const url = await uploadService.subir(file);
      setLogoUrl(url);
      await perfilService.update({ logoUrl: url });
      toast.success("Logo actualizado");
    } catch {
      toast.error("No se pudo subir el logo");
    }
    setSubiendoLogo(false);
  };

  const quitarLogo = async () => {
    setLogoUrl("");
    try {
      await perfilService.update({ logoUrl: null });
      toast.success("Logo eliminado");
    } catch {
      toast.error("No se pudo quitar el logo");
    }
  };

  const onFirmaFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!archivoUtils.extensionPermitida(file.name, FIRMA_PERFIL_EXTENSIONES)) {
      toast.error("La firma debe ser una imagen PNG.");
      return;
    }
    if (file.size > FIRMA_PERFIL_MAX_BYTES) {
      toast.error(`La firma supera el máximo de ${FIRMA_PERFIL_MAX_BYTES / 1024 / 1024} MB.`);
      return;
    }
    setSubiendoFirma(true);
    try {
      const url = await uploadService.subir(file);
      setFirmaUrl(url);
      await perfilService.update({ firmaUrl: url });
      toast.success("Firma actualizada");
    } catch {
      toast.error("No se pudo subir la firma");
    }
    setSubiendoFirma(false);
  };

  const quitarFirma = async () => {
    setFirmaUrl("");
    try {
      await perfilService.update({ firmaUrl: null });
      toast.success("Firma eliminada");
    } catch {
      toast.error("No se pudo quitar la firma");
    }
  };

  const handleResetRequest = async () => {
    await perfilService.requestReset(email).catch(() => {});
    toast.success("Se envio un enlace a tu correo para restablecer la contrasena");
  };

  const handleResetConfirm = async () => {
    if (resetPassword.length < 6) { toast.error("Minimo 6 caracteres"); return; }
    setResetting(true);
    try {
      await perfilService.confirmReset(resetToken!, resetPassword);
      setResetDone(true);
      toast.success("Contrasena actualizada");
      router.replace("/dashboard/perfil");
    } catch { toast.error("Token invalido o expirado"); }
    setResetting(false);
  };

  const marcarCorreoActivo = (email: string) => {
    setNotifActive(email);
    setNotifSelected(email);
    setNotifPending("");
    setNotifCode("");
    setNotifCandidates((prev) => prev.map((c) => ({ ...c, activo: c.email === email })));
  };

  const handleSolicitarNotificacion = async () => {
    if (!notifSelected || notifSelected === notifActive || notifSending) return;
    setNotifSending(true);
    try {
      const result = await perfilService.solicitarNotificacion(notifSelected);
      if (result.verificado) {
        marcarCorreoActivo(result.email);
        toast.success("Correo de notificaciones actualizado");
      } else {
        setNotifPending(result.email);
        setNotifCode("");
        if (result.emailEnviado) {
          toast.success("Te enviamos un codigo al correo seleccionado");
        } else {
          toast.warning("Solicitud registrada, pero no se pudo enviar el correo. Revisa la configuracion de correo.");
        }
      }
    } catch {
      toast.error("No se pudo iniciar la verificacion del correo");
    }
    setNotifSending(false);
  };

  const handleConfirmarNotificacion = async () => {
    if (!notifCode.trim() || notifConfirming) return;
    setNotifConfirming(true);
    try {
      const result = await perfilService.confirmarNotificacion(notifCode.trim());
      marcarCorreoActivo(result.email);
      toast.success("Correo de notificaciones verificado");
    } catch {
      toast.error("Codigo invalido o expirado");
    }
    setNotifConfirming(false);
  };

  if (loading) return null;
  return (
    <main className="flex-1 py-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
          <p className="text-sm text-muted-foreground">
            Separa los datos de tu cuenta, de la empresa y del representante legal.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5">
            <TabsTrigger value="cuenta" className="gap-1.5 text-xs">
              <UserRound className="h-3.5 w-3.5" />
              <span>Cuenta</span>
            </TabsTrigger>
            <TabsTrigger value="empresa" className="gap-1.5 text-xs">
              <Building2 className="h-3.5 w-3.5" />
              <span>Empresa y representante</span>
            </TabsTrigger>
            <TabsTrigger value="recursos" className="gap-1.5 text-xs">
              <ImageIcon className="h-3.5 w-3.5" />
              <span>Logo y firma</span>
            </TabsTrigger>
            <TabsTrigger value="seguridad" className="gap-1.5 text-xs">
              <LockKeyhole className="h-3.5 w-3.5" />
              <span>Seguridad</span>
            </TabsTrigger>
            <TabsTrigger value="notificaciones" className="gap-1.5 text-xs">
              <Bell className="h-3.5 w-3.5" />
              <span>Notificaciones</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cuenta" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="h-4 w-4" />
                  <span>Datos de la cuenta</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Identidad con la que ingresas y recibes notificaciones.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email"><span>Correo de acceso</span></Label>
                  <Input id="email" value={email} disabled className="opacity-60 text-xs" />
                  <p className="text-[11px] text-muted-foreground">
                    Este correo identifica tu cuenta. Para cambiarlo, contacta al IIMP.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="nombre"><span>Nombres</span></Label>
                    <Input id="nombre" placeholder="Juan" value={nombre} onChange={(e) => setNombre(e.target.value)} className="text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="apellidos"><span>Apellidos</span></Label>
                    <Input id="apellidos" placeholder="Perez" value={apellidos} onChange={(e) => setApellidos(e.target.value)} className="text-xs" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="telefono"><span>Telefono de contacto</span></Label>
                  <Input id="telefono" placeholder="999888777" maxLength={9} value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/\D/g, "").slice(0, 9))} className="text-xs" />
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={saving}>
                    <span>{saving ? "Guardando..." : "Guardar datos de la cuenta"}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="empresa" className="mt-0 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span>Datos de la empresa</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Información fiscal y comercial que se usa en el contrato y el comprobante.
                </p>
              </CardHeader>
              <CardContent>
                {empresaVinculada ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="empresaRazonSocial"><span>Razón social</span> <span className="text-destructive">*</span></Label>
                      <InputEmpresa id="empresaRazonSocial" error={errorVisibleEmpresa("razonSocial")} resaltado={marcarPendienteEmpresa("razonSocial")} autocompletado={estaAutocompletado("razonSocial")} maxLength={200} value={razonSocialEmpresa} onChange={(e) => setRazonSocialEmpresa(e.target.value)} className="text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="empresaTipoDocumento"><span>Tipo de documento</span> <span className="text-destructive">*</span></Label>
                      <Select value={tipoDocumentoEmpresa} onValueChange={(v) => {
                        setTipoDocumentoEmpresa(v);
                        setSunatValidadoEmpresa(false);
                        setSunatCargandoEmpresa(false);
                        setRucEmpresa((prev) => v === TIPOS_DOCUMENTO_EMPRESA.RUC
                          ? String(prev ?? "").replace(/\D/g, "").slice(0, 11)
                          : String(prev ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 20));
                      }}>
                        <SelectTrigger id="empresaTipoDocumento" className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(TIPOS_DOCUMENTO_EMPRESA_LABELS).map(([valor, etiqueta]) => (
                            <SelectItem key={valor} value={valor}><span>{etiqueta}</span></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="empresaRuc">
                        <span>{tipoDocumentoEmpresa === TIPOS_DOCUMENTO_EMPRESA.RUC ? "RUC" : "RUT / No domiciliado"}</span> <span className="text-destructive">*</span>
                      </Label>
                      <InputEmpresa
                        id="empresaRuc"
                        error={errorVisibleEmpresa("ruc")} resaltado={marcarPendienteEmpresa("ruc")} autocompletado={estaAutocompletado("ruc")}
                        nota={sunatCargandoEmpresa ? "Consultando SUNAT..." : sunatValidadoEmpresa ? "Datos validados con SUNAT." : undefined}
                        value={rucEmpresa ?? ""}
                        onChange={(e) => {
                          setSunatValidadoEmpresa(false);
                          setSunatCargandoEmpresa(false);
                          setRucEmpresa(tipoDocumentoEmpresa === TIPOS_DOCUMENTO_EMPRESA.RUC
                            ? e.target.value.replace(/\D/g, "").slice(0, 11)
                            : e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 20));
                        }}
                        placeholder={tipoDocumentoEmpresa === TIPOS_DOCUMENTO_EMPRESA.RUC ? "20601234567" : "RUT o documento"}
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="empresaPais"><span>Pais</span> <span className="text-destructive">*</span></Label>
                      <PaisSelect id="empresaPais" value={paisEmpresa} onChange={setPaisEmpresa} error={errorVisibleEmpresa("pais")} resaltado={marcarPendienteEmpresa("pais")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="empresaInicioOperaciones"><span>Inicio de operaciones</span> <span className="text-destructive">*</span></Label>
                      <InputEmpresa id="empresaInicioOperaciones" error={errorVisibleEmpresa("inicioOperaciones")} resaltado={marcarPendienteEmpresa("inicioOperaciones")} type="date" value={inicioOperaciones} onChange={(e) => setInicioOperaciones(e.target.value)} className="text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="empresaNombreComercial"><span>Nombre comercial</span> <span className="text-destructive">*</span></Label>
                      <InputEmpresa id="empresaNombreComercial" error={errorVisibleEmpresa("nombreComercial")} resaltado={marcarPendienteEmpresa("nombreComercial")} autocompletado={estaAutocompletado("nombreComercial")} maxLength={200} value={nombreComercialEmpresa} onChange={(e) => setNombreComercialEmpresa(e.target.value)} className="text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="empresaDireccion"><span>Dirección fiscal</span> <span className="text-destructive">*</span></Label>
                      <InputEmpresa id="empresaDireccion" error={errorVisibleEmpresa("direccionFiscal")} resaltado={marcarPendienteEmpresa("direccionFiscal")} autocompletado={estaAutocompletado("direccionFiscal")} maxLength={250} value={direccionFiscal} onChange={(e) => setDireccionFiscal(e.target.value)} className="text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="empresaTelefono"><span>Teléfono</span> <span className="text-destructive">*</span></Label>
                      <TelefonoEmpresa id="empresaTelefono" error={errorVisibleEmpresa("telefono")} resaltado={marcarPendienteEmpresa("telefono")} value={telefonoEmpresa} onChange={setTelefonoEmpresa} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="empresaEmailFacturacion"><span>Correo de facturación</span> <span className="text-destructive">*</span></Label>
                      <InputEmpresa id="empresaEmailFacturacion" error={errorVisibleEmpresa("emailFacturacion")} resaltado={marcarPendienteEmpresa("emailFacturacion")} type="email" maxLength={200} value={emailFacturacion} onChange={(e) => setEmailFacturacion(e.target.value)} className="text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="empresaTipoComprobante"><span>Tipo de comprobante</span> <span className="text-destructive">*</span></Label>
                      <Select value={tipoComprobante} onValueChange={setTipoComprobante}>
                        <SelectTrigger id="empresaTipoComprobante" className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.values(TIPOS_COMPROBANTE).map((tipo) => (
                            <SelectItem key={tipo} value={tipo}><span>{TIPO_COMPROBANTE_LABELS[tipo] ?? tipo}</span></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="empresaSitioWeb"><span>Sitio web</span> <span className="text-destructive">*</span></Label>
                      <InputEmpresa id="empresaSitioWeb" error={errorVisibleEmpresa("sitioWeb")} resaltado={marcarPendienteEmpresa("sitioWeb")} maxLength={200} value={sitioWebEmpresa} onChange={(e) => setSitioWebEmpresa(e.target.value)} className="text-xs" />
                    </div>
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
                    No tienes una empresa vinculada.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span>Facturación y coordinación</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Datos usados en la factura y en la coordinación operativa del stand.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {empresaVinculada ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="empresaEmailContacto"><span>Correo de contacto</span> <span className="text-destructive">*</span></Label>
                        <InputEmpresa id="empresaEmailContacto" error={errorVisibleEmpresa("emailContacto")} resaltado={marcarPendienteEmpresa("emailContacto")} type="email" maxLength={200} value={emailContacto} onChange={(e) => setEmailContacto(e.target.value)} className="text-xs" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="empresaNombreFriso"><span>Nombre en el friso</span> <span className="text-destructive">*</span></Label>
                        <InputEmpresa id="empresaNombreFriso" error={errorVisibleEmpresa("nombreFriso")} resaltado={marcarPendienteEmpresa("nombreFriso")} maxLength={200} value={nombreFriso} onChange={(e) => setNombreFriso(e.target.value)} className="text-xs" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="empresaFacturarANombre"><span>Facturar a nombre de</span> <span className="text-destructive">*</span></Label>
                        <InputEmpresa id="empresaFacturarANombre" error={errorVisibleEmpresa("facturarANombre")} resaltado={marcarPendienteEmpresa("facturarANombre")} autocompletado={estaAutocompletado("facturarANombre")} maxLength={200} value={facturarANombre} onChange={(e) => setFacturarANombre(e.target.value)} className="text-xs" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="empresaActividadEconomica"><span>Actividad económica</span> <span className="text-destructive">*</span></Label>
                        <InputEmpresa id="empresaActividadEconomica" error={errorVisibleEmpresa("actividadEconomica")} resaltado={marcarPendienteEmpresa("actividadEconomica")} autocompletado={estaAutocompletado("actividadEconomica")} maxLength={250} value={actividadEconomica} onChange={(e) => setActividadEconomica(e.target.value)} className="text-xs" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="empresaEstadoContribuyente"><span>Estado del contribuyente</span> <span className="text-destructive">*</span></Label>
                        <InputEmpresa id="empresaEstadoContribuyente" error={errorVisibleEmpresa("estadoContribuyente")} resaltado={marcarPendienteEmpresa("estadoContribuyente")} autocompletado={estaAutocompletado("estadoContribuyente")} maxLength={100} value={estadoContribuyente} onChange={(e) => setEstadoContribuyente(e.target.value)} className="text-xs" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-foreground">Responsable de coordinación EXTEMIN</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="exteminNombre"><span>Nombre</span> <span className="text-destructive">*</span></Label>
                          <InputEmpresa autoComplete="off" id="exteminNombre" error={errorVisibleEmpresa("responsableExteminNombre")} resaltado={marcarPendienteEmpresa("responsableExteminNombre")} autocompletado={estaAutocompletado("responsableExteminNombre")} maxLength={200} value={exteminNombre} onChange={(e) => setExteminNombre(e.target.value)} className="text-xs" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="exteminTelefono"><span>Teléfono</span> <span className="text-destructive">*</span></Label>
                          <TelefonoEmpresa id="exteminTelefono" error={errorVisibleEmpresa("responsableExteminTelefono")} resaltado={marcarPendienteEmpresa("responsableExteminTelefono")} value={exteminTelefono} onChange={setExteminTelefono} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="exteminDni"><span>DNI</span> <span className="text-destructive">*</span></Label>
                          <InputEmpresa autoComplete="off" id="exteminDni" error={errorVisibleEmpresa("responsableExteminDni")} resaltado={marcarPendienteEmpresa("responsableExteminDni")} autocompletado={estaAutocompletado("responsableExteminDni")} nota={exteminDniConsultando ? "Consultando RENIEC..." : exteminDniValidado ? "Datos validados con RENIEC." : undefined} maxLength={8} value={exteminDni} onChange={(e) => { setExteminDniValidado(false); setExteminDni(e.target.value.replace(/\D/g, "").slice(0, 8)); }} className="font-mono text-xs" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="exteminEmail"><span>Correo</span> <span className="text-destructive">*</span></Label>
                          <InputEmpresa id="exteminEmail" error={errorVisibleEmpresa("responsableExteminEmail")} resaltado={marcarPendienteEmpresa("responsableExteminEmail")} type="email" maxLength={200} value={exteminEmail} onChange={(e) => setExteminEmail(e.target.value)} className="text-xs" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-foreground">Responsable de pagos</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="pagosNombre"><span>Nombre</span> <span className="text-destructive">*</span></Label>
                          <InputEmpresa autoComplete="off" id="pagosNombre" error={errorVisibleEmpresa("responsablePagosNombre")} resaltado={marcarPendienteEmpresa("responsablePagosNombre")} autocompletado={estaAutocompletado("responsablePagosNombre")} maxLength={200} value={pagosNombre} onChange={(e) => setPagosNombre(e.target.value)} className="text-xs" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="pagosTelefono"><span>Teléfono</span> <span className="text-destructive">*</span></Label>
                          <TelefonoEmpresa id="pagosTelefono" error={errorVisibleEmpresa("responsablePagosTelefono")} resaltado={marcarPendienteEmpresa("responsablePagosTelefono")} value={pagosTelefono} onChange={setPagosTelefono} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="pagosDni"><span>DNI</span> <span className="text-destructive">*</span></Label>
                          <InputEmpresa autoComplete="off" id="pagosDni" error={errorVisibleEmpresa("responsablePagosDni")} resaltado={marcarPendienteEmpresa("responsablePagosDni")} autocompletado={estaAutocompletado("responsablePagosDni")} nota={pagosDniConsultando ? "Consultando RENIEC..." : pagosDniValidado ? "Datos validados con RENIEC." : undefined} maxLength={8} value={pagosDni} onChange={(e) => { setPagosDniValidado(false); setPagosDni(e.target.value.replace(/\D/g, "").slice(0, 8)); }} className="font-mono text-xs" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="pagosEmail"><span>Correo</span> <span className="text-destructive">*</span></Label>
                          <InputEmpresa id="pagosEmail" error={errorVisibleEmpresa("responsablePagosEmail")} resaltado={marcarPendienteEmpresa("responsablePagosEmail")} type="email" maxLength={200} value={pagosEmail} onChange={(e) => setPagosEmail(e.target.value)} className="text-xs" />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="rounded-lg border border-dashed border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
                    No tienes una empresa vinculada.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="h-4 w-4" />
                  <span>Representante legal</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Persona que firma el contrato y usa el correo de acceso al sistema.
                </p>
              </CardHeader>
              <CardContent>
                {empresaVinculada ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="repTipoDocumento"><span>Tipo de documento</span> <span className="text-destructive">*</span></Label>
                      <Select value={repTipoDocumento} onValueChange={(v) => {
                        setRepDniValidado(false);
                        setRepTipoDocumento(v);
                        setRepDni((prev) => v === TIPOS_DOCUMENTO_PERSONA.DNI
                          ? prev.replace(/\D/g, "").slice(0, 8)
                          : prev.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15));
                      }}>
                        <SelectTrigger id="repTipoDocumento" className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(TIPOS_DOCUMENTO_PERSONA_LABELS).map(([valor, etiqueta]) => (
                            <SelectItem key={valor} value={valor}><span>{etiqueta}</span></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="repDni">
                          <span>{repTipoDocumento === TIPOS_DOCUMENTO_PERSONA.DNI ? "DNI del representante" : "Documento del representante"}</span> <span className="text-destructive">*</span>
                        </Label>
                        {repDniValidado && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "rgb(220 252 231)", color: "rgb(21 128 61)" }}>
                            <ShieldCheck className="h-3 w-3" />
                            <span>Validado RENIEC</span>
                          </span>
                        )}
                      </div>
                      <InputEmpresa
                        autoComplete="off"
                        id="repDni"
                        error={errorVisibleEmpresa("representanteLegalDni")} resaltado={marcarPendienteEmpresa("representanteLegalDni")} autocompletado={estaAutocompletado("representanteLegalDni")}
                        nota={repDniConsultando ? "Consultando RENIEC..." : repDniValidado ? "Datos validados con RENIEC." : undefined}
                        placeholder={repTipoDocumento === TIPOS_DOCUMENTO_PERSONA.DNI ? "45871233" : "Numero de documento"}
                        maxLength={repTipoDocumento === TIPOS_DOCUMENTO_PERSONA.DNI ? 8 : 15}
                        value={repDni}
                        onChange={(e) => {
                          setRepDniValidado(false);
                          setRepDni(repTipoDocumento === TIPOS_DOCUMENTO_PERSONA.DNI
                            ? e.target.value.replace(/\D/g, "").slice(0, 8)
                            : e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15));
                        }}
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="repNombre"><span>Nombre completo</span> <span className="text-destructive">*</span></Label>
                      <InputEmpresa autoComplete="off" id="repNombre" error={errorVisibleEmpresa("representanteLegalNombre")} resaltado={marcarPendienteEmpresa("representanteLegalNombre")} autocompletado={estaAutocompletado("representanteLegalNombre")} placeholder="Jorge Quispe Ramos" maxLength={200} value={repNombre} onChange={(e) => setRepNombre(e.target.value)} className="text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="repPartida"><span>{esRucEmpresa ? "Partida electronica" : "Partida electronica (opcional)"}</span>{esRucEmpresa && <span className="text-destructive"> *</span>}</Label>
                      <InputEmpresa id="repPartida" error={errorVisibleEmpresa("partidaElectronica")} resaltado={marcarPendienteEmpresa("partidaElectronica")} placeholder="11014857" maxLength={50} value={repPartida} onChange={(e) => setRepPartida(e.target.value)} className="font-mono text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="repDireccion"><span>Dirección</span> <span className="text-destructive">*</span></Label>
                      <InputEmpresa id="repDireccion" error={errorVisibleEmpresa("representanteDireccion")} resaltado={marcarPendienteEmpresa("representanteDireccion")} autocompletado={estaAutocompletado("representanteDireccion")} placeholder="Av. Arequipa 1250, Lince" maxLength={100} value={repDireccion} onChange={(e) => setRepDireccion(e.target.value)} className="text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="repCorreo"><span>Correo</span> <span className="text-destructive">*</span></Label>
                      <InputEmpresa id="repCorreo" error={errorVisibleEmpresa("representanteCorreo")} resaltado={marcarPendienteEmpresa("representanteCorreo")} autocompletado={estaAutocompletado("representanteCorreo")} type="email" placeholder="representante@empresa.pe" maxLength={101} value={repCorreo} onChange={(e) => setRepCorreo(e.target.value)} className="text-xs" />
                      <p className="text-[11px] text-muted-foreground">Se usará en el contrato, como usuario del sistema y para las notificaciones.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="repCelular"><span>Celular</span> <span className="text-destructive">*</span></Label>
                      <TelefonoEmpresa id="repCelular" error={errorVisibleEmpresa("representanteCelular")} resaltado={marcarPendienteEmpresa("representanteCelular")} autocompletado={estaAutocompletado("representanteCelular")} placeholder="+51 987 654 321" value={repCelular} onChange={setRepCelular} />
                    </div>
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
                    No hay representante legal porque no tienes una empresa vinculada.
                  </p>
                )}
              </CardContent>
            </Card>

            <div aria-live="polite" className="space-y-3">
              {pendientesEmpresa.length > 0 ? (
                <div className="rounded-xl border border-warning/40 bg-warning/5 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-warning">
                      Faltan {pendientesEmpresa.length} {pendientesEmpresa.length === 1 ? "dato" : "datos"} para guardar
                    </p>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="resaltar-pendientes-empresa" className="text-[11px] font-medium text-muted-foreground">
                        <span>Resaltar campos</span>
                      </Label>
                      <Switch
                        id="resaltar-pendientes-empresa"
                        checked={resaltarPendientesEmpresa}
                        onCheckedChange={setResaltarPendientesEmpresa}
                      />
                    </div>
                  </div>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-[11px] text-muted-foreground">
                    {pendientesEmpresa.map((mensaje, indice) => (
                      <li key={`${indice}-${mensaje}`}>{mensaje}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className={`flex items-center gap-1.5 text-[11px] font-medium ${confirmadoEmpresa ? "text-success" : "text-warning"}`}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>
                    {confirmadoEmpresa
                      ? "Todo listo para guardar."
                      : "Marca la confirmacion de que los datos son correctos para guardar."}
                  </span>
                </p>
              )}
            </div>

            <label className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
              <Checkbox
                checked={confirmadoEmpresa}
                onCheckedChange={(v) => setConfirmadoEmpresa(v === true)}
                className="mt-0.5"
              />
              <span className="text-[11px] leading-relaxed text-muted-foreground">
                Confirmo que estos datos son correctos y autorizo que se usen para generar el contrato de alquiler
                y el comprobante de pago de mi empresa.
              </span>
            </label>

            <div className="flex justify-end">
              <Button onClick={() => void handleSaveEmpresa()} disabled={savingEmpresa || !puedeGuardarEmpresa}>
                <span>{savingEmpresa ? "Guardando..." : "Guardar datos de la empresa y representante"}</span>
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="recursos" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  <span>Logo y firma</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  El logo se muestra en el mapa y la firma se usa para firmar contratos.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label><span>Logo personal (opcional)</span></Label>
                  <div className="flex items-center gap-3">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo personal" className="h-14 w-14 rounded-lg border bg-white object-contain p-1" />
                    ) : (
                      <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                        <ImageIcon className="h-4 w-4" />
                      </span>
                    )}
                    <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onLogoFile(e); }} />
                    <Button type="button" variant="outline" size="sm" className="rounded-full text-xs" disabled={subiendoLogo} onClick={() => logoRef.current?.click()}>
                      {subiendoLogo ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                      <span>{logoUrl ? "Cambiar logo" : "Subir logo"}</span>
                    </Button>
                    {logoUrl && (
                      <Button type="button" variant="ghost" size="sm" className="rounded-full text-xs text-destructive" onClick={() => void quitarLogo()}>
                        <span>Quitar</span>
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">PNG o JPG hasta 5 MB. Tiene prioridad sobre el logo de la empresa en los stands del mapa.</p>
                </div>

                <div className="space-y-2">
                  <Label><span>Firma digital (para contratos)</span></Label>
                  <div className="flex items-center gap-3">
                    {firmaUrl ? (
                      <img src={firmaUrl} alt="Firma digital" className="h-14 w-28 rounded-lg border bg-white object-contain p-1" />
                    ) : (
                      <span className="flex h-14 w-28 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                        <PenLine className="h-4 w-4" />
                      </span>
                    )}
                    <input ref={firmaRef} type="file" accept=".png,image/png" className="hidden" onChange={(e) => { void onFirmaFile(e); }} />
                    <Button type="button" variant="outline" size="sm" className="rounded-full text-xs" disabled={subiendoFirma} onClick={() => firmaRef.current?.click()}>
                      {subiendoFirma ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                      <span>{firmaUrl ? "Cambiar firma" : "Subir firma"}</span>
                    </Button>
                    {firmaUrl && (
                      <Button type="button" variant="ghost" size="sm" className="rounded-full text-xs text-destructive" onClick={() => void quitarFirma()}>
                        <span>Quitar</span>
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Sube una imagen PNG de tu firma con fondo claro. Se usará para firmar digitalmente tus contratos.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="seguridad" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LockKeyhole className="h-4 w-4" />
                  <span>Seguridad</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {resetToken ? (
                  resetDone ? (
                    <p className="text-sm text-emerald-600">Contrasena actualizada correctamente.</p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">Ingresa tu nueva contrasena.</p>
                      <Input type="password" placeholder="Minimo 6 caracteres" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} className="text-xs" />
                      <Button onClick={handleResetConfirm} disabled={resetting}>
                        <span>{resetting ? "Actualizando..." : "Cambiar contrasena"}</span>
                      </Button>
                    </div>
                  )
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">Recibiras un enlace por correo para restablecer tu contrasena.</p>
                    <Button variant="outline" onClick={handleResetRequest}>
                      <span>Enviar enlace de restablecimiento</span>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notificaciones" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <span>Notificaciones por correo</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Elige entre los correos registrados en tu cuenta y empresa. El correo de acceso siempre queda para iniciar sesion y recuperar la contrasena.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {!notifDatosCompletos ? (
                  <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
                    <p className="text-xs text-foreground">
                      Para elegir el correo de notificaciones primero completa el correo del representante y el correo de facturación en los datos de tu empresa.
                    </p>
                    <Button type="button" size="sm" onClick={() => router.push("/auth/validar-datos")}>
                      <span>Completar datos de la empresa</span>
                    </Button>
                  </div>
                ) : (
                  <>
                <div className="grid gap-2">
                  {notifCandidates.map((c) => {
                    const esActivo = c.email === notifActive;
                    const esPendiente = c.email === notifPending;
                    const seleccionado = c.email === notifSelected;
                    return (
                      <button
                        key={c.email}
                        type="button"
                        onClick={() => setNotifSelected(c.email)}
                        className={`flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition ${seleccionado ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                      >
                        <span className="space-y-0.5">
                          <span className="block text-xs font-medium">{c.label}</span>
                          <span className="block break-all text-xs text-muted-foreground">{c.email}</span>
                        </span>
                        <span className="shrink-0">
                          {esActivo ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Activo</span>
                          ) : esPendiente ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Pendiente</span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {notifSelected && notifSelected !== notifActive && notifSelected !== notifPending && (
                  <Button type="button" size="sm" disabled={notifSending} onClick={() => void handleSolicitarNotificacion()}>
                    {notifSending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                    <span>{notifSending ? "Enviando..." : notifSelected === email ? "Usar correo de acceso" : "Enviar codigo de verificacion"}</span>
                  </Button>
                )}

                {notifPending && notifSelected === notifPending && (
                  <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                    <p className="text-xs text-amber-800">
                      Enviamos un codigo de 6 digitos a <strong>{notifPending}</strong>. Vence en 10 minutos.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Codigo de verificacion"
                        value={notifCode}
                        onChange={(e) => setNotifCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="max-w-48 text-xs tracking-[0.3em]"
                      />
                      <Button type="button" size="sm" disabled={notifConfirming || notifCode.length !== 6} onClick={() => void handleConfirmarNotificacion()}>
                        {notifConfirming ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                        <span>{notifConfirming ? "Verificando..." : "Confirmar correo"}</span>
                      </Button>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground">
                  Los correos de seguridad (inicio de sesion, recuperacion de contrasena y credenciales) siempre se envian al correo de acceso.
                </p>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );

}

export default function PerfilPage() {
  return (
    <Suspense fallback={null}>
      <PerfilPageContent />
    </Suspense>
  );
}
