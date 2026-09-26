"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, CardContent, Input, Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { CalendarDays, ChevronRight, Search } from "lucide-react";
import { authService } from "@/lib/client/api/services/auth-service";
import { eventosServiceClient } from "@/lib/client/api/services/eventos-service";
import { perfilService } from "@/lib/client/api/services/perfil-service";
import { PortalFooter } from "@/components/layout/portal-stands";
import { PresalaHeader } from "@/components/layout/presala-header";
import { ESTADOS_EVENTO, FILTROS_EVENTO, LS_KEYS, ROLES } from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { estadoEventoBadge } from "@/lib/shared/utils/estado-evento";
import { eventoUtils } from "@/lib/shared/utils/evento";
import type { FiltroEvento } from "@/lib/shared/constants";
import type { EventoPadrePresalaDTO, EventoPresalaDTO } from "@/types/dto/models";

type VersionItem = EventoPresalaDTO;
interface EventoItem extends Omit<EventoPadrePresalaDTO, "versiones"> { versiones: VersionItem[] }

/** Color de acento por vertical del evento padre. */
const VERTICAL_COLORS: Record<string, string> = {
  perumin: "#b45309",
  proexplo: "#d97706",
  wmc: "#0891b2",
  gess: "#16a34a",
  "difusion-minera": "#7c3aed",
  eventos: "#0ea5e9",
};

function PresalaPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routerRef = useRef(router);
  const searchParamsRef = useRef(searchParams);
  const [eventos, setEventos] = useState<EventoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const [nombreUsuario, setNombreUsuario] = useState<string | null>(null);
  const [empresa, setEmpresa] = useState<string | null>(null);
  const [codigoEmpresa, setCodigoEmpresa] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<FiltroEvento>(FILTROS_EVENTO.TODOS);

  useEffect(() => {
    const router = routerRef.current;
    const searchParams = searchParamsRef.current;
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

        if (session.authenticated) {
          await perfilService
            .get()
            .then((perfil) => {
              const nombreCompleto = [perfil.nombre, perfil.apellidos].filter(Boolean).join(" ").trim();
              setNombreUsuario(nombreCompleto || perfil.email || session.email || null);
              setEmpresa(perfil.nombreEmpresa ?? null);
              setCodigoEmpresa(perfil.idEmpresa ?? null);
            })
            .catch(() => setNombreUsuario(session.email ?? null));
        }

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

  const handleSelect = async (eventoId: string, nombre: string, tipoEvento?: number, codigoEventoNum?: number, eventoPadreNombre?: string) => {
    const returnTo = searchParams.get("returnTo");

    if (!isAuth) {
      localStorage.setItem(LS_KEYS.EVENTO_PUBLICO, JSON.stringify({ eventoId, nombre, tipoEvento, codigoEvento: codigoEventoNum }));
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
      await authService.seleccionarEvento({ eventoId, tipoEvento, codigoEvento: codigoEventoNum, eventoNombre: nombre, eventoPadreNombre });
      router.push(returnTo && returnTo !== "/presala" ? returnTo : "/dashboard");
    } catch (err) {
      console.error("[presala] Error al seleccionar evento:", err);
    } finally {
      setSelecting(null);
    }
  };

  const textoBusqueda = busqueda.trim().toLowerCase();
  const catalogo = eventos
    .map((ep) => ({
      ...ep,
      versiones: ep.versiones.filter((ver) => {
        const coincideFiltro =
          filtro === FILTROS_EVENTO.TODOS ||
          (filtro === FILTROS_EVENTO.VIGENTES ? ver.estado === ESTADOS_EVENTO.ACTIVE : ver.estado !== ESTADOS_EVENTO.ACTIVE);
        const coincideBusqueda =
          !textoBusqueda ||
          ep.nombre.toLowerCase().includes(textoBusqueda) ||
          ep.vertical.toLowerCase().includes(textoBusqueda) ||
          ver.anio.toLowerCase().includes(textoBusqueda);
        return coincideFiltro && coincideBusqueda;
      }),
    }))
    .filter((ep) => ep.versiones.length > 0);

  const totalVersiones = eventos.reduce((n, ep) => n + ep.versiones.length, 0);
  const totalVigentes = eventos.reduce(
    (n, ep) => n + ep.versiones.filter((v) => v.estado === ESTADOS_EVENTO.ACTIVE).length,
    0,
  );

  const tabs = [
    { id: FILTROS_EVENTO.TODOS, etiqueta: `Todos (${totalVersiones})` },
    { id: FILTROS_EVENTO.VIGENTES, etiqueta: `Vigentes (${totalVigentes})` },
    { id: FILTROS_EVENTO.OTRAS, etiqueta: `Otras (${totalVersiones - totalVigentes})` },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PresalaHeader
        autenticado={isAuth}
        nombreUsuario={nombreUsuario}
        empresa={empresa}
        codigoEmpresa={codigoEmpresa}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <section className="relative mb-8 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-gold/10 p-6 shadow-sm sm:p-10">
          <div
            className="pointer-events-none absolute inset-0 text-primary opacity-[0.07]"
            style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "22px 22px" }}
            aria-hidden
          />
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" aria-hidden />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              <span>Portal del Expositor</span>
            </span>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-primary sm:text-5xl">
              Selecciona tu evento
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Elige la version vigente para explorar el plano de stands y enviar tu solicitud de reserva.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-2xl border border-border bg-card/70 px-5 py-3 backdrop-blur-sm">
                <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Eventos</p>
                <p className="text-2xl font-black text-primary">{eventos.length}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card/70 px-5 py-3 backdrop-blur-sm">
                <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Versiones vigentes</p>
                <p className="text-2xl font-black text-gold">{totalVigentes}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-border bg-card/80 p-3 shadow-sm backdrop-blur-sm md:flex-row">
          <div className="relative w-full md:w-96">
            <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar evento, vertical o version..."
              className="h-auto border-border bg-secondary py-2 pr-4 pl-10 text-sm placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
          <div className="flex w-full items-center gap-1.5 overflow-x-auto pb-1 md:w-auto md:pb-0">
            <span className="mr-2 hidden text-xs font-medium text-muted-foreground lg:inline-block">Estado:</span>
            {tabs.map((t) => (
              <Button
                key={t.id}
                type="button"
                size="sm"
                variant={filtro === t.id ? "default" : "ghost"}
                onClick={() => setFiltro(t.id)}
                className={`h-auto rounded-lg px-3.5 py-1.5 text-xs whitespace-nowrap ${
                  filtro === t.id ? "font-semibold shadow-sm" : "font-medium text-muted-foreground"
                }`}
              >
                <span>{t.etiqueta}</span>
              </Button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-56 w-full rounded-2xl" />)}
          </div>
        ) : catalogo.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              {eventos.length === 0 ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {isAdmin
                      ? "No hay eventos vigentes. Crea uno para comenzar."
                      : "No hay eventos vigentes. Contacta al administrador."}
                  </p>
                  {isAdmin && (
                    <Button asChild>
                      <Link href="/dashboard/eventos"><span>Ir a Gestion de Eventos</span></Link>
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No hay eventos que coincidan con tu busqueda.</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {catalogo.map((ep) => {
              const vColor = VERTICAL_COLORS[ep.vertical] ?? "#6b7280";
              const tieneVigente = ep.versiones.some((v) => v.estado === ESTADOS_EVENTO.ACTIVE);
              return (
                <article
                  key={ep.id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                >
                  <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: vColor }} />
                  <div className="flex items-center gap-3 p-5 pb-3">
                    <span
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-black tracking-wider text-white shadow-sm"
                      style={{ backgroundColor: vColor }}
                    >
                      {eventoUtils.sigla(ep.nombre)}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-bold tracking-tight text-foreground">{ep.nombre}</h2>
                      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <span>{ep.versiones.length} {ep.versiones.length === 1 ? "version" : "versiones"}</span>
                        {tieneVigente && (
                          <span className="inline-flex items-center gap-1 text-success">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                            <span>Vigente</span>
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
                    {ep.versiones.map((ver) => {
                      const estado = estadoEventoBadge(ver.estado);
                      return (
                        <Button
                          key={ver.id}
                          type="button"
                          variant="outline"
                          disabled={selecting === ver.id}
                          onClick={() => handleSelect(ver.id, `${ep.nombre} ${ver.anio}`, ver.tipoEvento, ver.codigoEvento, ep.nombre)}
                          className="h-auto w-full items-center justify-between gap-3 rounded-xl border-border bg-secondary/40 p-3 text-left font-normal whitespace-normal transition-all hover:border-primary/40 hover:bg-secondary disabled:opacity-60"
                        >
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate text-sm font-semibold text-foreground">{ep.nombre} {ver.anio}</span>
                            {(ver.fecha_inicio || ver.fecha_fin) && (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <CalendarDays className="h-3 w-3" />
                                {dateUtils.format(ver.fecha_inicio)} — {dateUtils.format(ver.fecha_fin)}
                              </span>
                            )}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <Badge className={`pointer-events-none ${estado.clase}`}>
                              <span>{estado.texto}</span>
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <PortalFooter />
    </div>
  );
}

export default function PresalaPage() {
  return (
    <Suspense fallback={null}>
      <PresalaPageContent />
    </Suspense>
  );
}
