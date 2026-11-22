import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { DomainError } from "@/domain/errors/domain-error";
import { API_ERROR_CODES } from "@/lib/shared/constants";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter((ruta): ruta is string => Boolean(ruta));

/**
 * Opciones comunes de arranque. En los contenedores el usuario de la app no tiene HOME
 * (`/nonexistent`) y Chromium aborta al no poder crear su carpeta de datos ni la de volcados
 * de fallos ("Failed to create headless user data directory container" / crashpad), por eso
 * se le da un HOME y una carpeta de volcados escribibles.
 */
const CHROMIUM_ENV = { ...process.env, HOME: process.env.CHROMIUM_HOME ?? "/tmp" };
const CHROMIUM_ARGS_BASE = ["--no-sandbox", "--disable-dev-shm-usage", "--crash-dumps-dir=/tmp"];

function chromePath(): string {
  const encontrado = CHROME_CANDIDATES.find((ruta) => existsSync(ruta));
  if (!encontrado) {
    throw new DomainError(
      "No se encontró Chrome/Chromium para automatizar la evidencia",
      API_ERROR_CODES.VALIDATION,
      503,
    );
  }
  return encontrado;
}

export interface EvidenciaCapturada {
  bytes: Buffer;
  mimeType: string;
  extension: "pdf";
  nombre: string;
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Resalta el término en el DOM (equivalente al Ctrl+F del navegador) y devuelve
 * el número de coincidencias encontradas.
 */
async function resaltarCoincidencias(
  page: import("playwright-core").Page,
  termino: string,
): Promise<number> {
  return page.evaluate((t) => {
    const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patron = new RegExp(escapar(t), "gi");
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodos: Text[] = [];
    while (walker.nextNode()) nodos.push(walker.currentNode as Text);

    let total = 0;
    for (const nodo of nodos) {
      const texto = nodo.nodeValue ?? "";
      const coincidencias = [...texto.matchAll(patron)];
      if (coincidencias.length === 0) continue;

      const fragmento = document.createDocumentFragment();
      let ultimo = 0;
      for (const coincidencia of coincidencias) {
        fragmento.appendChild(document.createTextNode(texto.slice(ultimo, coincidencia.index)));
        const marca = document.createElement("mark");
        marca.textContent = coincidencia[0];
        marca.style.background = "#ffeb3b";
        marca.style.color = "#000";
        fragmento.appendChild(marca);
        ultimo = coincidencia.index + coincidencia[0].length;
        total += 1;
      }
      fragmento.appendChild(document.createTextNode(texto.slice(ultimo)));
      nodo.parentNode?.replaceChild(fragmento, nodo);
    }
    return total;
  }, termino);
}

/**
 * Constancia de búsqueda para listados largos sin buscador (p. ej. lista
 * consolidada de la ONU): captura la pantalla con el término resaltado o, si no
 * hay coincidencias, el banner que lo declara. No imprime el listado completo.
 */
async function capturarBusquedaEnLista(
  page: import("playwright-core").Page,
  nombre: string,
  termino: string,
  url: string,
): Promise<EvidenciaCapturada> {
  const contenido = await page.evaluate(() => document.body?.innerText?.length ?? 0);
  if (contenido < 800) {
    throw new DomainError(
      "La fuente oficial no cargó su contenido (posible bloqueo). Revisa manualmente el portal.",
      API_ERROR_CODES.VALIDATION,
      502,
    );
  }

  const coincidencias = await resaltarCoincidencias(page, termino);

  await page.evaluate(
    ({ term, total }) => {
      const banner = document.createElement("div");
      banner.style.cssText =
        "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#0B2E59;color:#fff;" +
        "font:15px/1.5 Arial,sans-serif;padding:10px 16px;";
      banner.textContent =
        `Búsqueda: "${term}" — ` +
        (total > 0 ? `${total} coincidencia(s) resaltada(s)` : "Sin coincidencias") +
        ` — ${new Date().toLocaleString("es-PE")}`;
      document.body.appendChild(banner);
      document.body.style.paddingTop = "52px";
      document.querySelector("mark")?.scrollIntoView({ block: "center" });
    },
    { term: termino, total: coincidencias },
  );
  await page.waitForTimeout(400);

  const captura = await page.screenshot({ type: "png", fullPage: false });
  const html = `<!doctype html><html><head><meta charset="utf-8"></head>
    <body style="font-family:Arial,sans-serif;margin:16px">
      <h1 style="font-size:15px;margin:0 0 6px">${escaparHtml(nombre)}</h1>
      <p style="font-size:12px;color:#444;margin:0 0 10px">Término: "${escaparHtml(termino)}" · Coincidencias: ${coincidencias} · Fuente: ${escaparHtml(url)}</p>
      <img style="width:100%;border:1px solid #ccc" src="data:image/png;base64,${Buffer.from(captura).toString("base64")}">
    </body></html>`;
  await page.setContent(html, { waitUntil: "load" });

  const pdf = await page.pdf({
    format: "A4",
    landscape: true,
    printBackground: true,
    margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
  });

  return { bytes: Buffer.from(pdf), mimeType: "application/pdf", extension: "pdf", nombre };
}

/**
 * INTERPOL (notificaciones rojas): el formulario pide apellido y nombre por separado.
 * Con 3+ palabras se toman las dos últimas como apellidos (formato peruano) y el resto
 * como nombres; con 1-2 palabras la última es el apellido.
 */
export function separarNombreInterpol(termino: string): { apellido: string; nombre: string } {
  const palabras = termino.trim().split(/\s+/).filter(Boolean);
  if (palabras.length <= 1) return { apellido: palabras[0] ?? "", nombre: "" };
  const apellidos = palabras.length >= 3 ? 2 : 1;
  return {
    apellido: palabras.slice(-apellidos).join(" "),
    nombre: palabras.slice(0, -apellidos).join(" "),
  };
}

/** Escribe con una pulsacion real al final para disparar los handlers de teclado del sitio. */
async function escribirCampo(page: import("playwright-core").Page, selector: string, valor: string): Promise<void> {
  if (!valor) return;
  const input = page.locator(selector).first();
  await input.fill(valor.slice(0, -1));
  await input.pressSequentially(valor.slice(-1));
}

/** Busca en el formulario de notificaciones rojas y deja constancia del resultado. */
async function capturarBusquedaInterpol(
  page: import("playwright-core").Page,
  nombre: string,
  termino: string,
  url: string,
): Promise<EvidenciaCapturada> {
  const { apellido, nombre: nombres } = separarNombreInterpol(termino);
  await page.locator("button:has-text(\"Accept\"), button:has-text(\"Aceptar\")").first().click({ timeout: 2000 }).catch(() => undefined);
  await escribirCampo(page, "#name", apellido);
  await escribirCampo(page, "#forename", nombres);
  await page.locator("#submit").first().click();
  await page.waitForTimeout(5000);

  const total = await page.locator(".redNoticeItem").count();
  const sinResultados = await page.getByText(/no results for your search/i).first().isVisible().catch(() => false);
  const coincidencias = sinResultados ? 0 : total;

  await page.evaluate(
    ({ apellidoBuscado, nombresBuscados, cantidad }) => {
      const banner = document.createElement("div");
      banner.style.cssText =
        "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#0B2E59;color:#fff;" +
        "font:15px/1.5 Arial,sans-serif;padding:10px 16px;";
      banner.textContent =
        `INTERPOL Red Notices — Apellido: "${apellidoBuscado}"${nombresBuscados ? ` · Nombre: "${nombresBuscados}"` : ""} — ` +
        (cantidad > 0 ? `${cantidad} notificación(es) encontrada(s)` : "Sin resultados") +
        ` — ${new Date().toLocaleString("es-PE")}`;
      document.body.appendChild(banner);
      document.querySelector(".redNoticesList")?.scrollIntoView({ block: "start" });
      window.scrollBy(0, -80);
    },
    { apellidoBuscado: apellido, nombresBuscados: nombres, cantidad: coincidencias },
  );
  await page.waitForTimeout(400);

  const captura = await page.screenshot({ type: "png", fullPage: false });
  const html = `<!doctype html><html><head><meta charset="utf-8"></head>
    <body style="font-family:Arial,sans-serif;margin:16px">
      <h1 style="font-size:15px;margin:0 0 6px">${escaparHtml(nombre)}</h1>
      <p style="font-size:12px;color:#444;margin:0 0 10px">Búsqueda: apellido "${escaparHtml(apellido)}"${nombres ? `, nombre "${escaparHtml(nombres)}"` : ""} · Resultados: ${coincidencias} · Fuente: ${escaparHtml(url)}</p>
      <img style="width:100%;border:1px solid #ccc" src="data:image/png;base64,${Buffer.from(captura).toString("base64")}">
    </body></html>`;
  await page.setContent(html, { waitUntil: "load" });
  const pdf = await page.pdf({
    format: "A4",
    landscape: true,
    printBackground: true,
    margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
  });
  return { bytes: Buffer.from(pdf), mimeType: "application/pdf", extension: "pdf", nombre };
}

/** Normaliza texto para búsqueda: minúsculas y sin diacríticos. */
function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Barra de búsqueda tipo navegador para la constancia. */
function htmlBarraBusqueda(termino: string, coincidencias: number, detalle: string): string {
  const contador = coincidencias > 0 ? `1 de ${coincidencias}` : "Sin coincidencias";
  return `<div style="display:inline-flex;align-items:center;gap:10px;background:#fff;border:1px solid #dadce0;border-radius:8px;padding:7px 12px;box-shadow:0 1px 3px rgba(0,0,0,.18);font:13px Arial,sans-serif">
    <span style="font-size:14px">&#128269;</span>
    <span style="min-width:240px;border-bottom:1px solid #dadce0;padding:2px 2px">${escaparHtml(termino)}</span>
    <span style="color:#5f6368">${contador}</span>
    <span style="color:#5f6368">&#10005;</span>
    <span style="color:#9aa0a6;font-size:11px">${escaparHtml(detalle)}</span>
  </div>`;
}

/** Captura la primera página del PDF en el visor de Chrome (imagen para la constancia). */
async function capturarPrimeraPaginaPdf(datos: Uint8Array): Promise<string> {
  const rutaTemporal = path.join(os.tmpdir(), `dd-${randomUUID()}.pdf`);
  writeFileSync(rutaTemporal, Buffer.from(datos));

  const browser = await chromium.launch({
    executablePath: chromePath(),
    headless: true,
    env: CHROMIUM_ENV,
    args: CHROMIUM_ARGS_BASE,
  });

  try {
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${pathToFileURL(rutaTemporal).href}#page=1`, {
      waitUntil: "load",
      timeout: 45000,
    });
    await page.waitForTimeout(3500);
    const captura = await page.screenshot({ type: "png", fullPage: false });
    return Buffer.from(captura).toString("base64");
  } finally {
    await browser.close();
    try {
      unlinkSync(rutaTemporal);
    } catch {
      /* el temporal se limpia en el siguiente arranque */
    }
  }
}

/** Tabla HTML con las primeras filas de la hoja (para la constancia XLSX). */
function tablaHojaHtml(libro: import("exceljs").Workbook): string {
  const hoja = libro.worksheets.find((actual) => actual.rowCount > 1) ?? libro.worksheets[0];
  if (!hoja) return "";

  const maxFilas = Math.min(hoja.rowCount, 15);
  const maxColumnas = Math.min(Math.max(hoja.columnCount, 1), 10);
  const letra = (numero: number) => {
    let resultado = "";
    let valor = numero;
    while (valor > 0) {
      const resto = (valor - 1) % 26;
      resultado = String.fromCharCode(65 + resto) + resultado;
      valor = Math.floor((valor - 1) / 26);
    }
    return resultado;
  };

  const cabecera = Array.from({ length: maxColumnas }, (_, indice) => `<th>${letra(indice + 1)}</th>`).join("");
  const filas: string[] = [];
  for (let numero = 1; numero <= maxFilas; numero += 1) {
    const fila = hoja.getRow(numero);
    const celdas: string[] = [];
    for (let columna = 1; columna <= maxColumnas; columna += 1) {
      const valor = (fila.getCell(columna).text ?? "").trim().slice(0, 90);
      celdas.push(`<td>${escaparHtml(valor)}</td>`);
    }
    filas.push(`<tr><th>${numero}</th>${celdas.join("")}</tr>`);
  }

  return `<table style="border-collapse:collapse;width:100%;font:10px Arial,sans-serif;margin-top:12px">
    <thead><tr><th style="background:#f1f3f4;border:1px solid #dadce0;width:24px"></th>${cabecera.replaceAll("<th>", '<th style="background:#f1f3f4;border:1px solid #dadce0">')}</tr></thead>
    <tbody>${filas.join("").replaceAll("<td>", '<td style="border:1px solid #e0e0e0;padding:2px 4px">')}</tbody>
  </table>`;
}

/** Renderiza una constancia HTML a PDF usando Chrome headless. */
async function renderizarConstancia(html: string): Promise<Buffer> {
  const browser = await chromium.launch({
    executablePath: chromePath(),
    headless: true,
    env: CHROMIUM_ENV,
    args: CHROMIUM_ARGS_BASE,
  });

  try {
    const context = await browser.newContext({ locale: "es-PE" });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/**
 * Constancia de búsqueda para fuentes que entregan un PDF completo (p. ej.
 * sanciones europeas): descarga la lista, busca el término en el texto y genera
 * un PDF pequeño con el resultado. No adjunta el listado completo (10 MB+).
 */
async function capturarBusquedaEnPdf(
  url: string,
  termino: string,
  nombre: string,
): Promise<EvidenciaCapturada> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new DomainError(
      "No se pudo descargar la fuente oficial",
      API_ERROR_CODES.VALIDATION,
      502,
    );
  }
  const datos = new Uint8Array(await response.arrayBuffer());

  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  /* pdfjs transfiere (deja en 0 bytes) el buffer que recibe: se le pasa una copia para
   * conservar `datos` intacto (hash, tamaño y visor de la primera página). */
  const documento = await getDocument({ data: datos.slice() }).promise;
  const paginas = documento.numPages;

  const buscado = normalizarTexto(termino);
  const fragmentos: string[] = [];
  let coincidencias = 0;

  try {
    for (let numero = 1; numero <= documento.numPages; numero += 1) {
      const pagina = await documento.getPage(numero);
      const contenido = await pagina.getTextContent();
      const texto = normalizarTexto(
        contenido.items.map((item) => ("str" in item ? item.str : "")).join(" "),
      );

      let indice = texto.indexOf(buscado);
      while (indice !== -1) {
        coincidencias += 1;
        if (fragmentos.length < 3) {
          const desde = Math.max(0, indice - 120);
          const hasta = Math.min(texto.length, indice + buscado.length + 120);
          fragmentos.push(`Página ${numero}: …${texto.slice(desde, hasta).trim()}…`);
        }
        indice = texto.indexOf(buscado, indice + buscado.length);
      }
    }
  } finally {
    await documento.destroy();
  }

  const fecha = new Date().toLocaleString("es-PE");
  const hash = createHash("sha256").update(datos).digest("hex");
  const lista = fragmentos.length
    ? `<ul style="font-size:12px;line-height:1.5">${fragmentos
        .map((fragmento) => `<li>${escaparHtml(fragmento)}</li>`)
        .join("")}</ul>`
    : `<p style="font-size:13px">Sin coincidencias en la lista oficial descargada para esta búsqueda.</p>`;
  const visor = await capturarPrimeraPaginaPdf(datos);

  const html = `<!doctype html><html><head><meta charset="utf-8"></head>
    <body style="font-family:Arial,sans-serif;margin:4px">
      <h1 style="font-size:16px;margin:0 0 8px">${escaparHtml(nombre)}</h1>
      ${htmlBarraBusqueda(termino, coincidencias, `${paginas} páginas`)}
      <img style="width:100%;border:1px solid #d0d0d0;margin-top:12px" src="data:image/png;base64,${visor}">
      ${lista}
      <p style="font-size:11px;color:#555;margin-top:14px;line-height:1.5">
        Fuente: ${escaparHtml(url)}<br>
        Documento: ${datos.byteLength.toLocaleString("es-PE")} bytes · ${paginas} páginas · SHA-256: ${hash}<br>
        Búsqueda automática del término "${escaparHtml(termino)}" sobre la lista oficial · ${fecha}. No se adjunta el listado completo.
      </p>
    </body></html>`;

  return {
    bytes: await renderizarConstancia(html),
    mimeType: "application/pdf",
    extension: "pdf",
    nombre,
  };
}

/**
 * Constancia de búsqueda para fuentes que entregan una hoja de cálculo (p. ej.
 * sanciones australianas): descarga el XLSX, busca el término en sus celdas y
 * genera un PDF pequeño con el resultado y el hash del archivo oficial.
 */
async function capturarBusquedaEnXlsx(
  url: string,
  termino: string,
  nombre: string,
): Promise<EvidenciaCapturada> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new DomainError(
      "No se pudo descargar la fuente oficial",
      API_ERROR_CODES.VALIDATION,
      502,
    );
  }
  const datos = Buffer.from(await response.arrayBuffer());

  const exceljs = await import("exceljs");
  const ExcelJS = exceljs.default ?? exceljs;
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(datos as unknown as Parameters<typeof libro.xlsx.load>[0]);

  const buscado = normalizarTexto(termino);
  const fragmentos: string[] = [];
  let coincidencias = 0;

  libro.eachSheet((hoja) => {
    hoja.eachRow({ includeEmpty: false }, (fila, numero) => {
      fila.eachCell({ includeEmpty: false }, (celda) => {
        const texto = normalizarTexto(celda.text ?? "");
        if (!texto) return;

        let indice = texto.indexOf(buscado);
        while (indice !== -1) {
          coincidencias += 1;
          if (fragmentos.length < 3) {
            const desde = Math.max(0, indice - 100);
            const hasta = Math.min(texto.length, indice + buscado.length + 100);
            fragmentos.push(
              `Hoja "${hoja.name}", fila ${numero}: …${texto.slice(desde, hasta).trim()}…`,
            );
          }
          indice = texto.indexOf(buscado, indice + buscado.length);
        }
      });
    });
  });

  const fecha = new Date().toLocaleString("es-PE");
  const hash = createHash("sha256").update(datos).digest("hex");
  const lista = fragmentos.length
    ? `<ul style="font-size:12px;line-height:1.5">${fragmentos
        .map((fragmento) => `<li>${escaparHtml(fragmento)}</li>`)
        .join("")}</ul>`
    : `<p style="font-size:13px">Sin coincidencias en la hoja de cálculo oficial para esta búsqueda.</p>`;
  const tabla = tablaHojaHtml(libro);
  const totalFilas = libro.worksheets[0]?.rowCount ?? 0;

  const html = `<!doctype html><html><head><meta charset="utf-8"></head>
    <body style="font-family:Arial,sans-serif;margin:4px">
      <h1 style="font-size:16px;margin:0 0 8px">${escaparHtml(nombre)}</h1>
      ${htmlBarraBusqueda(termino, coincidencias, `${totalFilas} filas`)}
      ${tabla}
      ${lista}
      <p style="font-size:11px;color:#555;margin-top:14px;line-height:1.5">
        Fuente: ${escaparHtml(url)}<br>
        Documento: ${datos.byteLength.toLocaleString("es-PE")} bytes · ${libro.worksheets.length} hoja(s) · SHA-256: ${hash}<br>
        Búsqueda automática del término "${escaparHtml(termino)}" en la hoja de cálculo oficial · ${fecha}.
      </p>
    </body></html>`;

  return {
    bytes: await renderizarConstancia(html),
    mimeType: "application/pdf",
    extension: "pdf",
    nombre,
  };
}

async function buscarEnPagina(
  page: import("playwright-core").Page,
  termino: string,
  inputSelector?: string,
): Promise<void> {
  const selectores = inputSelector !== undefined
    ? (inputSelector ? [inputSelector] : [])
    : [
        'input[type="search"]',
        'input[placeholder*="Buscar" i]',
        'input[placeholder*="Search" i]',
        'input[name*="search" i]',
        'input[id*="search" i]',
        'input[name*="name" i]',
        'input[id*="name" i]',
        'input[type="text"]',
      ];

  for (const selector of selectores) {
    const input = page.locator(selector).first();
    if (await input.isVisible().catch(() => false)) {
      /* `fill` no dispara teclas: algunos buscadores (p. ej. Banco Mundial) filtran con keyup,
       * por eso el ultimo caracter se escribe con una pulsacion real. */
      await input.fill(termino.slice(0, -1));
      await input.pressSequentially(termino.slice(-1));
      await input.press("Enter");
      await page.waitForTimeout(1500);
      const submit = page
        .locator('input[type="submit"][value*="Search" i], input[type="submit"][value*="Buscar" i], button[type="submit"]')
        .first();
      if (await submit.isVisible().catch(() => false)) {
        await submit.click();
      }
      await page.waitForTimeout(3000);
      return;
    }
  }
}

/** Ejecuta la búsqueda pública y devuelve un PDF de la página de resultados. */
export async function capturarEvidenciaPdf(
  url: string,
  termino: string,
  nombre: string,
  inputSelector?: string,
): Promise<EvidenciaCapturada> {
  if (url.toLowerCase().endsWith(".xlsx")) {
    return await capturarBusquedaEnXlsx(url, termino, nombre);
  }

  if (url.toLowerCase().endsWith(".pdf") || url.includes("pdfFullSanctionsList")) {
    return await capturarBusquedaEnPdf(url, termino, nombre);
  }

  let htmlInicial: string | null = null;
  if (url.includes("scsanctions.un.org/consolidated")) {
    const response = await fetch(url);
    if (response.ok) htmlInicial = await response.text();
  }

  const browser = await chromium.launch({
    executablePath: chromePath(),
    headless: true,
    env: CHROMIUM_ENV,
    args: [...CHROMIUM_ARGS_BASE, "--disable-blink-features=AutomationControlled"],
  });

  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      locale: "es-PE",
      viewport: { width: 1440, height: 1800 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      extraHTTPHeaders: {
        "accept-language": "es-PE,es;q=0.9,en;q=0.8",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);

    if (htmlInicial) {
      await page.setContent(htmlInicial, { waitUntil: "domcontentloaded" });
    } else {
      const respuesta = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      if (respuesta && respuesta.status() >= 400) {
        throw new DomainError(
          `La fuente oficial respondió ${respuesta.status()} (posible bloqueo). Revisa manualmente el portal.`,
          API_ERROR_CODES.VALIDATION,
          502,
        );
      }
    }
    await page.waitForTimeout(1500);

    /* Lista consolidada sin buscador propio (ONU): la evidencia es la captura
       de la búsqueda (Ctrl+F) del término, no el listado completo. */
    if (url.includes("scsanctions.un.org/consolidated")) {
      return await capturarBusquedaEnLista(page, nombre, termino, url);
    }

    /* INTERPOL: formulario propio (apellido / nombre), no un buscador de una sola caja. */
    if (url.includes("interpol.int")) {
      return await capturarBusquedaInterpol(page, nombre, termino, url);
    }

    /* OpenSanctions/DEA ya traen el término en la URL; en el resto se busca en el formulario. */
    if (!url.includes("?q=") && !url.includes("?keywords=")) {
      await buscarEnPagina(page, termino, inputSelector);
    } else {
      await page.waitForTimeout(3000);
    }

    /* Portales con listado propio (DEA): constancia con la búsqueda aplicada. */
    if (url.includes("dea.gov/fugitives")) {
      return await capturarBusquedaEnLista(page, nombre, termino, page.url());
    }

    const bytes = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    });

    return { bytes: Buffer.from(bytes), mimeType: "application/pdf", extension: "pdf", nombre };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError(
      "No se pudo capturar la evidencia automáticamente. Revisa manualmente el portal.",
      API_ERROR_CODES.VALIDATION,
      502,
    );
  } finally {
    await browser.close();
  }
}




