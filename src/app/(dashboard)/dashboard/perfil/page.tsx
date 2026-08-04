"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { maestraService } from "@/lib/api/services/maestra-service";
import { perfilService } from "@/lib/api/services/perfil-service";
import type { PerfilDTO } from "@/lib/api/services/perfil-service";
import { MAESTRA_TABLAS } from "@/lib/constants";
import type { MaestraItemDTO } from "@/types/dto/maestra";

export default function PerfilPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetToken = searchParams.get("reset");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tipoUsuarioId, setTipoUsuarioId] = useState<number | null>(null);
  const [tiposUsuario, setTiposUsuario] = useState<MaestraItemDTO[]>([]);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    (async () => {
      const [perfilData] = await Promise.all([
        perfilService.get().catch(() => ({} as PerfilDTO)),
        maestraService.listar(MAESTRA_TABLAS.USUARIO_TIPO).then(setTiposUsuario).catch(() => {}),
      ]);
      setEmail(perfilData.email ?? "");
      setNombre(perfilData.nombre ?? "");
      setApellidos(perfilData.apellidos ?? "");
      setTelefono(perfilData.telefono ?? "");
      setTipoUsuarioId(perfilData.tipoUsuarioId ?? null);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await perfilService.update({ nombre, apellidos, telefono, tipoUsuarioId });
      toast.success("Perfil actualizado");
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleResetRequest = async () => {
    await perfilService.requestReset(email).catch(() => {});
    toast.success("Se envio un enlace a tu correo para restablecer la contrasena");
  };

  const handleResetConfirm = async () => {
    if (resetPassword.length < 6) {
      toast.error("Minimo 6 caracteres");
      return;
    }
    setResetting(true);
    try {
      await perfilService.confirmReset(resetToken!, resetPassword);
      setResetDone(true);
      toast.success("Contrasena actualizada");
      router.replace("/dashboard/perfil");
    } catch {
      toast.error("Token invalido o expirado");
    }
    setResetting(false);
  };

  if (loading) return null;

  return (
    <main className="flex-1 py-6">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
          <p className="text-sm text-muted-foreground">Gestiona tu informacion personal y seguridad.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle><span>Informacion personal</span></CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email"><span>Correo electronico</span></Label>
              <Input id="email" value={email} disabled className="opacity-60" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="nombre"><span>Nombres</span></Label>
                <Input id="nombre" placeholder="Juan" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="apellidos"><span>Apellidos</span></Label>
                <Input id="apellidos" placeholder="Perez" value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="telefono"><span>Telefono</span></Label>
                <Input id="telefono" placeholder="999888777" maxLength={9} value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/\D/g, "").slice(0, 9))} />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="tipoUsuario"><span>Tipo de usuario</span></Label>
                <Select value={tipoUsuarioId?.toString() ?? ""} disabled>
                  <SelectTrigger id="tipoUsuario"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {tiposUsuario.map((t) => (
                      <SelectItem key={t.itemId ?? t.id} value={String(t.itemId)}><span>{t.nombre}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              <span>{saving ? "Guardando..." : "Guardar cambios"}</span>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle><span>Seguridad</span></CardTitle>
          </CardHeader>
          <CardContent>
            {resetToken ? (
              resetDone ? (
                <p className="text-sm text-emerald-600">Contrasena actualizada correctamente.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Ingresa tu nueva contrasena.</p>
                  <Input type="password" placeholder="Minimo 6 caracteres" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
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
      </div>
    </main>
  );
}
