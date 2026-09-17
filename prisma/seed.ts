import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { TIPOLOGIAS_STAND, TIPOS_PLANO } from "../src/lib/shared/constants";

const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? "local";
if (APP_ENV === "production") {
  console.log("Seed bloqueado: no se ejecuta en produccion.");
  process.exit(0);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no definida");

const pool = new Pool({ connectionString, max: 1 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  /* ---------- Roles ---------- */
  const roles = [
    { nombre: "admin", descripcion: "Administrador del sistema", permisos: ["admin:full", "dashboard:view", "eventos:datos", "stands:vinculacion", "stands:manage", "stands:plano", "auspicios:view", "facturacion:view", "laboratorio:view", "laboratorio:manage", "roles:manage", "events:manage", "events:create", "events:edit", "events:toggle", "read:reservas", "write:reservas", "approve:all", "solicitudes:view", "solicitudes:review:comunicacion", "solicitudes:review:legal", "solicitudes:review:logistica", "solicitudes:notify", "solicitudes:upload"] },
    { nombre: "logistica", descripcion: "Area de Logistica", permisos: ["dashboard:view", "eventos:datos", "stands:manage", "stands:plano", "auspicios:view", "read:reservas", "approve:logistica", "solicitudes:view", "solicitudes:review:logistica"] },
    { nombre: "legal", descripcion: "Area Legal", permisos: ["dashboard:view", "eventos:datos", "stands:plano", "auspicios:view", "read:reservas", "approve:legal", "solicitudes:view", "solicitudes:review:legal"] },
    { nombre: "comunicacion", descripcion: "Area de Comunicacion", permisos: ["dashboard:view", "eventos:datos", "stands:plano", "auspicios:view", "read:reservas", "approve:comunicacion", "solicitudes:view", "solicitudes:review:comunicacion"] },
    { nombre: "cliente", descripcion: "Cliente expositor", permisos: ["eventos:datos", "solicitudes:view", "stands:plano", "read:reservas", "write:reservas"] },
  ];
  for (const r of roles) {
    await prisma.role.upsert({ where: { nombre: r.nombre }, update: { descripcion: r.descripcion, permisos: r.permisos }, create: r });
  }

  /* ---------- Usuarios de prueba ---------- */
  const testUsers = [
    { email: "admin@iimp.org.pe", role: "admin", password: "admin123", nombre: "Admin", apellidos: "IIMP" },
    { email: "logistica@iimp.org.pe", role: "logistica", password: "logistica123", nombre: "Carlos", apellidos: "Logistica" },
    { email: "legal@iimp.org.pe", role: "legal", password: "legal123", nombre: "Maria", apellidos: "Legal" },
    { email: "comunicacion@iimp.org.pe", role: "comunicacion", password: "comunicacion123", nombre: "Pedro", apellidos: "Comunicacion" },
    { email: "cliente@iimp.org.pe", role: "cliente", password: "cliente123", nombre: "Cliente", apellidos: "General" },
    { email: "ext_analistaprogramador3@iimp.org.pe", role: "admin", password: "admin123", nombre: "Edson", apellidos: "Huamani" },
  ];
  for (const tu of testUsers) {
    const role = await prisma.role.findUnique({ where: { nombre: tu.role } });
    if (!role) continue;
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: `user|${tu.email}`, roleId: role.id } },
      update: { password: tu.password, tipoUsuarioId: 2, nombre: tu.nombre, apellidos: tu.apellidos },
      create: { userId: `user|${tu.email}`, email: tu.email, roleId: role.id, password: tu.password, tipoUsuarioId: 2, nombre: tu.nombre, apellidos: tu.apellidos },
    });
  }

  console.log("Seed completado.");
}

// Seed maestra datos
async function seedMaestra() {
  // Upsert: intenta update; si no existe, crea
  const padres = [
    { id: 1, tabla: "comprobante_tipo", nombre: "Tipos de comprobante", orden: 1 },
    { id: 2, tabla: "documento_tipo", nombre: "Tipos de documento", orden: 2 },
    { id: 3, tabla: "usuario_tipo", nombre: "Tipos de usuario", orden: 3 },
    { id: 4, tabla: "stand_estado", nombre: "Estados de stand", orden: 4 },
    { id: 5, tabla: "solicitud_estado", nombre: "Estados de solicitud", orden: 5 },
    { id: 6, tabla: "revision_estado", nombre: "Estados de revision", orden: 6 },
    { id: 7, tabla: "reevaluacion_estado", nombre: "Estados de re-evaluacion", orden: 7 },
    { id: 8, tabla: "facturacion_estado", nombre: "Estados de facturacion", orden: 8 },
    { id: 9, tabla: "facturacion_tipo", nombre: "Tipos de facturacion", orden: 9 },
    { id: 10, tabla: "cuota_estado", nombre: "Estados de cuota", orden: 10 },
    { id: 11, tabla: "stand_tipologia", nombre: "Tipologias de stand", orden: 11 },
  ];
  for (const p of padres) {
    const updated = await prisma.maestra.updateMany({
      where: { id: p.id },
      data: { nombre: p.nombre, numOrden: p.orden },
    });
    if (updated.count === 0) {
      await prisma.maestra.create({ data: { id: p.id, nidMaestraPadre: 0, tabla: p.tabla, nombre: p.nombre, numOrden: p.orden } });
    }
  }

  const hijos = [
    { id: 10, padre: 1, itemId: 1, nombre: "Factura", descripcion: "Comprobante fiscal", orden: 1 },
    { id: 11, padre: 1, itemId: 2, nombre: "Boleta", descripcion: "Comprobante consumidor final", orden: 2 },
    { id: 20, padre: 2, itemId: 1, nombre: "DNI", descripcion: "Documento Nacional de Identidad", orden: 1 },
    { id: 21, padre: 2, itemId: 2, nombre: "RUC", descripcion: "Registro Unico de Contribuyentes", orden: 2 },
    { id: 30, padre: 3, itemId: 1, nombre: "Asociado", descripcion: "Miembro del IIMP", orden: 1 },
    { id: 31, padre: 3, itemId: 2, nombre: "Cliente", descripcion: "Expositor o empresa externa", orden: 2 },
    { id: 40, padre: 4, itemId: 1, nombre: "Disponible", descripcion: "Stand disponible", orden: 1 },
    { id: 41, padre: 4, itemId: 2, nombre: "En evaluacion", descripcion: "Solicitud en aprobacion", orden: 2 },
    { id: 42, padre: 4, itemId: 3, nombre: "Reservado", descripcion: "Stand reservado", orden: 3 },
    { id: 50, padre: 5, itemId: 1, nombre: "Pendiente", descripcion: "Sin respuesta de las areas", orden: 1 },
    { id: 51, padre: 5, itemId: 2, nombre: "En proceso", descripcion: "Al menos un area ha respondido", orden: 2 },
    { id: 52, padre: 5, itemId: 3, nombre: "Aprobado", descripcion: "Todas las areas aprobaron", orden: 3 },
    { id: 53, padre: 5, itemId: 4, nombre: "Rechazado", descripcion: "Al menos un area rechazo", orden: 4 },
    { id: 54, padre: 5, itemId: 5, nombre: "Pendiente Pago", descripcion: "Aprobado, esperando pago", orden: 5 },
    { id: 55, padre: 5, itemId: 6, nombre: "Pagado", descripcion: "Pago completado", orden: 6 },
    { id: 60, padre: 6, itemId: 1, nombre: "Pendiente", descripcion: "Revision pendiente", orden: 1 },
    { id: 61, padre: 6, itemId: 2, nombre: "Aprobado", descripcion: "Revision aprobada", orden: 2 },
    { id: 62, padre: 6, itemId: 3, nombre: "Rechazado", descripcion: "Revision rechazada", orden: 3 },
    { id: 70, padre: 7, itemId: 1, nombre: "Pendiente", descripcion: "Re-evaluacion pendiente", orden: 1 },
    { id: 71, padre: 7, itemId: 2, nombre: "Aprobado", descripcion: "Re-evaluacion aprobada", orden: 2 },
    { id: 72, padre: 7, itemId: 3, nombre: "Rechazado", descripcion: "Re-evaluacion rechazada", orden: 3 },
    // facturacion_estado
    { id: 80, padre: 8, itemId: 1, nombre: "Pendiente", descripcion: "Facturacion pendiente de pago", orden: 1 },
    { id: 81, padre: 8, itemId: 2, nombre: "Pagado", descripcion: "Facturacion pagada", orden: 2 },
    { id: 82, padre: 8, itemId: 3, nombre: "Cancelado", descripcion: "Facturacion cancelada", orden: 3 },
    { id: 83, padre: 8, itemId: 4, nombre: "Archivado", descripcion: "Facturacion archivada", orden: 4 },
    // facturacion_tipo
    { id: 90, padre: 9, itemId: 1, nombre: "Manual", descripcion: "Pago manual registrado por admin", orden: 1 },
    { id: 91, padre: 9, itemId: 2, nombre: "Niubizz", descripcion: "Pago via pasarela Niubizz", orden: 2 },
    // cuota_estado
    { id: 100, padre: 10, itemId: 1, nombre: "Pendiente", descripcion: "Cuota pendiente de pago", orden: 1 },
    { id: 101, padre: 10, itemId: 2, nombre: "Pagado", descripcion: "Cuota pagada", orden: 2 },
    { id: 102, padre: 10, itemId: 3, nombre: "Vencido", descripcion: "Cuota vencida", orden: 3 },
    // stand_tipologia
    { id: 110, padre: 11, itemId: 1, nombre: "Complejo", descripcion: "2 niveles o >2.5m de altura", orden: 1 },
    { id: 111, padre: 11, itemId: 2, nombre: "Simple", descripcion: "1 nivel", orden: 2 },
    { id: 112, padre: 11, itemId: 3, nombre: "Octanorm simple", descripcion: "Solo viniles", orden: 3 },
  ];
  for (const h of hijos) {
    const padre = padres.find((p) => p.id === h.padre);
    if (!padre) continue;
    const updated = await prisma.maestra.updateMany({
      where: { id: h.id },
      data: { nombre: h.nombre, itemId: h.itemId, numOrden: h.orden },
    });
    if (updated.count === 0) {
      await prisma.maestra.create({ data: { id: h.id, nidMaestraPadre: h.padre, tabla: padre.tabla, itemId: h.itemId, nombre: h.nombre, descripcion: h.descripcion, numOrden: h.orden } });
    }
  }
  console.log("Maestra seeded");
}

/* ---------- Plano GESS → BD (Laboratorio 3D) ---------- */
async function seedPlanoGess() {
  const { buildItems, buildFurniture } = await import("../src/lib/shared/planos/gess/construccion");
  const { DIMENSIONES, BLOCK_LABEL } = await import("../src/lib/shared/planos/gess/tipos");

  const plano = await prisma.plano.upsert({
    where: { codigo: "gess" },
    update: { nombre: "GESS", descripcion: "Plano isometrico del evento GESS — 52 bloques con kioskos rusticos y plaza central" },
    create: {
      codigo: "gess",
      nombre: "GESS",
      descripcion: "Plano isometrico del evento GESS — 52 bloques con kioskos rusticos y plaza central",
    },
  });

  // Tipos de bloque
  const tipoMap = new Map<string, string>();
  // Alias explicito: la clave de DIMENSIONES ("S_vert") no coincide con el BlockType ("S")
  const TIPO_ALIAS: Record<string, string> = { S_vert: "S" };
  for (const [codigo, dim] of Object.entries(DIMENSIONES)) {
    const blockType = TIPO_ALIAS[codigo] ?? codigo;
    const label = BLOCK_LABEL[blockType as keyof typeof BLOCK_LABEL];
    const tipo = await prisma.planoTipoBloque.upsert({
      where: { planoId_codigo: { planoId: plano.id, codigo: blockType } },
      update: { w: dim.w, d: dim.d, h: dim.h, color: dim.color, label: label?.label ?? blockType, nombre: label?.nombre ?? blockType },
      create: {
        planoId: plano.id,
        codigo: blockType,
        label: label?.label ?? blockType,
        nombre: label?.nombre ?? blockType,
        w: dim.w, d: dim.d, h: dim.h, color: dim.color,
      },
    });
    tipoMap.set(codigo, tipo.id);
  }

  // Bloques
  const items = buildItems();
  await prisma.planoBloque.deleteMany({ where: { planoId: plano.id } });
  for (const [i, item] of items.entries()) {
    const dimCodigo = Object.entries(DIMENSIONES).find(([, d]) => d === item.dim)?.[0];
    const tipoId = dimCodigo ? tipoMap.get(dimCodigo) : undefined;
    await prisma.planoBloque.create({
      data: {
        planoId: plano.id,
        tipoId: tipoId ?? null,
        bloqueId: item.id,
        tipoCodigo: item.type,
        tipologia: TIPOLOGIAS_STAND.SIMPLE,
        x: item.x,
        z: item.z,
        rotY: 0,
        orden: i,
      },
    });
  }

  // Furniture
  const furniture = buildFurniture();
  await prisma.planoFurniture.deleteMany({ where: { planoId: plano.id } });
  for (const f of furniture) {
    await prisma.planoFurniture.create({
      data: { planoId: plano.id, refId: f.id, tipo: f.type, x: f.x, z: f.z, rotY: f.rotY },
    });
  }

  console.log(`Plano GESS seeded: ${items.length} bloques, ${furniture.length} furniture`);
}

/* ---------- Plano MACRO PERUMIN (pabellones) ---------- */
async function seedPlanoMacroPerumin() {
  await prisma.plano.upsert({
    where: { codigo: "perumin" },
    update: { tipo: TIPOS_PLANO.MACRO, imagenFondo: "/uploads/perumin-mapa-pabellones.jpg" },
    create: {
      codigo: "perumin",
      nombre: "PERUMIN",
      descripcion: "Mapa de pabellones PERUMIN — vista macro con secciones navegables a planos 3D",
      tipo: TIPOS_PLANO.MACRO,
      imagenFondo: "/uploads/perumin-mapa-pabellones.jpg",
    },
  });
  console.log("Plano macro PERUMIN seeded (imagen pabellones)");
}

main()
  .then(() => seedMaestra())
  .then(() => seedPlanoGess())
  .then(() => seedPlanoMacroPerumin())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
