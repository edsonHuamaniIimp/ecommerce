#!/usr/bin/env node
/**
 * Generador de la vista previa HTML de la arquitectura AWS
 * =======================================================
 *
 * Lee `docs/02-despliegue/arquitectura-aws.md`, extrae los bloques ```mermaid
 * y emite `docs/02-despliegue/arquitectura-preview.html`, que renderiza los
 * diagramas en el navegador con Mermaid (CDN).
 *
 * Motivo: los diagramas viven en el Markdown (GitLab/Confluence los renderizan),
 * y este HTML es para verlos/adjuntarlos sin visor de Markdown.
 *
 * Uso:
 *   node scripts/build-arquitectura-preview.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "docs", "02-despliegue", "arquitectura-aws.md");
const OUT = join(ROOT, "docs", "02-despliegue", "arquitectura-preview.html");
const MERMAID_CDN = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ── Extraer bloques mermaid con su título (heading previo) ─────────────── */
const md = readFileSync(SRC, "utf8");
const blocks = [];
let heading = "";
let inBlock = false;
let buf = [];

for (const line of md.split("\n")) {
  if (!inBlock) {
    const h = line.match(/^#{2,3}\s+(.+)$/);
    if (h) heading = h[1].trim();
  }
  if (/^```mermaid\s*$/.test(line)) {
    inBlock = true;
    buf = [];
    continue;
  }
  if (inBlock && /^```\s*$/.test(line)) {
    inBlock = false;
    blocks.push({ heading, code: buf.join("\n") });
    continue;
  }
  if (inBlock) buf.push(line);
}

if (blocks.length === 0) {
  console.error(`No se encontraron bloques mermaid en ${SRC}`);
  process.exit(1);
}

const sections = blocks
  .map(
    ({ heading, code }) =>
      `  <h2>${escapeHtml(heading)}</h2>\n  <pre class="mermaid">${escapeHtml(code)}</pre>`,
  )
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ContratosStands — Arquitectura AWS v3 (vista previa)</title>
<!-- ARCHIVO GENERADO — NO editar a mano.
     Fuente: docs/02-despliegue/arquitectura-aws.md
     Regenerar: node scripts/build-arquitectura-preview.mjs -->
<style>
  body { font-family: "Segoe UI", Arial, sans-serif; background: #f1f5f9; color: #0f172a;
         max-width: 1240px; margin: 0 auto; padding: 24px; }
  h1 { margin: 0 0 4px; }
  .sub { color: #475569; margin: 0 0 8px; }
  h2 { margin-top: 44px; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px; color: #0c4a6e; }
  pre.mermaid { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px;
                overflow: auto; box-shadow: 0 1px 4px rgba(15, 23, 42, .08); }
  footer { margin-top: 48px; color: #64748b; font-size: 12px; border-top: 1px solid #cbd5e1; padding-top: 12px; }
</style>
</head>
<body>
  <h1>ContratosStands — Arquitectura AWS v3</h1>
  <p class="sub">Vista previa generada desde <code>docs/02-despliegue/arquitectura-aws.md</code> · ${blocks.length} diagramas · 2026-09-15</p>
${sections}
  <footer>Archivo generado. Editar el Markdown y regenerar con
    <code>node scripts/build-arquitectura-preview.mjs</code>. Requiere conexión para cargar Mermaid (CDN).</footer>
  <script src="${MERMAID_CDN}"></script>
  <script>mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });</script>
</body>
</html>
`;

writeFileSync(OUT, html);
console.log(`OK ${OUT}`);
console.log(`   ${blocks.length} diagramas · ${(html.length / 1024).toFixed(1)} KB`);
