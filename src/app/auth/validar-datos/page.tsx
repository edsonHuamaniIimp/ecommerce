"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { AlertTriangle, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { portalEmpresaService } from "@/lib/client/api/services/portal-empresa-service";
import { authService } from "@/lib/client/api/services/auth-service";
import { sunatService } from "@/lib/client/api/services/sunat-service";
import { PortalAuthCardHeader, PortalAuthLayout } from "@/components/layout/portal-auth-layout";
import { PaisSelect } from "@/components/shared/pais-select";
import { TelefonoInput } from "@/components/shared/telefono-input";
import { REGEX_EMAIL, REGEX_RUC, TIPOS_COMPROBANTE, TIPO_COMPROBANTE_LABELS, TIPOS_DOCUMENTO_PERSONA, TIPOS_DOCUMENTO_PERSONA_LABELS } from "@/lib/shared/constants";
import { validarDocumentoPersona } from "@/lib/shared/utils/documento-persona";
import type { EmpresaDTO } from "@/types/dto/empresas";

interface FormState {
  ruc: string;
  pais: string;
  razonSocial: string;
  nombreComercial: string;
  direccionFiscal: string;
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
}) {
  return (
    <div className={contractual ? "rounded-lg border border-warning/40 bg-warning/5 p-3" : ""}>
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
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={deshabilitado}
          className={`h-10 text-sm ${mono ? "font-mono" : ""} ${deshabilitado ? "opacity-60" : ""} ${error ? "border-destructive" : ""}`}
        />
      )}
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
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

/**
 * Reglas de validacion del formulario (mismas que el endpoint). Los datos del
 * representante legal son obligatorios: contrato + sincronizacion + usuario del sistema.
 */
function erroresDeFormulario(form: FormState): Partial<Record<keyof FormState, string>> {
  const nuevos: Partial<Record<keyof FormState, string>> = {};
  if (!form.pais.trim()) nuevos.pais = "Selecciona el pais de la empresa";
  if (!form.razonSocial.trim()) nuevos.razonSocial = "La razon social es obligatoria";
  if (!REGEX_RUC.test(form.ruc.trim())) nuevos.ruc = "El RUC debe tener 11 digitos";
  if (form.emailFacturacion.trim() && !REGEX_EMAIL.test(form.emailFacturacion.trim())) {
    nuevos.emailFacturacion = "Correo invalido";
  }
  if (form.emailContacto.trim() && !REGEX_EMAIL.test(form.emailContacto.trim())) {
    nuevos.emailContacto = "Correo invalido";
  }
  if (form.responsableExteminEmail.trim() && !REGEX_EMAIL.test(form.responsableExteminEmail.trim())) {
    nuevos.responsableExteminEmail = "Correo invalido";
  }
  if (form.responsablePagosEmail.trim() && !REGEX_EMAIL.test(form.responsablePagosEmail.trim())) {
    nuevos.responsablePagosEmail = "Correo invalido";
  }
  if (!form.representanteLegalNombre.trim()) {
    nuevos.representanteLegalNombre = "El nombre del representante legal es obligatorio";
  }
  const dni = form.representanteLegalDni.trim();
  if (!dni) {
    nuevos.representanteLegalDni = "El documento del representante legal es obligatorio";
  } else {
    const errorDni = validarDocumentoPersona(form.representanteLegalTipoDocumento, dni);
    if (errorDni) nuevos.representanteLegalDni = errorDni;
  }
  const validarDocumentoOpcional = (tipo: string, documento: string, campo: "responsableExteminDni" | "responsablePagosDni") => {
    const valor = documento.trim();
    if (!valor) return;
    const error = validarDocumentoPersona(tipo, valor);
    if (error) nuevos[campo] = error;
  };
  validarDocumentoOpcional(form.responsableExteminTipoDocumento, form.responsableExteminDni, "responsableExteminDni");
  validarDocumentoOpcional(form.responsablePagosTipoDocumento, form.responsablePagosDni, "responsablePagosDni");
  const correoRep = form.representanteCorreo.trim();
  if (!correoRep) {
    nuevos.representanteCorreo = "El correo del representante legal es obligatorio";
  } else if (!REGEX_EMAIL.test(correoRep)) {
    nuevos.representanteCorreo = "Correo invalido";
  }
  if (!form.representanteCelular.trim()) nuevos.representanteCelular = "El celular del representante legal es obligatorio";
  if (!form.representanteDireccion.trim()) nuevos.representanteDireccion = "La direccion del representante legal es obligatoria";
  return nuevos;
}

function ValidarDatosContent() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [empresa, setEmpresa] = useState<EmpresaDTO | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [confirmado, setConfirmado] = useState(false);
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
          razonSocial: datos.razonSocial,
          nombreComercial: datos.nombreComercial ?? "",
          pais: datos.pais ?? "PE",
          direccionFiscal: datos.direccionFiscal ?? "",
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
    if (!form || !/^\d{11}$/.test(ruc)) return;
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
            razonSocial: r.razonSocial || prev.razonSocial,
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

  /** Validacion viva: el boton de guardar solo se habilita con los obligatorios completos. */
  const formularioCompleto = useMemo(() => (form ? Object.keys(erroresDeFormulario(form)).length === 0 : false), [form]);

  /** Errores de formato en vivo (solo campos con contenido): los vacios se guian por el * y el aviso. */
  const erroresVivos = useMemo(() => {
    if (!form) return {} as Partial<Record<keyof FormState, string>>;
    const nuevos = erroresDeFormulario(form);
    const visibles: Partial<Record<keyof FormState, string>> = {};
    for (const [campo, mensaje] of Object.entries(nuevos) as Array<[keyof FormState, string]>) {
      if (String(form[campo] ?? "").trim()) visibles[campo] = mensaje;
    }
    return visibles;
  }, [form]);

  const validar = (): boolean => (form ? Object.keys(erroresDeFormulario(form)).length === 0 : false);

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
        razonSocial: form.razonSocial.trim(),
        nombreComercial: form.nombreComercial.trim() || null,
        pais: form.pais,
        direccionFiscal: form.direccionFiscal.trim() || null,
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
              <Campo contractual requerido label="Razon social" valor={form.razonSocial} onChange={(v) => setCampo("razonSocial", v)} placeholder="Minera Cordillera S.A.C." error={erroresVivos.razonSocial} />
              <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
                <Label className="mb-1 block text-xs font-semibold text-primary">
                  <span>Pais</span> <span className="text-destructive">*</span>
                </Label>
                <PaisSelect
                  id="empresaPais"
                  value={form.pais}
                  onChange={(v) => setCampo("pais", v)}
                  error={erroresVivos.pais}
                />
                <p className="mt-1 text-[10px] text-muted-foreground">Codigo ISO del pais de la empresa.</p>
              </div>
              <Campo label="Email general" valor={form.emailContacto} onChange={(v) => setCampo("emailContacto", v)} placeholder="contacto@empresa.pe" error={erroresVivos.emailContacto} />
              <Campo label="Actividad economica" valor={form.actividadEconomica} onChange={(v) => setCampo("actividadEconomica", v)} placeholder="Se completa al validar el RUC" />
              <Campo label="Estado de contribuyente" valor={form.estadoContribuyente} onChange={(v) => setCampo("estadoContribuyente", v)} placeholder="Se completa al validar el RUC" deshabilitado nota="Dato consultado en SUNAT." />
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
              <Campo contractual requerido label="Nombre" valor={form.representanteLegalNombre} onChange={(v) => setCampo("representanteLegalNombre", v)} placeholder="Jorge Quispe Ramos" error={erroresVivos.representanteLegalNombre} />
              <CampoTipoDocumento value={form.representanteLegalTipoDocumento} onChange={(v) => setCampo("representanteLegalTipoDocumento", v)} id="repTipoDocumento" />
              <Campo contractual requerido label="Numero de documento" valor={form.representanteLegalDni} onChange={(v) => setCampo("representanteLegalDni", form.representanteLegalTipoDocumento === TIPOS_DOCUMENTO_PERSONA.DNI ? v.replace(/\D/g, "").slice(0, 8) : v.replace(/[^0-9A-Za-z]/g, "").slice(0, 15))} placeholder={form.representanteLegalTipoDocumento === TIPOS_DOCUMENTO_PERSONA.DNI ? "45871233" : "Numero de documento"} mono error={erroresVivos.representanteLegalDni} />
              <Campo
                contractual
                requerido
                label="Email"
                valor={form.representanteCorreo}
                onChange={(v) => setCampo("representanteCorreo", v)}
                placeholder="representante@empresa.pe"
                deshabilitado={!repCorreoRegistrable}
                nota={repCorreoRegistrable ? "Se usara en el contrato, como usuario del sistema y para las notificaciones." : "Para cambiar el correo, primero debe validarse."}
                error={erroresVivos.representanteCorreo}
              />
              <Campo telefono contractual requerido label="Telefono" valor={form.representanteCelular} onChange={(v) => setCampo("representanteCelular", v)} placeholder="+51 987 654 321" error={erroresVivos.representanteCelular} />
              <Campo contractual requerido label="Direccion" valor={form.representanteDireccion} onChange={(v) => setCampo("representanteDireccion", v)} placeholder="Av. Arequipa 1250, Lince" error={erroresVivos.representanteDireccion} />
              <Campo contractual label="Partida electronica (opcional)" valor={form.partidaElectronica} onChange={(v) => setCampo("partidaElectronica", v)} placeholder="11014857" mono />
            </div>
          </SeccionFormulario>

          <SeccionFormulario titulo="Responsable EXTEMIN">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Nombre" valor={form.responsableExteminNombre} onChange={(v) => setCampo("responsableExteminNombre", v)} placeholder="Nombre completo" />
              <Campo telefono label="Telefono" valor={form.responsableExteminTelefono} onChange={(v) => setCampo("responsableExteminTelefono", v)} placeholder="+51 987 654 321" />
              <CampoTipoDocumento value={form.responsableExteminTipoDocumento} onChange={(v) => setCampo("responsableExteminTipoDocumento", v)} id="exteminTipoDocumento" />
              <Campo label="Numero de documento" valor={form.responsableExteminDni} onChange={(v) => setCampo("responsableExteminDni", form.responsableExteminTipoDocumento === TIPOS_DOCUMENTO_PERSONA.DNI ? v.replace(/\D/g, "").slice(0, 8) : v.replace(/[^0-9A-Za-z]/g, "").slice(0, 15))} placeholder={form.responsableExteminTipoDocumento === TIPOS_DOCUMENTO_PERSONA.DNI ? "45871233" : "Numero de documento"} mono />
              <Campo label="Email" valor={form.responsableExteminEmail} onChange={(v) => setCampo("responsableExteminEmail", v)} placeholder="extemin@empresa.pe" error={erroresVivos.responsableExteminEmail} />
            </div>
          </SeccionFormulario>

          <SeccionFormulario titulo="Responsable de pagos">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Nombre" valor={form.responsablePagosNombre} onChange={(v) => setCampo("responsablePagosNombre", v)} placeholder="Nombre completo" />
              <Campo telefono label="Telefono" valor={form.responsablePagosTelefono} onChange={(v) => setCampo("responsablePagosTelefono", v)} placeholder="+51 987 654 321" />
              <CampoTipoDocumento value={form.responsablePagosTipoDocumento} onChange={(v) => setCampo("responsablePagosTipoDocumento", v)} id="pagosTipoDocumento" />
              <Campo label="Numero de documento" valor={form.responsablePagosDni} onChange={(v) => setCampo("responsablePagosDni", form.responsablePagosTipoDocumento === TIPOS_DOCUMENTO_PERSONA.DNI ? v.replace(/\D/g, "").slice(0, 8) : v.replace(/[^0-9A-Za-z]/g, "").slice(0, 15))} placeholder={form.responsablePagosTipoDocumento === TIPOS_DOCUMENTO_PERSONA.DNI ? "45871233" : "Numero de documento"} mono />
              <Campo label="Email" valor={form.responsablePagosEmail} onChange={(v) => setCampo("responsablePagosEmail", v)} placeholder="pagos@empresa.pe" error={erroresVivos.responsablePagosEmail} />
            </div>
          </SeccionFormulario>

          <SeccionFormulario titulo="Nombre en el friso del stand">
            <Campo contractual label="Nombre a colocar en el friso" valor={form.nombreFriso} onChange={(v) => setCampo("nombreFriso", v)} placeholder="Nombre comercial visible" />
          </SeccionFormulario>

          <SeccionFormulario titulo="Datos de facturacion" className="lg:col-span-2">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Campo
                contractual
                requerido
                label="RUC"
                valor={form.ruc}
                onChange={(v) => {
                  setSunatValidado(false);
                  setCampo("ruc", v);
                }}
                placeholder="20601234567"
                mono
                error={erroresVivos.ruc}
                nota={sunatCargando ? "Consultando SUNAT..." : sunatValidado ? "Datos validados con SUNAT." : undefined}
              />
              <Campo contractual label="Facturar a nombre de" valor={form.facturarANombre} onChange={(v) => setCampo("facturarANombre", v)} placeholder={form.razonSocial || "Razon social"} />
              <Campo contractual label="Direccion de facturacion" valor={form.direccionFiscal} onChange={(v) => setCampo("direccionFiscal", v)} placeholder="Av. Los Ingenieros 245, Lima" />
              <Campo contractual label="Correo de facturacion" valor={form.emailFacturacion} onChange={(v) => setCampo("emailFacturacion", v)} placeholder="facturacion@empresa.pe" error={erroresVivos.emailFacturacion} />
            </div>
            <div className="mt-3 rounded-lg border border-warning/40 bg-warning/5 p-3">
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

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {!formularioCompleto && (
            <p className="text-right text-[11px] text-muted-foreground">
              Completa los campos obligatorios (*) para guardar.
            </p>
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
              disabled={guardando || !confirmado || !formularioCompleto}
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
