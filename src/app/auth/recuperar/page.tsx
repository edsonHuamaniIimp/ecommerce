"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input } from "@nrivera-iimp/ui-kit-iimp";
import { ArrowLeft, CheckCircle2, Mail, MailCheck } from "lucide-react";
import { perfilService } from "@/lib/client/api/services/perfil-service";
import { PortalAuthCardHeader, PortalAuthLayout, PortalField } from "@/components/layout/portal-auth-layout";
import { PORTAL_UI } from "@/lib/shared/constants";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await perfilService.requestReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el enlace");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalAuthLayout>
      <PortalAuthCardHeader
        icono={sent ? <MailCheck className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
        titulo="Recuperar contrasena"
        descripcion="Te enviaremos un enlace a tu correo institucional para crear una nueva."
      />

      {sent ? (
        <div className="mt-6 space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <p className="text-xs font-medium text-foreground">
              Si el correo esta registrado, recibiras un enlace para restablecer tu contrasena. El enlace expira en 30 minutos.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link href="/auth/login"><span>Volver al inicio de sesion</span></Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <PortalField id="email" label="Correo electronico corporativo" icono={<Mail className="h-[19px] w-[19px]" />}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="ejemplo@empresa.com.pe"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            className="mt-2 w-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90"
          >
            <span>{loading ? "Enviando..." : "Enviar enlace de recuperacion"}</span>
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
