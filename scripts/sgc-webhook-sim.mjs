// Simulador de webhooks del SGC para pruebas locales.
// Firma el cuerpo igual que el SGC: HMAC-SHA256(secreto, "<timestamp>.<cuerpo>").
//
// Uso:
//   node scripts/sgc-webhook-sim.mjs <contractId> <eventType> [finalization]
//
// Ejemplos:
//   node scripts/sgc-webhook-sim.mjs mock-000000000001 workflow.advanced
//   node scripts/sgc-webhook-sim.mjs mock-000000000001 workflow.approved active
//   node scripts/sgc-webhook-sim.mjs mock-000000000001 workflow.returned
//   node scripts/sgc-webhook-sim.mjs mock-000000000001 contract.closed
//
// Variables: SGC_WEBHOOK_SECRET (obligatoria), SGC_WEBHOOK_URL (opcional).

import { createHmac } from "node:crypto";

const [, , contractId, eventType, finalization] = process.argv;

if (!contractId || !eventType) {
  console.error("Uso: node scripts/sgc-webhook-sim.mjs <contractId> <eventType> [finalization]");
  process.exit(1);
}

const secret = process.env.SGC_WEBHOOK_SECRET;
if (!secret) {
  console.error("Falta SGC_WEBHOOK_SECRET en el entorno (.env).");
  process.exit(1);
}

const url = process.env.SGC_WEBHOOK_URL ?? "http://localhost:3001/api/integracion/sgc/webhook";

const payload = {
  apiVersion: "2026-09-01",
  eventId: `sim-${Date.now()}`,
  eventType,
  createdAt: new Date().toISOString(),
  resource: { id: contractId, type: "contract" },
  data: finalization ? { finalization } : {},
};

const body = JSON.stringify(payload);
const timestamp = Math.floor(Date.now() / 1000);
const firma = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

const res = await fetch(url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-sgc-signature": `t=${timestamp},v1=${firma}`,
  },
  body,
});

console.log(`POST ${url}`);
console.log(`eventType=${eventType}${finalization ? ` finalization=${finalization}` : ""}`);
console.log(res.status, await res.text());
