import "server-only";

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
    throw new DomainError(
      "La fuente entrega un archivo XLSX; todavía no se convierte automáticamente a PDF",
      API_ERROR_CODES.VALIDATION,
      422,
    );
  }

  if (url.toLowerCase().endsWith(".pdf") || url.includes("pdfFullSanctionsList")) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new DomainError("No se pudo descargar la fuente oficial", API_ERROR_CODES.VALIDATION, 502);
    }
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      mimeType: "application/pdf",
      extension: "pdf",
      nombre,
    };
  }

  let htmlInicial: string | null = null;
  if (url.includes("scsanctions.un.org/consolidated")) {
    const response = await fetch(url);
    if (response.ok) htmlInicial = await response.text();
  }

  const browser = await chromium.launch({
    executablePath: chromePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      locale: "es-PE",
      viewport: { width: 1440, height: 1800 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);

    if (htmlInicial) {
      await page.setContent(htmlInicial, { waitUntil: "domcontentloaded" });
    } else {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    }
    await page.waitForTimeout(1500);

    /* OpenSanctions/DEA ya traen el término en la URL; en el resto se busca en el formulario. */
    if (!url.includes("?q=") && !url.includes("?keywords=")) {
      await buscarEnPagina(page, termino, inputSelector);
    } else {
      await page.waitForTimeout(3000);
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




