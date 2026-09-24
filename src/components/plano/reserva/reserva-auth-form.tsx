"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Checkbox, Input, Label, Tabs, TabsContent, TabsList, TabsTrigger } from "@nrivera-iimp/ui-kit-iimp";
import { Building2, Eye, EyeOff, IdCard, Loader2, Lock, LogIn, Mail, Phone, ShieldCheck, UserPlus } from "lucide-react";
import { authService } from "@/lib/client/api/services/auth-service";
import { sunatService } from "@/lib/client/api/services/sunat-service";
import { CAMPOS_REGISTRO, REGISTRO_CODIGO, VALIDACIONES } from "@/lib/shared/constants";
import type { CampoRegistro } from "@/lib/shared/constants";
import { onlyDigits } from "@/lib/shared/utils/form-validator";
import type { RegistroRequestDTO } from "@/types/dto/auth/registro-request.dto";

interface Props {
  onAuthenticated: () => void | Promise<unknown>;
}

const REGISTRO_INICIAL: RegistroRequestDTO = {
  [CAMPOS_REGISTRO.EMAIL]: "",
  [CAMPOS_REGISTRO.PASSWORD]: "",
  [CAMPOS_REGISTRO.NOMBRE]: "",
  [CAMPOS_REGISTRO.APELLIDOS]: "",
  [CAMPOS_REGISTRO.RAZON_SOCIAL]: "",
  [CAMPOS_REGISTRO.RUC]: "",
  [CAMPOS_REGISTRO.TELEFONO]: "",
};

/** Pestañas del formulario de acceso/registro. */
const TAB = { INGRESAR: "ingresar", CREAR: "crear" } as const;

/** Fases del registro: captura de datos y verificacion por codigo. */
const FASE = { DATOS: "datos", CODIGO: "codigo" } as const;
type Fase = (typeof FASE)[keyof typeof FASE];

/** Etiqueta de campo con marca de obligatorio. */
function CampoLabel({ htmlFor, children, requerido = true }: { htmlFor: string; children: React.ReactNode; requerido?: boolean }) {
  return (
    <Label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
      <span>{children}</span>
      {requerido && <span className="ml-0.5 text-destructive">*</span>}
    </Label>
  );
}

export function ReservaAuthForm({ onAuthenticated }: Props) {
  const [tab, setTab] = useState<string>(TAB.INGRESAR);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [registro, setRegistro] = useState<RegistroRequestDTO>(REGISTRO_INICIAL);
  const [faseRegistro, setFaseRegistro] = useState<Fase>(FASE.DATOS);
  const [codigo, setCodigo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [rucValidado, setRucValidado] = useState(false);
  const rucEditedRef = useRef(false);

  const setCampo = (campo: CampoRegistro, valor: string) =>
    setRegistro((prev) => ({ ...prev, [campo]: valor }));

  const cambiarRuc = (valor: string) => {
    rucEditedRef.current = true;
    setRucValidado(false);
    setCampo(CAMPOS_REGISTRO.RUC, onlyDigits(valor, VALIDACIONES.RUC_LONGITUD));
  };

  const rucActual = registro[CAMPOS_REGISTRO.RUC];

  // Autocomplete: consulta SUNAT al completar los 11 digitos del RUC.
  useEffect(() => {
    if (faseRegistro !== FASE.DATOS || rucActual.length !== VALIDACIONES.RUC_LONGITUD || !rucEditedRef.current) return;
    rucEditedRef.current = false;
    setLookupLoading(true);
    sunatService.consultarRuc(rucActual)
      .then((r) => {
        if (r?.razonSocial) {
          setCampo(CAMPOS_REGISTRO.RAZON_SOCIAL, r.razonSocial);
          setRucValidado(true);
        }
      })
      .finally(() => setLookupLoading(false));
  }, [rucActual, faseRegistro]);

  const resetFase = () => {
    setFaseRegistro(FASE.DATOS);
    setCodigo("");
    setAviso(null);
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await authService.login({ email: email.trim(), password, remember });
      await onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesion");
    } finally {
      setLoading(false);
    }
  };

  const enviarCodigo = async () => {
    setLoading(true);
    setError(null);
    setAviso(null);
    const telefono = registro[CAMPOS_REGISTRO.TELEFONO]?.trim();
    try {
      const body: RegistroRequestDTO = {
        [CAMPOS_REGISTRO.EMAIL]: registro[CAMPOS_REGISTRO.EMAIL].trim(),
        [CAMPOS_REGISTRO.PASSWORD]: registro[CAMPOS_REGISTRO.PASSWORD],
        [CAMPOS_REGISTRO.NOMBRE]: registro[CAMPOS_REGISTRO.NOMBRE].trim(),
        [CAMPOS_REGISTRO.APELLIDOS]: registro[CAMPOS_REGISTRO.APELLIDOS].trim(),
        [CAMPOS_REGISTRO.RAZON_SOCIAL]: registro[CAMPOS_REGISTRO.RAZON_SOCIAL].trim(),
        [CAMPOS_REGISTRO.RUC]: registro[CAMPOS_REGISTRO.RUC].trim(),
        ...(telefono ? { [CAMPOS_REGISTRO.TELEFONO]: telefono } : {}),
      };
      const result = await authService.registrar(body);
      setFaseRegistro(FASE.CODIGO);
      setAviso(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  const handleRegistro = (e: React.FormEvent) => {
    e.preventDefault();
    void enviarCodigo();
  };

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authService.confirmarRegistro({ email: registro[CAMPOS_REGISTRO.EMAIL].trim(), codigo: codigo.trim() });
      await onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo verificar el codigo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-1">
      <Tabs value={tab} onValueChange={(v) => { setTab(v); resetFase(); }}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value={TAB.INGRESAR} className="gap-1.5"><LogIn className="h-3.5 w-3.5" /><span>Ingresar</span></TabsTrigger>
          <TabsTrigger value={TAB.CREAR} className="gap-1.5"><UserPlus className="h-3.5 w-3.5" /><span>Crear cuenta</span></TabsTrigger>
        </TabsList>

        <TabsContent value={TAB.INGRESAR}>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Ingresa con tu cuenta de exhibidor para continuar con la reserva.
          </p>
          <form onSubmit={handleLogin} className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <CampoLabel htmlFor="ra-email">Correo electronico</CampoLabel>
              <div className="relative">
                <Mail className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="ra-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="ejemplo@empresa.com.pe"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <CampoLabel htmlFor="ra-password">Contrasena</CampoLabel>
              <div className="relative">
                <Lock className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="ra-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-8 pr-9 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword((v) => !v)}
                  title="Mostrar u ocultar contrasena"
                  className="absolute inset-y-0 right-0 h-full w-9 text-muted-foreground hover:bg-transparent hover:text-primary"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center">
              <Checkbox
                id="ra-remember"
                checked={remember}
                onCheckedChange={(value) => setRemember(value === true)}
                className="h-4 w-4 border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
              />
              <Label htmlFor="ra-remember" className="ml-2 cursor-pointer text-xs font-medium text-muted-foreground select-none">
                <span>Recordar mi sesion en este equipo</span>
              </Label>
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="group flex w-full items-center justify-center gap-2 text-sm font-semibold">
              <span>{loading ? "Ingresando..." : "Ingresar y continuar"}</span>
              <LogIn className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </form>
        </TabsContent>

        <TabsContent value={TAB.CREAR}>
          {faseRegistro === FASE.CODIGO ? (
            <form onSubmit={handleConfirmar} className="mt-3 space-y-3">
              <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{aviso ?? `Enviamos un codigo de ${REGISTRO_CODIGO.LONGITUD} digitos a tu correo.`}</span>
              </div>

              <div className="space-y-1.5">
                <CampoLabel htmlFor="ra-codigo">Codigo de verificacion</CampoLabel>
                <Input
                  id="ra-codigo"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={REGISTRO_CODIGO.LONGITUD}
                  placeholder={"0".repeat(REGISTRO_CODIGO.LONGITUD)}
                  value={codigo}
                  onChange={(e) => setCodigo(onlyDigits(e.target.value, REGISTRO_CODIGO.LONGITUD))}
                  className="text-center text-lg font-semibold tracking-[0.5em]"
                />
                <p className="text-[11px] text-muted-foreground">
                  Revisa tu bandeja (y spam). El codigo vence en {REGISTRO_CODIGO.MINUTOS_VIGENCIA} minutos.
                </p>
              </div>

              {error && (
                <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading || codigo.length !== REGISTRO_CODIGO.LONGITUD}
                className="flex w-full items-center justify-center gap-2 text-sm font-semibold"
              >
                <span>{loading ? "Verificando..." : "Verificar y continuar"}</span>
                <UserPlus className="h-4 w-4" />
              </Button>

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={resetFase}
                >
                  <span>Cambiar datos</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  disabled={loading}
                  onClick={() => { void enviarCodigo(); }}
                >
                  <span>Reenviar codigo</span>
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegistro} className="mt-3 space-y-3">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Crea tu cuenta de exhibidor. Enviaremos un codigo de verificacion a tu correo para completar el registro.
              </p>

              <div className="space-y-1.5">
                <CampoLabel htmlFor="ra-ruc">RUC</CampoLabel>
                <div className="relative">
                  <IdCard className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="ra-ruc"
                    inputMode="numeric"
                    required
                    maxLength={VALIDACIONES.RUC_LONGITUD}
                    placeholder="20123456789"
                    value={registro[CAMPOS_REGISTRO.RUC]}
                    onChange={(e) => cambiarRuc(e.target.value)}
                    className="pl-8 text-xs"
                  />
                </div>
                {lookupLoading ? (
                  <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Buscando en SUNAT...</span>
                  </p>
                ) : rucValidado ? (
                  <p className="flex items-center gap-1.5 text-[10px] font-medium text-success">
                    <ShieldCheck className="h-3 w-3" />
                    <span>Razon social validada con SUNAT</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    Ingresa los {VALIDACIONES.RUC_LONGITUD} digitos para autocompletar la razon social.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <CampoLabel htmlFor="ra-razon">Razon social</CampoLabel>
                <div className="relative">
                  <Building2 className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="ra-razon"
                    required
                    maxLength={VALIDACIONES.RAZON_SOCIAL_MAX}
                    placeholder="Mi Empresa S.A.C."
                    value={registro[CAMPOS_REGISTRO.RAZON_SOCIAL]}
                    onChange={(e) => setCampo(CAMPOS_REGISTRO.RAZON_SOCIAL, e.target.value)}
                    className="pl-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <CampoLabel htmlFor="ra-nombre">Nombres</CampoLabel>
                  <Input
                    id="ra-nombre"
                    required
                    autoComplete="given-name"
                    maxLength={VALIDACIONES.NOMBRE_MAX}
                    placeholder="Juan"
                    value={registro[CAMPOS_REGISTRO.NOMBRE]}
                    onChange={(e) => setCampo(CAMPOS_REGISTRO.NOMBRE, e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <CampoLabel htmlFor="ra-apellidos">Apellidos</CampoLabel>
                  <Input
                    id="ra-apellidos"
                    required
                    autoComplete="family-name"
                    maxLength={VALIDACIONES.APELLIDOS_MAX}
                    placeholder="Perez"
                    value={registro[CAMPOS_REGISTRO.APELLIDOS]}
                    onChange={(e) => setCampo(CAMPOS_REGISTRO.APELLIDOS, e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <CampoLabel htmlFor="ra-email-nuevo">Correo electronico</CampoLabel>
                <div className="relative">
                  <Mail className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="ra-email-nuevo"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={VALIDACIONES.EMAIL_MAX}
                    placeholder="ejemplo@empresa.com.pe"
                    value={registro[CAMPOS_REGISTRO.EMAIL]}
                    onChange={(e) => setCampo(CAMPOS_REGISTRO.EMAIL, e.target.value)}
                    className="pl-8 text-xs"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Un correo por cuenta. No puede repetirse en otro registro.</p>
              </div>

              <div className="space-y-1.5">
                <CampoLabel htmlFor="ra-telefono" requerido={false}>Telefono</CampoLabel>
                <div className="relative">
                  <Phone className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="ra-telefono"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={VALIDACIONES.TELEFONO_MAX}
                    placeholder="999 999 999"
                    value={registro[CAMPOS_REGISTRO.TELEFONO]}
                    onChange={(e) => setCampo(CAMPOS_REGISTRO.TELEFONO, e.target.value)}
                    className="pl-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <CampoLabel htmlFor="ra-password-nuevo">Contrasena</CampoLabel>
                <div className="relative">
                  <Lock className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="ra-password-nuevo"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={VALIDACIONES.PASSWORD_MIN}
                    maxLength={VALIDACIONES.PASSWORD_MAX}
                    placeholder={`Minimo ${VALIDACIONES.PASSWORD_MIN} caracteres`}
                    value={registro[CAMPOS_REGISTRO.PASSWORD]}
                    onChange={(e) => setCampo(CAMPOS_REGISTRO.PASSWORD, e.target.value)}
                    className="pl-8 pr-9 text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPassword((v) => !v)}
                    title="Mostrar u ocultar contrasena"
                    className="absolute inset-y-0 right-0 h-full w-9 text-muted-foreground hover:bg-transparent hover:text-primary"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {error && (
                <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 text-sm font-semibold"
              >
                <span>{loading ? "Enviando codigo..." : "Crear cuenta y continuar"}</span>
                <UserPlus className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </form>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
