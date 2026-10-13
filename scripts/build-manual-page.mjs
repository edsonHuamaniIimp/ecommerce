#!/usr/bin/env node
/**
 * Genera la pagina /manual del portal a partir de docs/08-manual/manual-exhibidor.md
 * =================================================================================
 *
 * Uso:  node scripts/build-manual-page.mjs
 *
 * Hace 3 cosas:
 *  1. Convierte el Markdown del manual a HTML (marked via npx).
 *  2. Escribe src/app/(public)/manual/content.ts con el HTML embebido y el
 *     indice de secciones (TOC) para el menu de navegacion.
 *  3. Copia docs/08-manual/img -> public/manual/img (+ favicon/logo si aplica).
 *
 * Para actualizar el manual: editar el .md (y/o reemplazar imagenes) y volver
 * a ejecutar este script.
 */

import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const MD = join(ROOT, "docs", "08-manual", "manual-exhibidor.md");
const TMP = join(ROOT, "docs", "08-manual", "_body.html");
const OUT_DIR = join(ROOT, "src", "app", "(public)", "manual");
const IMG_SRC = join(ROOT, "docs", "08-manual", "img");
const IMG_DEST = join(ROOT, "public", "manual", "img");

execSync(`npx --yes marked -i "${MD}" -o "${TMP}"`, { stdio: "inherit" });

let html = readFileSync(TMP, "utf8");
html = html.replace(/src="img\//g, 'src="/manual/img/');

/* Agrega id a cada <h2> y construye el TOC para el menu lateral. */
const toc = [];
let h2Index = 0;
html = html.replace(/<h2>(.*?)<\/h2>/g, (_match, inner) => {
  h2Index += 1;
  const id = `seccion-${h2Index}`;
  const label = String(inner).replace(/<[^>]+>/g, "").trim();
  toc.push({ id, label });
  return `<h2 id="${id}">${inner}</h2>`;
});

rmSync(TMP, { force: true });

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  join(OUT_DIR, "content.ts"),
  "/* Generado por scripts/build-manual-page.mjs desde docs/08-manual/manual-exhibidor.md. No editar a mano. */\n" +
    "export interface ManualSeccion { id: string; label: string }\n" +
    "export const MANUAL_TOC: ManualSeccion[] = " +
    JSON.stringify(toc, null, 2) +
    ";\n" +
    "export const MANUAL_HTML: string = " +
    JSON.stringify(html) +
    ";\n",
);

cpSync(IMG_SRC, IMG_DEST, { recursive: true });

console.log(`OK: content.ts (${toc.length} secciones) y public/manual/img actualizados.`);
