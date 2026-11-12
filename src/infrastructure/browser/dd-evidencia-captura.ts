import "server-only";

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
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

/** Normaliza texto para búsqueda: minúsculas y sin diacríticos. */
function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Renderiza una constancia HTML a PDF usando Chrome headless. */
async function renderizarConstancia(html: string): Promise<Buffer> {
  const browser = await chromium.launch({
    executablePath: chromePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
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
  const documento = await getDocument({ data: datos }).promise;
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

  const html = `<!doctype html><html><head><meta charset="utf-8"></head>
    <body style="font-family:Arial,sans-serif;margin:4px">
      <h1 style="font-size:16px;margin:0 0 6px">${escaparHtml(nombre)}</h1>
      <p style="font-size:12px;color:#444;margin:0 0 12px">
        Término buscado: "${escaparHtml(termino)}" · Coincidencias: ${coincidencias} · ${fecha}<br>
        Fuente: ${escaparHtml(url)}<br>
        Documento: ${datos.byteLength.toLocaleString("es-PE")} bytes · ${paginas} páginas · SHA-256: ${hash}
      </p>
      ${lista}
      <p style="font-size:11px;color:#666;margin-top:16px">
        Constancia de búsqueda automática sobre la lista oficial. No se adjunta el listado completo.
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

  const ExcelJS = (await import("exceljs")).default;
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

  const html = `<!doctype html><html><head><meta charset="utf-8"></head>
    <body style="font-family:Arial,sans-serif;margin:4px">
      <h1 style="font-size:16px;margin:0 0 6px">${escaparHtml(nombre)}</h1>
      <p style="font-size:12px;color:#444;margin:0 0 12px">
        Término buscado: "${escaparHtml(termino)}" · Coincidencias: ${coincidencias} · ${fecha}<br>
        Fuente: ${escaparHtml(url)}<br>
        Documento: ${datos.byteLength.toLocaleString("es-PE")} bytes · ${libro.worksheets.length} hoja(s) · SHA-256: ${hash}
      </p>
      ${lista}
      <p style="font-size:11px;color:#666;margin-top:16px">
        Constancia de búsqueda automática sobre la hoja de cálculo oficial. No se adjunta el archivo completo.
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
      await input.fill(termino);
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
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
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




