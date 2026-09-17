/**
 * Seed de data de prueba para PRODUCCION (o QA).
 *
 * Crea UNICAMENTE data aislada bajo marcadores "TEST-":
 *   - EventoPadre codigo "TEST"
 *   - Evento tipoEvento=999 / codigoEvento=999
 *   - Stands y GessStands con numero/standCode "TEST-01".."TEST-05"
 *   - Usuarios test.{cliente|logistica|comunicacion|admin}@iimp.org.pe
 *     vinculados a roles EXISTENTES (nunca se crean roles).
 *
 * Compatible con el flujo SGC:
 *   - GessStand.empresa y standCode alimentan el expediente del SGC
 *     (counterpartyLegalName y code al aprobar Comunicacion).
 *   - El flujo crea 2 revisiones (logistica + comunicacion); Legal se delega
 *     al SGC. Por eso se siembran usuarios con esos roles.
 *   - Requiere las tablas SGC (migracion 0003) y SGC_ENABLED=1 en .env.prod.
 *
 * NO toca tablas maestras ni de dependencia: maestra, role, plano, plano_bloque,
 * plano_furniture, plano_seccion, plano_tipo_bloque.
 *
 * Uso (dentro del contenedor):
 *   docker exec ctrst-app npx tsx scripts/seed-prod-test.ts
 *
 * Limpieza:
 *   docker exec ctrst-app npx tsx scripts/cleanup-prod-test.ts --yes
 */

import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { ESTADOS_EVENTO, ESTADOS_STAND, VERTICALES } from "../src/lib/shared/constants";
import {
  STAND_PREFIX,
  TEST_ANIO,
  TEST_CODIGO_EVENTO,
  TEST_CODIGO_PADRE,
  TEST_EMPRESA,
  TEST_STAND_COUNT,
  TEST_TIPO_EVENTO,
  TEST_USERS,
} from "./test-prod-datos";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no definida");

const pool = new Pool({ connectionString, max: 1 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function numeroStand(i: number): string {
  return `${STAND_PREFIX}${String(i).padStart(2, "0")}`;
}

async function main() {
  console.log("==============================================================");
  console.log("  SEED DATA DE PRUEBA — ContratosStands");
  console.log(`  APP_ENV: ${process.env.NEXT_PUBLIC_APP_ENV ?? "(no definido)"}`);
  console.log("  Solo crea data con marcadores TEST-. Maestras intactas.");
  console.log("==============================================================\n");

  /* ---------- 1. EventoPadre ---------- */
  const padre = await prisma.eventoPadre.upsert({
    where: { codigo: TEST_CODIGO_PADRE },
    update: { nombre: "Evento de Pruebas", vertical: VERTICALES.GESS },
    create: {
      codigo: TEST_CODIGO_PADRE,
      vertical: VERTICALES.GESS,
      nombre: "Evento de Pruebas",
    },
  });
  console.log(`[1/7] EventoPadre: codigo=${padre.codigo} id=${padre.id}`);

  /* ---------- 2. Evento ---------- */
  const evento = await prisma.evento.upsert({
    where: { tipoEvento_codigoEvento: { tipoEvento: TEST_TIPO_EVENTO, codigoEvento: TEST_CODIGO_EVENTO } },
    update: { estado: ESTADOS_EVENTO.ACTIVE, flgActivo: true, flgVisible: true },
    create: {
      eventoPadreId: padre.id,
      tipoEvento: TEST_TIPO_EVENTO,
      codigoEvento: TEST_CODIGO_EVENTO,
      anio: TEST_ANIO,
      estado: ESTADOS_EVENTO.ACTIVE,
      plano: "gess",
      planoRef: "TEST",
    },
  });
  console.log(`[2/7] Evento: tipo=${TEST_TIPO_EVENTO} codigo=${TEST_CODIGO_EVENTO} id=${evento.id}`);

  /* ---------- 3. EventoMetadata ---------- */
  const metadata = await prisma.eventoMetadata.upsert({
    where: { tipoEvento_codigoEvento: { tipoEvento: TEST_TIPO_EVENTO, codigoEvento: TEST_CODIGO_EVENTO } },
    update: { plano: "gess", flgVisible: true },
    create: { tipoEvento: TEST_TIPO_EVENTO, codigoEvento: TEST_CODIGO_EVENTO, plano: "gess", flgVisible: true },
  });
  console.log(`[3/7] EventoMetadata: tipo=${metadata.tipoEvento} codigo=${metadata.codigoEvento}`);

  /* ---------- 4. TipoStand ---------- */
  let tipoStand = await prisma.tipoStand.findFirst({
    where: { eventoId: evento.id, nombre: "TEST Estandar" },
  });
  if (!tipoStand) {
    tipoStand = await prisma.tipoStand.create({
      data: { eventoId: evento.id, nombre: "TEST Estandar", medidas: "3x3", montoBase: 100, moneda: "USD" },
    });
  }
  console.log(`[4/7] TipoStand: id=${tipoStand.id}`);

  /* ---------- 5. Stands + PlanoPosicion ---------- */
  await prisma.planoPosicion.deleteMany({ where: { stand: { eventoId: evento.id, numero: { startsWith: STAND_PREFIX } } } });
  await prisma.stand.deleteMany({ where: { eventoId: evento.id, numero: { startsWith: STAND_PREFIX } } });

  for (let i = 1; i <= TEST_STAND_COUNT; i++) {
    const stand = await prisma.stand.create({
      data: {
        eventoId: evento.id,
        tipoStandId: tipoStand.id,
        numero: numeroStand(i),
        monto: 100,
        moneda: "USD",
        estado: ESTADOS_STAND.DISPONIBLE,
        posicion: { create: { x: i, y: i } },
      },
    });
    console.log(`       stand ${stand.numero} creado (id=${stand.id})`);
  }
  console.log(`[5/7] Stands: ${TEST_STAND_COUNT} creados`);

  /* ---------- 6. GessStand (aparecen en el plano 3D por bloqueId) ---------- */
  const clienteTest = TEST_USERS.find((u) => u.rol === "cliente") ?? TEST_USERS[0];
  const clienteUserId = `user|${clienteTest.email}`;

  const bloquesLibres = await prisma.planoBloque.findMany({
    where: { plano: { codigo: "gess" }, flgActivo: true },
    orderBy: { orden: "asc" },
    select: { bloqueId: true },
  });
  const bloqueUsados = (
    await prisma.gessStand.findMany({ where: { bloqueId: { not: null } }, select: { bloqueId: true } })
  ).map((g) => g.bloqueId);
  const bloqueDisponibles = bloquesLibres.filter((b) => !bloqueUsados.includes(b.bloqueId)).map((b) => b.bloqueId);

  if (bloqueDisponibles.length === 0) {
    console.warn("⚠️   No hay bloques libres en el plano 'gess'. Los GessStands quedaran sin bloqueId.");
    console.warn("    Ejecuta la vinculacion manual o sincroniza planos antes de usar el 3D.");
  }

  for (let i = 1; i <= TEST_STAND_COUNT; i++) {
    const codigo = numeroStand(i);
    const bloqueId = bloqueDisponibles[i - 1] ?? null;
    await prisma.gessStand.upsert({
      where: { eventoId_standCode: { eventoId: evento.id, standCode: codigo } },
      update: { bloqueId, estado: ESTADOS_STAND.DISPONIBLE, empresa: TEST_EMPRESA, email: clienteTest.email, userId: clienteUserId, documentos: [], imagenes: [] },
      create: {
        eventoId: evento.id,
        standApiId: codigo,
        standCode: codigo,
        tipoStand: "ESTANDAR_02",
        medidas: "3x3",
        estado: ESTADOS_STAND.DISPONIBLE,
        empresa: TEST_EMPRESA,
        pabellon: "TEST",
        ubicacion: "TEST",
        bloqueId,
        email: clienteTest.email,
        userId: clienteUserId,
        documentos: [],
        imagenes: [],
      },
    });
    console.log(`       gessStand ${codigo} vinculado a bloque ${bloqueId ?? "(sin bloque)"}`);
  }
  console.log(`[6/7] GessStand: ${TEST_STAND_COUNT} listos`);

  /* ---------- 7. Usuarios de prueba (roles existentes, no se crean) ---------- */
  for (const u of TEST_USERS) {
    const rol = await prisma.role.findUnique({ where: { nombre: u.rol } });
    if (!rol) {
      console.warn(`⚠️   Rol "${u.rol}" no existe. No se creo el usuario ${u.email} (no tocar maestras).`);
      continue;
    }
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: `user|${u.email}`, roleId: rol.id } },
      update: { password: u.password, nombre: "Test", apellidos: u.rol, nombreEmpresa: TEST_EMPRESA, tipoUsuarioId: 2 },
      create: {
        userId: `user|${u.email}`,
        roleId: rol.id,
        email: u.email,
        password: u.password,
        nombre: "Test",
        apellidos: u.rol,
        nombreEmpresa: TEST_EMPRESA,
        tipoUsuarioId: 2,
      },
    });
    console.log(`       usuario ${u.email} (rol ${u.rol})`);
  }
  console.log(`[7/7] Usuarios: ${TEST_USERS.length} (password test123)`);

  console.log("\n==============================================================");
  console.log("  RESUMEN — FLUJO SGC");
  console.log("--------------------------------------------------------------");
  console.log(`  Evento:       tipoEvento=${TEST_TIPO_EVENTO} codigoEvento=${TEST_CODIGO_EVENTO}`);
  console.log(`  Stands:       ${STAND_PREFIX}01..${STAND_PREFIX}0${TEST_STAND_COUNT} (estado disponible)`);
  console.log("");
  console.log("  Prerequisitos SGC en .env.prod:");
  console.log("    SGC_ENABLED=1        (disparo al aprobar Comunicacion)");
  console.log("    SGC_MODE=mock        (cliente actual: SgcClientMock)");
  console.log("    SGC_AREA_CODE=       p.ej. EVENTOS");
  console.log("    SGC_CONTRACT_TYPE_CODE= p.ej. AUSPICIO");
  console.log("  Requiere migracion 0003 (tablas sgc_*) aplicada.");
  console.log("");
  console.log("  FLUJO DE PRUEBA:");
  console.log(`    1. Login ${clienteTest.email} → selecciona evento TEST → plano`);
  console.log(`    2. Reserva stand ${STAND_PREFIX}01 (crea Solicitud + 2 revisiones)`);
  console.log(`    3. Login ${TEST_USERS.find(u => u.rol === "logistica")?.email} → revisa (aprobado)`);
  console.log(`    4. Login ${TEST_USERS.find(u => u.rol === "comunicacion")?.email} → revisa (aprobado)`);
  console.log("       → dispara el expediente al SGC (SgcExpediente creado)");
  console.log("    5. Panel SGC en detalle de solicitud → detalle/reconciliar");
  console.log("");
  console.log("  LIMPIEZA:");
  console.log("  docker exec ctrst-app npx tsx scripts/cleanup-prod-test.ts --yes");
  console.log("==============================================================");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
