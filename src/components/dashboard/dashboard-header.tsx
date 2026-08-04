"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@nrivera-iimp/ui-kit-iimp";
import { LogOut, User, Bell } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { authService } from "@/lib/api/services/auth-service";
import { alertasService } from "@/lib/api/services/alertas-service";
import { LS_KEYS } from "@/lib/constants";
import { dateUtils } from "@/lib/utils/date";

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
  const [alertas, setAlertas] = useState<AlertaItem[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const json = await authService.getSession();
        if (json.authenticated) {
          setEventoNombre(json.eventoNombre ?? null);
          setEventoPadreNombre(json.eventoPadreNombre ?? null);
          setEmail(json.email ?? null);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const loadAlertas = useCallback(async () => {
    try {
      const data = await alertasService.listar();
      setAlertas(data.alertas);
      setNoLeidas(data.noLeidas);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadAlertas();
    const interval = setInterval(loadAlertas, 30000);
    return () => clearInterval(interval);
  }, [loadAlertas]);

  const handleMarcarLeida = async (id: string) => {
    await alertasService.marcarLeida(id);
    loadAlertas();
  };

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
    localStorage.removeItem(LS_KEYS.VERTICAL);
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
              No tienes alertas
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
                  <p className="text-[11px] text-slate-500 line-clamp-2">{a.mensaje}</p>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User dropdown */}
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
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-xs cursor-pointer text-red-600">
            <LogOut className="h-3.5 w-3.5 mr-2" />
            <span>Cerrar sesion</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
