"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from "@nrivera-iimp/ui-kit-iimp";
import { AlertTriangle, Building2, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { portalEmpresaService } from "@/lib/client/api/services/portal-empresa-service";
import { authService } from "@/lib/client/api/services/auth-service";
import { sunatService } from "@/lib/client/api/services/sunat-service";
import { PortalAuthCardHeader, PortalAuthLayout } from "@/components/layout/portal-auth-layout";
import { PaisSelect } from "@/components/shared/pais-select";
import { TelefonoInput } from "@/components/shared/telefono-input";
import {
  TIPOS_COMPROBANTE,
  TIPO_COMPROBANTE_LABELS,
  TIPOS_DOCUMENTO_EMPRESA,
  TIPOS_DOCUMENTO_EMPRESA_LABELS,
  TIPOS_DOCUMENTO_PERSONA,
  TIPOS_DOCUMENTO_PERSONA_LABELS,
} from "@/lib/shared/constants";
import { resolverTipoDocumentoEmpresa } from "@/lib/shared/utils/documento-empresa";
import { dateUtils } from "@/lib/shared/utils/date";
import { erroresFormularioEmpresa } from "@/lib/shared/utils/empresa-form-validacion";
import { RepresentantesAdicionalesEditor } from "@/components/empresa/representantes-adicionales-editor";
import { erroresRepresentantesAdicionales, representanteAdicionalDesdeDTO, representanteAdicionalPayload, type RepresentanteAdicionalForm } from "@/lib/shared/utils/representantes-adicionales";
import type { EmpresaDTO } from "@/types/dto/empresas";

interface FormState {
  ruc: string;
  tipoDocumento: string;
  pais: string;
  razonSocial: string;
  nombreComercial: string;
  direccionFiscal: string;
  inicioOperaciones: string;
  telefono: string;
  emailContacto: string;
  emailFacturacion: string;
  representanteLegalNombre: string;
  representanteLegalTipoDocumento: string;
  representanteLegalDni: string;
  representanteCorreo: string;
  representanteCelular: string;
  representanteDireccion: string;
  partidaElectronica: string;
  nombreFriso: string;
  actividadEconomica: string;
  estadoContribuyente: string;
  facturarANombre: string;
  responsableExteminNombre: string;
  responsableExteminTelefono: string;
  responsableExteminTipoDocumento: string;
  responsableExteminDni: string;
  responsableExteminEmail: string;
  responsablePagosNombre: string;
  responsablePagosTelefono: string;
  responsablePagosTipoDocumento: string;
  responsablePagosDni: string;
  responsablePagosEmail: string;
  tipoComprobante: string;
  sitioWeb: string;
}

/** Agrupacion visual del formulario (mismo orden que la solicitud de participacion). */
function SeccionFormulario({ titulo, descripcion, className = "", children }: { titulo: string; descripcion?: string; className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-4 ${className}`}>
      <div className="mb-3 border-b border-border pb-2">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-primary">{titulo}</h3>
        {descripcion && <p className="mt-1 text-[11px] text-muted-foreground">{descripcion}</p>}
      </div>
      {children}
    </section>
  );
}

function Campo({
  label,
  valor,
  onChange,
  contractual = false,
  placeholder,
  mono = false,
  deshabilitado = false,
  nota,
  requerido = false,
  error,
  telefono = false,
  resaltado = false,
  type = "text",
}: {
  label: string;
  valor: string;
  onChange: (valor: string) => void;
  contractual?: boolean;
  placeholder?: string;
  mono?: boolean;
  deshabilitado?: boolean;
  nota?: string;
  requerido?: boolean;
  error?: string;
  telefono?: boolean;
  resaltado?: boolean;
  type?: "text" | "date" | "email";
}) {
  return (
    <div
      className={resaltado
        ? "rounded-lg border border-warning bg-warning/10 p-3 ring-2 ring-warning/20"
        : contractual ? "rounded-lg border border-border bg-secondary/30 p-3" : ""}
    >
      <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
        <Label className="text-xs font-semibold text-primary">
          {label} {requerido && <span className="text-destructive">*</span>}
        </Label>
        {contractual && (
          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[9px] font-bold tracking-wide text-warning uppercase">
            Se usara en el contrato
          </span>
        )}
      </div>
      {telefono ? (
        <TelefonoInput
          value={valor}
          onChange={onChange}
          disabled={deshabilitado}
          error={error}
          placeholder={placeholder}
        />
      ) : (
        <Input
          type={type}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={deshabilitado}
          className={`h-10 text-sm ${mono ? "font-mono" : ""} ${deshabilitado ? "opacity-60" : ""} ${
            resaltado ? "border-warning ring-2 ring-warning/20" : error ? "border-destructive" : ""
          }`}
        />
      )}
      {error && <p className={`mt-1 text-[11px] ${resaltado ? "text-warning" : "text-destructive"}`}>{error}</p>}
      {nota && <p className="mt-1 text-[10px] text-muted-foreground">{nota}</p>}
    </div>
  );
}

function CampoTipoDocumento({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-primary"><span>Tipo de documento</span></Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-10 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          {Object.values(TIPOS_DOCUMENTO_PERSONA).map((tipo) => (
            <SelectItem key={tipo} value={tipo}>
              <span>{TIPOS_DOCUMENTO_PERSONA_LABELS[tipo] ?? tipo}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CampoTipoDocumentoEmpresa({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <div className="space-y-1 rounded-lg border border-border bg-secondary/30 p-3">
      <Label className="text-xs font-semibold text-primary"><span>Tipo de documento</span></Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-10 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          {Object.values(TIPOS_DOCUMENTO_EMPRESA).map((tipo) => (
            <SelectItem key={tipo} value={tipo}>
              <span>{TIPOS_DOCUMENTO_EMPRESA_LABELS[tipo] ?? tipo}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ValidarDatosContent() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [empresa, setEmpresa] = useState<EmpresaDTO | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [representantesAdicionales, setRepresentantesAdicionales] = useState<RepresentanteAdicionalForm[]>([]);
  const [confirmado, setConfirmado] = useState(false);
  /** Al activarlo, los campos con error se resaltan para ubicarlos rápido. */
  const [resaltarPendientes, setResaltarPendientes] = useState(false);
  /** Cuenta sin correo del representante: puede registrarlo en este primer ingreso (solo local). */
  const [repCorreoRegistrable, setRepCorreoRegistrable] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sunatCargando, setSunatCargando] = useState(false);
  const [sunatValidado, setSunatValidado] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const datos = await portalEmpresaService.misDatos();
        setEmpresa(datos);
        setForm({
          ruc: datos.ruc,
          tipoDocumento: datos.tipoDocumento ?? TIPOS_DOCUMENTO_EMPRESA.RUC,
          razonSocial: datos.razonSocial,
          nombreComercial: datos.nombreComercial ?? "",
          pais: datos.pais ?? "PE",
          direccionFiscal: datos.direccionFiscal ?? "",
          inicioOperaciones: dateUtils.toInputValue(datos.inicioOperaciones),
          telefono: datos.telefono ?? "",
          emailContacto: datos.emailContacto ?? "",
          emailFacturacion: datos.emailFacturacion ?? "",
          representanteLegalNombre: datos.representanteLegalNombre ?? "",
          representanteLegalTipoDocumento: datos.representanteLegalTipoDocumento ?? TIPOS_DOCUMENTO_PERSONA.DNI,
          representanteLegalDni: datos.representanteLegalDni ?? "",
          representanteCorreo: datos.representanteCorreo ?? "",
          representanteCelular: datos.representanteCelular ?? "",
          representanteDireccion: datos.representanteDireccion ?? "",
          partidaElectronica: datos.partidaElectronica ?? "",
          nombreFriso: datos.nombreFriso ?? "",
          actividadEconomica: datos.actividadEconomica ?? "",
          estadoContribuyente: datos.estadoContribuyente ?? "",
          facturarANombre: datos.facturarANombre?.trim() || datos.razonSocial,
          responsableExteminNombre: datos.responsableExteminNombre ?? "",
          responsableExteminTelefono: datos.responsableExteminTelefono ?? "",
          responsableExteminTipoDocumento: datos.responsableExteminTipoDocumento ?? TIPOS_DOCUMENTO_PERSONA.DNI,
          responsableExteminDni: datos.responsableExteminDni ?? "",
          responsableExteminEmail: datos.responsableExteminEmail ?? "",
          responsablePagosNombre: datos.responsablePagosNombre ?? "",
          responsablePagosTelefono: datos.responsablePagosTelefono ?? "",
          responsablePagosTipoDocumento: datos.responsablePagosTipoDocumento ?? TIPOS_DOCUMENTO_PERSONA.DNI,
          responsablePagosDni: datos.responsablePagosDni ?? "",
          responsablePagosEmail: datos.responsablePagosEmail ?? "",
          tipoComprobante: datos.tipoComprobante,
          sitioWeb: datos.sitioWeb ?? "",
        });
        setRepresentantesAdicionales((datos.representantesAdicionales ?? []).map(representanteAdicionalDesdeDTO));
        setRepCorreoRegistrable(!(datos.representanteCorreo ?? "").trim());
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudieron cargar los datos de tu empresa");
      }
      setCargando(false);
    })();
  }, []);

  const setCampo = (campo: keyof FormState, valor: string) => {
    setForm((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  };

  /** Autocompleta desde SUNAT al cargar o editar un RUC de 11 digitos. */
  useEffect(() => {
    const ruc = form?.ruc ?? "";
    if (!form || form.tipoDocumento !== TIPOS_DOCUMENTO_EMPRESA.RUC || !/^\d{11}$/.test(ruc)) return;
    let vigente = true;
    void (async () => {
      setSunatCargando(true);
      setSunatValidado(false);
      try {
        const r = await sunatService.consultarRuc(ruc);
        if (!vigente || !r.razonSocial) return;
        setForm((prev) => {
          if (!prev) return prev;
          const facturarActual = prev.facturarANombre.trim();
          const debeActualizarFacturar = !facturarActual || facturarActual === prev.razonSocial;
          return {
            ...prev,
            razonSocial: prev.razonSocial.trim() ? prev.razonSocial : (r.razonSocial || prev.razonSocial),
            direccionFiscal: r.direccion || prev.direccionFiscal,
            actividadEconomica: r.actividadEconomica || prev.actividadEconomica,
            estadoContribuyente: [r.estado, r.condicion].filter(Boolean).join(" / ") || prev.estadoContribuyente,
            facturarANombre: debeActualizarFacturar ? (r.razonSocial || prev.razonSocial) : prev.facturarANombre,
          };
        });
        setSunatValidado(true);
      } finally {
        if (vigente) setSunatCargando(false);
      }
    })();
    return () => { vigente = false; };
  }, [form?.ruc]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Consulta RENIEC cuando el tipo de documento es DNI (8 digitos). */
  useEffect(() => {
    if (!form) return;
    const objetivos = [
      { tipo: form.representanteLegalTipoDocumento, documento: form.representanteLegalDni, campo: "representanteLegalNombre" as const },
      { tipo: form.responsableExteminTipoDocumento, documento: form.responsableExteminDni, campo: "responsableExteminNombre" as const },
      { tipo: form.responsablePagosTipoDocumento, documento: form.responsablePagosDni, campo: "responsablePagosNombre" as const },
    ].filter((o) => o.tipo === TIPOS_DOCUMENTO_PERSONA.DNI && /^\d{8}$/.test(o.documento.trim()));
    if (objetivos.length === 0) return;
    let vigente = true;
    void Promise.all(objetivos.map(async (o) => {
      const r = await sunatService.consultarDni(o.documento.trim());
      const nombre = r.nombreCompleto || [r.nombres, r.apellidoPaterno, r.apellidoMaterno].filter(Boolean).join(" ");
      return { campo: o.campo, nombre: nombre.trim() };
    })).then((resultados) => {
      if (!vigente) return;
      setForm((prev) => {
        if (!prev) return prev;
        const siguiente = { ...prev };
        for (const r of resultados) {
          if (r.nombre) siguiente[r.campo] = r.nombre;
        }
        return siguiente;
      });
    });
    return () => { vigente = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form?.representanteLegalTipoDocumento,
    form?.representanteLegalDni,
    form?.responsableExteminTipoDocumento,
    form?.responsableExteminDni,
    form?.responsablePagosTipoDocumento,
    form?.responsablePagosDni,
  ]);

  /** Errores actuales del formulario (incluye obligatorios vacios). */
  const erroresFormulario = useMemo<Partial<Record<keyof FormState, string>>>(
    () => (form ? erroresFormularioEmpresa(form) : {}),
    [form],
  );
  /** Validacion viva: el boton de guardar solo se habilita con los obligatorios completos. */
  const formularioCompleto = Object.keys(erroresFormulario).length === 0;
  const esRucEmpresa = form
    ? resolverTipoDocumentoEmpresa(form.tipoDocumento, form.ruc) === TIPOS_DOCUMENTO_EMPRESA.RUC
    : false;

  /**
   * Errores visibles: solo los campos con contenido, para no marcar en rojo
   * todo el formulario al cargar. Los vacios se resaltan con el switch.
   */
  const erroresVisibles = useMemo(() => {
    if (!form) return {} as Partial<Record<keyof FormState, string>>;
    const visibles: Partial<Record<keyof FormState, string>> = {};
    for (const [campo, mensaje] of Object.entries(erroresFormulario) as Array<[keyof FormState, string]>) {
      if (String(form[campo] ?? "").trim()) visibles[campo] = mensaje;
    }
    return visibles;
  }, [erroresFormulario, form]);

  /** Marca en naranja el campo cuando el switch esta activo y el campo es pendiente. */
  const marcarPendiente = (campo: keyof FormState) =>
    resaltarPendientes && Boolean(erroresFormulario[campo]);

  const erroresAdicionales = useMemo(() => erroresRepresentantesAdicionales(representantesAdicionales), [representantesAdicionales]);
  const adicionalesCompletos = erroresAdicionales.every((e) => Object.keys(e).length === 0);
  /** Pendientes reales para habilitar Guardar, incluida la confirmacion final. */
  const pendientes = useMemo(() => {
    const campos = [...Object.values(erroresFormulario), ...erroresAdicionales.flatMap((e) => Object.values(e))];
    return confirmado ? campos : [...campos, "Marca la confirmacion de que los datos son correctos."];
  }, [erroresFormulario, erroresAdicionales, confirmado]);

  const validar = (): boolean => Boolean(form && Object.keys(erroresFormularioEmpresa(form)).length === 0 && adicionalesCompletos);

  const guardar = async () => {
    if (!form || !confirmado) return;
    if (!validar()) {
      setError("Revisa los campos marcados en rojo antes de continuar.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await portalEmpresaService.validarDatos({
        ruc: form.ruc.trim(),
        tipoDocumento: form.tipoDocumento,
        razonSocial: form.razonSocial.trim(),
        nombreComercial: form.nombreComercial.trim() || null,
        pais: form.pais,
        direccionFiscal: form.direccionFiscal.trim() || null,
        inicioOperaciones: form.inicioOperaciones || null,
        telefono: form.telefono.trim() || null,
        emailContacto: form.emailContacto.trim() || null,
        emailFacturacion: form.emailFacturacion.trim() || null,
        representanteLegalNombre: form.representanteLegalNombre.trim() || null,
        representanteLegalTipoDocumento: form.representanteLegalTipoDocumento,
        representanteLegalDni: form.representanteLegalDni.trim() || null,
        representanteCorreo: form.representanteCorreo.trim() || null,
        representanteCelular: form.representanteCelular.trim() || null,
        representanteDireccion: form.representanteDireccion.trim() || null,
        partidaElectronica: form.partidaElectronica.trim() || null,
        nombreFriso: form.nombreFriso.trim() || null,
        actividadEconomica: form.actividadEconomica.trim() || null,
        estadoContribuyente: form.estadoContribuyente.trim() || null,
        facturarANombre: form.facturarANombre.trim() || null,
        responsableExteminNombre: form.responsableExteminNombre.trim() || null,
        responsableExteminTelefono: form.responsableExteminTelefono.trim() || null,
        responsableExteminTipoDocumento: form.responsableExteminTipoDocumento,
        responsableExteminDni: form.responsableExteminDni.trim() || null,
        responsableExteminEmail: form.responsableExteminEmail.trim() || null,
        responsablePagosNombre: form.responsablePagosNombre.trim() || null,
        responsablePagosTelefono: form.responsablePagosTelefono.trim() || null,
        responsablePagosTipoDocumento: form.responsablePagosTipoDocumento,
        responsablePagosDni: form.responsablePagosDni.trim() || null,
        responsablePagosEmail: form.responsablePagosEmail.trim() || null,
        tipoComprobante: form.tipoComprobante,
        sitioWeb: form.sitioWeb.trim() || null,
        representantesAdicionales: representantesAdicionales.map(representanteAdicionalPayload),
      });
      toast.success("Datos validados. Ya puedes continuar en el portal.");
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar los datos");
    }
    setGuardando(false);
  };

  return (
    <PortalAuthLayout ancho="max-w-[1180px]" alinear="start">
      <PortalAuthCardHeader
        icono={<Building2 className="h-5 w-5" />}
        titulo="Valida los datos de tu empresa"
        descripcion="Confirma o actualiza la informacion registrada. Los campos marcados generan tu contrato de alquiler de stands."
      />

      {cargando ? (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando datos de la empresa...
        </p>
      ) : !form ? (
        <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error ?? "No se encontraron los datos de tu empresa."}
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Revisa con cuidado los campos resaltados: se usaran para generar el <strong>contrato</strong> y el
              <strong> comprobante</strong> de tu empresa.{" "}
              {empresa?.primerAccesoCompletado ? "Ya validaste tus datos; puedes actualizarlos si cambiaron." : ""}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
          <SeccionFormulario titulo="Datos generales" className="lg:col-span-2">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Campo contractual requerido label="Razon social" valor={form.razonSocial} onChange={(v) => setCampo("razonSocial", v)} placeholder="Minera Cordillera S.A.C." error={erroresVisibles.razonSocial} resaltado={marcarPendiente("razonSocial")} />
              <div className={`rounded-lg border p-3 ${marcarPendiente("pais") ? "border-warning bg-warning/10 ring-2 ring-warning/20" : "border-border bg-secondary/30"}`}>
                <Label className="mb-1 block text-xs font-semibold text-primary">
                  <span>Pais</span> <span className="text-destructive">*</span>
                </Label>
                <PaisSelect
                  id="empresaPais"
                  value={form.pais}
                  onChange={(v) => setCampo("pais", v)}
                  error={erroresVisibles.pais}
                />
                <p className="mt-1 text-[10px] text-muted-foreground">Codigo ISO del pais de la empresa.</p>
              </div>
              <Campo label="Email general" valor={form.emailContacto} onChange={(v) => setCampo("emailContacto", v)} placeholder="contacto@empresa.pe" error={erroresVisibles.emailContacto} resaltado={marcarPendiente("emailContacto")} />
              <Campo label="Actividad economica" valor={form.actividadEconomica} onChange={(v) => setCampo("actividadEconomica", v)} placeholder="Se completa al validar el RUC" />
              <Campo label="Estado de contribuyente" valor={form.estadoContribuyente} onChange={(v) => setCampo("estadoContribuyente", v)} placeholder="Se completa al validar el RUC" deshabilitado nota="Dato consultado en SUNAT." />
              <Campo
                type="date"
                requerido
                label="Inicio de operaciones"
                valor={form.inicioOperaciones}
                onChange={(v) => setCampo("inicioOperaciones", v)}
                nota="Fecha de inicio de actividades de la empresa."
                error={erroresVisibles.inicioOperaciones}
                resaltado={marcarPendiente("inicioOperaciones")}
              />
              <Campo label="Nombre comercial" valor={form.nombreComercial} onChange={(v) => setCampo("nombreComercial", v)} placeholder="Minera Cordillera" />
              <Campo telefono label="Telefono" valor={form.telefono} onChange={(v) => setCampo("telefono", v)} placeholder="+51 987 654 321" />
              <Campo label="Sitio web" valor={form.sitioWeb} onChange={(v) => setCampo("sitioWeb", v)} placeholder="www.empresa.pe" />
            </div>
          </SeccionFormulario>

          <SeccionFormulario
            titulo="Responsable de firma de contrato"
            descripcion="Representante legal que firma el contrato de alquiler."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <CampoTipoDocumento value={form.representanteLegalTipoDocumento} onChange={(v) => setCampo("representanteLegalTipoDocumento", v)} id="repTipoDocumento" />
              <Campo contractual requerido label="Numero de documento" valor={form.representanteLegalDni} onChange={(v) => setCampo("representanteLegalDni", form.representanteLegalTipoDocumento === TIPOS_DOCUMENTO_PERSONA.DNI ? v.replace(/\D/g, "").slice(0, 8) : v.replace(/[^0-9A-Za-z]/g, "").slice(0, 15))} placeholder={form.representanteLegalTipoDocumento === TIPOS_DOCUMENTO_PERSONA.DNI ? "45871233" : "Numero de documento"} mono error={erroresVisibles.representanteLegalDni} resaltado={marcarPendiente("representanteLegalDni")} />
              <Campo contractual requerido label="Nombre" valor={form.representanteLegalNombre} onChange={(v) => setCampo("representanteLegalNombre", v)} placeholder="Jorge Quispe Ramos" error={erroresVisibles.representanteLegalNombre} resaltado={marcarPendiente("representanteLegalNombre")} />
              <Campo
                contractual
                requerido
                label="Email"
                valor={form.representanteCorreo}
                onChange={(v) => setCampo("representanteCorreo", v)}
                placeholder="representante@empresa.pe"
                deshabilitado={!repCorreoRegistrable}
                nota={repCorreoRegistrable ? "Se usara en el contrato, como usuario del sistema y para las notificaciones." : "Para cambiar el correo, primero debe validarse."}
                error={erroresVisibles.representanteCorreo}
                resaltado={marcarPendiente("representanteCorreo")}
              />
              <Campo telefono contractual requerido label="Telefono" valor={form.representanteCelular} onChange={(v) => setCampo("representanteCelular", v)} placeholder="+51 987 654 321" error={erroresVisibles.representanteCelular} resaltado={marcarPendiente("representanteCelular")} />
              <Campo contractual requerido label="Direccion" valor={form.representanteDireccion} onChange={(v) => setCampo("representanteDireccion", v)} placeholder="Av. Arequipa 1250, Lince" error={erroresVisibles.representanteDireccion} resaltado={marcarPendiente("representanteDireccion")} />
            </div>
          </SeccionFormulario>

          <SeccionFormulario
            titulo="Representantes legales adicionales"
            descripcion="El representante principal es el titular de la cuenta y firma el contrato. Agrega aqui a los demas representantes que deben figurar en el documento."
          >
            <RepresentantesAdicionalesEditor
              value={representantesAdicionales}
              onChange={setRepresentantesAdicionales}
              errores={erroresAdicionales}
              ocultarEncabezado
            />
          </SeccionFormulario>
          <SeccionFormulario titulo="Responsable EXTEMIN">
            <div className="grid gap-3 sm:grid-cols-2">
              <CampoTipoDocumento value={form.responsableExteminTipoDocumento} onChange={(v) => setCampo("responsableExteminTipoDocumento", v)} id="exteminTipoDocumento" />
              <Campo label="Numero de documento" valor={form.responsableExteminDni} onChange={(v) => setCampo("responsableExteminDni", form.responsableExteminTipoDocumento === TIPOS_DOCUMENTO_PERSONA.DNI ? v.replace(/\D/g, "").slice(0, 8) : v.replace(/[^0-9A-Za-z]/g, "").slice(0, 15))} placeholder={form.responsableExteminTipoDocumento === TIPOS_DOCUMENTO_PERSONA.DNI ? "45871233" : "Numero de documento"} mono error={erroresVisibles.responsableExteminDni} resaltado={marcarPendiente("responsableExteminDni")} />
              <Campo label="Nombre" valor={form.responsableExteminNombre} onChange={(v) => setCampo("responsableExteminNombre", v)} placeholder="Nombre completo" />
              <Campo telefono label="Telefono" valor={form.responsableExteminTelefono} onChange={(v) => setCampo("responsableExteminTelefono", v)} placeholder="+51 987 654 321" />
              <Campo label="Email" valor={form.responsableExteminEmail} onChange={(v) => setCampo("responsableExteminEmail", v)} placeholder="extemin@empresa.pe" error={erroresVisibles.responsableExteminEmail} resaltado={marcarPendiente("responsableExteminEmail")} />
            </div>
          </SeccionFormulario>

          <SeccionFormulario titulo="Responsable de pagos">
            <div className="grid gap-3 sm:grid-cols-2">
              <CampoTipoDocumento value={form.responsablePagosTipoDocumento} onChange={(v) => setCampo("responsablePagosTipoDocumento", v)} id="pagosTipoDocumento" />
              <Campo label="Numero de documento" valor={form.responsablePagosDni} onChange={(v) => setCampo("responsablePagosDni", form.responsablePagosTipoDocumento === TIPOS_DOCUMENTO_PERSONA.DNI ? v.replace(/\D/g, "").slice(0, 8) : v.replace(/[^0-9A-Za-z]/g, "").slice(0, 15))} placeholder={form.responsablePagosTipoDocumento === TIPOS_DOCUMENTO_PERSONA.DNI ? "45871233" : "Numero de documento"} mono error={erroresVisibles.responsablePagosDni} resaltado={marcarPendiente("responsablePagosDni")} />
              <Campo label="Nombre" valor={form.responsablePagosNombre} onChange={(v) => setCampo("responsablePagosNombre", v)} placeholder="Nombre completo" />
              <Campo telefono label="Telefono" valor={form.responsablePagosTelefono} onChange={(v) => setCampo("responsablePagosTelefono", v)} placeholder="+51 987 654 321" />
              <Campo label="Email" valor={form.responsablePagosEmail} onChange={(v) => setCampo("responsablePagosEmail", v)} placeholder="pagos@empresa.pe" error={erroresVisibles.responsablePagosEmail} resaltado={marcarPendiente("responsablePagosEmail")} />
            </div>
          </SeccionFormulario>

          <SeccionFormulario titulo="Nombre en el friso del stand">
            <Campo contractual label="Nombre a colocar en el friso" valor={form.nombreFriso} onChange={(v) => setCampo("nombreFriso", v)} placeholder="Nombre comercial visible" />
          </SeccionFormulario>

          <SeccionFormulario titulo="Datos de facturacion" className="lg:col-span-2">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <CampoTipoDocumentoEmpresa
                value={form.tipoDocumento}
                onChange={(v) => {
                  setSunatValidado(false);
                  setCampo("tipoDocumento", v);
                  setCampo(
                    "ruc",
                    v === TIPOS_DOCUMENTO_EMPRESA.RUC
                      ? form.ruc.replace(/\D/g, "").slice(0, 11)
                      : form.ruc.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 20),
                  );
                }}
                id="empresaTipoDocumento"
              />
              <Campo
                contractual
                requerido
                label={form.tipoDocumento === TIPOS_DOCUMENTO_EMPRESA.RUC ? "RUC" : "RUT / No domiciliado"}
                valor={form.ruc}
                onChange={(v) => {
                  setSunatValidado(false);
                  setCampo(
                    "ruc",
                    form.tipoDocumento === TIPOS_DOCUMENTO_EMPRESA.RUC
                      ? v.replace(/\D/g, "").slice(0, 11)
                      : v.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 20),
                  );
                }}
                placeholder={form.tipoDocumento === TIPOS_DOCUMENTO_EMPRESA.RUC ? "20601234567" : "RUT o documento"}
                mono
                error={erroresVisibles.ruc}
                resaltado={marcarPendiente("ruc")}
                nota={sunatCargando ? "Consultando SUNAT..." : sunatValidado ? "Datos validados con SUNAT." : undefined}
              />
              <Campo
                contractual
                requerido={esRucEmpresa}
                label={esRucEmpresa ? "Partida electronica de la empresa" : "Partida electronica (opcional)"}
                valor={form.partidaElectronica}
                onChange={(v) => setCampo("partidaElectronica", v)}
                placeholder="11014857"
                mono
                error={erroresVisibles.partidaElectronica}
                resaltado={marcarPendiente("partidaElectronica")}
              />
              <Campo contractual label="Facturar a nombre de" valor={form.facturarANombre} onChange={(v) => setCampo("facturarANombre", v)} placeholder={form.razonSocial || "Razon social"} />
                  <Campo contractual label="Domicilio fiscal (no sitio web)" valor={form.direccionFiscal} onChange={(v) => setCampo("direccionFiscal", v)} placeholder="Av. Los Ingenieros 245, Lima" />
              <Campo contractual label="Correo de facturacion" valor={form.emailFacturacion} onChange={(v) => setCampo("emailFacturacion", v)} placeholder="facturacion@empresa.pe" error={erroresVisibles.emailFacturacion} resaltado={marcarPendiente("emailFacturacion")} />
            </div>
            <div className="mt-3 rounded-lg border border-border bg-secondary/30 p-3">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
                <Label className="text-xs font-semibold text-primary">Tipo de comprobante</Label>
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[9px] font-bold tracking-wide text-warning uppercase">
                  Se usara en el contrato
                </span>
              </div>
              <Select value={form.tipoComprobante} onValueChange={(v) => setCampo("tipoComprobante", v)}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(TIPOS_COMPROBANTE).map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      <span>{TIPO_COMPROBANTE_LABELS[tipo] ?? tipo}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[10px] text-muted-foreground">La factura requiere RUC; la boleta no.</p>
            </div>
          </SeccionFormulario>
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
            <Checkbox
              checked={confirmado}
              onCheckedChange={(v) => setConfirmado(v === true)}
              className="mt-0.5"
            />
            <span className="text-[11px] leading-relaxed text-muted-foreground">
              Confirmo que estos datos son correctos y autorizo que se usen para generar el contrato de alquiler y
              el comprobante de pago de mi empresa.
            </span>
          </label>

          <div aria-live="polite">
            {pendientes.length === 0 ? (
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Todo listo para guardar.
              </p>
            ) : (
              <div className="rounded-xl border border-warning/40 bg-warning/5 px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-warning">
                    Faltan {pendientes.length} {pendientes.length === 1 ? "dato" : "datos"} para guardar
                  </p>
                  {Object.keys(erroresFormulario).length > 0 && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="resaltar-pendientes" className="text-[11px] font-medium text-muted-foreground">
                        <span>Resaltar campos</span>
                      </Label>
                      <Switch
                        id="resaltar-pendientes"
                        checked={resaltarPendientes}
                        onCheckedChange={setResaltarPendientes}
                      />
                    </div>
                  )}
                </div>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-[11px] text-muted-foreground">
                  {pendientes.map((mensaje, indice) => (
                    <li key={`${indice}-${mensaje}`}>{mensaje}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full px-4 text-xs"
              disabled={guardando}
              onClick={async () => {
                await authService.logout().catch(() => undefined);
                router.push("/auth/login");
              }}
            >
              Cerrar sesion
            </Button>
            <Button
              size="sm"
              className="rounded-full px-5 text-xs font-semibold"
              disabled={guardando || !confirmado || !formularioCompleto || !adicionalesCompletos}
              onClick={guardar}
            >
              {guardando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Guardar y continuar
            </Button>
          </div>
        </div>
      )}
    </PortalAuthLayout>
  );
}

export default function ValidarDatosPage() {
  return <ValidarDatosContent />;
}
