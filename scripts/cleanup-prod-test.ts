/**
 * Limpieza de data de prueba en PRODUCCION (o QA).
 *
 * Borra SOLO la data creada por scripts/seed-prod-test.ts y todo lo que
 * cuelgue de ella (solicitudes, revisiones, facturaciones, expedientes SGC,
 * reservas, alertas, auditoria), en orden de dependencias FK.
 *
 * NO toca: maestra, role, plano, plano_bloque, plano_furniture, plano_seccion,
 * plano_tipo_bloque, ni ninguna tabla maestra o de dependencia.
 *
 * Por defecto hace DRY-RUN (muestra lo que borraria). Para borrar de verdad:
 *   docker exec ctrst-app npx tsx scripts/cleanup-prod-test.ts --yes
 */

import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  TEST_CODIGO_EVENTO,
  TEST_CODIGO_PADRE,
  TEST_TIPO_EVENTO,
  TEST_USER_EMAILS,
  TEST_USER_IDS,
} from "./test-prod-datos";

const YES = process.argv.includes("--yes");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no definida");

const pool = new Pool({ connectionString, max: 1 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface Paso {
  label: string;
  modelo: string;
  where: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function modeloPrisma(nombre: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelo = (prisma as any)[nombre];
  if (!modelo) throw new Error(`Modelo Prisma "${nombre}" no existe`);
  return modelo;
}

async function main() {
  console.log("==============================================================");
  console.log(`  LIMPIEZA DATA DE PRUEBA — ContratosStands ${YES ? "(EJECUCION)" : "(DRY-RUN)"}`);
  console.log(`  Evento: tipoEvento=${TEST_TIPO_EVENTO} codigoEvento=${TEST_CODIGO_EVENTO}`);
  console.log("  Solo borra data colgada del evento TEST. Maestras intactas.");
  console.log("==============================================================\n");

  /* ---------- Resolver evento de prueba ---------- */
  const evento = await prisma.evento.findUnique({
    where: { tipoEvento_codigoEvento: { tipoEvento: TEST_TIPO_EVENTO, codigoEvento: TEST_CODIGO_EVENTO } },
  });

  if (!evento) {
    console.log("No existe el evento de prueba. Verificando restos sueltos...\n");
  }

  /* ---------- Recolectar ids en cascada ---------- */
  const gessIds = evento
    ? (await prisma.gessStand.findMany({ where: { eventoId: evento.id }, select: { id: true } })).map((r) => r.id)
    : [];

  // Solicitudes: directas (1 stand) y multiples (via solicitud_stand).
  const solicitudIdsDirectas = gessIds.length > 0
    ? (await prisma.solicitud.findMany({ where: { gessStandId: { in: gessIds } }, select: { id: true } })).map((r) => r.id)
    : [];
  const solicitudIdsVinculadas = gessIds.length > 0
    ? (await prisma.solicitudStand.findMany({ where: { gessStandId: { in: gessIds } }, select: { solicitudId: true } })).map((r) => r.solicitudId)
    : [];
  const solicitudIds = [...new Set([...solicitudIdsDirectas, ...solicitudIdsVinculadas])];

  const expedientes = solicitudIds.length > 0
    ? await prisma.sgcExpediente.findMany({ where: { solicitudId: { in: solicitudIds } }, select: { id: true, code: true, contractId: true } })
    : [];
  const expedienteIds = expedientes.map((e) => e.id);
  const expedienteCodes = expedientes.map((e) => e.code);
  const contractIds = expedientes.map((e) => e.contractId).filter((c): c is string => Boolean(c));

  const facturacionIds = solicitudIds.length > 0
    ? (await prisma.facturacion.findMany({ where: { solicitudId: { in: solicitudIds } }, select: { id: true } })).map((r) => r.id)
    : [];

  const reservaIds = evento
    ? (await prisma.reserva.findMany({ where: { eventoId: evento.id }, select: { id: true } })).map((r) => r.id)
    : [];

  const standIds = evento
    ? (await prisma.stand.findMany({ where: { eventoId: evento.id }, select: { id: true } })).map((r) => r.id)
    : [];

  const tipoStandIds = evento
    ? (await prisma.tipoStand.findMany({ where: { eventoId: evento.id }, select: { id: true } })).map((r) => r.id)
    : [];

  const padre = evento
    ? await prisma.eventoPadre.findUnique({ where: { id: evento.eventoPadreId } })
    : await prisma.eventoPadre.findUnique({ where: { codigo: TEST_CODIGO_PADRE } });

  /* ---------- Pasos de borrado en orden FK ---------- */
  const pasos: Paso[] = [];

  if (expedienteIds.length > 0) {
    pasos.push({ label: "sgc_documento", modelo: "sgcDocumento", where: { sgcExpedienteId: { in: expedienteIds } } });
  }
  if (expedienteCodes.length > 0 || contractIds.length > 0) {
    const orConds: Record<string, unknown>[] = [];
    if (expedienteCodes.length > 0) orConds.push({ resourceCode: { in: expedienteCodes } });
    if (contractIds.length > 0) orConds.push({ resourceId: { in: contractIds } });
    pasos.push({ label: "sgc_webhook_evento", modelo: "sgcWebhookEvento", where: { OR: orConds } });
  }
  if (solicitudIds.length > 0) {
    pasos.push({ label: "sgc_expediente", modelo: "sgcExpediente", where: { solicitudId: { in: solicitudIds } } });
  }
  if (facturacionIds.length > 0) {
    pasos.push({ label: "facturacion_historial", modelo: "facturacionHistorial", where: { facturacionId: { in: facturacionIds } } });
  }
  if (solicitudIds.length > 0) {
    const alertaOr: Record<string, unknown>[] = [{ solicitudId: { in: solicitudIds } }];
    if (TEST_USER_IDS.length > 0) alertaOr.push({ userId: { in: TEST_USER_IDS } });
    pasos.push(
      { label: "facturacion", modelo: "facturacion", where: { solicitudId: { in: solicitudIds } } },
      { label: "alerta", modelo: "alerta", where: { OR: alertaOr } },
      { label: "solicitud_documento", modelo: "solicitudDocumento", where: { solicitudId: { in: solicitudIds } } },
      { label: "solicitud_stand", modelo: "solicitudStand", where: { solicitudId: { in: solicitudIds } } },
      { label: "revision", modelo: "revision", where: { solicitudId: { in: solicitudIds } } },
      { label: "revision_historial", modelo: "revisionHistorial", where: { solicitudId: { in: solicitudIds } } },
      { label: "reevaluacion", modelo: "reevaluacion", where: { solicitudId: { in: solicitudIds } } },
    );
  }
  if (gessIds.length > 0) {
    pasos.push({ label: "solicitud", modelo: "solicitud", where: { gessStandId: { in: gessIds } } });
  }
  // Solicitudes multi-stand tienen gessStandId null: borrar por id.
  if (solicitudIds.length > 0) {
    pasos.push({ label: "solicitud (multi)", modelo: "solicitud", where: { id: { in: solicitudIds } } });
  }
  if (reservaIds.length > 0) {
    pasos.push(
      { label: "interop_facturacion", modelo: "interopFacturacion", where: { reservaId: { in: reservaIds } } },
      { label: "aprobacion", modelo: "aprobacion", where: { reservaId: { in: reservaIds } } },
      { label: "cuota", modelo: "cuota", where: { reservaId: { in: reservaIds } } },
    );
  }
  if (reservaIds.length > 0 || standIds.length > 0) {
    const orConds: Record<string, unknown>[] = [];
    if (reservaIds.length > 0) orConds.push({ reservaId: { in: reservaIds } });
    if (standIds.length > 0) orConds.push({ standId: { in: standIds } });
    pasos.push({ label: "reserva_stand", modelo: "reservaStand", where: { OR: orConds } });
  }
  if (evento) {
    pasos.push({ label: "reserva", modelo: "reserva", where: { eventoId: evento.id } });
  }
  if (standIds.length > 0) {
    pasos.push({ label: "plano_posicion", modelo: "planoPosicion", where: { standId: { in: standIds } } });
  }
  if (tipoStandIds.length > 0 || evento) {
    const orConds: Record<string, unknown>[] = [];
    if (tipoStandIds.length > 0) orConds.push({ tipoStandId: { in: tipoStandIds } });
    if (evento) orConds.push({ eventoId: evento.id });
    pasos.push({ label: "contrato_plantilla", modelo: "contratoPlantilla", where: { OR: orConds } });
  }
  if (evento) {
    pasos.push({ label: "stand", modelo: "stand", where: { eventoId: evento.id } });
    pasos.push({ label: "tipo_stand", modelo: "tipoStand", where: { eventoId: evento.id } });
    pasos.push({ label: "gess_stand", modelo: "gessStand", where: { eventoId: evento.id } });
    pasos.push({ label: "evento", modelo: "evento", where: { id: evento.id } });
  }
  pasos.push({
    label: "evento_metadata",
    modelo: "eventoMetadata",
    where: { tipoEvento: TEST_TIPO_EVENTO, codigoEvento: TEST_CODIGO_EVENTO },
  });
  if (TEST_USER_IDS.length > 0) {
    const auditoriaOr: Record<string, unknown>[] = [];
    if (TEST_USER_IDS.length > 0) auditoriaOr.push({ actor: { in: TEST_USER_IDS } });
    if (TEST_USER_EMAILS.length > 0) auditoriaOr.push({ actor: { in: TEST_USER_EMAILS } });
    pasos.push(
      { label: "user_role (usuarios test)", modelo: "userRole", where: { userId: { in: TEST_USER_IDS } } },
      { label: "error_log (usuarios test)", modelo: "errorLog", where: { userId: { in: TEST_USER_IDS } } },
      { label: "audit_log (actores test)", modelo: "auditLog", where: { OR: auditoriaOr } },
    );
  }

  /* ---------- Ejecutar (o dry-run) ---------- */
  let total = 0;
  for (const paso of pasos) {
    const modelo = modeloPrisma(paso.modelo);
    if (YES) {
      const res = await modelo.deleteMany({ where: paso.where });
      total += res.count;
      console.log(`  DELETE ${paso.label.padEnd(26)} -> ${res.count}`);
    } else {
      const count = await modelo.count({ where: paso.where });
      total += count;
      console.log(`  [dry]  ${paso.label.padEnd(26)} -> ${count}`);
    }
  }

  /* ---------- Evento padre: solo si quedo sin eventos ---------- */
  if (padre && padre.codigo === TEST_CODIGO_PADRE) {
    const restantes = await prisma.evento.count({ where: { eventoPadreId: padre.id } });
    if (restantes === 0) {
      if (YES) {
        const res = await prisma.eventoPadre.delete({ where: { id: padre.id } });
        total += 1;
        console.log(`  DELETE ${"evento_padre (TEST)".padEnd(26)} -> 1 (${res.codigo})`);
      } else {
        total += 1;
        console.log(`  [dry]  ${"evento_padre (TEST)".padEnd(26)} -> 1`);
      }
    } else {
      console.log(`  SKIP   evento_padre (TEST): aun tiene ${restantes} evento(s) no TEST. No se borra.`);
    }
  }

  console.log("");
  console.log(`  TOTAL: ${total} registro(s) ${YES ? "borrados" : "a borrar"}`);
  if (!YES) {
    console.log("");
    console.log("  DRY-RUN: nada fue borrado.");
    console.log("  Para ejecutar la limpieza real: npx tsx scripts/cleanup-prod-test.ts --yes");
  }
  console.log("==============================================================");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
