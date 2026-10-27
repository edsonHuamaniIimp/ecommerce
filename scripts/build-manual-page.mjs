#!/usr/bin/env node
/**
 * Genera las páginas /manual y /manual/dd a partir de los Markdown de
 * docs/08-manual.
 *
 * Uso: node scripts/build-manual-page.mjs
 *
 * Por cada guía:
 *  1. Convierte el Markdown a HTML (marked vía npx).
 *  2. Agrega id a cada <h2> y construye el TOC para el menú lateral.
 *  3. Envuelve las tablas para que puedan desplazarse en móvil.
 *  4. Escribe el content.ts correspondiente con el HTML y el TOC.
 *
 * Finalmente copia docs/08-manual/img -> public/manual/img.
 */

import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const MANUAL_DIR = join(ROOT, "docs", "08-manual");
const OUT_DIR = join(ROOT, "src", "app", "(public)", "manual");
const IMG_SRC = join(MANUAL_DIR, "img");
const IMG_DEST = join(ROOT, "public", "manual", "img");

const GUIAS = [
  {
    md: "manual-exhibidor.md",
    out: "content.ts",
    htmlExport: "MANUAL_HTML",
    tocExport: "MANUAL_TOC",
  },
  {
    md: "manual-debida-diligencia.md",
    out: "content-dd.ts",
    htmlExport: "MANUAL_DD_HTML",
    tocExport: "MANUAL_DD_TOC",
  },
];

function construirGuia(guia) {
  const mdPath = join(MANUAL_DIR, guia.md);
  const tmpPath = join(MANUAL_DIR, `_${guia.out.replace(".ts", "")}.html`);

  execSync(`npx --yes marked -i "${mdPath}" -o "${tmpPath}"`, { stdio: "inherit" });

  let html = readFileSync(tmpPath, "utf8");
  html = html.replace(/src="img\//g, 'src="/manual/img/');
  html = html.replace(/<table>/g, '<div class="manual-table-wrap"><table>');
  html = html.replace(/<\/table>/g, "</table></div>");

  /* Agrega id a cada <h2> y construye el TOC para el menú lateral. */
  const toc = [];
  let h2Index = 0;
  html = html.replace(/<h2>(.*?)<\/h2>/g, (_match, inner) => {
    h2Index += 1;
    const id = `seccion-${h2Index}`;
    const label = String(inner).replace(/<[^>]+>/g, "").trim();
    toc.push({ id, label });
    return `<h2 id="${id}">${inner}</h2>`;
  });

  rmSync(tmpPath, { force: true });

  writeFileSync(
    join(OUT_DIR, guia.out),
    `/* Generado por scripts/build-manual-page.mjs desde docs/08-manual/${guia.md}. No editar a mano. */\n` +
      "export interface ManualSeccion { id: string; label: string }\n" +
      `export const ${guia.tocExport}: ManualSeccion[] = ` +
      JSON.stringify(toc, null, 2) +
      ";\n" +
      `export const ${guia.htmlExport}: string = ` +
      JSON.stringify(html) +
      ";\n",
    "utf8",
  );

  console.log(`OK: ${guia.out} (${toc.length} secciones).`);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const guia of GUIAS) construirGuia(guia);

cpSync(IMG_SRC, IMG_DEST, { recursive: true });
console.log("OK: public/manual/img actualizado.");
