import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { AprobacionesSection } from "@/components/dashboard/aprobaciones-section";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  const eventoId = session?.eventoId ?? "";

  if (!eventoId) {
    return (
      <DashboardContent
        reservas={[]}
        stats={{ totalStands: "0", reservados: "0", disponibles: "0", montoTotal: "USD 0", procesoCount: "0" }}
      />
    );
  }

  const [stands] = await Promise.all([
    prisma.gessStand.findMany({ where: { eventoId }, orderBy: { standCode: "asc" } }),
  ]);

  const totalStands = stands.length;
  const reservados = stands.filter((s) => s.estado === "Reservado").length;
  const enProceso = stands.filter((s) => s.estado === "en_evaluacion" || s.estado === "En evaluacion").length;
  const disponibles = totalStands - reservados - enProceso;

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
