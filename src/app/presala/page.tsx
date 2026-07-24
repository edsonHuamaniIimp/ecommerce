"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@nrivera-iimp/ui-kit-iimp";
import { authService } from "@/lib/api/services/auth-service";
import { eventosServiceClient } from "@/lib/api/services/eventos-service";
import { ROLES } from "@/lib/constants";
import Link from "next/link";
import type { EventoPadrePresalaDTO, EventoPresalaDTO } from "@/types/dto/models";

interface VersionItem extends EventoPresalaDTO {}
interface EventoItem extends Omit<EventoPadrePresalaDTO, "versiones"> { versiones: VersionItem[] }

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PresalaPage() {
  const router = useRouter();
  const [eventos, setEventos] = useState<EventoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [json, session] = await Promise.all([
          eventosServiceClient.listPresala(),
          authService.getSession(),
        ]);
        setEventos(json as EventoItem[]);
        setIsAdmin(session.roles?.includes(ROLES.ADMIN) ?? false);
        if (session.authenticated && session.eventoId) {
          router.replace("/dashboard");
          return;
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSelect = async (eventoId: string, vertical: string) => {
    setSelecting(eventoId);
    try {
      await authService.seleccionarEvento({ eventoId });
      localStorage.setItem("iimp-vertical", vertical);
      document.documentElement.classList.forEach((c) => {
        if (c.startsWith("vert-")) document.documentElement.classList.remove(c);
      });
      document.documentElement.classList.add(`vert-${vertical}`);
      document.documentElement.setAttribute("data-vertical", vertical);
      router.push("/dashboard");
    } catch {
      // ignore
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
            {eventos.map((ep) => (
              <Card key={ep.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">{ep.nombre.charAt(0)}</span>
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
                        onClick={() => handleSelect(ver.id, ep.vertical)}
                        className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 text-left transition-all hover:border-primary hover:shadow-md active:bg-slate-50"
                      >
                        <span className="text-sm font-semibold text-slate-800">{ep.nombre} {ver.anio}</span>
                        {(ver.fecha_inicio || ver.fecha_fin) && (
                          <span className="text-xs text-muted-foreground">
                            {formatDate(ver.fecha_inicio)} — {formatDate(ver.fecha_fin)}
                          </span>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <Badge variant={ver.estado === "active" ? "default" : "secondary"} className="text-[10px]">
                            <span>{ver.estado === "active" ? "Vigente" : ver.estado}</span>
                          </Badge>
                          <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={selecting === ver.id} asChild>
                            <span>{selecting === ver.id ? "..." : "Ingresar"}</span>
                          </Button>
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
