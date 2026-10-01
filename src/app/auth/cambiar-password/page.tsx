"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input } from "@nrivera-iimp/ui-kit-iimp";
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/client/api/services/auth-service";
import { PortalAuthCardHeader, PortalAuthLayout, PortalField } from "@/components/layout/portal-auth-layout";
import { PASSWORD_MIN_LENGTH } from "@/lib/shared/constants";

function CambiarPasswordContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (nueva.trim().length < PASSWORD_MIN_LENGTH) {
      setError(`La nueva contrasena debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
      return;
    }
    if (nueva !== confirmar) {
      setError("Las contrasenas no coinciden.");
      return;
    }

    setEnviando(true);
    try {
      const resultado = await authService.cambiarPassword({ passwordActual: actual, passwordNueva: nueva });
      toast.success("Contrasena actualizada");
      const returnTo = params.get("returnTo");
      if (resultado.requiereValidarDatos) {
        router.push("/auth/validar-datos");
      } else {
        router.push(returnTo ?? "/dashboard");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contrasena");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <PortalAuthLayout>
      <PortalAuthCardHeader
        icono={<KeyRound className="h-5 w-5" />}
        titulo="Cambia tu contrasena"
        descripcion="Usaste una contrasena temporal enviada por correo. Define una nueva para continuar."
      />

      <div className="mt-5 rounded-lg border border-info/30 bg-info/10 px-3 py-2.5 text-[11px] text-muted-foreground">
        La contrasena temporal deja de ser valida al guardar. Minimo {PASSWORD_MIN_LENGTH} caracteres.
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <PortalField id="password-actual" label="Contrasena temporal actual" icono={<Lock className="h-3.5 w-3.5" />}>
          <Input
            id="password-actual"
            type={ver ? "text" : "password"}
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            autoComplete="current-password"
            className="h-10 pl-9 text-sm"
            required
          />
        </PortalField>

        <PortalField id="password-nueva" label="Nueva contrasena" icono={<ShieldCheck className="h-3.5 w-3.5" />}>
          <Input
            id="password-nueva"
            type={ver ? "text" : "password"}
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            autoComplete="new-password"
            className="h-10 pl-9 text-sm"
            required
          />
        </PortalField>

        <PortalField id="password-confirmar" label="Confirmar nueva contrasena" icono={<ShieldCheck className="h-3.5 w-3.5" />}>
          <Input
            id="password-confirmar"
            type={ver ? "text" : "password"}
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            autoComplete="new-password"
            className="h-10 pl-9 text-sm"
            required
          />
        </PortalField>

        <button
          type="button"
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => setVer((v) => !v)}
        >
          {ver ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          <span>{ver ? "Ocultar contrasenas" : "Mostrar contrasenas"}</span>
        </button>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" disabled={enviando} className="h-11 w-full rounded-lg text-sm font-semibold">
          {enviando ? "Guardando..." : "Guardar y continuar"}
        </Button>

        <p className="text-center text-[11px] text-muted-foreground">
          <button
            type="button"
            className="underline-offset-2 hover:underline"
            onClick={async () => {
              await authService.logout().catch(() => undefined);
              router.push("/auth/login");
            }}
          >
            Cerrar sesion
          </button>
        </p>
      </form>
    </PortalAuthLayout>
  );
}

export default function CambiarPasswordPage() {
  return (
    <Suspense fallback={null}>
      <CambiarPasswordContent />
    </Suspense>
  );
}
