#!/usr/bin/env node
/**
 * Publicador de documentación Markdown → Confluence Cloud
 * ========================================================
 *
 * Convierte los documentos de `docs/` (y anexos) a formato "storage" de
 * Confluence y los publica como páginas hijas de un portal padre.
 * Es idempotente: si la página ya existe (mismo título en el espacio),
 * la actualiza; si no, la crea.
 *
 * Uso:
 *   node scripts/publish-confluence.mjs --space CTRS [--dry-run] [--only 3]
 *
 * Variables de entorno requeridas:
 *   ATLASSIAN_SITE_NAME    subdominio (ej: iimp-team-ejhn)
 *   ATLASSIAN_USER_EMAIL   correo de la cuenta
 *   ATLASSIAN_API_TOKEN    API token (si falta, se lee de
 *                          ~/.config/opencode/confluence.token)
 *
 * Opcionales:
 *   CONFLUENCE_PARENT_TITLE  título del portal padre
 *                            (default: "ContratosStands — Portal de Documentación")
 */

import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DOCS = join(ROOT, "docs");

/* ------------------------------------------------------------------ */
/* Configuración                                                       */
/* ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};
const hasFlag = (name) => args.includes(name);

const SPACE_KEY = getArg("--space");
const DRY_RUN = hasFlag("--dry-run");
const ONLY = getArg("--only") ? Number(getArg("--only")) : undefined;
const PARENT_TITLE =
  process.env.CONFLUENCE_PARENT_TITLE ??
  "ContratosStands — Portal de Documentación";

const SITE = process.env.ATLASSIAN_SITE_NAME;
const EMAIL = process.env.ATLASSIAN_USER_EMAIL;
let TOKEN = process.env.ATLASSIAN_API_TOKEN;

if (!TOKEN) {
  const tokenFile = join(homedir(), ".config", "opencode", "confluence.token");
  if (existsSync(tokenFile)) TOKEN = readFileSync(tokenFile, "utf8").trim();
}

if (!SITE || !EMAIL || !TOKEN) {
  console.error(
    "Faltan credenciales. Define ATLASSIAN_SITE_NAME, ATLASSIAN_USER_EMAIL y ATLASSIAN_API_TOKEN (o crea ~/.config/opencode/confluence.token).",
  );
  process.exit(1);
}
if (!SPACE_KEY) {
  console.error("Falta --space <SPACE_KEY> (ej: --space CTRS).");
  process.exit(1);
}

const API = `https://${SITE}.atlassian.net/wiki/api/v2`;
const API_V1 = `https://${SITE}.atlassian.net/wiki/rest/api`;
const AUTH = "Basic " + Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");

/* ------------------------------------------------------------------ */
/* Páginas a publicar (orden del portal)                               */
/* ------------------------------------------------------------------ */

const PAGES = [
  { title: "00 · Resumen Ejecutivo y Traspaso", file: "resumen-ejecutivo.md" },
  { title: "01 · Requerimientos y Alcance", file: "requerimientos.md" },
  { title: "02 · Arquitectura de Software", file: "arquitectura.md" },
  { title: "03 · Stack Tecnológico", file: "stack-tecnologico.md" },
  { title: "04 · Modelo de Datos", file: "modelo-datos.md" },
  { title: "05 · API — Inventario de Endpoints", file: "api-inventario.md" },
  { title: "06 · API — Contrato y Convenciones", file: "endpoints.md" },
  { title: "07 · Guía de Consumo — Servicio Persona", file: "GUIA-CONSUMO.md" },
  { title: "08 · Flujos de Negocio", file: "flujos.md" },
  { title: "09 · Integración — Sistema de Montaje", file: "api-sistema-montaje.md" },
  { title: "10 · Infraestructura, Docker y CI/CD", file: "infraestructura-devops.md" },
  { title: "11 · Despliegue", file: "despliegue.md" },
  { title: "12 · Convenciones de Código y Reglas", file: "convenciones-codigo.md" },
  { title: "A1 · Anexo — OpenAPI 3.0 (YAML)", file: "openapi.yaml", raw: true },
];

/* ------------------------------------------------------------------ */
/* Conversión Markdown → Confluence storage format                     */
/* ------------------------------------------------------------------ */

const escapeXml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function renderInline(text) {
  let s = escapeXml(text);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    '<a href="$2">$1</a>',
  );
  return s;
}

function renderCodeBlock(lang, code) {
  const language = lang && lang !== "mermaid" ? `<ac:parameter ac:name="language">${escapeXml(lang)}</ac:parameter>` : "";
  const safe = code.replace(/]]>/g, "]]]]><![CDATA[>");
  return `<ac:structured-macro ac:name="code">${language}<ac:plain-text-body><![CDATA[${safe}]]></ac:plain-text-body></ac:structured-macro>`;
}

function renderTable(tableLines) {
  const rows = tableLines.map((l) =>
    l
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim()),
  );
  const [header, , ...body] = rows;
  let html = "<table><tbody>";
  html +=
    "<tr>" + header.map((c) => `<th>${renderInline(c)}</th>`).join("") + "</tr>";
  for (const row of body) {
    html +=
      "<tr>" + row.map((c) => `<td>${renderInline(c)}</td>`).join("") + "</tr>";
  }
  html += "</tbody></table>";
  return html;
}

function isTableStart(line, next) {
  return (
    line.trim().startsWith("|") &&
    typeof next === "string" &&
    /^\|[\s:|-]+\|$/.test(next.trim())
  );
}

const isBlockStart = (line, next) =>
  /^(#{1,6})\s/.test(line) ||
  /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
  line.startsWith(">") ||
  /^\s*[-*+]\s+/.test(line) ||
  /^\s*\d+\.\s+/.test(line) ||
  isTableStart(line, next) ||
  /^\u0000CODEBLOCK\d+\u0000$/.test(line);

function mdToStorage(markdown) {
  /* 1. Extraer bloques de código a placeholders */
  const codeBlocks = [];
  let md = markdown.replace(
    /```([\w+-]*)\n([\s\S]*?)```/g,
    (_, lang, code) => {
      const i = codeBlocks.length;
      codeBlocks.push({ lang, code });
      return `\u0000CODEBLOCK${i}\u0000`;
    },
  );

  /* 2. Parsear línea por línea */
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1];

    const placeholder = line.match(/^\u0000CODEBLOCK(\d+)\u0000$/);
    if (placeholder) {
      const { lang, code } = codeBlocks[Number(placeholder[1])];
      out.push(renderCodeBlock(lang, code.replace(/\n$/, "")));
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push("<hr/>");
      i++;
      continue;
    }

    if (isTableStart(line, next)) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      out.push(renderTable(tableLines));
      continue;
    }

    if (line.startsWith(">")) {
      const quote = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote><p>${renderInline(quote.join(" "))}</p></blockquote>`);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      out.push(
        "<ul>" + items.map((t) => `<li>${renderInline(t)}</li>`).join("") + "</ul>",
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      out.push(
        "<ol>" + items.map((t) => `<li>${renderInline(t)}</li>`).join("") + "</ol>",
      );
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    /* Párrafo: acumular líneas hasta el próximo bloque */
    const paragraph = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isBlockStart(lines[i], lines[i + 1])
    ) {
      paragraph.push(lines[i]);
      i++;
    }
    out.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  }

  return out.join("\n");
}

/* ------------------------------------------------------------------ */
/* API de Confluence                                                   */
/* ------------------------------------------------------------------ */

async function cf(path, options = {}) {
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    ...options,
    headers: {
      Authorization: AUTH,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Confluence ${res.status} ${res.statusText}: ${detail}`);
  }
  return res.status === 204 ? null : res.json();
}

async function resolveSpaceId(key) {
  const data = await cf(`/spaces?keys=${encodeURIComponent(key)}&limit=1`);
  const space = data.results?.[0];
  if (!space) throw new Error(`No se encontró el espacio con key "${key}".`);
  return space.id;
}

async function findPageByTitle(spaceId, title) {
  const data = await cf(
    `/pages?space-id=${spaceId}&title=${encodeURIComponent(title)}&limit=2`,
  );
  return data.results?.[0] ?? null;
}

async function upsertPage({ spaceId, parentId, title, storage }) {
  const existing = await findPageByTitle(spaceId, title);
  if (existing) {
    const current = await cf(`/pages/${existing.id}?body-format=storage`);
    const version = (current.version?.number ?? existing.version?.number ?? 1) + 1;
    await cf(`/pages/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify({
        id: existing.id,
        status: "current",
        title,
        spaceId,
        parentId,
        body: { representation: "storage", value: storage },
        version: { number: version },
      }),
    });
    return { id: existing.id, action: "actualizada", version };
  }
  const created = await cf(`/pages`, {
    method: "POST",
    body: JSON.stringify({
      spaceId,
      status: "current",
      title,
      parentId,
      body: { representation: "storage", value: storage },
    }),
  });
  return { id: created.id, action: "creada" };
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

const parentStorage = `
<p>Documentación técnica y funcional completa del sistema <strong>ContratosStands</strong> (reserva de stands del Instituto de Ingenieros de Minas del Perú), preparada para el <strong>traspaso al proveedor de software</strong>.</p>
<ac:structured-macro ac:name="info"><ac:rich-text-body><p>Este portal es la fuente de consulta oficial del proyecto. Los documentos se versionan en el repositorio (carpeta <code>docs/</code>) y se publican aquí mediante <code>scripts/publish-confluence.mjs</code>.</p></ac:rich-text-body></ac:structured-macro>
<ac:structured-macro ac:name="toc"><ac:parameter ac:name="maxLevel">2</ac:parameter></ac:structured-macro>
<h2>Contenido del portal</h2>
<table><tbody>
<tr><th>#</th><th>Documento</th><th>Contenido</th></tr>
<tr><td>00</td><td>Resumen Ejecutivo y Traspaso</td><td>Qué es, alcance, estado, personas, riesgos y próximos pasos</td></tr>
<tr><td>01</td><td>Requerimientos y Alcance</td><td>RF, RNF, actores, glosario, flujogramas de alto nivel</td></tr>
<tr><td>02</td><td>Arquitectura de Software</td><td>Estructura completa de carpetas, capas backend/frontend</td></tr>
<tr><td>03</td><td>Stack Tecnológico</td><td>Dependencias, versiones, scripts y configuraciones</td></tr>
<tr><td>04</td><td>Modelo de Datos</td><td>Entidades, ER, diccionario de datos, convenciones BD</td></tr>
<tr><td>05</td><td>API — Inventario de Endpoints</td><td>Inventario REAL implementado (fuente: código)</td></tr>
<tr><td>06</td><td>API — Contrato y Convenciones</td><td>Contrato propuesto, convenciones REST, errores</td></tr>
<tr><td>07</td><td>Guía de Consumo — Servicio Persona</td><td>Guía del servicio REST externo de personas</td></tr>
<tr><td>08</td><td>Flujos de Negocio</td><td>Flujos detallados de solicitudes, revisiones y documentos</td></tr>
<tr><td>09</td><td>Integración — Sistema de Montaje</td><td>API del sistema de montaje (externa)</td></tr>
<tr><td>10</td><td>Infraestructura, Docker y CI/CD</td><td>Variables, Docker, Nginx, pipeline GitHub Actions</td></tr>
<tr><td>11</td><td>Despliegue</td><td>Guía de despliegue por ambiente</td></tr>
<tr><td>12</td><td>Convenciones de Código y Reglas</td><td>Reglas obligatorias, arquitectura, calidad ZERO ERRORS</td></tr>
<tr><td>A1</td><td>Anexo — OpenAPI 3.0 (YAML)</td><td>Especificación OpenAPI completa</td></tr>
</tbody></table>
`;

async function main() {
  console.log(`\n📚 Publicador Confluence — ${SITE} / espacio ${SPACE_KEY}`);
  console.log(DRY_RUN ? "🧪 Modo dry-run (no publica)\n" : "🚀 Publicando...\n");

  const spaceId = DRY_RUN ? "DRY" : await resolveSpaceId(SPACE_KEY);
  console.log(`   Espacio resuelto: id=${spaceId}`);

  let parentId;
  if (!DRY_RUN) {
    const parent = await upsertPage({
      spaceId,
      parentId: undefined,
      title: PARENT_TITLE,
      storage: parentStorage,
    });
    parentId = parent.id;
    console.log(`   Portal padre: "${PARENT_TITLE}" (${parent.action}, id=${parent.id})\n`);
  }

  let published = 0;
  for (const [index, page] of PAGES.entries()) {
    if (ONLY !== undefined && index !== ONLY) continue;
    const filePath = join(DOCS, page.file);
    if (!existsSync(filePath)) {
      console.warn(`   ⚠️  Falta ${page.file} — se omite.`);
      continue;
    }
    const raw = readFileSync(filePath, "utf8");
    const storage = page.raw
      ? renderCodeBlock("yaml", raw.trim())
      : mdToStorage(raw);

    if (DRY_RUN) {
      console.log(
        `   [dry] ${page.title} ← ${page.file} (${(storage.length / 1024).toFixed(1)} KB storage)`,
      );
      continue;
    }

    const result = await upsertPage({
      spaceId,
      parentId,
      title: page.title,
      storage,
    });
    console.log(`   ✓ ${page.title} (${result.action})`);
    published++;
  }

  console.log(
    DRY_RUN
      ? "\n✅ Dry-run completo."
      : `\n✅ Publicación completa: ${published} páginas.`,
  );
  if (!DRY_RUN) {
    console.log(`🔗 https://${SITE}.atlassian.net/wiki/spaces/${SPACE_KEY}\n`);
  }
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
