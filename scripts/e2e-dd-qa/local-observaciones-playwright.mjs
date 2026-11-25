// E2E LOCAL con Playwright: lo que ve y hace el cliente cuando SIG o Legal observan, y como subsana.
// Requiere `npm run dev` (por defecto http://localhost:3001) y los clientes de prueba e2e-lNN@example.invalid.
// Uso: node scripts/e2e-dd-qa/local-observaciones-playwright.mjs   (E2E_BASE, E2E_OUT, E2E_HEADLESS=0 opcionales)
// Cada caso afirma el comportamiento CORRECTO; las capturas quedan en E2E_OUT.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.E2E_BASE || "http://localhost:3001";
const EVENTO = process.env.E2E_EVENTO || "c50908e1-793b-4ab4-83b9-ee60f499479e"; // PERUMIN 2027 local
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PASSWORD = "E2eTest#2026";
const SIG = "e2e-admin-local@example.invalid";
const OUT = process.env.E2E_OUT || path.resolve("e2e-capturas");
const HEADLESS = process.env.E2E_HEADLESS !== "0";
/* Espejo de src/lib/shared/constants.ts (este script corre suelto, sin build). */
const DD_ESTADOS = { OBSERVADA: "observada", EN_REVISION: "en_revision", EN_LEGAL: "en_legal", DOCUMENTACION_RECIBIDA: "doc_recibida" };
const DD_OBSERVACION_ESTADOS = { ABIERTA: "abierta" };
const DD_DOCUMENTOS = { FICHA_RUC: "ficha_ruc", PODERES: "poderes", IDENTIDAD_REPRESENTANTE: "identidad_representante", DECLARACION_JURADA: "declaracion_jurada" };
const DD_VINCULOS = { EXHIBIDOR: "exhibidor" };
const DD_TIPOS_DOCUMENTO_REPRESENTANTE = { DNI: "DNI" };
const DD_MATRIZ_TIPOS_VINCULO = { EMPRESA: "empresa" };
const DD_MATRIZ_SI_NO_NA = { NO: "no" };
const DD_ACCIONES_REVISION = { RECHAZAR: "rechazar" };
const DD_ACCIONES_LEGAL = { APROBAR: "aprobar" };
const DD_ALCANCES_REVISION = { EXPEDIENTE: "expediente" };
const DD_PASO = { VINCULOS: 3, DOCUMENTOS: 4 };
const TEXTO_FALTANTE = "Estimado(a), para continuar con el proceso de debida diligencia, le solicitamos registrar a todos los representantes legales vinculados a su Ficha RUC, así como a los socios que cuenten con una participación igual o mayor al 10%.";

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
  const archivo = path.join(OUT, `${String(paso).padStart(2, "0")}-${nombre}.png`);
  await page.screenshot({ path: archivo, fullPage: false });
  return archivo;
}
async function caso(id, nombre, page, fn) {
  try {
    const r = await fn();
    reg(id, nombre, true, r ?? "");
    return true;
  } catch (e) {
    const archivo = page ? await captura(page, `${id}-ERROR`).catch(() => "") : "";
    reg(id, nombre, false, `${e.message} ${archivo ? `(captura ${path.basename(archivo)})` : ""}`);
    return false;
  }
}

// ---------------------------------------------------------------- API (preparacion y verificacion)
const tokens = {};
async function http(u, metodo, ruta, cuerpo, formulario = false) {
  const headers = {};
  if (tokens[u]) headers.cookie = `token=${tokens[u]}`;
  let body;
  if (cuerpo !== undefined) {
    if (formulario) body = cuerpo;
    else { headers["content-type"] = "application/json"; body = JSON.stringify(cuerpo); }
  }
  const r = await fetch(BASE + ruta, { method: metodo, headers, body, redirect: "manual" });
  const m = /token=([^;]+)/.exec(r.headers.get("set-cookie") || "");
  if (m) tokens[u] = m[1];
  const t = await r.text();
  let json = null;
  try { json = JSON.parse(t); } catch { json = null; }
  return { status: r.status, ok: r.ok && json?.success !== false, json, t };
}
async function api(u, metodo, ruta, cuerpo, formulario) {
  const r = await http(u, metodo, ruta, cuerpo, formulario);
  if (!r.ok) throw new Error(`${metodo} ${ruta} -> ${r.status} ${corto(r.json?.error?.message ?? r.t)}`);
  return r.json.data ?? r.json;
}
async function loginApi(u, email) {
  delete tokens[u];
  const r = await http(u, "POST", "/api/auth/login", { email, password: PASSWORD });
  if (!r.ok) throw new Error(`login ${email} -> ${r.status}`);
  if (r.json.token) tokens[u] = r.json.token;
  await api(u, "POST", "/api/auth/seleccionar-evento", { eventoId: EVENTO });
}
const pdf = (t) => new Blob([`%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n% ${t}\n${"% e2e ".repeat(300)}\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`], { type: "application/pdf" });
function archivoPdf(nombre) {
  const ruta = path.join(OUT, nombre);
  fs.writeFileSync(ruta, `%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n% ${nombre}\n${"% e2e ".repeat(300)}\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`);
  return ruta;
}
async function clienteEnvia(n) {
  const u = `cli${n}`;
  await loginApi(u, `e2e-l${n}@example.invalid`);
  const previa = await http(u, "GET", "/api/debida-diligencia/mi-expediente?soloEvento=1");
  if (previa.json?.data?.expediente) throw new Error(`L${n} ya tiene DD (${previa.json.data.expediente.codigo}); usa otra empresa`);
  await api(u, "POST", "/api/debida-diligencia/nueva", {});
  const docs = [];
  for (const tipo of [DD_DOCUMENTOS.FICHA_RUC, DD_DOCUMENTOS.PODERES, DD_DOCUMENTOS.IDENTIDAD_REPRESENTANTE, DD_DOCUMENTOS.DECLARACION_JURADA]) {
    const fd = new FormData();
    fd.append("file", pdf(`${tipo}-l${n}`), `${tipo}-l${n}.pdf`);
    fd.append("tipo", tipo);
    const d = await api(u, "POST", "/api/debida-diligencia/documento", fd, true);
    docs.push({ tipo, nombre: d.nombre, url: d.url });
  }
  const e = await api(u, "POST", "/api/debida-diligencia/guardar", {
    tipoRelacionComercial: [DD_VINCULOS.EXHIBIDOR], actividadEconomica: "Servicios", paisConstitucion: "Perú",
    sitioWeb: `https://l${n}.example.com`, emailRepresentante: `rep-l${n}@example.com`,
    aceptaDatos: true, aceptaVerificacion: true, declaraVerdad: true,
    representanteNombre: `REPRESENTANTE L${n}`, representanteTipoDocumento: DD_TIPOS_DOCUMENTO_REPRESENTANTE.DNI,
    representanteDocumento: `4${String(Number(n) + 7000).padStart(7, "0")}`, representanteNacionalidad: "Perú",
    beneficiarios: [], documentos: docs,
  });
  await api(u, "POST", "/api/debida-diligencia/enviar", {});
  return { n, u, id: e.id, email: `e2e-l${n}@example.invalid`, razon: `E2E LOCAL L${n} S.A.C.` };
}
const estadoApi = async (c) => (await api("sig", "GET", `/api/debida-diligencia/detalle?id=${c.id}`)).estado;
async function abiertasApi(c) {
  const d = await api("sig", "GET", `/api/debida-diligencia/detalle?id=${c.id}`);
  return (d.observaciones || []).filter((o) => o.estado === DD_OBSERVACION_ESTADOS.ABIERTA);
}
async function filaEmpresa(c) {
  const m = await api("sig", "GET", `/api/debida-diligencia/matriz-evaluacion?expedienteId=${c.id}&perPage=100`);
  return (m.data || []).find((f) => f.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA);
}

// ---------------------------------------------------------------- navegador
let browser;
async function contexto(email) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-PE" });
  const r = await ctx.request.post(`${BASE}/api/auth/login`, { data: { email, password: PASSWORD } });
  if (!r.ok()) throw new Error(`login UI ${email} -> ${r.status()}`);
  await ctx.request.post(`${BASE}/api/auth/seleccionar-evento`, { data: { eventoId: EVENTO } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(25000);
  return { ctx, page };
}
const esperar = (page, ms = 800) => page.waitForTimeout(ms);
async function confirmar(page, nombre) {
  const dialogo = page.getByRole("alertdialog").or(page.getByRole("dialog").filter({ has: page.getByRole("button", { name: nombre, exact: true }) })).last();
  await dialogo.getByRole("button", { name: nombre, exact: true }).click();
}

/** SIG, desde la matriz: inicia la revision (vinculos completos) y registra DOCUMENTACION OBSERVADA. */
async function sigObservaUI(page, c, { documentos = [], vinculos = [], comentario = "" }, etiqueta) {
  const fila = await filaEmpresa(c);
  await page.goto(`${BASE}/dashboard/debida-diligencia/matriz/${fila.id}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Matriz", exact: true }).first().click();
  const modal = page.getByRole("dialog").filter({ hasText: "Revisar debida diligencia" });
  await modal.waitFor();
  await modal.getByText("Conclusión final", { exact: true }).waitFor();
  await esperar(page, 1500);
  await captura(page, `${etiqueta}-sig-modal-doc-recibida`);
  /* En Documentacion recibida no hay conclusion: se inicia la revision declarando vinculos completos. */
  await modal.locator("label", { hasText: "todos los vínculos de la solicitud están registrados y completos" }).getByRole("checkbox").click();
  await confirmar(page, "Declarar");
  await modal.getByText("En revisión", { exact: true }).first().waitFor();
  await esperar(page);
  await modal.getByRole("button", { name: /DOCUMENTACIÓN OBSERVADA/ }).click();
  for (const titulo of documentos) {
    await modal.getByRole("tab", { name: /Documentos/ }).click();
    const tarjeta = modal.locator(`xpath=.//p[normalize-space()='${titulo}']/ancestor::div[.//button[@role='checkbox']][1]`).first();
    await tarjeta.getByRole("checkbox").first().click();
  }
  if (comentario) await modal.locator("#final-comentario-cliente").fill(comentario);
  for (const v of vinculos) {
    const label = modal.locator("label", { hasText: v.etiqueta }).first();
    await label.getByRole("checkbox").click();
    await label.locator("xpath=following-sibling::div[1]//textarea").fill(v.comentario);
  }
  await captura(page, `${etiqueta}-sig-conclusion-observada`);
  await modal.getByRole("button", { name: "Registrar conclusión final" }).click();
  await confirmar(page, "Registrar resultado");
  await page.getByText(/Resultado final: DOCUMENTACIÓN OBSERVADA/).first().waitFor({ timeout: 20000 });
  return estadoApi(c);
}

/** Legal: observa documentos desde su bandeja. */
async function legalObservaUI(page, c, { documentos, comentario }, etiqueta) {
  await page.goto(`${BASE}/dashboard/debida-diligencia/legal`, { waitUntil: "networkidle" });
  const filaTabla = page.locator("tr", { hasText: c.razon }).first();
  await filaTabla.getByRole("button", { name: /Revisar/ }).click();
  const modal = page.getByRole("dialog").last();
  await modal.getByText("Guardar decisión").waitFor();
  await esperar(page, 1200);
  await modal.locator("label", { hasText: "El cliente debe subsanar y reenviar el expediente." }).click();
  await modal.getByRole("tab", { name: /Documentos/ }).click();
  for (const titulo of documentos) {
    const tarjeta = modal.locator(`xpath=.//*[normalize-space()='${titulo}']/ancestor::div[.//button[@role='checkbox']][1]`).first();
    await tarjeta.getByRole("checkbox").first().click();
  }
  await modal.getByPlaceholder("Observación de Legal para que el cliente subsane (obligatoria)").fill(comentario);
  await captura(page, `${etiqueta}-legal-observa`);
  await modal.getByRole("button", { name: "Guardar decisión" }).click();
  await confirmar(page, "Observar");
  await esperar(page, 2500);
  return estadoApi(c);
}

/** Cliente: Mi debida diligencia y formulario. Devuelve los textos visibles para las afirmaciones. */
async function clienteVe(page, etiqueta) {
  await page.goto(`${BASE}/dashboard/debida-diligencia`, { waitUntil: "networkidle" });
  await page.getByText("Estado de la evaluación").waitFor();
  await esperar(page, 1200);
  await captura(page, `${etiqueta}-cliente-mi-dd`);
  const miDd = await page.locator("main").innerText();
  await page.goto(`${BASE}/dashboard/debida-diligencia/formulario`, { waitUntil: "networkidle" });
  await page.getByText(/Paso \d de 4/).first().waitFor();
  await esperar(page, 1500);
  await captura(page, `${etiqueta}-cliente-formulario`);
  const form = await page.locator("main").innerText();
  const pasoActual = (/Paso (\d) de 4/.exec(form) || [])[1];
  const alertas = await page.locator('nav[aria-label="Progreso del formulario de debida diligencia"] button[aria-label*="tiene observaciones"]').count();
  return { miDd, form, pasoActual: Number(pasoActual), alertas };
}
async function clienteEnviaUI(page, etiqueta) {
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await confirmar(page, "Enviar a revisión");
  /* Tras reenviar, el portal lleva a "Mi debida diligencia". */
  await page.waitForURL((url) => url.pathname === "/dashboard/debida-diligencia", { timeout: 25000 });
  await page.getByText("Estado de la evaluación").waitFor();
  await esperar(page, 1500);
  await captura(page, `${etiqueta}-cliente-enviado`);
  return page.locator("main").innerText();
}
async function irAPasoDocumentos(page) {
  for (let i = 0; i < 4 && !(await page.getByText("Paso 4 de 4").isVisible()); i += 1) {
    await page.getByRole("button", { name: "Continuar" }).click();
    await esperar(page, 600);
  }
}
async function subirNuevaVersion(page, titulo, archivo) {
  const tarjeta = page.locator(`xpath=//*[normalize-space()='${titulo}']/ancestor::div[.//button[normalize-space()='Subir nueva versión' or .//span[normalize-space()='Subir nueva versión']]][1]`).first();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    tarjeta.getByRole("button", { name: "Subir nueva versión" }).click(),
  ]);
  await chooser.setFiles(archivo);
  await page.getByText(/cargad|subid|nueva versión/i).first().waitFor().catch(() => null);
  await esperar(page, 1500);
}

// ================================================================ escenarios
async function escenarioSigVinculoFaltante(sig, c) {
  const id = "S1";
  let ok = await caso(id, "SIG inicia la revision y observa solo 'Falta agregar un vinculo' (caso MOTORYSA)", sig, async () => {
    const e = await sigObservaUI(sig, c, { vinculos: [{ etiqueta: "Falta agregar un vínculo", comentario: TEXTO_FALTANTE }] }, id);
    if (e !== DD_ESTADOS.OBSERVADA) throw new Error(`estado=${e}`);
    const ab = await abiertasApi(c);
    return `estado=${e}; abiertas=${ab.map((o) => o.vinculoTipo ?? o.documentoTipo ?? "general").join(",")}`;
  });
  if (!ok) return;
  const { ctx, page } = await contexto(c.email);
  try {
    ok = await caso(id, "cliente ve la observacion en Mi DD y en el formulario (abre en paso 3, alerta, sin '0 observaciones')", page, async () => {
      const v = await clienteVe(page, id);
      const errores = [];
      if (!v.miDd.includes("registrar a todos los representantes legales")) errores.push("Mi DD sin el texto");
      if (v.pasoActual !== DD_PASO.VINCULOS) errores.push(`formulario abre en paso ${v.pasoActual}`);
      if (!/tiene 1 observación abierta/.test(v.form)) errores.push("aviso no dice 1 observación");
      if (/0 observaciones abiertas/.test(v.form)) errores.push("sigue diciendo 0 observaciones");
      if (!v.form.includes("Vínculo faltante")) errores.push("no indica Vínculo faltante");
      if (v.alertas !== 1) errores.push(`pasos en alerta=${v.alertas}`);
      if (errores.length) throw new Error(errores.join("; "));
      return `paso inicial=${v.pasoActual}; pasos en alerta=${v.alertas}`;
    });
    await caso(id, "desde el paso 2 el aviso ofrece 'Corregir en Representante y vinculos'", page, async () => {
      await page.getByRole("button", { name: /Ir al paso Empresa/ }).click();
      await esperar(page);
      await captura(page, `${id}-cliente-paso2`);
      await page.getByRole("button", { name: "Corregir en Representante y vínculos" }).click();
      await page.getByText("Paso 3 de 4").waitFor();
      return "boton lleva al paso 3";
    });
    await caso(id, "cliente agrega el vinculo faltante y reenvia -> En revision (no Documentacion recibida)", page, async () => {
      await page.getByRole("button", { name: "Agregar vínculo" }).click();
      /* Vinculo extranjero con pasaporte ficticio: no se consulta RENIEC (evita traer datos de personas reales). */
      await page.getByRole("combobox").filter({ hasText: "Selecciona país" }).last().click();
      await page.getByPlaceholder("Buscar país o código...").fill("Chile");
      await page.getByRole("option", { name: /Chile/ }).first().click();
      await page.getByRole("combobox").filter({ hasText: /^DNI$/ }).last().click();
      await page.getByRole("option", { name: "Pasaporte" }).click();
      await page.getByPlaceholder("N.º de documento").last().fill("E2E000707");
      await page.getByPlaceholder("Nombre completo o razón social").last().fill("SEGUNDO REPRESENTANTE E2E L07");
      await page.getByRole("combobox").filter({ hasText: "Seleccione el tipo de vínculo" }).last().click();
      await page.getByRole("option", { name: "Representante legal" }).click();
      await captura(page, `${id}-cliente-vinculo-agregado`);
      await irAPasoDocumentos(page);
      await captura(page, `${id}-cliente-paso4`);
      const texto = await clienteEnviaUI(page, id);
      const e = await estadoApi(c);
      const ab = await abiertasApi(c);
      if (e !== DD_ESTADOS.EN_REVISION) throw new Error(`estado=${e}`);
      if (ab.length) throw new Error(`quedan ${ab.length} abiertas`);
      if (!texto.includes("Observaciones subsanadas") || !texto.includes("revisa las correcciones que enviaste")) {
        throw new Error("Mi DD no refleja la subsanacion (dice 'Sin observaciones' o 'revisó los documentos')");
      }
      return `estado=${e}; Mi DD: Observaciones subsanadas / Logística revisa las correcciones`;
    });
  } finally {
    await ctx.close();
  }
}

async function escenarioSigMixto(sig, c) {
  const id = "S2";
  const ok = await caso(id, "SIG observa Ficha RUC + representante + comentario general", sig, async () => {
    const e = await sigObservaUI(sig, c, {
      documentos: ["Ficha RUC o identificación fiscal"],
      comentario: "Actualiza la Ficha RUC con fecha de este mes.",
      vinculos: [{ etiqueta: `Representante legal: REPRESENTANTE L${c.n}`, comentario: "El DNI del representante no coincide con la vigencia de poderes." }],
    }, id);
    if (e !== DD_ESTADOS.OBSERVADA) throw new Error(`estado=${e}`);
    const ab = await abiertasApi(c);
    return `estado=${e}; abiertas=${ab.map((o) => o.vinculoTipo ?? o.documentoTipo ?? "general").join(",")}`;
  });
  if (!ok) return;
  const { ctx, page } = await contexto(c.email);
  try {
    await caso(id, "cliente ve documento y representante; abre en paso 3 con pasos 3 y 4 en alerta", page, async () => {
      const v = await clienteVe(page, id);
      const errores = [];
      if (v.pasoActual !== DD_PASO.VINCULOS) errores.push(`abre en paso ${v.pasoActual}`);
      if (v.alertas !== 2) errores.push(`pasos en alerta=${v.alertas}`);
      if (!/tiene 2 observaciones abiertas/.test(v.form)) errores.push("aviso no dice 2 observaciones");
      if (!v.form.includes("Ficha RUC")) errores.push("no menciona Ficha RUC");
      if (!v.form.includes("no coincide con la vigencia de poderes")) errores.push("no muestra la observacion del representante");
      if (/Solo debes corregir lo observado/.test(v.form)) errores.push("muestra el aviso antiguo incompleto");
      if (errores.length) throw new Error(errores.join("; "));
      return `paso=${v.pasoActual}; alertas=${v.alertas}`;
    });
    await caso(id, "reenviar sin subir la nueva Ficha RUC queda bloqueado", page, async () => {
      await page.getByRole("button", { name: "Corregir en Documentos" }).click();
      await page.getByText("Paso 4 de 4").waitFor();
      await esperar(page);
      await captura(page, `${id}-cliente-paso4-bloqueado`);
      const deshabilitado = await page.getByRole("button", { name: "Enviar a revisión" }).isDisabled();
      if (!deshabilitado) throw new Error("Enviar a revision habilitado sin corregir el documento");
      return "Enviar deshabilitado";
    });
    await caso(id, "sube nueva version de la Ficha RUC y reenvia -> En revision", page, async () => {
      await subirNuevaVersion(page, "Ficha RUC o identificación fiscal", archivoPdf("ficha-ruc-l08-v2.pdf"));
      await captura(page, `${id}-cliente-ficha-subida`);
      await clienteEnviaUI(page, id);
      const e = await estadoApi(c);
      const ab = await abiertasApi(c);
      if (e !== DD_ESTADOS.EN_REVISION) throw new Error(`estado=${e}`);
      if (ab.length) throw new Error(`quedan ${ab.length} abiertas`);
      return `estado=${e}`;
    });
  } finally {
    await ctx.close();
  }
}

async function escenarioLegal(sig, c) {
  const id = "L1";
  const ok = await caso(id, "SIG inicia y deriva a Legal; Legal observa la vigencia de poderes desde su bandeja", sig, async () => {
    const fila = await filaEmpresa(c);
    const det = await api("sig", "GET", `/api/debida-diligencia/matriz-evaluacion/detalle?id=${fila.id}`);
    await api("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", { id: fila.id, borrador: true, listas: { [det.listas[0].codigo]: DD_MATRIZ_SI_NO_NA.NO } });
    await api("sig", "POST", "/api/debida-diligencia/revisar", { expedienteId: c.id, alcance: DD_ALCANCES_REVISION.EXPEDIENTE, accion: DD_ACCIONES_REVISION.RECHAZAR, motivo: "Derivado a Legal (e2e)", informeLogisticaUrl: "https://drive.google.com/e2e-informe", documentosObservados: [], observaciones: [], derivarComunicaciones: false });
    const enLegal = await estadoApi(c);
    if (enLegal !== DD_ESTADOS.EN_LEGAL) throw new Error(`tras derivar=${enLegal}`);
    const e = await legalObservaUI(sig, c, { documentos: ["Vigencia de poderes del representante legal"], comentario: "La vigencia de poderes no está actualizada (menos de 3 meses)." }, id);
    if (e !== DD_ESTADOS.OBSERVADA) throw new Error(`estado=${e}`);
    const ab = await abiertasApi(c);
    return `${enLegal} -> ${e}; abiertas=${ab.map((o) => `${o.area}:${o.documentoTipo ?? "general"}`).join(",")}`;
  });
  if (!ok) return;
  const { ctx, page } = await contexto(c.email);
  try {
    await caso(id, "cliente ve la observacion de Legal; abre en Documentos con alerta", page, async () => {
      const v = await clienteVe(page, id);
      const errores = [];
      if (v.pasoActual !== DD_PASO.DOCUMENTOS) errores.push(`abre en paso ${v.pasoActual}`);
      if (v.alertas !== 1) errores.push(`pasos en alerta=${v.alertas}`);
      if (!/Legal:/.test(v.form)) errores.push("no muestra 'Legal:'");
      if (!v.form.includes("no está actualizada")) errores.push("sin el texto de Legal");
      if (!v.miDd.includes("no está actualizada")) errores.push("Mi DD sin el texto de Legal");
      if (errores.length) throw new Error(errores.join("; "));
      return `paso=${v.pasoActual}; alertas=${v.alertas}`;
    });
    await caso(id, "sube nueva vigencia de poderes y reenvia -> vuelve a En revision legal", page, async () => {
      await subirNuevaVersion(page, "Vigencia de poderes del representante legal", archivoPdf("poderes-l09-v2.pdf"));
      const texto = await clienteEnviaUI(page, id);
      const e = await estadoApi(c);
      if (e !== DD_ESTADOS.EN_LEGAL) throw new Error(`estado=${e} (se esperaba en_legal)`);
      if (!texto.includes("Legal revisa las correcciones que enviaste")) throw new Error("Mi DD no indica que Legal revisa la corrección");
      return `estado=${e}; Mi DD: Legal revisa las correcciones`;
    });
    await caso(id, "Legal aprueba -> En revision sin observaciones abiertas", page, async () => {
      await api("sig", "POST", "/api/debida-diligencia/legal/resolver", { expedienteId: c.id, decision: DD_ACCIONES_LEGAL.APROBAR, motivo: null, documentosObservados: [], informeLegalNombre: null, informeLegalUrl: null });
      const e = await estadoApi(c);
      const ab = await abiertasApi(c);
      if (e !== DD_ESTADOS.EN_REVISION || ab.length) throw new Error(`estado=${e}; abiertas=${ab.length}`);
      await page.goto(`${BASE}/dashboard/debida-diligencia`, { waitUntil: "networkidle" });
      await esperar(page, 1200);
      await captura(page, `${id}-cliente-tras-legal`);
      return `estado=${e}`;
    });
  } finally {
    await ctx.close();
  }
}

(async () => {
  browser = await chromium.launch({ executablePath: CHROME, headless: HEADLESS });
  try {
    await loginApi("sig", SIG);
    const sig = await contexto(SIG);
    const c7 = await clienteEnvia("07");
    const c8 = await clienteEnvia("08");
    const c9 = await clienteEnvia("09");
    for (const c of [c7, c8, c9]) {
      const e = await estadoApi(c);
      reg("PREP", `L${c.n} enviada por el cliente`, e === DD_ESTADOS.DOCUMENTACION_RECIBIDA, `estado=${e}`);
    }
    await escenarioSigVinculoFaltante(sig.page, c7);
    await escenarioSigMixto(sig.page, c8);
    await escenarioLegal(sig.page, c9);
    await sig.ctx.close();
  } finally {
    await browser.close();
  }
  const ok = resultados.filter((r) => r.ok).length;
  console.log(`=== RESUMEN: ${ok}/${resultados.length} OK, ${resultados.length - ok} FAIL · capturas en ${OUT} ===`);
  fs.writeFileSync(path.join(OUT, "resultados.json"), JSON.stringify(resultados, null, 1));
})().catch((e) => {
  console.log("FATAL", e.stack);
  process.exit(1);
});
