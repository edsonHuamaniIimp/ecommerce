"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, CardContent, Input, Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { CalendarDays, ChevronRight, Search, ShieldCheck } from "lucide-react";
import { authService } from "@/lib/client/api/services/auth-service";
import { eventosServiceClient } from "@/lib/client/api/services/eventos-service";
import { perfilService } from "@/lib/client/api/services/perfil-service";
import { PortalFooter } from "@/components/layout/portal-stands";
import { PresalaHeader, PresalaAyudaCard } from "@/components/layout/presala-header";
import { ESTADOS_EVENTO, FILTROS_EVENTO, LS_KEYS, REVISION_AREA_LABELS, REVISION_AREA_ORDER, ROLES } from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { estadoEventoBadge } from "@/lib/shared/utils/estado-evento";
import { eventoUtils } from "@/lib/shared/utils/evento";
import type { FiltroEvento } from "@/lib/shared/constants";
import type { EventoPadrePresalaDTO, EventoPresalaDTO } from "@/types/dto/models";

type VersionItem = EventoPresalaDTO;
interface EventoItem extends Omit<EventoPadrePresalaDTO, "versiones"> { versiones: VersionItem[] }

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
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span>Portal del Expositor</span>
            </span>
            <span>/</span>
            <span className="text-foreground">Convocatorias</span>
          </div>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-primary">Selecciona tu evento</h1>
              <p className="mt-1 text-sm text-muted-foreground md:text-base">
                Elige el evento y su version para ver el plano de stands y reservar.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2 shadow-sm">
              <div className="border-r border-border px-3 py-1 text-center">
                <p className="text-xs font-medium text-muted-foreground">Eventos</p>
                <p className="text-lg font-bold text-primary">{eventos.length}</p>
              </div>
              <div className="px-3 py-1 text-center">
                <p className="text-xs font-medium text-muted-foreground">Versiones vigentes</p>
                <p className="text-lg font-bold text-gold">{totalVigentes}</p>
              </div>
            </div>
          </div>
        </div>

        <section className="mb-8 flex flex-col items-center justify-between gap-4 rounded-xl border border-border bg-card p-3 shadow-sm md:flex-row md:p-4">
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

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-8">
            {loading ? (
              <>
                <Skeleton className="h-44 w-full rounded-xl" />
                <Skeleton className="h-44 w-full rounded-xl" />
              </>
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
              catalogo.map((ep) => {
                const tieneVigente = ep.versiones.some((v) => v.estado === ESTADOS_EVENTO.ACTIVE);
                return (
                  <article
                    key={ep.id}
                    className={`overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 ${
                      tieneVigente ? "border-primary/25 hover:border-primary" : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <div className="p-6">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-base font-black tracking-wider text-primary-foreground shadow-sm">
                            {eventoUtils.sigla(ep.nombre)}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="text-xl font-bold tracking-tight text-primary">{ep.nombre}</h2>
                              {tieneVigente && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
                                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                                  <span>Vigente</span>
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-medium text-muted-foreground">
                              {ep.versiones.length} {ep.versiones.length === 1 ? "version disponible" : "versiones disponibles"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {ep.versiones.map((ver) => {
                          const estado = estadoEventoBadge(ver.estado);
                          return (
                            <Button
                              key={ver.id}
                              type="button"
                              variant="outline"
                              disabled={selecting === ver.id}
                              onClick={() => handleSelect(ver.id, `${ep.nombre} ${ver.anio}`, ver.tipoEvento, ver.codigoEvento, ep.nombre)}
                              className="h-auto w-full flex-col items-start gap-2 rounded-lg border-border bg-card p-4 text-left font-normal whitespace-normal transition-all hover:border-primary/40 hover:bg-card hover:shadow-md active:bg-secondary disabled:opacity-60"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-foreground">{ep.nombre} {ver.anio}</span>
                                <Badge className={`pointer-events-none ${estado.clase}`}>
                                  <span>{estado.texto}</span>
                                </Badge>
                              </div>
                              {(ver.fecha_inicio || ver.fecha_fin) && (
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  {dateUtils.format(ver.fecha_inicio)} — {dateUtils.format(ver.fecha_fin)}
                                </span>
                              )}
                              <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-primary">
                                {selecting === ver.id ? "Ingresando..." : "Ingresar al plano"}
                                <ChevronRight className="h-3.5 w-3.5" />
                              </span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <aside className="flex flex-col gap-6 lg:col-span-4">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold tracking-wider text-primary uppercase">
                <ShieldCheck className="h-4 w-4 text-gold" />
                <span>Protocolo de reserva</span>
              </h3>
              <ul className="space-y-3 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  <span>
                    <strong className="text-foreground">Revision por areas:</strong>{" "}
                    {REVISION_AREA_ORDER.map((area) => REVISION_AREA_LABELS[area]).join(" y ")} revisan tu
                    documentacion antes de aprobar la solicitud.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  <span>
                    <strong className="text-foreground">Contrato por SGC:</strong> la revision legal del contrato
                    se gestiona a traves del Sistema de Gestion de Contratos.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  <span>
                    <strong className="text-foreground">Documentos:</strong> adjunta los documentos del contrato
                    desde <em>Mis solicitudes</em> para continuar con el flujo.
                  </span>
                </li>
              </ul>
            </div>

            <PresalaAyudaCard />
          </aside>
        </div>
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
