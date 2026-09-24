"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@nrivera-iimp/ui-kit-iimp";
import { authService } from "@/lib/client/api/services/auth-service";
import { eventosServiceClient } from "@/lib/client/api/services/eventos-service";
import { ROLES, LS_KEYS } from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import type { EventoPadrePresalaDTO } from "@/types/dto/models";

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

  const handleSelect = async (eventoId: string) => {
    if (!isAuth) {
      localStorage.setItem(LS_KEYS.EVENTO_PENDIENTE, eventoId);
      router.push("/auth/login");
      return;
    }
    try {
      await authService.seleccionarEvento({ eventoId });
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
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">{ep.nombre.charAt(0)}</span>
                    <span>{ep.nombre}</span>
                    <Badge variant="outline" className="ml-1 text-[10px]"><span>{ep.vertical}</span></Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {ep.versiones.map((ver) => (
                      <Button
                        key={ver.id}
                        type="button"
                        variant="outline"
                        onClick={() => handleSelect(ver.id)}
                        className="h-auto w-full flex-col items-start gap-1 rounded-lg border-border bg-card p-4 text-left font-normal whitespace-normal transition-all hover:border-primary/40 hover:bg-card hover:shadow-md"
                      >
                        <span className="text-sm font-semibold">{ep.nombre} {ver.anio}</span>
                        {(ver.fecha_inicio || ver.fecha_fin) && (
                          <span className="text-xs text-muted-foreground">{dateUtils.format(ver.fecha_inicio)} — {dateUtils.format(ver.fecha_fin)}</span>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <Badge
                            className={
                              ver.estado === "active"
                                ? "pointer-events-none border-transparent bg-success/10 text-success"
                                : "pointer-events-none border-transparent bg-muted text-muted-foreground"
                            }
                          >
                            <span>{ver.estado === "active" ? "Vigente" : ver.estado}</span>
                          </Badge>
                          <span className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground transition-colors">
                            {isAuth ? "Ingresar" : "Ver"}
                          </span>
                        </div>
                      </Button>
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
