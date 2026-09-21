import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { ROLES_SEED, USUARIOS_SEED } from "./seed-data";

/**
 * Seed minimo (solo roles + usuarios de prueba). NO importa de `src/`, por lo que
 * puede ejecutarse dentro de la imagen ECS standalone via ECS Exec:
 *   SEED_ALLOW_PROD=1 npx tsx prisma/seed-auth.ts
 */

const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? "local";
if (APP_ENV === "production" && process.env.SEED_ALLOW_PROD !== "1") {
  console.log("Seed bloqueado: no se ejecuta en produccion.");
  console.log("Si es intencional, usar SEED_ALLOW_PROD=1.");
  process.exit(0);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no definida");

const pool = new Pool({ connectionString, max: 1 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  for (const r of ROLES_SEED) {
    await prisma.role.upsert({
      where: { nombre: r.nombre },
      update: { descripcion: r.descripcion, permisos: r.permisos },
      create: r,
    });
  }

  for (const tu of USUARIOS_SEED) {
    const role = await prisma.role.findUnique({ where: { nombre: tu.role } });
    if (!role) continue;
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: `user|${tu.email}`, roleId: role.id } },
      update: { password: tu.password, tipoUsuarioId: 2, nombre: tu.nombre, apellidos: tu.apellidos },
      create: { userId: `user|${tu.email}`, email: tu.email, roleId: role.id, password: tu.password, tipoUsuarioId: 2, nombre: tu.nombre, apellidos: tu.apellidos },
    });
  }

  console.log("Seed auth completado (roles + usuarios).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
