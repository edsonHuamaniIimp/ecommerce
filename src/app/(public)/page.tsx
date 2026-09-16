"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@nrivera-iimp/ui-kit-iimp";
import { authService } from "@/lib/client/api/services/auth-service";
import { eventosServiceClient } from "@/lib/client/api/services/eventos-service";
import { ROLES, LS_KEYS } from "@/lib/shared/constants";
import type { EventoPadrePresalaDTO, EventoPresalaDTO } from "@/types/dto/models";

const VERTICAL_COLORS: Record<string, string> = {
  proexplo: "#d97706",
  wmc: "#0891b2",
  "world-mining-congress": "#0891b2",
  gess: "#16a34a",
  perumin: "#b45309",
  "difusion-minera": "#7c3aed",
  eventos: "#0ea5e9",
};

function verticalColor(vertical: string): string {
  return VERTICAL_COLORS[vertical] ?? "#6b7280";
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export default function HomePage() {
  const router = useRouter();
  const [eventos, setEventos] = useState<EventoPadrePresalaDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const session = await authService.getSession();
        setIsAuth(session.authenticated);
        setIsAdmin(session.roles?.includes(ROLES.ADMIN) ?? false);
        if (session.authenticated && session.eventoId) {
          router.replace("/dashboard");
          return;
        }
      } catch { /* public */ }
      try {
        const json = await eventosServiceClient.listarPresala();
        setEventos(json);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [router]);

  const handleSelect = async (eventoId: string, vertical: string) => {
    if (!isAuth) {
      localStorage.setItem(LS_KEYS.EVENTO_PENDIENTE, eventoId);
      localStorage.setItem(LS_KEYS.VERTICAL, vertical);
      document.documentElement.classList.forEach((c) => { if (c.startsWith("vert-")) document.documentElement.classList.remove(c); });
      document.documentElement.classList.add(`vert-${vertical}`);
      document.documentElement.setAttribute("data-vertical", vertical);
      router.push("/auth/login");
      return;
    }
    try {
      await authService.seleccionarEvento({ eventoId });
      localStorage.setItem(LS_KEYS.VERTICAL, vertical);
      document.documentElement.classList.forEach((c) => { if (c.startsWith("vert-")) document.documentElement.classList.remove(c); });
      document.documentElement.classList.add(`vert-${vertical}`);
      document.documentElement.setAttribute("data-vertical", vertical);
      router.push("/dashboard");
    } catch { /* ignore */ }
  };

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Contratos de Stands — IIMP</h1>
          <p className="mt-1 text-sm text-muted-foreground">Selecciona un evento para ver sus stands disponibles.</p>
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Cargando eventos...</p>
        ) : eventos.length === 0 ? (
          <div className="py-12 text-center space-y-4">
            {isAdmin ? (
              <>
                <p className="text-sm text-muted-foreground">No hay eventos vigentes.</p>
                <Button asChild><Link href="/dashboard/eventos"><span>Gestionar eventos</span></Link></Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No hay eventos disponibles en este momento.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {eventos.map((ep) => (
              <Card key={ep.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-white" style={{ backgroundColor: verticalColor(ep.vertical) }}>{ep.nombre.charAt(0)}</span>
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
                        onClick={() => handleSelect(ver.id, ep.vertical)}
                        className="flex flex-col gap-1 rounded-lg border p-4 text-left transition-all hover:shadow-md"
                        style={{ borderColor: "transparent", ...({ "--hover-color": verticalColor(ep.vertical) } as React.CSSProperties) }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = verticalColor(ep.vertical); }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                      >
                        <span className="text-sm font-semibold">{ep.nombre} {ver.anio}</span>
                        {(ver.fecha_inicio || ver.fecha_fin) && (
                          <span className="text-xs text-muted-foreground">{formatDate(ver.fecha_inicio)} — {formatDate(ver.fecha_fin)}</span>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <Badge variant={ver.estado === "active" ? "default" : "secondary"} className="text-[10px]">
                            <span>{ver.estado === "active" ? "Vigente" : ver.estado}</span>
                          </Badge>
                          <span className="rounded-md px-2 py-1 text-xs font-medium text-white transition-colors" style={{ backgroundColor: verticalColor(ep.vertical) }}>
                            {isAuth ? "Ingresar" : "Ver"}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
