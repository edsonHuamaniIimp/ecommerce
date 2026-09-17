import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { AprobacionesSection } from "@/components/dashboard/aprobaciones-section";
import { getSession } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { ESTADOS_STAND, ESTADOS_STAND_LEGACY, MONEDAS } from "@/lib/shared/constants";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  const eventoId = session?.eventoId ?? "";

  if (!eventoId) {
    return (
      <DashboardContent
        reservas={[]}
        stats={{ totalStands: "0", reservados: "0", disponibles: "0", montoTotal: `${MONEDAS.USD} 0`, procesoCount: "0" }}
      />
    );
  }

  const [stands] = await Promise.all([
    prisma.gessStand.findMany({ where: { eventoId }, orderBy: { standCode: "asc" } }),
  ]);

  const totalStands = stands.length;
  const reservados = stands.filter((s) => s.estado === ESTADOS_STAND_LEGACY.RESERVADO).length;
  const enProceso = stands.filter((s) => s.estado === ESTADOS_STAND.EN_EVALUACION || s.estado === ESTADOS_STAND_LEGACY.EN_EVALUACION).length;
  const disponibles = totalStands - reservados - enProceso;

  const montoTotalStands = stands
    .filter((s) => s.estado === ESTADOS_STAND_LEGACY.RESERVADO)
    .reduce((acc, s) => {
      const montoStr = s.medidas?.replace(MONEDAS.US_DOLAR, "").trim() ?? "0";
      return acc + parseFloat(montoStr) || 0;
    }, 0);

  const stats = {
    totalStands: String(totalStands),
    reservados: String(reservados),
    disponibles: String(disponibles),
    montoTotal: `${MONEDAS.USD} ${montoTotalStands.toLocaleString("en-US")}`,
    procesoCount: String(enProceso),
  };

  return (
    <>
      <DashboardContent
        reservas={[]}
        stats={stats}
      />
      <div className="pb-10">
        <AprobacionesSection reservas={[]} />
      </div>
    </>
  );
}
