// Ronda 7 (navegador) en QA con Playwright: Configuracion DD (asistente y cierre automatico), asistente IA / OCR en
// la matriz, vista ampliada, regla «Exigir evidencia» al guardar y lo que ven SIG y el cliente tras el cierre automatico.
// Requiere haber corrido ronda7.mjs (lee E2E_OUT/ronda7-estado.json) y Chrome instalado.
// Uso: node scripts/e2e-dd-qa/ronda7-ui.mjs   (E2E_BASE, E2E_OUT, E2E_HEADLESS=0 opcionales). Capturas en E2E_OUT.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.E2E_BASE || "https://qa-ecommerce.sistemasiimp.org.pe";
const EVENTO = "c0a354e0-4c79-4b38-b88d-ff824cd28964"; // Perumin 2027
const CHROME = process.env.E2E_CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PASSWORD = "E2eTest#2026";
const OUT = process.env.E2E_OUT || path.resolve("e2e-capturas/ronda7");
const HEADLESS = process.env.E2E_HEADLESS !== "0";
const ESTADO = JSON.parse(fs.readFileSync(path.join(OUT, "ronda7-estado.json"), "utf8"));
/* Espejo de src/lib/shared/constants.ts (este script corre suelto, sin build). */
const DD_ASISTENTE_MENSAJES = {
  REVISAR: "Texto agregado a la observación. Revísalo antes de guardar.",
};
const DD_MENSAJES = {
  MATRIZ_EVIDENCIA_REQUERIDA: "Sube al menos una evidencia en estos criterios (regla «Exigir evidencia por campo aplicable»):",
};
const DD_MATRIZ_RESULTADOS = { ACEPTADO: "aceptado" };
const DD_MATRIZ_CONCLUSIONES = { SIN_OBSERVACIONES: "sin_observaciones" };
const DD_MATRIZ_SI_NO_NA = { NO: "no" };
const ETIQUETAS = {
  asistente: "Asistente IA en observaciones de criterios",
  ia: "Ayúdate con IA",
  ocr: "OCR + prompt",
  opcionesCierre: ["SIN RESPUESTA", "NO APTO", "DOCUMENTACIÓN OBSERVADA"],
};

fs.mkdirSync(OUT, { recursive: true });
const resultados = [];
let paso = 0;
const corto = (v) => String(v ?? "").replace(/\s+/g, " ").slice(0, 220);
function reg(caso, nombre, ok, detalle) {
  resultados.push({ caso, nombre, ok, detalle: corto(detalle) });
  console.log(`${ok ? "OK  " : "FAIL"}|${caso}|${nombre}|${corto(detalle)}`);
}
async function captura(page, nombre) {
  paso += 1;
  const archivo = path.join(OUT, `ui-${String(paso).padStart(2, "0")}-${nombre}.png`);
  await page.screenshot({ path: archivo, fullPage: false });
  return path.basename(archivo);
}
async function caso(id, nombre, page, fn) {
  try {
    const r = await fn();
    reg(id, nombre, true, r ?? "");
    return true;
  } catch (e) {
    const archivo = page ? await captura(page, `${id}-ERROR`).catch(() => "") : "";
    reg(id, nombre, false, `${e.message} ${archivo ? `(captura ${archivo})` : ""}`);
    return false;
  }
}

// ---------------------------------------------------------------- API (preparacion)
const tokens = {};
async function api(u, metodo, ruta, cuerpo) {
  const headers = { "content-type": "application/json" };
  if (tokens[u]) headers.cookie = `token=${tokens[u]}`;
  const r = await fetch(BASE + ruta, { method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo), redirect: "manual" });
  const m = /token=([^;]+)/.exec(r.headers.get("set-cookie") || "");
  if (m) tokens[u] = m[1];
  const json = await r.json().catch(() => null);
  if (!r.ok || json?.success === false) throw new Error(`${metodo} ${ruta} -> ${r.status} ${corto(json?.error?.message)}`);
  return json?.data ?? json;
}
async function loginApi(u, email) {
  const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  const m = /token=([^;]+)/.exec(r.headers.get("set-cookie") || "");
  const json = await r.json().catch(() => null);
  tokens[u] = json?.token || m?.[1];
  if (!r.ok || !tokens[u]) throw new Error(`login ${email} -> ${r.status}`);
  await api(u, "POST", "/api/auth/seleccionar-evento", { eventoId: EVENTO });
}
async function cambiarConfig(cambios) {
  const actual = await api("admin", "GET", "/api/debida-diligencia/configuracion");
  return api("admin", "POST", "/api/debida-diligencia/configuracion", { ...actual, ...cambios });
}

// ---------------------------------------------------------------- navegador
let browser;
async function contexto(email) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: "es-PE" });
  const r = await ctx.request.post(`${BASE}/api/auth/login`, { data: { email, password: PASSWORD } });
  if (!r.ok()) throw new Error(`login UI ${email} -> ${r.status()}`);
  await ctx.request.post(`${BASE}/api/auth/seleccionar-evento`, { data: { eventoId: EVENTO } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  page.on("dialog", (d) => d.accept().catch(() => undefined));
  return { ctx, page };
}
const esperar = (page, ms = 800) => page.waitForTimeout(ms);
/* QA mantiene conexiones abiertas (notificaciones): no se espera networkidle sino elementos concretos. */
async function abrirMatriz(page, filaId) {
  await page.goto(`${BASE}/dashboard/debida-diligencia/matriz/${filaId}`, { waitUntil: "domcontentloaded" });
  const editar = page.getByRole("button", { name: "Editar", exact: true });
  await editar.waitFor();
  await editar.click();
  await page.getByRole("button", { name: /^Observación de / }).first().waitFor();
}
async function abrirCriterio(page, label) {
  await page.getByRole("button", { name: `Observación de ${label}`, exact: true }).first().click();
  await page.getByText("Observación del criterio").first().waitFor();
}

async function main() {
  await loginApi("admin", "e2e-admin@example.invalid");
  await loginApi("sig", "e2e-sig@example.invalid");
  const inicial = await api("admin", "GET", "/api/debida-diligencia/configuracion");
  browser = await chromium.launch({ executablePath: CHROME, headless: HEADLESS });
  const asist = ESTADO.asistente;
  const sig = await contexto("e2e-sig@example.invalid");
  const admin = await contexto("e2e-admin@example.invalid");
  try {
    // ---------------- Configuracion DD
    await caso("U1", "Configuracion: regla del asistente y opciones de cierre automatico", admin.page, async () => {
      const page = admin.page;
      await page.goto(`${BASE}/dashboard/debida-diligencia/configuracion`, { waitUntil: "domcontentloaded" });
      await page.getByRole("tab", { name: "Reglas y plazos" }).click().catch(() => undefined);
      await page.getByText(ETIQUETAS.asistente).waitFor();
      await page.getByText("Cierre automático").first().scrollIntoViewIfNeeded();
      const combo = page.locator("label", { hasText: "Cierre automático" }).locator("xpath=following::button[@role='combobox'][1]");
      await combo.click();
      const opciones = (await page.getByRole("option").allTextContents()).map((t) => t.trim());
      await captura(page, "config-opciones-cierre");
      await page.keyboard.press("Escape");
      const faltan = ETIQUETAS.opcionesCierre.filter((o) => !opciones.some((t) => t.startsWith(o)));
      if (faltan.length) throw new Error(`faltan opciones: ${faltan.join(", ")} (hay: ${opciones.join(" | ")})`);
      return `opciones: ${opciones.join(" | ")}`;
    });
    await caso("U1", "Configuracion: encender el asistente y guardar", admin.page, async () => {
      const page = admin.page;
      const interruptor = page.locator("label", { hasText: ETIQUETAS.asistente }).getByRole("switch");
      if ((await interruptor.getAttribute("aria-checked")) !== "true") await interruptor.click();
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await esperar(page, 2500);
      await captura(page, "config-asistente-encendido");
      const c = await api("admin", "GET", "/api/debida-diligencia/configuracion");
      if (!c.asistenteIaHabilitado) throw new Error("no se guardo");
      return "asistenteIaHabilitado=true";
    });

    // ---------------- Asistente en la matriz (SIG)
    const det = await api("sig", "GET", `/api/debida-diligencia/matriz-evaluacion/detalle?id=${asist.filaId}`);
    const label = (codigo) => det.listas.find((l) => l.codigo === codigo)?.label;
    await caso("U2", "Matriz: el criterio INDECOPI ofrece «Ayúdate con IA» y «OCR + prompt»", sig.page, async () => {
      await abrirMatriz(sig.page, asist.filaId);
      await abrirCriterio(sig.page, label("indecopi"));
      await sig.page.getByRole("button", { name: ETIQUETAS.ia }).first().waitFor();
      await sig.page.getByRole("button", { name: ETIQUETAS.ocr }).first().waitFor();
      return await captura(sig.page, "matriz-asistente-visible");
    });
    /** Envia la indicacion y espera a que la respuesta llene la observacion del criterio (hasta 90 s). */
    const preguntar = async (page, codigo, modo, prompt) => {
      await page.getByRole("button", { name: modo }).first().click();
      await page.getByRole("textbox", { name: "Indicación para el asistente" }).first().fill(prompt);
      const observacion = page.getByRole("textbox", { name: `Observación de ${label(codigo)}` }).first();
      /* La observacion puede traer texto previo: la respuesta se agrega debajo, se espera a que cambie. */
      const previo = await observacion.inputValue();
      await page.getByRole("button", { name: "Enviar" }).first().click();
      const limite = Date.now() + 90000;
      let texto = previo;
      while (Date.now() < limite && texto === previo) {
        await esperar(page, 1000);
        texto = await observacion.inputValue();
      }
      if (texto === previo) throw new Error("la respuesta no llego a la observacion");
      await page.getByText(DD_ASISTENTE_MENSAJES.REVISAR).first().waitFor();
      return texto.slice(previo.length).trim() || texto;
    };
    await caso("U2", "OCR + prompt: la respuesta llena la observación del criterio", sig.page, async () => {
      const texto = await preguntar(sig.page, "indecopi", ETIQUETAS.ocr, "Solo dime el RUC de la empresa.");
      await captura(sig.page, "matriz-ocr-respuesta");
      return corto(texto);
    });
    await caso("U2", "Ayúdate con IA en OEFA (PDF completo)", sig.page, async () => {
      await abrirCriterio(sig.page, label("oefa"));
      const texto = await preguntar(sig.page, "oefa", ETIQUETAS.ia, "¿Cuántas infracciones registra? Responde solo el número.");
      await captura(sig.page, "matriz-ia-respuesta");
      return corto(texto);
    });
    await caso("U2", "Vista ampliada de la observación (modal con el asistente)", sig.page, async () => {
      const page = sig.page;
      await page.getByRole("button", { name: "Ampliar la observación del criterio" }).first().click();
      const dialogo = page.getByRole("dialog");
      await dialogo.waitFor();
      await dialogo.getByRole("button", { name: ETIQUETAS.ia }).waitFor();
      const archivo = await captura(page, "matriz-vista-ampliada");
      await page.keyboard.press("Escape");
      await esperar(page);
      return archivo;
    });

    // ---------------- Regla apagada: el asistente desaparece
    await caso("U3", "Regla apagada en Configuracion: la matriz ya no muestra el asistente", sig.page, async () => {
      await cambiarConfig({ asistenteIaHabilitado: false });
      await abrirMatriz(sig.page, asist.filaId);
      await abrirCriterio(sig.page, label("indecopi"));
      await esperar(sig.page, 1000);
      const visibles = await sig.page.getByRole("button", { name: ETIQUETAS.ia }).count();
      await captura(sig.page, "matriz-asistente-apagado");
      if (visibles) throw new Error("el boton sigue visible");
      return "sin botones del asistente";
    });

    // ---------------- Exigir evidencia al «Guardar evaluación»
    const sinEvidencia = ESTADO.evidencia;
    if (sinEvidencia) {
      await caso("U4", "Guardar evaluación con SI sin evidencia: muestra la regla y el criterio", sig.page, async () => {
        const page = sig.page;
        const hoy = new Date().toISOString().slice(0, 10);
        /* Resultado y conclusion SIG guardados para que el boton «Guardar evaluación» quede habilitado. */
        await api("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", {
          id: asist.filaId,
          sig: { fecha: hoy, responsable: "R7 SIG", resultado: DD_MATRIZ_RESULTADOS.ACEPTADO, observaciones: null, conclusion: DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES },
        });
        await abrirMatriz(page, asist.filaId);
        const fila = page.locator("tr", { hasText: sinEvidencia.label }).first();
        await fila.getByRole("button", { name: "SI", exact: true }).click();
        /* Un SI se sustenta con su observacion: se registra para llegar a la regla de evidencia. */
        await abrirCriterio(page, sinEvidencia.label);
        await page.getByRole("textbox", { name: `Observación de ${sinEvidencia.label}` }).first().fill("R7: sustento del criterio");
        await page.getByRole("button", { name: "Guardar evaluación", exact: true }).last().click();
        const confirmar = page.getByRole("dialog").filter({ hasText: "Guardar evaluación del vínculo" }).getByRole("button", { name: "Guardar evaluación", exact: true });
        await confirmar.waitFor({ timeout: 10000 });
        await confirmar.click();
        const aviso = page.getByText(DD_MENSAJES.MATRIZ_EVIDENCIA_REQUERIDA, { exact: false }).first();
        await aviso.waitFor({ timeout: 20000 });
        const texto = await aviso.textContent();
        await captura(page, "matriz-exigir-evidencia");
        if (!texto.includes(sinEvidencia.label.slice(0, 20))) throw new Error(`no nombra el criterio: ${texto}`);
        return corto(texto);
      });
      await api("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", { id: asist.filaId, borrador: true, listas: { [sinEvidencia.criterioSinEvidencia]: DD_MATRIZ_SI_NO_NA.NO } }).catch(() => undefined);
    }

    // ---------------- Cierre automatico: lo que ven SIG y el cliente
    const cerrado = ESTADO.empresas?.A;
    if (cerrado?.filaId) {
      await caso("U5", "SIG: la matriz del expediente cerrado muestra SIN RESPUESTA", sig.page, async () => {
        await sig.page.goto(`${BASE}/dashboard/debida-diligencia/matriz/${cerrado.filaId}`, { waitUntil: "domcontentloaded" });
        await sig.page.getByText("SIN RESPUESTA").first().waitFor();
        return await captura(sig.page, "cierre-matriz-sin-respuesta");
      });
      const cliente = await contexto(cerrado.email);
      try {
        await caso("U5", "Cliente: Mi debida diligencia muestra la DD cerrada", cliente.page, async () => {
          await cliente.page.goto(`${BASE}/dashboard/debida-diligencia`, { waitUntil: "domcontentloaded" });
          await cliente.page.getByText(cerrado.codigo).first().waitFor().catch(() => undefined);
          await esperar(cliente.page, 2000);
          const cuerpo = await cliente.page.locator("body").innerText();
          await captura(cliente.page, "cierre-cliente");
          const pistas = ["falta de respuesta", "presentar una nueva", "Cerrad", "Rechazad", "NO APTO", "SIN RESPUESTA"];
          const vistas = pistas.filter((p) => cuerpo.toLowerCase().includes(p.toLowerCase()));
          if (!vistas.length) throw new Error("no se ve el cierre");
          return `muestra: ${vistas.join(", ")}`;
        });
      } finally {
        await cliente.ctx.close();
      }
    }
  } finally {
    await caso("Z", "Configuracion restaurada", null, async () => {
      const c = await cambiarConfig({ asistenteIaHabilitado: inicial.asistenteIaHabilitado });
      return `asistente=${c.asistenteIaHabilitado}`;
    });
    await browser.close();
  }
}

try {
  await main();
} catch (e) {
  reg("X", "error general", false, e.stack || e.message);
} finally {
  fs.writeFileSync(path.join(OUT, "ronda7-ui-resultados.json"), JSON.stringify(resultados, null, 2));
  const fallas = resultados.filter((r) => !r.ok).length;
  console.log(`\nTOTAL ${resultados.length - fallas}/${resultados.length} OK`);
  process.exitCode = fallas ? 1 : 0;
}
