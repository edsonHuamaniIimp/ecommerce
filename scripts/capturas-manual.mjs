import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:3001";
const EMAIL = "correo12412@correo.com";
const PASSWORD_TEMPORAL = "capturas123";
const PASSWORD_ANTERIOR = "scrypt$UCIt3WHTwM-cEnYHMbjxNw$9ZdD-ShChaccXDjNpX_M_pBXeVTrxkHqgKPPyYLF3Mk";
const IMG = "public/manual/img";

function databaseUrl() {
  const env = readFileSync(".env", "utf8");
  const linea = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
  return (linea?.slice("DATABASE_URL=".length) ?? "").trim().replace(/^"|"$/g, "");
}

function hashPassword(plano) {
  const salt = randomBytes(16);
  const clave = scryptSync(plano, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64url")}$${clave.toString("base64url")}`;
}

const db = new pg.Client({ connectionString: databaseUrl() });
let browser;

try {
  await db.connect();
  await db.query("UPDATE user_role SET password = $1 WHERE email = $2", [hashPassword(PASSWORD_TEMPORAL), EMAIL]);

  browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "es-PE" });
  const login = await context.request.post(`${BASE}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD_TEMPORAL } });
  if (!login.ok()) throw new Error(`Login fallo: ${login.status()}`);
  const setCookie = login.headers()["set-cookie"] ?? "";
  const token = /token=([^;]+)/.exec(setCookie)?.[1];
  if (!token) throw new Error("Sin cookie token");
  await context.addCookies([{ name: "token", value: token, domain: "localhost", path: "/" }]);

  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  const resaltar = async (locator) => {
    await locator.evaluate((el) => {
      el.style.outline = "3px solid #dc2626";
      el.style.outlineOffset = "2px";
      el.style.borderRadius = "8px";
      el.style.backgroundColor = "rgba(220,38,38,0.08)";
    });
  };
  const tarjetaDe = (elemento) => elemento.locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
  const ir = async () => {
    await page.goto(`${BASE}/dashboard/mis-pagos`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
  };

  /* Figura 1: Mis documentos de la cuenta (tarjeta con plan del contrato). */
  await ir();
  await page.evaluate(() => {
    const boton = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Agregar cuota"));
    const tarjeta = boton?.closest('div[class*="rounded"]');
    if (tarjeta?.parentElement) tarjeta.parentElement.style.display = "none";
  });
  await page.screenshot({ path: `${IMG}/fact-01-mis-documentos.png` });
  console.log("OK fact-01");

  /* Figura 2 (marcada): icono que abre el formulario de requisitos. */
  await ir();
  const botonSolicitar = page.locator("main button:has(svg.lucide-file-text)").first();
  await resaltar(botonSolicitar);
  await tarjetaDe(botonSolicitar).screenshot({ path: `${IMG}/fact-02a-tarjeta-solicitar.png` });
  console.log("OK fact-02a");
  /* Figura 2: formulario de requisitos (cuota sin solicitud enviada). */
  await ir();
  await page.locator("main button:has(svg.lucide-file-text)").first().click();
  const dialogo = page.locator('[role="dialog"]');
  await dialogo.waitFor({ state: "visible" });
  await page.waitForTimeout(600);
  await dialogo.screenshot({ path: `${IMG}/fact-02-requisitos.png` });
  console.log("OK fact-02");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  /* Figura 4 (marcada): icono que abre el panel de documentos. */
  await ir();
  const botonDocumentos = page.locator("main button:has(svg.lucide-files)").first();
  await resaltar(botonDocumentos);
  await tarjetaDe(botonDocumentos).screenshot({ path: `${IMG}/fact-03a-tarjeta-documentos.png` });
  console.log("OK fact-03a");

  /* Figura 3: panel Documentos para tu factura (cuota con contrato). */  await ir();
  await page.locator("main button:has(svg.lucide-files)").first().click();
  await dialogo.waitFor({ state: "visible" });
  await page.waitForTimeout(2500);
  const textoDialogo = await dialogo.innerText();
  if (/no hay cuenta corriente|no esta registrada|no se pudieron cargar/i.test(textoDialogo)) {
    console.log("OMITIDO fact-04: el IIMP no devolvio la cuenta corriente");
  } else {
    await dialogo.screenshot({ path: `${IMG}/fact-04-documentos-cuota.png` });
    console.log("OK fact-04");
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  /* Figura 6 (marcada): icono de descarga de la factura. */
  await ir();
  const enlaceFacturaMarcado = page.locator('a[href^="/api/pagos/factura"]').first();
  await resaltar(enlaceFacturaMarcado);
  await tarjetaDe(enlaceFacturaMarcado).screenshot({ path: `${IMG}/fact-06a-tarjeta-factura.png` });
  console.log("OK fact-06a");

  /* Figura 4 (fact-06): tarjeta de la cuota con factura y acciones de descarga. */  await ir();
  const enlaceFactura = page.locator('a[href^="/api/pagos/factura"]').first();
  const tarjetaFactura = enlaceFactura.locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
  await tarjetaFactura.screenshot({ path: `${IMG}/fact-06-factura.png` });
  console.log("OK fact-06");

  /* Figura 8 (marcada): boton Contacto. */
  await ir();
  const botonContacto = page.locator("main button:has(svg.lucide-headset)").first();
  await resaltar(botonContacto);
  await page.screenshot({ path: `${IMG}/fact-05a-boton-contacto.png` });
  console.log("OK fact-05a");

  /* Figura 5: contacto de facturacion. */  await ir();
  await page.locator("main button:has(svg.lucide-headset)").first().click();
  await dialogo.waitFor({ state: "visible" });
  await page.waitForTimeout(500);
  await dialogo.screenshot({ path: `${IMG}/fact-05-contacto.png` });
  console.log("OK fact-05");
} catch (error) {
  console.error("ERR=" + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
} finally {
  await db.query("UPDATE user_role SET password = $1 WHERE email = $2", [PASSWORD_ANTERIOR, EMAIL]).catch(() => undefined);
  await db.end().catch(() => undefined);
  await browser?.close().catch(() => undefined);
}
