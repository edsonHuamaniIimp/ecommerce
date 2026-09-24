"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Input } from "@nrivera-iimp/ui-kit-iimp";
import { CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { perfilService } from "@/lib/client/api/services/perfil-service";
import { PortalAuthCardHeader, PortalAuthLayout, PortalField } from "@/components/layout/portal-auth-layout";
import { PORTAL_UI, VALIDACIONES } from "@/lib/shared/constants";

export default function ConfirmarResetPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePassword = (
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
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < VALIDACIONES.PASSWORD_MIN) {
      setError(`La contrasena debe tener al menos ${VALIDACIONES.PASSWORD_MIN} caracteres`);
      return;
    }
    if (password !== confirmacion) {
      setError("Las contrasenas no coinciden");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await perfilService.confirmReset(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la contrasena");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalAuthLayout>
      <PortalAuthCardHeader
        icono={done ? <CheckCircle2 className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
        titulo={done ? "Contrasena actualizada" : "Nueva contrasena"}
        descripcion={done ? "Ya puedes ingresar con tu nueva contrasena." : "Define una contrasena nueva para tu cuenta."}
      />

      {done ? (
        <div className="mt-6">
          <Button asChild className="w-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90">
            <Link href="/auth/login"><span>Ir al inicio de sesion</span></Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <PortalField id="password" label="Nueva contrasena" icono={<Lock className="h-[19px] w-[19px]" />}>
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              placeholder={`Minimo ${VALIDACIONES.PASSWORD_MIN} caracteres`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={PORTAL_UI.INPUT_CON_ICONO_Y_ACCION}
            />
            {togglePassword}
          </PortalField>

          <PortalField id="confirmacion" label="Confirmar contrasena" icono={<Lock className="h-[19px] w-[19px]" />}>
            <Input
              id="confirmacion"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              placeholder="Repite la contrasena"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
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
            <span>{loading ? "Actualizando..." : "Guardar nueva contrasena"}</span>
          </Button>
        </form>
      )}
    </PortalAuthLayout>
  );
}
