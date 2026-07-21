import "dotenv/config";

import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no definida");

const pool = new Pool({ connectionString, max: 1 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  /* ---------- Eventos Padre ---------- */
  const perumin = await prisma.eventoPadre.upsert({
    where: { codigo: "PERUMIN" },
    update: {},
    create: { codigo: "PERUMIN", vertical: "perumin", nombre: "PERUMIN" },
  });
  const proexplo = await prisma.eventoPadre.upsert({
    where: { codigo: "PROEXPLO" },
    update: {},
    create: { codigo: "PROEXPLO", vertical: "proexplo", nombre: "ProExplo" },
  });
  const wmc = await prisma.eventoPadre.upsert({
    where: { codigo: "WMC" },
    update: {},
    create: { codigo: "WMC", vertical: "wmc", nombre: "WMC" },
  });
  const gess = await prisma.eventoPadre.upsert({
    where: { codigo: "GESS" },
    update: {},
    create: { codigo: "GESS", vertical: "gess", nombre: "GESS" },
  });

  /* ---------- Eventos ---------- */
  const evPerumin = await prisma.evento.upsert({
    where: { id: "ev-perumin38" },
    update: { estado: "closed", fechaInicio: new Date("2025-09-22"), fechaFin: new Date("2025-09-26") },
    create: { id: "ev-perumin38", eventoPadreId: perumin.id, tipoEvento: 14, codigoEvento: 1, anio: "2025", estado: "closed", fechaInicio: new Date("2025-09-22"), fechaFin: new Date("2025-09-26") },
  });
  await prisma.evento.upsert({
    where: { id: "ev-perumin39" },
    update: {},
    create: { id: "ev-perumin39", eventoPadreId: perumin.id, tipoEvento: 14, codigoEvento: 2, anio: "2026", estado: "active", fechaInicio: new Date("2026-09-21"), fechaFin: new Date("2026-09-25") },
  });
  await prisma.evento.upsert({
    where: { id: "ev-proexplo2026" },
    update: {},
    create: { id: "ev-proexplo2026", eventoPadreId: proexplo.id, tipoEvento: 5, codigoEvento: 1, anio: "2026", estado: "active", fechaInicio: new Date("2026-05-11"), fechaFin: new Date("2026-05-14") },
  });
  await prisma.evento.upsert({
    where: { id: "ev-wmc2026" },
    update: {},
    create: { id: "ev-wmc2026", eventoPadreId: wmc.id, tipoEvento: 7, codigoEvento: 1, anio: "2026", estado: "active", fechaInicio: new Date("2026-10-05"), fechaFin: new Date("2026-10-08") },
  });
  await prisma.evento.upsert({
    where: { id: "ev-gess2026" },
    update: {},
    create: { id: "ev-gess2026", eventoPadreId: gess.id, tipoEvento: 3, codigoEvento: 1, anio: "2026", estado: "active", fechaInicio: new Date("2026-06-15"), fechaFin: new Date("2026-06-17") },
  });

  /* ---------- Tipos de Stand ---------- */
  const tipos = [
    { nombre: "Estándar", medidas: "3x3 m", montoBase: 5000, moneda: "USD" },
    { nombre: "Isla", medidas: "6x6 m", montoBase: 12000, moneda: "USD" },
    { nombre: "Preferencial", medidas: "4x4 m", montoBase: 8000, moneda: "USD" },
    { nombre: "Esquina", medidas: "3x3 m", montoBase: 6500, moneda: "USD" },
  ] as const;

  for (const t of tipos) {
    await prisma.tipoStand.upsert({
      where: { id: `ts-${t.nombre.toLowerCase()}` },
      update: {},
      create: { id: `ts-${t.nombre.toLowerCase()}`, eventoId: evPerumin.id, ...t },
    });
  }

  /* ---------- Roles ---------- */
  const roles = [
    { nombre: "admin", descripcion: "Administrador del sistema", permisos: ["admin:full", "read:reservas", "write:reservas", "approve:all"] },
    { nombre: "logistica", descripcion: "Area de Logistica", permisos: ["read:reservas", "approve:logistica"] },
    { nombre: "legal", descripcion: "Area Legal", permisos: ["read:reservas", "approve:legal"] },
    { nombre: "comunicacion", descripcion: "Area de Comunicacion", permisos: ["read:reservas", "approve:comunicacion"] },
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { nombre: r.nombre },
      update: { descripcion: r.descripcion, permisos: r.permisos },
      create: r,
    });
  }

  /* ---------- Usuarios de prueba ---------- */
  const testUsers: { email: string; role: string }[] = [
    { email: "admin@iimp.org.pe", role: "admin" },
    { email: "logistica@iimp.org.pe", role: "logistica" },
    { email: "legal@iimp.org.pe", role: "legal" },
    { email: "comunicacion@iimp.org.pe", role: "comunicacion" },
  ];

  for (const tu of testUsers) {
    const role = await prisma.role.findUnique({ where: { nombre: tu.role } });
    if (!role) continue;
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: `user|${tu.email}`, roleId: role.id } },
      update: {},
      create: { userId: `user|${tu.email}`, email: tu.email, roleId: role.id },
    });
  }

  console.log("Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
