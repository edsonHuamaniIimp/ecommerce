import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { AprobacionesSection } from "@/components/dashboard/aprobaciones-section";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function DashboardPage() {
  const session = await getSession();
  let eventoId = "";
  let eventoNombre = "";

  if (session?.eventoId) {
    const evento = await prisma.evento.findUnique({
      where: { id: session.eventoId },
      include: { eventoPadre: { select: { nombre: true } } },
    });
    if (evento) {
      eventoId = evento.id;
      eventoNombre = `${evento.eventoPadre.nombre} ${evento.anio}`;
    }
  }

  if (!eventoId) {
    return (
      <DashboardContent
        reservas={[]}
        stats={{ totalStands: "0", reservados: "0", disponibles: "0", montoTotal: "USD 0", procesoCount: "0" }}
        eventoNombre="Selecciona un evento en la presala"
      />
    );
  }

  const [stands] = await Promise.all([
    prisma.gessStand.findMany({ where: { eventoId }, orderBy: { standCode: "asc" } }),
  ]);

  const totalStands = stands.length;
  const reservados = stands.filter((s) => s.estado === "Reservado").length;
  const disponibles = totalStands - reservados;

  const montoTotalStands = stands
    .filter((s) => s.estado === "Reservado")
    .reduce((acc, s) => {
      const montoStr = s.medidas?.replace("US$", "").trim() ?? "0";
      return acc + parseFloat(montoStr) || 0;
    }, 0);

  const stats = {
    totalStands: String(totalStands),
    reservados: String(reservados),
    disponibles: String(disponibles),
    montoTotal: `USD ${montoTotalStands.toLocaleString("en-US")}`,
    procesoCount: String(reservados),
  };

  return (
    <>
      <DashboardContent
        reservas={[]}
        stats={stats}
        eventoNombre={eventoNombre}
      />
      <div className="px-6 pb-10 lg:px-10">
        <AprobacionesSection reservas={[]} />
      </div>
    </>
  );
}
