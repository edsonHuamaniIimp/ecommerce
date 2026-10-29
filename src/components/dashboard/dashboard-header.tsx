"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, Popover, PopoverTrigger, PopoverContent } from "@nrivera-iimp/ui-kit-iimp";
import { LogOut, User, Bell, AlertCircle } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { authService } from "@/lib/client/api/services/auth-service";
import { alertasService } from "@/lib/client/api/services/alertas-service";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { LS_KEYS, ROLES } from "@/lib/shared/constants";
import { portalEmpresaService } from "@/lib/client/api/services/portal-empresa-service";
import { empresaPerfilPendiente } from "@/lib/shared/utils/empresa-perfil";
import { dateUtils } from "@/lib/shared/utils/date";

interface AlertaItem {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  url: string | null;
  createdAt: string;
}

function formatAlertaFecha(iso: string) { return dateUtils.formatDateTime(iso); }

export function DashboardHeader() {
  const router = useRouter();
  const [eventoNombre, setEventoNombre] = useState<string | null>(null);
  const [eventoPadreNombre, setEventoPadreNombre] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [idioma, setIdioma] = useState<string | null>(null);
  const [alertas, setAlertas] = useState<AlertaItem[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [roles, setRoles] = useState<string[]>([]);
  const [perfilPendiente, setPerfilPendiente] = useState(false);
  const [perfilAvisoOpen, setPerfilAvisoOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const json = await authService.getSession();
        if (json.authenticated) {
          setEventoNombre(json.eventoNombre ?? null);
          setEventoPadreNombre(json.eventoPadreNombre ?? null);
          setEmail(json.email ?? null);
          setRoles(json.roles ?? []);
          setIdioma(json.idioma ?? null);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  /* Aviso de perfil de empresa incompleto (solo clientes con empresa vinculada). */
  useEffect(() => {
    let activo = true;
    const esCliente = roles.includes(ROLES.CLIENTE) && !roles.includes(ROLES.ADMIN);
    if (!esCliente) return () => { activo = false; };
    portalEmpresaService.misDatos()
      .then((empresa) => {
        if (activo) setPerfilPendiente(empresaPerfilPendiente(empresa).pendiente);
      })
      .catch(() => {
        if (activo) setPerfilPendiente(false);
      });
    return () => { activo = false; };
  }, [roles]);

  /* Apertura automatica del aviso una vez por sesion de navegador. */
  useEffect(() => {
    if (!perfilPendiente) return;
    try {
      if (sessionStorage.getItem("dashboard-perfil-aviso-visto") === "1") return;
      sessionStorage.setItem("dashboard-perfil-aviso-visto", "1");
    } catch {
      /* sessionStorage no disponible */
    }
    queueMicrotask(() => setPerfilAvisoOpen(true));
  }, [perfilPendiente]);
  const loadAlertas = useCallback(async () => {
    try {
      const data = await alertasService.listar();
      setAlertas(data.alertas ?? []);
      setNoLeidas(data.noLeidas ?? 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    (async () => { await loadAlertas(); })();
    const interval = setInterval(loadAlertas, 30000);
    return () => clearInterval(interval);
  }, [loadAlertas]);

  const handleAlertClick = async (a: AlertaItem) => {
    await alertasService.marcarLeida(a.id);
    loadAlertas();
    if (a.url) {
      const parsed = new URL(a.url, window.location.origin);
      const path = parsed.pathname;
      const id = parsed.searchParams.get("id");
      if (path === window.location.pathname) {
        window.dispatchEvent(new CustomEvent("alerta:navigate", { detail: { path, id } }));
      } else {
        router.push(a.url);
      }
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    localStorage.removeItem(LS_KEYS.EVENTO_PUBLICO);
    localStorage.removeItem(LS_KEYS.EVENTO_PENDIENTE);
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <>
      {eventoNombre && (
        <Link href="/presala?change=1" className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto">
          <span className="font-medium">{eventoPadreNombre ?? eventoNombre}</span>
          {eventoPadreNombre && <span className="text-muted-foreground/60"> — {eventoNombre}</span>}
        </Link>
      )}

      {/* Selector de idioma (ES/EN) */}
      <LanguageSwitcher idiomaActual={idioma} />

      {/* Bell icon */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0">
            <Bell className="h-3.5 w-3.5" />
            {noLeidas > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {noLeidas > 9 ? "9+" : noLeidas}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-xs font-semibold text-slate-700">Alertas</span>
            {noLeidas > 0 && (
              <button className="text-[10px] text-primary hover:underline" onClick={async () => {
                await alertasService.marcarTodasLeidas();
                loadAlertas();
              }}>
                Marcar todas leidas
              </button>
            )}
          </div>
          {alertas.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              <span>No tienes alertas</span>
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto">
              {alertas.slice(0, 15).map((a) => (
                <DropdownMenuItem
                  key={a.id}
                  className={`flex flex-col items-start gap-0.5 px-3 py-2 text-xs ${!a.leida ? "bg-blue-50/50" : ""}`}
                  onClick={() => handleAlertClick(a)}
                >
                  <div className="flex items-center gap-2 w-full">
                    {!a.leida && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                    <span className="font-medium text-slate-700 truncate">{a.titulo}</span>
                    <span className="ml-auto text-[10px] text-slate-400 shrink-0">{formatAlertaFecha(a.createdAt)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2"><span>{a.mensaje}</span></p>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User dropdown */}
      <div className="relative">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 h-8 max-w-[200px]">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline text-xs truncate">{email ?? "Usuario"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {email && (
              <div className="px-2 py-1.5 text-[10px] text-muted-foreground border-b mb-1 truncate">{email}</div>
            )}
            <DropdownMenuItem asChild className="text-xs cursor-pointer">
              <Link href="/dashboard/perfil">
                <User className="h-3.5 w-3.5 mr-2" />
                <span>Perfil</span>
              </Link>
            </DropdownMenuItem>
            {perfilPendiente && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="text-xs cursor-pointer bg-amber-50 text-amber-800 focus:bg-amber-100">
                  <Link href="/dashboard/perfil?tab=empresa">
                    <AlertCircle className="h-3.5 w-3.5 mr-2" />
                    <span>Completar datos de empresa</span>
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-xs cursor-pointer text-red-600">
              <LogOut className="h-3.5 w-3.5 mr-2" />
              <span>Cerrar sesion</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {perfilPendiente && perfilAvisoOpen && typeof document !== "undefined" && createPortal(
          <div
            aria-hidden="true"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setPerfilAvisoOpen(false)}
          />,
          document.body,
        )}

        {perfilPendiente && (
          <Popover modal open={perfilAvisoOpen} onOpenChange={setPerfilAvisoOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Completar datos de la empresa"
                className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-amber-500 ring-2 ring-background"
              />
            </PopoverTrigger>
            <PopoverContent align="end" side="left" sideOffset={8} collisionPadding={16} className="z-[60] w-80">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">Completa los datos de tu empresa</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Tienes solicitudes en curso. Para poder avanzar, completa toda la informacion de tu empresa y del representante legal.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPerfilAvisoOpen(false)}>
                    <span>Ahora no</span>
                  </Button>
                  <Button size="sm" className="h-7 text-xs" asChild>
                    <Link href="/dashboard/perfil?tab=empresa" onClick={() => setPerfilAvisoOpen(false)}>
                      <span>Completar informacion</span>
                    </Link>
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </>
  );
}
