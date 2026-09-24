"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, Textarea } from "@nrivera-iimp/ui-kit-iimp";
import { ArrowLeft, Building2, CheckCircle2, IdCard, Mail, Phone, Send, User } from "lucide-react";
import { solicitudCuentaService } from "@/lib/client/api/services/solicitud-cuenta-service";
import { PortalAuthCardHeader, PortalAuthLayout, PortalField } from "@/components/layout/portal-auth-layout";
import { PORTAL_UI, VALIDACIONES } from "@/lib/shared/constants";
import { onlyDigits } from "@/lib/shared/utils/form-validator";

const FORM_INICIAL = {
  email: "",
  nombre: "",
  apellidos: "",
  telefono: "",
  razonSocial: "",
  ruc: "",
  cargo: "",
  mensaje: "",
};

export default function SolicitarCuentaPage() {
  const [form, setForm] = useState(FORM_INICIAL);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setCampo = (campo: keyof typeof FORM_INICIAL, valor: string) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = {
        email: form.email.trim(),
        nombre: form.nombre.trim(),
        apellidos: form.apellidos.trim(),
        razonSocial: form.razonSocial.trim(),
        ...(form.telefono.trim() ? { telefono: form.telefono.trim() } : {}),
        ...(form.ruc.trim() ? { ruc: form.ruc.trim() } : {}),
        ...(form.cargo.trim() ? { cargo: form.cargo.trim() } : {}),
        ...(form.mensaje.trim() ? { mensaje: form.mensaje.trim() } : {}),
      };
      await solicitudCuentaService.crear(body);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la solicitud");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalAuthLayout ancho="max-w-[520px]">
      <PortalAuthCardHeader
        icono={sent ? <CheckCircle2 className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
        titulo={sent ? "Solicitud enviada" : "Solicitar cuenta de exhibidor"}
        descripcion={
          sent
            ? "Nuestro equipo de RR.HH. revisara tu solicitud y se pondra en contacto contigo."
            : "Completa tus datos. RR.HH. habilitara tu acceso al portal."
        }
      />

      {sent ? (
        <div className="mt-6">
          <Button asChild className="w-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90">
            <Link href="/auth/login"><span>Volver al inicio de sesion</span></Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <PortalField id="razonSocial" label="Razon social de la empresa" icono={<Building2 className="h-[19px] w-[19px]" />}>
            <Input
              id="razonSocial"
              required
              maxLength={VALIDACIONES.RAZON_SOCIAL_MAX}
              placeholder="Mi Empresa S.A.C."
              value={form.razonSocial}
              onChange={(e) => setCampo("razonSocial", e.target.value)}
              className={PORTAL_UI.INPUT_CON_ICONO}
            />
          </PortalField>

          <div className="grid gap-4 sm:grid-cols-2">
            <PortalField id="nombre" label="Nombres" icono={<User className="h-[19px] w-[19px]" />}>
              <Input
                id="nombre"
                required
                maxLength={VALIDACIONES.NOMBRE_MAX}
                placeholder="Juan"
                value={form.nombre}
                onChange={(e) => setCampo("nombre", e.target.value)}
                className={PORTAL_UI.INPUT_CON_ICONO}
              />
            </PortalField>
            <PortalField id="apellidos" label="Apellidos" icono={<User className="h-[19px] w-[19px]" />}>
              <Input
                id="apellidos"
                required
                maxLength={VALIDACIONES.APELLIDOS_MAX}
                placeholder="Perez"
                value={form.apellidos}
                onChange={(e) => setCampo("apellidos", e.target.value)}
                className={PORTAL_UI.INPUT_CON_ICONO}
              />
            </PortalField>
          </div>

          <PortalField id="email" label="Correo electronico corporativo" icono={<Mail className="h-[19px] w-[19px]" />}>
            <Input
              id="email"
              type="email"
              required
              maxLength={VALIDACIONES.EMAIL_MAX}
              placeholder="ejemplo@empresa.com.pe"
              value={form.email}
              onChange={(e) => setCampo("email", e.target.value)}
              className={PORTAL_UI.INPUT_CON_ICONO}
            />
          </PortalField>

          <div className="grid gap-4 sm:grid-cols-2">
            <PortalField id="ruc" label="RUC (opcional)" icono={<IdCard className="h-[19px] w-[19px]" />}>
              <Input
                id="ruc"
                inputMode="numeric"
                maxLength={VALIDACIONES.RUC_LONGITUD}
                placeholder="20123456789"
                value={form.ruc}
                onChange={(e) => setCampo("ruc", onlyDigits(e.target.value, VALIDACIONES.RUC_LONGITUD))}
                className={PORTAL_UI.INPUT_CON_ICONO}
              />
            </PortalField>
            <PortalField id="telefono" label="Telefono (opcional)" icono={<Phone className="h-[19px] w-[19px]" />}>
              <Input
                id="telefono"
                inputMode="tel"
                maxLength={VALIDACIONES.TELEFONO_MAX}
                placeholder="999 999 999"
                value={form.telefono}
                onChange={(e) => setCampo("telefono", e.target.value)}
                className={PORTAL_UI.INPUT_CON_ICONO}
              />
            </PortalField>
          </div>

          <div>
            <label htmlFor="mensaje" className="mb-1.5 block text-xs font-semibold tracking-wide text-primary">
              <span>Mensaje (opcional)</span>
            </label>
            <Textarea
              id="mensaje"
              maxLength={VALIDACIONES.MENSAJE_MAX}
              rows={3}
              placeholder="Cuentanos brevemente que necesitas"
              value={form.mensaje}
              onChange={(e) => setCampo("mensaje", e.target.value)}
              className="border-border bg-background text-sm placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>

          <PortalField id="cargo" label="Cargo (opcional)" icono={<User className="h-[19px] w-[19px]" />}>
            <Input
              id="cargo"
              maxLength={VALIDACIONES.CARGO_MAX}
              placeholder="Gerente comercial"
              value={form.cargo}
              onChange={(e) => setCampo("cargo", e.target.value)}
              className={PORTAL_UI.INPUT_CON_ICONO}
            />
          </PortalField>

          {error && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="group mt-2 flex w-full items-center justify-center gap-2 bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-[0.99]"
          >
            <span>{loading ? "Enviando..." : "Enviar solicitud"}</span>
            <Send className="h-4 w-4 text-gold-soft transition-transform group-hover:translate-x-0.5" />
          </Button>

          <Link
            href="/auth/login"
            className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Volver al inicio de sesion</span>
          </Link>
        </form>
      )}
    </PortalAuthLayout>
  );
}
