import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no definida");

const pool = new Pool({ connectionString, max: 1 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function upsertEventoPadre(codigo: string, vertical: string, nombre: string) {
  const exist = await prisma.eventoPadre.findUnique({ where: { codigo } });
  if (exist) return exist;
  return prisma.eventoPadre.create({ data: { codigo, vertical, nombre } });
}

async function upsertEvento(params: {
  eventoPadreId: string;
  tipoEvento: number;
  codigoEvento: number;
  anio: string;
  estado: string;
  flgActivo: boolean;
  fechaInicio?: Date;
  fechaFin?: Date;
}) {
  const exist = await prisma.evento.findFirst({
    where: { eventoPadreId: params.eventoPadreId, anio: params.anio },
  });
  if (exist) {
    return prisma.evento.update({
      where: { id: exist.id },
      data: { estado: params.estado, flgActivo: params.flgActivo, fechaInicio: params.fechaInicio ?? null, fechaFin: params.fechaFin ?? null },
    });
  }
  return prisma.evento.create({ data: params });
}

async function upsertTipoStand(eventoId: string, nombre: string, medidas: string, montoBase: number, moneda: string) {
  const exist = await prisma.tipoStand.findFirst({ where: { eventoId, nombre } });
  if (exist) return exist;
  return prisma.tipoStand.create({ data: { eventoId, nombre, medidas, montoBase, moneda } });
}

async function main() {
  /* ---------- Eventos Padre ---------- */
  const perumin = await upsertEventoPadre("PERUMIN", "perumin", "PERUMIN");
  const proexplo = await upsertEventoPadre("PROEXPLO", "proexplo", "ProExplo");
  const wmc = await upsertEventoPadre("WMC", "wmc", "WMC");
  const gess = await upsertEventoPadre("GESS", "gess", "GESS");

  /* ---------- Eventos (versiones) ---------- */
  const jul = new Date("2026-07-01");
  const dic = new Date("2026-12-31");

  const evPerumin = await upsertEvento({ eventoPadreId: perumin.id, tipoEvento: 14, codigoEvento: 1, anio: "2025", estado: "closed", flgActivo: false, fechaInicio: new Date("2025-09-22"), fechaFin: new Date("2025-09-26") });
  await upsertEvento({ eventoPadreId: perumin.id, tipoEvento: 14, codigoEvento: 2, anio: "2026", estado: "active", flgActivo: true, fechaInicio: jul, fechaFin: dic });
  await upsertEvento({ eventoPadreId: proexplo.id, tipoEvento: 5, codigoEvento: 1, anio: "2026", estado: "active", flgActivo: true, fechaInicio: jul, fechaFin: dic });
  await upsertEvento({ eventoPadreId: wmc.id, tipoEvento: 7, codigoEvento: 1, anio: "2026", estado: "active", flgActivo: true, fechaInicio: jul, fechaFin: dic });
  await upsertEvento({ eventoPadreId: gess.id, tipoEvento: 3, codigoEvento: 1, anio: "2026", estado: "active", flgActivo: true, fechaInicio: jul, fechaFin: dic });

  /* ---------- Tipos de Stand ---------- */
  const tipos = [
    { nombre: "Estándar", medidas: "3x3 m", montoBase: 5000, moneda: "USD" },
    { nombre: "Isla", medidas: "6x6 m", montoBase: 12000, moneda: "USD" },
    { nombre: "Preferencial", medidas: "4x4 m", montoBase: 8000, moneda: "USD" },
    { nombre: "Esquina", medidas: "3x3 m", montoBase: 6500, moneda: "USD" },
  ];
  for (const t of tipos) {
    await upsertTipoStand(evPerumin.id, t.nombre, t.medidas, t.montoBase, t.moneda);
  }

  /* ---------- Roles ---------- */
  const roles = [
    { nombre: "admin", descripcion: "Administrador del sistema", permisos: ["admin:full", "events:create", "events:edit", "events:toggle", "read:reservas", "write:reservas", "approve:all"] },
    { nombre: "logistica", descripcion: "Area de Logistica", permisos: ["read:reservas", "approve:logistica"] },
    { nombre: "legal", descripcion: "Area Legal", permisos: ["read:reservas", "approve:legal"] },
    { nombre: "comunicacion", descripcion: "Area de Comunicacion", permisos: ["read:reservas", "approve:comunicacion"] },
  ];
  for (const r of roles) {
    await prisma.role.upsert({ where: { nombre: r.nombre }, update: { descripcion: r.descripcion, permisos: r.permisos }, create: r });
  }

  /* ---------- Usuarios de prueba ---------- */
  const testUsers = [
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
