import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { USUARIOS_SEED } from "./seed-data";

/**
 * Elimina los usuarios de PRUEBA creados por el seed (no toca roles, maestra,
 * planos ni datos de negocio). Autocontenido (sin `src/`), apto para ECS.
 *
 *   SEED_ALLOW_PROD=1 npx tsx prisma/seed-cleanup.ts     # o npm run db:seed:cleanup
 *
 * IMPORTANTE: borra tambien `admin@iimp.org.pe`. Crea primero tu usuario real
 * (o quitalo de USUARIOS_SEED) antes de ejecutarlo en produccion.
 */

const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? "local";
if (APP_ENV === "production" && process.env.SEED_ALLOW_PROD !== "1") {
  console.log("Cleanup bloqueado: no se ejecuta en produccion sin SEED_ALLOW_PROD=1.");
  process.exit(0);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no definida");

const pool = new Pool({ connectionString, max: 1 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const emails = USUARIOS_SEED.map((u) => u.email);
  const res = await prisma.userRole.deleteMany({
    where: { OR: [{ email: { in: emails } }, { email: { startsWith: "test." } }] },
  });
  console.log(`Eliminados ${res.count} usuario(s) de prueba. Roles/maestra intactos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
