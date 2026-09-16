import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "postgresql://ctrst:ctrst_dev@localhost:5433/contratos_stands",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const stands = await prisma.gessStand.findMany({
    where: { empresa: { contains: "TELEFONICA" } },
    select: { standCode: true, empresa: true, rawData: true },
  });
  console.log("STANDS TELEFONICA:", stands.length);
  for (const s of stands.slice(0, 5)) {
    console.log(s.standCode, "|", s.empresa, "| rawData keys:", s.rawData ? Object.keys(s.rawData as object).join(",") : "null");
  }

  const reservas = await prisma.reserva.findMany({
    select: { empresaRef: true },
    take: 10,
  });
  console.log("RESERVAS empresaRef:", reservas.map(r => r.empresaRef));

  const users = await prisma.userRole.findMany({
    where: { idEmpresa: { not: null } },
    select: { userId: true, idEmpresa: true, nombreEmpresa: true },
  });
  console.log("USERS CON EMPRESA:", users);
  process.exit(0);
}

main();
