#!/usr/bin/env node
/**
 * Auditoría de un plan de Terraform contra las reglas de despliegue (R3 y R6)
 * ==========================================================================
 *
 * Verifica, sobre un plan ya generado, que:
 *   R3 — todo recurso con soporte de tags lleva las 5 etiquetas obligatorias
 *        (project | environment | component | managed-by | cost-center) y que
 *        `component` usa SOLO el vocabulario permitido
 *        (network | database | storage | secrets | app).
 *   R6 — el diff no destruye ni reemplaza nada (y si lo hace, lo lista).
 *
 * Uso:
 *   cd terraform
 *   terraform plan -out=tfplan
 *   terraform show -json tfplan > plan.json
 *   node ../scripts/audit-terraform-plan.mjs plan.json
 *
 * El hashtag del proyecto es `project=contratos-stands`. NUNCA se opera sobre
 * recursos de otro proyecto (p. ej. montaje-integral).
 */

import { readFileSync } from "node:fs";

const FILE = process.argv[2] ?? "plan.json";
const PROJECT = "contratos-stands";
const ALLOWED_COMPONENTS = ["network", "database", "storage", "secrets", "app"];
const REQUIRED_TAGS = ["project", "environment", "component", "managed-by", "cost-center"];

/* ── Lectura tolerante a BOM (PowerShell `>` escribe UTF-16) ──────────────── */
function readJson(file) {
  const buf = readFileSync(file);
  let text;
  if (buf[0] === 0xff && buf[1] === 0xfe) text = buf.slice(2).toString("utf16le");
  else if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) text = buf.slice(3).toString("utf8");
  else text = buf.toString("utf8");
  return JSON.parse(text);
}

const plan = readJson(FILE);
const changes = plan.resource_changes ?? [];

const creates = changes.filter((r) => r.change.actions.includes("create"));
const updates = changes.filter((r) => r.change.actions.includes("update"));
const destroys = changes.filter(
  (r) => r.change.actions.includes("delete") || r.change.actions.includes("replace"),
);

const hasTags = (r) =>
  r.change.after && typeof r.change.after.tags === "object" && r.change.after.tags !== null;

const taggable = [...creates, ...updates].filter(hasTags);
const untaggable = [...creates, ...updates].filter((r) => !hasTags(r));

/* ── R3 ──────────────────────────────────────────────────────────────────── */
const missing = [];
const wrongProject = [];
const badComponent = [];
const components = {};

for (const r of taggable) {
  const t = r.change.after.tags;
  const faltan = REQUIRED_TAGS.filter((k) => !t[k]);
  if (faltan.length) missing.push(`${r.address} (faltan: ${faltan.join(", ")})`);
  if (t.project && t.project !== PROJECT) wrongProject.push(`${r.address} (project=${t.project})`);
  if (t.component) {
    components[t.component] = (components[t.component] ?? 0) + 1;
    if (!ALLOWED_COMPONENTS.includes(t.component)) badComponent.push(`${r.address} (component=${t.component})`);
  }
}

/* ── Reporte ─────────────────────────────────────────────────────────────── */
let errores = 0;

console.log(`\nAuditoría del plan — ${FILE}`);
console.log("─".repeat(70));
console.log(`Recursos: ${creates.length} crear · ${updates.length} actualizar · ${destroys.length} destruir/reemplazar`);
console.log(`Con soporte de tags: ${taggable.length} · sin soporte: ${untaggable.length} (normal: versiones, asociaciones, políticas)`);

console.log("\nR3 — etiquetas obligatorias");
console.log(`  etiquetas completas:            ${taggable.length - missing.length}/${taggable.length}`);
console.log(`  project=${PROJECT}: ${taggable.length - wrongProject.length}/${taggable.length}`);
console.log(`  component en vocabulario R3:    ${badComponent.length === 0 ? "OK" : `${badComponent.length} fuera de regla`}`);
console.log(`  valores de component: ${Object.entries(components).map(([k, v]) => `${k}(${v})`).join(", ") || "—"}`);
if (missing.length) { errores++; console.log("  SIN etiquetas:\n    " + missing.join("\n    ")); }
if (wrongProject.length) { errores++; console.log("  project incorrecto:\n    " + wrongProject.join("\n    ")); }
if (badComponent.length) { errores++; console.log("  component inválido:\n    " + badComponent.join("\n    ")); }

console.log("\nR6 — integridad del diff");
if (destroys.length === 0) {
  console.log("  sin destrucciones ni reemplazos: OK");
} else {
  errores++;
  console.log(`  ATENCIÓN: ${destroys.length} recursos se destruyen/reemplazan:`);
  for (const r of destroys) console.log(`    ${r.change.actions.join(",")}  ${r.address}`);
}

console.log("\n" + (errores === 0 ? "RESULTADO: conforme ✅" : `RESULTADO: ${errores} no conformidad(es) ❌`));
process.exit(errores === 0 ? 0 : 1);
