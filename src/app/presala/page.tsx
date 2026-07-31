"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@nrivera-iimp/ui-kit-iimp";
import { authService } from "@/lib/api/services/auth-service";
import { eventosServiceClient } from "@/lib/api/services/eventos-service";
import { ROLES, LS_KEYS } from "@/lib/constants";
import { dateUtils } from "@/lib/utils/date";
import Link from "next/link";
import type { EventoPadrePresalaDTO, EventoPresalaDTO } from "@/types/dto/models";

const VERTICAL_COLORS: Record<string, string> = {
  proexplo: "#d97706",
  "world-mining-congress": "#0891b2",
  gess: "#16a34a",
  perumin: "#b45309",
  "difusion-minera": "#7c3aed",
  eventos: "#0ea5e9",
};

function verticalColor(vertical: string): string {
  return VERTICAL_COLORS[vertical] ?? "#6b7280";
}

interface VersionItem extends EventoPresalaDTO {}
interface EventoItem extends Omit<EventoPadrePresalaDTO, "versiones"> { versiones: VersionItem[] }

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PresalaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [eventos, setEventos] = useState<EventoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const session = await authService.getSession();
        setIsAuth(session.authenticated);
        if (session.authenticated) {
          localStorage.removeItem(LS_KEYS.EVENTO_PUBLICO);
          localStorage.removeItem(LS_KEYS.EVENTO_PENDIENTE);
        }
        const isChange = searchParams.get("change") === "1";
        if (session.authenticated && session.eventoId && !isChange) {
          const returnTo = searchParams.get("returnTo");
          if (!returnTo || returnTo === "/dashboard" || returnTo === "/presala") {
            router.replace("/dashboard");
          }
          return;
        }
        setIsAdmin(session.roles?.includes(ROLES.ADMIN) ?? false);

        const pendingEvento = localStorage.getItem(LS_KEYS.EVENTO_PENDIENTE);
        if (session.authenticated && pendingEvento) {
          localStorage.removeItem(LS_KEYS.EVENTO_PENDIENTE);
          try {
            await authService.seleccionarEvento({ eventoId: pendingEvento });
            const returnTo = searchParams.get("returnTo");
            router.replace(returnTo && returnTo !== "/presala" ? returnTo : "/dashboard");
            return;
          } catch { /* fall through to show presala */ }
        }

        const json = await eventosServiceClient.listarPresala();
        setEventos(json as EventoItem[]);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const [isAuth, setIsAuth] = useState(false);

  const handleSelect = async (eventoId: string, vertical: string, nombre: string, tipoEvento?: number, codigoEvento?: number) => {
    const safeVertical = vertical.toLowerCase().replace(/\s+/g, "-");
    const returnTo = searchParams.get("returnTo");

    if (!isAuth) {
      localStorage.setItem(LS_KEYS.VERTICAL, safeVertical);
      localStorage.setItem(LS_KEYS.EVENTO_PUBLICO, JSON.stringify({ eventoId, nombre, tipoEvento, codigoEvento }));
      document.documentElement.classList.forEach((c) => { if (c.startsWith("vert-")) document.documentElement.classList.remove(c); });
      document.documentElement.classList.add(`vert-${safeVertical}`);
      document.documentElement.setAttribute("data-vertical", safeVertical);
      if (returnTo && returnTo !== "/presala") {
        router.push(returnTo);
      } else {
        localStorage.setItem(LS_KEYS.EVENTO_PENDIENTE, eventoId);
        router.push("/auth/login");
      }
      return;
    }

    setSelecting(eventoId);
    try {
      await authService.seleccionarEvento({ eventoId, tipoEvento, codigoEvento, eventoNombre: nombre });
      localStorage.setItem(LS_KEYS.VERTICAL, safeVertical);
      document.documentElement.classList.forEach((c) => { if (c.startsWith("vert-")) document.documentElement.classList.remove(c); });
      document.documentElement.classList.add(`vert-${safeVertical}`);
      document.documentElement.setAttribute("data-vertical", safeVertical);
      router.push(returnTo && returnTo !== "/presala" ? returnTo : "/dashboard");
    } catch (err) {
      console.error("[presala] Error al seleccionar evento:", err);
    } finally {
      setSelecting(null);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Seleccionar evento</h1>
          <p className="mt-1 text-sm text-muted-foreground">Elegi el evento y su version para continuar.</p>
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Cargando eventos...</p>
        ) : eventos.length === 0 ? (
          <div className="py-16 text-center space-y-4">
            {isAdmin ? (
              <>
                <p className="text-sm text-muted-foreground">No hay eventos vigentes. Crea uno para comenzar.</p>
                <Button asChild>
                  <Link href="/dashboard/eventos"><span>Ir a Gestion de Eventos</span></Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No hay eventos vigentes. Contacta al administrador.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {eventos.map((ep) => {
              const vColor = verticalColor(ep.vertical);
              return (
                <Card key={ep.id} className="overflow-hidden" style={{ borderColor: vColor + "40" }}>
                  <div className="h-1 w-full" style={{ backgroundColor: vColor }} />
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-white" style={{ backgroundColor: vColor }}>{ep.nombre.charAt(0)}</span>
                      <span>{ep.nombre}</span>
                      <Badge variant="outline" className="ml-1 text-[10px]"><span>{ep.vertical}</span></Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {ep.versiones.map((ver) => (
                        <button
                          key={ver.id}
                          type="button"
                          disabled={selecting === ver.id}
                          onClick={() => handleSelect(ver.id, ep.vertical, `${ep.nombre} ${ver.anio}`, ver.tipoEvento, ver.codigoEvento)}
                          className="flex flex-col gap-1 overflow-hidden rounded-lg border border-slate-200 bg-white text-left transition-all hover:shadow-md active:bg-slate-50"
                        >
                          <div className="h-1 w-full shrink-0" style={{ backgroundColor: vColor }} />
                          <div className="flex flex-col gap-1 px-4 pb-4 pt-3">
                            <span className="text-sm font-semibold text-slate-800">{ep.nombre} {ver.anio}</span>
                            {(ver.fecha_inicio || ver.fecha_fin) && (
                              <span className="text-xs text-muted-foreground">
                                {formatDate(ver.fecha_inicio)} — {formatDate(ver.fecha_fin)}
                              </span>
                            )}
                            <div className="mt-2 flex items-center justify-between">
                              <Badge
                                className="text-[10px]"
                                style={{
                                  backgroundColor: ver.estado === "active" ? vColor + "1A" : undefined,
                                  color: ver.estado === "active" ? vColor : undefined,
                                  borderColor: ver.estado === "active" ? vColor + "40" : undefined,
                                }}
                              >
                                <span>{ver.estado === "active" ? "Vigente" : ver.estado}</span>
                              </Badge>
                              <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={selecting === ver.id} asChild>
                                <span>{selecting === ver.id ? "..." : "Ingresar"}</span>
                              </Button>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
