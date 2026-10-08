"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@nrivera-iimp/ui-kit-iimp";
import { ArrowRight, Building2, CheckCircle, ClipboardList, Map, Wallet } from "lucide-react";
import { StatsCard } from "./stats-card";
import { PaginaDashboard } from "./pagina-dashboard";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { EstadoSolicitudBadge } from "@/components/solicitudes/estado-solicitud-badge";
import { solicitudesService } from "@/lib/client/api/services/solicitudes-service";
import { pagosService, type PagoRowDTO } from "@/lib/client/api/services/pagos-service";
import { perfilService } from "@/lib/client/api/services/perfil-service";
import { dateUtils } from "@/lib/shared/utils/date";
import { numberUtils } from "@/lib/shared/utils/number";
import { ESTADOS_CUOTA, ESTADOS_SOLICITUD, MONEDAS } from "@/lib/shared/constants";
import type { SessionDTO } from "@/types/dto/auth/session.dto";
import type { SolicitudDTO } from "@/types/dto/solicitudes/solicitudes-response.dto";

const RESERVAS_RECIENTES = 5;

const ESTADOS_EN_EVALUACION: string[] = [ESTADOS_SOLICITUD.PENDIENTE, ESTADOS_SOLICITUD.EN_PROCESO];
const ESTADOS_APROBADOS: string[] = [ESTADOS_SOLICITUD.APROBADO, ESTADOS_SOLICITUD.PAGADO];

interface Props {
  session: SessionDTO | null;
  cargando: boolean;
}

/** Panel del Portal del Cliente: resumen de sus reservas, pagos y accesos del evento activo. */
export function ClienteDashboardContent({ session, cargando }: Props) {
  const eventoId = session?.eventoId ?? "";
  const userId = session?.userId ?? "";
  const [solicitudes, setSolicitudes] = useState<{ items: SolicitudDTO[]; total: number } | null>(null);
  const [pagos, setPagos] = useState<PagoRowDTO[] | null>(null);
  const [perfil, setPerfil] = useState<{ saludo: string; empresa: string | null } | null>(null);

  useEffect(() => {
    if (!eventoId || !userId) return;
    let activo = true;
    solicitudesService
      .listar(eventoId, 1, 100, undefined, userId)
      .then((r) => { if (activo) setSolicitudes({ items: r.data ?? [], total: r.total ?? 0 }); })
      .catch(() => { if (activo) setSolicitudes({ items: [], total: 0 }); });
    pagosService
      .listar({ page: 1, per_page: 100 })
      .then((r) => { if (activo) setPagos(r.data ?? []); })
      .catch(() => { if (activo) setPagos([]); });
    perfilService
      .get()
      .then((p) => {
        if (!activo) return;
        const nombre = [p?.nombre, p?.apellidos].filter(Boolean).join(" ").trim();
        setPerfil({ saludo: nombre || p?.email || (session?.email ?? ""), empresa: p?.nombreEmpresa ?? null });
      })
      .catch(() => { if (activo) setPerfil({ saludo: session?.email ?? "", empresa: null }); });
    return () => { activo = false; };
  }, [eventoId, userId, session?.email]);

  const resumen = useMemo(() => {
    const items = solicitudes?.items ?? [];
    const cuotas = (pagos ?? []).flatMap((p) => p.cuotas);
    const porPagar = cuotas.filter((c) => c.estado !== ESTADOS_CUOTA.PAGADO);
    return {
      totalReservas: solicitudes?.total ?? 0,
      enEvaluacion: items.filter((s) => ESTADOS_EN_EVALUACION.includes(s.estadoSolicitud)).length,
      aprobadas: items.filter((s) => ESTADOS_APROBADOS.includes(s.estadoSolicitud)).length,
      cuotas: porPagar.length,
      montoPorPagar: porPagar.reduce((acc, c) => acc + (c.monto ?? 0), 0),
      recientes: items.slice(0, RESERVAS_RECIENTES),
    };
  }, [solicitudes, pagos]);

  const cargandoData = solicitudes === null || pagos === null;

  return (
    <PaginaDashboard
      titulo="Mi Panel"
      descripcion={`Hola${perfil?.saludo ? `, ${perfil.saludo}` : ""}. Resumen de tus reservas y pagos del evento activo.`}
      cargando={cargando}
      tieneEvento={Boolean(eventoId)}
      accion={
        <Button asChild variant="outline" className="gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
          <Link href="/mapa">
            <Map className="h-4 w-4" />
            <span>Nueva reserva en el plano</span>
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">
        {cargandoData ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border pb-4">
                <Skeleton className="h-5 w-48" />
              </CardHeader>
              <CardContent className="p-6">
                <TableSkeleton rows={5} columns={4} />
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatsCard
                title="Mis reservas"
                value={resumen.totalReservas}
                icon={<ClipboardList className="h-4 w-4" />}
                chip={{ texto: `${resumen.enEvaluacion} en evaluacion`, variante: "primary" }}
              />
              <StatsCard
                title="Aprobadas"
                value={resumen.aprobadas}
                icon={<CheckCircle className="h-4 w-4" />}
                chip={{ texto: "En firme", variante: "muted" }}
              />
              <StatsCard
                title="Cuotas por pagar"
                value={resumen.cuotas}
                icon={<Wallet className="h-4 w-4" />}
                footer={{ texto: "Monto pendiente", destacado: numberUtils.monto(resumen.montoPorPagar, MONEDAS.US_DOLAR) }}
              />
              <StatsCard
                title="Mi empresa"
                value={perfil?.empresa ?? "Sin empresa"}
                icon={<Building2 className="h-4 w-4" />}
                chip={{ texto: perfil?.empresa ? "Vinculada" : "Vincula en tu perfil", variante: "muted" }}
              />
            </div>

            <Card className="overflow-hidden">
              <CardHeader className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle><span className="text-base font-bold text-primary">Tus reservas recientes</span></CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">Sigue el estado de tus solicitudes y completa lo pendiente.</p>
                </div>
                <Button asChild variant="ghost" size="sm" className="w-fit shrink-0 gap-1 text-xs text-primary">
                  <Link href="/dashboard/mis-solicitudes">
                    <span>Ver todas</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {resumen.recientes.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                    <p className="text-sm text-muted-foreground"><span>Aun no tienes reservas en este evento.</span></p>
                    <Button asChild size="sm" className="gap-2">
                      <Link href="/mapa">
                        <Map className="h-3.5 w-3.5" />
                        <span>Reservar en el plano</span>
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead><span className="text-[10px] uppercase">Stand</span></TableHead>
                          <TableHead><span className="text-[10px] uppercase">Estado</span></TableHead>
                          <TableHead className="hidden sm:table-cell"><span className="text-[10px] uppercase">Tipo</span></TableHead>
                          <TableHead className="hidden md:table-cell"><span className="text-[10px] uppercase">Actualizado</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resumen.recientes.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-mono text-xs whitespace-nowrap">{s.standCode}</TableCell>
                            <TableCell><EstadoSolicitudBadge estado={s.estadoSolicitud} /></TableCell>
                            <TableCell className="hidden max-w-[180px] truncate text-xs sm:table-cell">{s.tipoStand ?? "-"}</TableCell>
                            <TableCell className="hidden text-xs whitespace-nowrap text-muted-foreground md:table-cell">{dateUtils.format(s.updatedAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PaginaDashboard>
  );
}
