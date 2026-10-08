/**
 * Rehash de contrasenas legacy en texto plano (scrypt).
 *
 * Uso:
 *   npx tsx scripts/rehash-passwords.ts
 *
 * Idempotente: solo toca filas cuyo password NO es un hash scrypt. Corre con la
 * DATABASE_URL del ambiente cargado (.env). Para prod se ejecuta como tarea ECS
 * one-off (mismo patron que las migraciones).
 */
import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { esHash, hashPassword } from "../src/lib/server/utils/password";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no definida");

const pool = new Pool({ connectionString, max: 1 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const usuarios = await prisma.userRole.findMany({ select: { id: true, email: true, password: true } });
  let rehasheados = 0;
  for (const u of usuarios) {
    if (esHash(u.password)) continue;
    await prisma.userRole.update({ where: { id: u.id }, data: { password: hashPassword(u.password) } });
    console.log(`rehash user_role: ${u.email}`);
    rehasheados++;
  }

  const pendientes = await prisma.registroPendiente.findMany({ select: { id: true, email: true, password: true } });
  let pendientesRehash = 0;
  for (const p of pendientes) {
    if (esHash(p.password)) continue;
    await prisma.registroPendiente.update({ where: { id: p.id }, data: { password: hashPassword(p.password) } });
    console.log(`rehash registro_pendiente: ${p.email}`);
    pendientesRehash++;
  }

  console.log(`Listo. user_role: ${rehasheados} de ${usuarios.length}; registro_pendiente: ${pendientesRehash} de ${pendientes.length}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
