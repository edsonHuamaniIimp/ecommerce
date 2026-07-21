import { eventosService, planoService, reservasService } from "@/lib/api/services/facade";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { AprobacionesSection } from "@/components/dashboard/aprobaciones-section";
import { ESTADOS_STAND, ESTADOS_RESERVA } from "@/lib/constants";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function DashboardPage() {
  const session = await getSession();
  let eventoId = "ev-perumin39";
  let eventoPadreNombre = "PERUMIN";
  let eventoAnio = "2026";

  if (session?.eventoId) {
    const evento = await prisma.evento.findUnique({
      where: { id: session.eventoId },
      include: { eventoPadre: { select: { nombre: true } } },
    });
    if (evento) {
      eventoId = evento.id;
      eventoPadreNombre = evento.eventoPadre.nombre;
      eventoAnio = evento.anio;
    }
  }

  const [contexto, stands, reservas] = await Promise.all([
    eventosService.getEventoActual(),
    planoService.getPlano(eventoId),
    reservasService.list(eventoId),
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
    <>
      <DashboardContent
        reservas={reservas}
        eventos={eventos}
        eventoActual={contexto.evento}
        stats={stats}
        eventoNombre={`${eventoPadreNombre} ${eventoAnio}`}
      />
      <div className="px-6 pb-10 lg:px-10">
        <AprobacionesSection reservas={reservas} />
      </div>
    </>
  );
}
