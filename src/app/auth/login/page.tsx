"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Checkbox, Input, Label } from "@nrivera-iimp/ui-kit-iimp";
import { Building2, ChevronDown, Eye, EyeOff, Lock, LogIn, Mail, UserPlus } from "lucide-react";
import { authService } from "@/lib/client/api/services/auth-service";
import { sincronizarEventoPublicoEnSesion } from "@/lib/client/sesion-evento";
import { PortalAuthLayout, PortalField } from "@/components/layout/portal-auth-layout";
import { useEventoPublico } from "@/hooks/use-evento-publico";
import { PORTAL_UI } from "@/lib/shared/constants";

function LoginPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const eventoPublico = useEventoPublico();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await authService.login({ email: email.trim(), password, remember });
      await sincronizarEventoPublicoEnSesion();
      const returnTo = params.get("returnTo") ?? "/presala";
      router.push(returnTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalAuthLayout>
      <div className="flex flex-col items-center border-b border-border pb-6 text-center">
        <div className="mb-4 flex items-center justify-center gap-2">
          <span className="flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-xs font-bold tracking-wider text-primary-foreground">
            IIMP
          </span>
          <span className="pl-1 text-left leading-none">
            <span className="block text-[11px] font-bold uppercase tracking-tight text-primary">
              Instituto de Ingenieros
            </span>
            <span className="block text-[10px] font-medium text-muted-foreground">de Minas del Peru</span>
          </span>
        </div>

        {eventoPublico?.nombre && (
          <Link
            href="/presala?change=1"
            title="Cambiar de evento"
            className="group mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 transition-colors hover:bg-accent"
          >
            <Building2 className="h-[17px] w-[17px] text-gold" />
            <span className="text-xs font-semibold text-primary">{eventoPublico.nombre}</span>
            <ChevronDown className="h-[15px] w-[15px] text-muted-foreground transition-transform group-hover:text-primary" />
          </Link>
        )}

        <h1 className="text-2xl font-bold tracking-tight text-primary">Reserva de stands</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ingresa con tu cuenta institucional</p>
      </div>

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

        <PortalField
          id="password"
          label="Contrasena"
          icono={<Lock className="h-[19px] w-[19px]" />}
          accionLabel={
            <Link
              href="/auth/recuperar"
              className="text-xs font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
            >
              <span>Olvidaste tu contrasena?</span>
            </Link>
          }
        >
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={PORTAL_UI.INPUT_CON_ICONO_Y_ACCION}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowPassword((v) => !v)}
            title="Mostrar u ocultar contrasena"
            className="absolute inset-y-0 right-0 h-full w-10 rounded-none text-muted-foreground hover:bg-transparent hover:text-primary"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </Button>
        </PortalField>

        <div className="flex items-center pt-1">
          <Checkbox
            id="remember"
            checked={remember}
            onCheckedChange={(value) => setRemember(value === true)}
            className="h-4 w-4 border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
          <Label htmlFor="remember" className="ml-2 block cursor-pointer text-xs font-medium text-muted-foreground select-none">
            <span>Recordar mi sesion en este equipo</span>
          </Label>
        </div>

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
          <span>{loading ? "Ingresando..." : "Ingresar a la plataforma"}</span>
          <LogIn className="h-4 w-4 text-gold-soft transition-transform group-hover:translate-x-0.5" />
        </Button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 font-medium tracking-wider text-muted-foreground">o</span>
        </div>
      </div>

      <Link
        href="/auth/solicitar-cuenta"
        className="group flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-xs font-semibold text-primary transition-all hover:border-muted-foreground/40 hover:bg-secondary"
      >
        <UserPlus className="h-4 w-4 text-gold" />
        <span>Solicitar cuenta de nuevo exhibidor</span>
      </Link>
    </PortalAuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
