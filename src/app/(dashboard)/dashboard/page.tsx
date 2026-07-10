import { eventosService, planoService, reservasService } from "@/lib/api/services/facade";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { ESTADOS_STAND, ESTADOS_RESERVA } from "@/lib/constants";

export default async function DashboardPage() {
  const [contexto, stands, reservas] = await Promise.all([
    eventosService.getEventoActual(),
    planoService.getPlano("ev-perumin38"),
    reservasService.list("ev-perumin38"),
  ]);
  const eventos = await eventosService.listEventos(contexto.evento.eventoPadreId);

  const reservados = stands.filter((s) => s.estado === ESTADOS_STAND.RESERVADO).length;
  const disponibles = stands.filter((s) => s.estado === ESTADOS_STAND.DISPONIBLE).length;
  const enEvaluacion = stands.filter((s) => s.estado === ESTADOS_STAND.EN_EVALUACION).length;
  const montoActivo = reservas
    .filter((r) => r.estado === ESTADOS_RESERVA.FACTURADA || r.estado === ESTADOS_RESERVA.EN_APROBACION)
    .reduce((s, r) => s + r.montoTotal, 0);

  const stats = {
    totalStands: String(stands.length),
    reservados: String(reservados),
    disponibles: String(disponibles),
    montoTotal: `USD ${montoActivo.toLocaleString("en-US")}`,
    procesoCount: String(reservados + enEvaluacion),
  };

  return (
    <DashboardContent
      reservas={reservas}
      eventos={eventos}
      eventoActual={contexto.evento}
      stats={stats}
    />
  );
}
