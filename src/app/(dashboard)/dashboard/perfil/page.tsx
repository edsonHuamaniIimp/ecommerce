"use client";

import { Suspense, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Badge } from "@nrivera-iimp/ui-kit-iimp";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Building2, Search, X, Loader2 } from "lucide-react";
import { authService } from "@/lib/client/api/services/auth-service";
import { maestraService } from "@/lib/client/api/services/maestra-service";
import { perfilService } from "@/lib/client/api/services/perfil-service";
import { entidadesService } from "@/lib/client/api/services/entidades-service";
import type { PerfilDTO } from "@/lib/client/api/services/perfil-service";
import { MAESTRA_TABLAS, ROLES } from "@/lib/shared/constants";
import type { MaestraItemDTO } from "@/types/dto/maestra";

function PerfilPageContent() {
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
  const [, setTiposUsuario] = useState<MaestraItemDTO[]>([]);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  // Empresa
  const [idEmpresa, setIdEmpresa] = useState<string | null>(null);
  const [nombreEmpresa, setNombreEmpresa] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchEmpresa, setSearchEmpresa] = useState("");
  const [empresasResults, setEmpresasResults] = useState<Array<{ id_empresa: string; empresa: string; documento: string }>>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await authService.getSession();
      setEmail(session.email ?? "");
      setIsAdmin(session.roles?.includes(ROLES.ADMIN) ?? false);
      const [perfilData] = await Promise.all([
        perfilService.get().catch(() => ({} as PerfilDTO)),
        maestraService.listar(MAESTRA_TABLAS.USUARIO_TIPO).then(setTiposUsuario).catch(() => {}),
      ]);
      setEmail(session.email ?? perfilData.email ?? "");
      setNombre(perfilData.nombre ?? "");
      setApellidos(perfilData.apellidos ?? "");
      setTelefono(perfilData.telefono ?? "");
      setTipoUsuarioId(perfilData.tipoUsuarioId ?? null);
      setIdEmpresa(perfilData.idEmpresa ?? null);
      setNombreEmpresa(perfilData.nombreEmpresa ?? null);
      if (perfilData.nombreEmpresa) setSearchEmpresa(perfilData.nombreEmpresa);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await perfilService.update({ nombre, apellidos, telefono, tipoUsuarioId, idEmpresa, nombreEmpresa });
      toast.success("Perfil actualizado");
    } catch { toast.error("Error al guardar"); }
    setSaving(false);
  };

  const handleSearchEmpresa = async () => {
    const q = searchEmpresa.trim();
    if (!q || q.length < 2) { toast.error("Ingresa al menos 2 caracteres"); return; }
    setSearching(true);
    try {
      const esRuc = /^\d{11}$/.test(q);
      const data = esRuc
        ? await entidadesService.searchEmpresa(q, undefined)
        : await entidadesService.searchEmpresa(undefined, q);
      // API responde { ListEmpresa: [{ ecicod, razonSocial, numDocumento }] }
      const rawList = (data as Record<string, unknown>).ListEmpresa
        ?? (data as Record<string, unknown>).listEmpresa
        ?? (data as Record<string, unknown>).ListInfoEmpresa
        ?? [];
      const results = (rawList as Array<Record<string, unknown>> | undefined)?.map((e) => ({
        id_empresa: String(e.ecicod ?? e.id_empresa ?? e.sie_code ?? ""),
        empresa: String(e.razonSocial ?? e.empresa ?? ""),
        documento: String(e.numDocumento ?? e.documento ?? ""),
      })).filter((e) => e.empresa || e.id_empresa) ?? [];
      setEmpresasResults(results);
      if (results.length === 0) toast.error("No se encontraron empresas");
    } catch { toast.error("Error al buscar"); }
    setSearching(false);
  };

  const selectEmpresa = async (row: { id_empresa: string; empresa: string; documento: string }) => {
    setIdEmpresa(row.id_empresa);
    setNombreEmpresa(row.empresa);
    setSearchEmpresa(row.empresa);
    setEmpresasResults([]);
    try {
      await perfilService.update({ idEmpresa: row.id_empresa, nombreEmpresa: row.empresa });
      toast.success("Empresa vinculada");
    } catch { toast.error("Error al vincular empresa"); }
  };

  const clearEmpresa = async () => {
    setIdEmpresa(null);
    setNombreEmpresa(null);
    setSearchEmpresa("");
    setEmpresasResults([]);
    try {
      await perfilService.update({ idEmpresa: null, nombreEmpresa: null });
      toast.success("Empresa desvinculada");
    } catch { toast.error("Error al desvincular"); }
  };

  const handleResetRequest = async () => {
    await perfilService.requestReset(email).catch(() => {});
    toast.success("Se envio un enlace a tu correo para restablecer la contrasena");
  };

  const handleResetConfirm = async () => {
    if (resetPassword.length < 6) { toast.error("Minimo 6 caracteres"); return; }
    setResetting(true);
    try {
      await perfilService.confirmReset(resetToken!, resetPassword);
      setResetDone(true);
      toast.success("Contrasena actualizada");
      router.replace("/dashboard/perfil");
    } catch { toast.error("Token invalido o expirado"); }
    setResetting(false);
  };

  if (loading) return null;

  return (
    <main className="flex-1 py-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
          <p className="text-sm text-muted-foreground">Gestiona tu informacion personal y seguridad.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle><span>Informacion personal</span></CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email"><span>Correo electronico</span></Label>
                <Input id="email" value={email} disabled className="opacity-60 text-xs" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="nombre"><span>Nombres</span></Label>
                  <Input id="nombre" placeholder="Juan" value={nombre} onChange={(e) => setNombre(e.target.value)} className="text-xs" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="apellidos"><span>Apellidos</span></Label>
                  <Input id="apellidos" placeholder="Perez" value={apellidos} onChange={(e) => setApellidos(e.target.value)} className="text-xs" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefono"><span>Telefono</span></Label>
                <Input id="telefono" placeholder="999888777" maxLength={9} value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/\D/g, "").slice(0, 9))} className="text-xs" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>Empresa</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {nombreEmpresa ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">{nombreEmpresa}</p>
                    {idEmpresa && <p className="text-[11px] text-emerald-600">{idEmpresa}</p>}
                  </div>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 h-8 w-8 p-0" onClick={clearEmpresa}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : isAdmin ? (
                <>
                  <p className="text-xs text-slate-500">Vincula al usuario a una empresa registrada en el IIMP.</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Buscar por nombre o RUC"
                      value={searchEmpresa}
                      onChange={(e) => setSearchEmpresa(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSearchEmpresa(); }}
                      className="text-xs"
                    />
                    <Button size="sm" variant="outline" className="shrink-0 rounded-full" onClick={handleSearchEmpresa} disabled={searching}>
                      {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  {empresasResults.length > 0 && (
                    <div className="rounded-lg border bg-white max-h-48 overflow-y-auto divide-y">
                      {empresasResults.map((r, i) => (
                        <button
                          key={i}
                          className="flex items-center justify-between w-full px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
                          onClick={() => selectEmpresa(r)}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate">{r.empresa}</p>
                            <p className="text-[10px] text-slate-400">{r.documento}</p>
                          </div>
                          <Badge variant="secondary" className="text-[9px] shrink-0 ml-2">{r.id_empresa}</Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-500">Solo el administrador puede asignar tu empresa. Contacta a soporte.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          <span>{saving ? "Guardando..." : "Guardar cambios"}</span>
        </Button>

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
                  <Input type="password" placeholder="Minimo 6 caracteres" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} className="text-xs" />
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

export default function PerfilPage() {
  return (
    <Suspense fallback={null}>
      <PerfilPageContent />
    </Suspense>
  );
}
