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
    update: {},
    create: { id: "ev-perumin38", eventoPadreId: perumin.id, tipoEvento: 14, codigoEvento: 1, anio: "2026", estado: "active" },
  });
  await prisma.evento.upsert({
    where: { id: "ev-proexplo2026" },
    update: {},
    create: { id: "ev-proexplo2026", eventoPadreId: proexplo.id, tipoEvento: 5, codigoEvento: 1, anio: "2026", estado: "active" },
  });
  await prisma.evento.upsert({
    where: { id: "ev-wmc2026" },
    update: {},
    create: { id: "ev-wmc2026", eventoPadreId: wmc.id, tipoEvento: 7, codigoEvento: 1, anio: "2026", estado: "active" },
  });
  await prisma.evento.upsert({
    where: { id: "ev-gess2026" },
    update: {},
    create: { id: "ev-gess2026", eventoPadreId: gess.id, tipoEvento: 3, codigoEvento: 1, anio: "2026", estado: "active" },
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

  console.log("Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
