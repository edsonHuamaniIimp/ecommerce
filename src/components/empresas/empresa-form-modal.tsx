"use client";

import { useRef, useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { Image as ImageIcon, Loader2, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { empresasService } from "@/lib/client/api/services/empresas-service";
import { entidadesService, type EmpresaEntidadDTO } from "@/lib/client/api/services/entidades-service";
import { uploadService } from "@/lib/client/api/services/upload-service";
import { REGEX_EMAIL, REGEX_RUC, TIPOS_COMPROBANTE, TIPOS_DOCUMENTO_EMPRESA, TIPO_COMPROBANTE_LABELS } from "@/lib/shared/constants";
import type { EmpresaDTO, EmpresaFuenteDTO } from "@/types/dto/empresas";

interface Props {
  /** Empresa a editar; null = alta. */
  empresa: EmpresaDTO | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  ruc: string;
  razonSocial: string;
  logoUrl: string;
  nombreComercial: string;
  direccionFiscal: string;
  telefono: string;
  emailContacto: string;
  emailFacturacion: string;
  representanteLegalNombre: string;
  representanteLegalDni: string;
  partidaElectronica: string;
  tipoComprobante: string;
  sitioWeb: string;
}

function formDesdeEmpresa(empresa: EmpresaDTO | null): FormState {
  return {
    ruc: empresa?.ruc ?? "",
    razonSocial: empresa?.razonSocial ?? "",
    logoUrl: empresa?.logoUrl ?? "",
    nombreComercial: empresa?.nombreComercial ?? "",
    direccionFiscal: empresa?.direccionFiscal ?? "",
    telefono: empresa?.telefono ?? "",
    emailContacto: empresa?.emailContacto ?? "",
    emailFacturacion: empresa?.emailFacturacion ?? "",
    representanteLegalNombre: empresa?.representanteLegalNombre ?? "",
    representanteLegalDni: empresa?.representanteLegalDni ?? "",
    partidaElectronica: empresa?.partidaElectronica ?? "",
    tipoComprobante: empresa?.tipoComprobante ?? TIPOS_COMPROBANTE.FACTURA,
    sitioWeb: empresa?.sitioWeb ?? "",
  };
}

function CampoForm({ label, requerido = false, valor, onChange, error, placeholder, tipo = "text", mono = false }: {
  label: string;
  requerido?: boolean;
  valor: string;
  onChange: (valor: string) => void;
  error?: string;
  placeholder?: string;
  tipo?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs">
        {label} {requerido && <span className="text-destructive">*</span>}
      </Label>
      <Input
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1 h-9 text-sm ${mono ? "font-mono" : ""} ${error ? "border-destructive" : ""}`}
      />
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

/** Alta/edicion de una empresa (backoffice). Se monta por apertura (estado limpio). */
export function EmpresaFormModal({ empresa, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => formDesdeEmpresa(empresa));
  const [errores, setErrores] = useState<Partial<Record<keyof FormState, string>>>({});
  const [enviando, setEnviando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  /* Consulta previa (RUC y/o razon social): evita registrar sin verificar duplicado local y fuente. */
  const [consultando, setConsultando] = useState(false);
  const [consultado, setConsultado] = useState(false);
  const [duplicadaLocal, setDuplicadaLocal] = useState<EmpresaDTO | null>(null);
  const [encontradaFuente, setEncontradaFuente] = useState<EmpresaFuenteDTO | null>(null);
  const [resultadosFuente, setResultadosFuente] = useState<EmpresaFuenteDTO[] | null>(null);
  const [sieCodeFuente, setSieCodeFuente] = useState<string | null>(null);
  const [avisoConsulta, setAvisoConsulta] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const esEdicion = empresa !== null;

  const onLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSubiendoLogo(true);
    try {
      const url = await uploadService.subir(file);
      setCampo("logoUrl", url);
    } catch {
      toast.error("No se pudo subir el logo");
    }
    setSubiendoLogo(false);
  };

  const setCampo = (campo: keyof FormState, valor: string) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    setErrores((prev) => ({ ...prev, [campo]: undefined }));
    if (campo === "ruc" || campo === "razonSocial") {
      setConsultado(false);
      setDuplicadaLocal(null);
      setEncontradaFuente(null);
      setResultadosFuente(null);
      setSieCodeFuente(null);
      setAvisoConsulta(null);
    }
  };

  /** Prellena (solo campos vacios) con los datos de la empresa de servicio-persona. */
  const aplicarDatosFuente = (fuente: EmpresaFuenteDTO) => {
    setForm((prev) => ({
      ...prev,
      razonSocial: prev.razonSocial.trim() || fuente.nombre,
      direccionFiscal: prev.direccionFiscal.trim() || (fuente.direccion ?? ""),
      telefono: prev.telefono.trim() || (fuente.telefono ?? ""),
      emailContacto: prev.emailContacto.trim() || (fuente.correo ?? ""),
    }));
  };

  /** Empresa del padron IIMP (API de entidades, la misma del perfil) -> DTO de la fuente. */
  const aFuenteDTO = (e: EmpresaEntidadDTO): EmpresaFuenteDTO => ({
    sieCode: e.idEmpresa,
    nombre: e.razonSocial,
    idTipoDocumento: REGEX_RUC.test(e.documento) ? TIPOS_DOCUMENTO_EMPRESA.RUC : TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO,
    documento: e.documento,
    direccion: null,
    correo: null,
    telefono: null,
  });

  /**
   * Consulta previa (criterio: no crear sin consultar): duplicado local por RUC exacto
   * (bloquea) y empresa(s) en el padron IIMP (por RUC y/o razon social) y en
   * servicio-persona (best-effort: puede no estar accesible). Se elige con "Usar".
   */
  const consultar = async () => {
    const ruc = form.ruc.trim();
    const nombre = form.razonSocial.trim();
    const esRucValido = REGEX_RUC.test(ruc);
    if (!esRucValido && nombre.length < 3) {
      setErrores((prev) => ({ ...prev, ruc: "Ingresa el RUC (11 digitos) o al menos 3 letras de la razon social" }));
      return;
    }
    setConsultando(true);
    setDuplicadaLocal(null);
    setEncontradaFuente(null);
    setResultadosFuente(null);
    setSieCodeFuente(null);
    setAvisoConsulta(null);
    try {
      if (esRucValido) {
        const pagina = await empresasService.listar({ page: 1, perPage: 10, search: ruc });
        setDuplicadaLocal((pagina.data ?? []).find((e) => e.ruc === ruc) ?? null);
      }

      const coincidencias: EmpresaFuenteDTO[] = [];
      const agregar = (lista: EmpresaFuenteDTO[]) => {
        for (const e of lista) {
          if (!coincidencias.some((c) => (c.sieCode && c.sieCode === e.sieCode) || (c.documento && c.documento === e.documento))) {
            coincidencias.push(e);
          }
        }
      };

      /* Padron IIMP (API de entidades): por RUC exacto y/o por razon social. */
      const delPadron: EmpresaFuenteDTO[] = [];
      try {
        if (esRucValido) agregarPadron(delPadron, await entidadesService.buscarEmpresas(ruc));
        if (nombre.length >= 3) agregarPadron(delPadron, await entidadesService.buscarEmpresas(nombre));
      } catch {
        /* padron no disponible: seguimos con servicio-persona */
      }

      let exacta: EmpresaFuenteDTO | null = null;
      if (esRucValido) {
        exacta = delPadron.find((e) => e.documento === ruc) ?? null;
      }
      if (!exacta) agregar(delPadron);

      /* Fuente servicio-persona (best-effort, sin bloquear la consulta). */
      try {
        if (!exacta && esRucValido) {
          const porRuc = await empresasService.buscarFuente(ruc);
          exacta = porRuc.find((e) => e.documento === ruc) ?? null;
          if (!exacta) agregar(porRuc);
        }
        if (!exacta && nombre.length >= 3) {
          agregar(await empresasService.buscarFuente(nombre));
        }
      } catch (err) {
        setAvisoConsulta(err instanceof Error ? err.message : "servicio-persona no disponible");
      }

      if (exacta) {
        setEncontradaFuente(exacta);
        setSieCodeFuente(exacta.sieCode || null);
        aplicarDatosFuente(exacta);
      } else if (coincidencias.length > 0) {
        setResultadosFuente(coincidencias);
      }
      setConsultado(true);
    } finally {
      setConsultando(false);
    }
  };

  /** Agrega resultados del padron IIMP evitando duplicados por SIE/documento. */
  const agregarPadron = (destino: EmpresaFuenteDTO[], lista: EmpresaEntidadDTO[]) => {
    for (const e of lista.map(aFuenteDTO)) {
      if (!destino.some((d) => (d.sieCode && d.sieCode === e.sieCode) || (d.documento && d.documento === e.documento))) {
        destino.push(e);
      }
    }
  };

  const validar = (): boolean => {
    const nuevos: Partial<Record<keyof FormState, string>> = {};
    if (!form.razonSocial.trim()) nuevos.razonSocial = "La razon social es obligatoria";
    if (!REGEX_RUC.test(form.ruc.trim())) nuevos.ruc = "El RUC debe tener 11 digitos";
    if (form.emailContacto.trim() && !REGEX_EMAIL.test(form.emailContacto.trim())) {
      nuevos.emailContacto = "Correo invalido";
    }
    if (form.emailFacturacion.trim() && !REGEX_EMAIL.test(form.emailFacturacion.trim())) {
      nuevos.emailFacturacion = "Correo invalido";
    }
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const handleSubmit = async () => {
    if (!validar()) return;
    if (!esEdicion) {
      if (!consultado) {
        setErrores((prev) => ({ ...prev, ruc: "Consulta el RUC antes de registrar" }));
        return;
      }
      if (duplicadaLocal) {
        setErrores((prev) => ({ ...prev, ruc: `Ya existe una empresa con este RUC: ${duplicadaLocal.razonSocial}` }));
        return;
      }
    }
    setEnviando(true);
    try {
      const payload = {
        ruc: form.ruc.trim(),
        razonSocial: form.razonSocial.trim(),
        sieCode: sieCodeFuente,
        logoUrl: form.logoUrl || null,
        nombreComercial: form.nombreComercial.trim() || null,
        direccionFiscal: form.direccionFiscal.trim() || null,
        telefono: form.telefono.trim() || null,
        emailContacto: form.emailContacto.trim() || null,
        emailFacturacion: form.emailFacturacion.trim() || null,
        representanteLegalNombre: form.representanteLegalNombre.trim() || null,
        representanteLegalDni: form.representanteLegalDni.trim() || null,
        partidaElectronica: form.partidaElectronica.trim() || null,
        tipoComprobante: form.tipoComprobante,
        sitioWeb: form.sitioWeb.trim() || null,
      };
      if (esEdicion && empresa) {
        await empresasService.actualizar({ id: empresa.id, ...payload });
        toast.success("Empresa actualizada");
      } else {
        await empresasService.crear(payload);
        toast.success("Empresa registrada. Podras crear su cuenta y enviar credenciales.");
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la empresa");
    }
    setEnviando(false);
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border pb-3 text-left">
          <DialogTitle className="text-base font-semibold">
            {esEdicion ? "Editar empresa" : "Nueva empresa"}
          </DialogTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            La razon social, RUC, direccion y representante legal alimentan el contrato: la empresa debera
            validarlos en su primer acceso al portal.
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoForm label="Razon social" requerido valor={form.razonSocial} onChange={(v) => setCampo("razonSocial", v)} error={errores.razonSocial} placeholder="Minera Cordillera S.A.C." />
            <div>
              <Label className="text-xs">RUC <span className="text-destructive">*</span></Label>
              <div className="mt-1 flex gap-2">
                <Input
                  value={form.ruc}
                  onChange={(e) => { setCampo("ruc", e.target.value); }}
                  onBlur={() => { if (!esEdicion && (REGEX_RUC.test(form.ruc.trim()) || form.razonSocial.trim().length >= 3)) void consultar(); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void consultar(); } }}
                  placeholder="20601234567"
                  className={`h-9 font-mono text-sm ${errores.ruc ? "border-destructive" : ""}`}
                />
                <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 text-xs" disabled={consultando} onClick={() => { void consultar(); }}>
                  {consultando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  <span>Consultar</span>
                </Button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                <span>Consulta por RUC (exacto) o razon social (prefijo) antes de registrar.</span>
              </p>
              {errores.ruc && <p className="mt-1 text-[11px] text-destructive"><span>{errores.ruc}</span></p>}
              {!esEdicion && duplicadaLocal && (
                <p className="mt-1 text-[11px] text-destructive">
                  <span>Ya existe en el sistema: {duplicadaLocal.razonSocial}. Editala desde la bandeja.</span>
                </p>
              )}
              {!esEdicion && !duplicadaLocal && encontradaFuente && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <span>Encontrada: {encontradaFuente.nombre} (SIE {encontradaFuente.sieCode || "sin codigo"}). Se reutilizara al registrar.</span>
                </p>
              )}
              {!esEdicion && !duplicadaLocal && resultadosFuente && resultadosFuente.length > 0 && (
                <div className="mt-2 max-h-[160px] space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
                  {resultadosFuente.map((e) => (
                    <div key={e.sieCode || e.documento || e.nombre} className="flex items-center justify-between gap-2 rounded px-1 py-1">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium"><span>{e.nombre}</span></p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          <span>{e.documento || "—"} · {e.sieCode || "—"}</span>
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 text-xs"
                        onClick={() => { setEncontradaFuente(e); setSieCodeFuente(e.sieCode || null); aplicarDatosFuente(e); setResultadosFuente(null); }}
                      >
                        <span>Usar</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {!esEdicion && !duplicadaLocal && consultado && !encontradaFuente && !resultadosFuente && !avisoConsulta && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <span>No esta en el padron IIMP ni en servicio-persona: se creara al registrar (requiere direccion, correo y telefono).</span>
                </p>
              )}
              {!esEdicion && avisoConsulta && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <span>servicio-persona no disponible ({avisoConsulta}); se consulto el padron IIMP. Puedes registrar igual.</span>
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoForm label="Nombre comercial" valor={form.nombreComercial} onChange={(v) => setCampo("nombreComercial", v)} placeholder="Minera Cordillera" />
            <CampoForm label="Direccion fiscal" valor={form.direccionFiscal} onChange={(v) => setCampo("direccionFiscal", v)} placeholder="Av. Los Ingenieros 245, Lima" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoForm label="Correo de contacto" tipo="email" valor={form.emailContacto} onChange={(v) => setCampo("emailContacto", v)} error={errores.emailContacto} placeholder="contacto@empresa.pe" />
            <CampoForm label="Correo de facturacion" tipo="email" valor={form.emailFacturacion} onChange={(v) => setCampo("emailFacturacion", v)} error={errores.emailFacturacion} placeholder="facturacion@empresa.pe" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoForm label="Telefono" valor={form.telefono} onChange={(v) => setCampo("telefono", v)} placeholder="+51 987 654 321" />
            <CampoForm label="Sitio web" valor={form.sitioWeb} onChange={(v) => setCampo("sitioWeb", v)} placeholder="www.empresa.pe" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoForm label="Representante legal" valor={form.representanteLegalNombre} onChange={(v) => setCampo("representanteLegalNombre", v)} placeholder="Jorge Quispe Ramos" />
            <CampoForm label="DNI del representante" valor={form.representanteLegalDni} onChange={(v) => setCampo("representanteLegalDni", v)} placeholder="45871233" mono />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoForm label="Partida electronica (opcional)" valor={form.partidaElectronica} onChange={(v) => setCampo("partidaElectronica", v)} placeholder="11014857" mono />
          </div>
          <div>
            <Label className="text-xs">Logo de la empresa</Label>
            <div className="mt-1 flex items-center gap-3">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Logo de la empresa" className="h-12 w-12 rounded-lg border bg-white object-contain p-1" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                  <ImageIcon className="h-4 w-4" />
                </span>
              )}
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onLogoFile(e); }} />
              <Button type="button" variant="outline" size="sm" className="rounded-full text-xs" disabled={subiendoLogo} onClick={() => logoRef.current?.click()}>
                {subiendoLogo ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                {form.logoUrl ? "Cambiar logo" : "Subir logo"}
              </Button>
              {form.logoUrl && (
                <Button type="button" variant="ghost" size="sm" className="rounded-full text-xs text-destructive" onClick={() => setCampo("logoUrl", "")}>
                  Quitar
                </Button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">PNG o JPG; se pinta en los stands reservados de la empresa en el mapa.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Tipo de comprobante preferido</Label>
              <Select value={form.tipoComprobante} onValueChange={(v) => setCampo("tipoComprobante", v)}>
                <SelectTrigger className="mt-1 h-9 text-sm">
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
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" size="sm" className="rounded-full px-4 text-xs" onClick={onClose} disabled={enviando}>
            <span>Cancelar</span>
          </Button>
          <Button
            size="sm"
            className="rounded-full px-4 text-xs font-semibold"
            onClick={handleSubmit}
            disabled={enviando || consultando || (!esEdicion && (!consultado || Boolean(duplicadaLocal)))}
          >
            {enviando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            <span>{esEdicion ? "Guardar cambios" : "Registrar empresa"}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
