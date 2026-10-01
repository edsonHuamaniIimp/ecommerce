"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { AlertTriangle, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { portalEmpresaService } from "@/lib/client/api/services/portal-empresa-service";
import { PortalAuthCardHeader, PortalAuthLayout } from "@/components/layout/portal-auth-layout";
import { TIPOS_COMPROBANTE, TIPO_COMPROBANTE_LABELS } from "@/lib/shared/constants";
import type { EmpresaDTO } from "@/types/dto/empresas/empresa.dto";

interface FormState {
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  direccionFiscal: string;
  telefono: string;
  emailFacturacion: string;
  representanteLegalNombre: string;
  representanteLegalDni: string;
  tipoComprobante: string;
  sitioWeb: string;
}

function Campo({
  label,
  valor,
  onChange,
  contractual = false,
  placeholder,
  mono = false,
}: {
  label: string;
  valor: string;
  onChange: (valor: string) => void;
  contractual?: boolean;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div className={contractual ? "rounded-lg border border-warning/40 bg-warning/5 p-3" : ""}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
        <Label className="text-xs font-semibold text-primary">{label}</Label>
        {contractual && (
          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[9px] font-bold tracking-wide text-warning uppercase">
            Se usara en el contrato
          </span>
        )}
      </div>
      <Input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-10 text-sm ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}

function ValidarDatosContent() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [empresa, setEmpresa] = useState<EmpresaDTO | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const datos = await portalEmpresaService.misDatos();
        setEmpresa(datos);
        setForm({
          ruc: datos.ruc,
          razonSocial: datos.razonSocial,
          nombreComercial: datos.nombreComercial ?? "",
          direccionFiscal: datos.direccionFiscal ?? "",
          telefono: datos.telefono ?? "",
          emailFacturacion: datos.emailFacturacion ?? "",
          representanteLegalNombre: datos.representanteLegalNombre ?? "",
          representanteLegalDni: datos.representanteLegalDni ?? "",
          tipoComprobante: datos.tipoComprobante,
          sitioWeb: datos.sitioWeb ?? "",
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudieron cargar los datos de tu empresa");
      }
      setCargando(false);
    })();
  }, []);

  const setCampo = (campo: keyof FormState, valor: string) => {
    setForm((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  };

  const guardar = async () => {
    if (!form || !confirmado) return;
    setGuardando(true);
    setError(null);
    try {
      await portalEmpresaService.validarDatos({
        ruc: form.ruc.trim(),
        razonSocial: form.razonSocial.trim(),
        nombreComercial: form.nombreComercial.trim() || null,
        direccionFiscal: form.direccionFiscal.trim() || null,
        telefono: form.telefono.trim() || null,
        emailFacturacion: form.emailFacturacion.trim() || null,
        representanteLegalNombre: form.representanteLegalNombre.trim() || null,
        representanteLegalDni: form.representanteLegalDni.trim() || null,
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
    <PortalAuthLayout ancho="max-w-[820px]">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo contractual label="Razon social" valor={form.razonSocial} onChange={(v) => setCampo("razonSocial", v)} placeholder="Minera Cordillera S.A.C." />
            <Campo contractual label="RUC" valor={form.ruc} onChange={(v) => setCampo("ruc", v)} placeholder="20601234567" mono />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo contractual label="Direccion fiscal" valor={form.direccionFiscal} onChange={(v) => setCampo("direccionFiscal", v)} placeholder="Av. Los Ingenieros 245, Lima" />
            <Campo contractual label="Representante legal" valor={form.representanteLegalNombre} onChange={(v) => setCampo("representanteLegalNombre", v)} placeholder="Jorge Quispe Ramos" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo contractual label="DNI del representante legal" valor={form.representanteLegalDni} onChange={(v) => setCampo("representanteLegalDni", v)} placeholder="45871233" mono />
            <Campo contractual label="Correo de facturacion" valor={form.emailFacturacion} onChange={(v) => setCampo("emailFacturacion", v)} placeholder="facturacion@empresa.pe" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
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
                      {TIPO_COMPROBANTE_LABELS[tipo] ?? tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[10px] text-muted-foreground">La factura requiere RUC; la boleta no.</p>
            </div>
            <Campo label="Nombre comercial" valor={form.nombreComercial} onChange={(v) => setCampo("nombreComercial", v)} placeholder="Minera Cordillera" />
            <Campo label="Telefono" valor={form.telefono} onChange={(v) => setCampo("telefono", v)} placeholder="+51 987 654 321" />
            <Campo label="Sitio web" valor={form.sitioWeb} onChange={(v) => setCampo("sitioWeb", v)} placeholder="www.empresa.pe" />
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

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full px-4 text-xs"
              disabled={guardando}
              onClick={() => { router.push("/dashboard"); router.refresh(); }}
            >
              Mas tarde
            </Button>
            <Button
              size="sm"
              className="rounded-full px-5 text-xs font-semibold"
              disabled={guardando || !confirmado}
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
