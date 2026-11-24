/**
 * Capturas del manual contextual de "Mis reservas" (public/manual/casos).
 *
 * Usa el servidor local (`npm run dev` en localhost:3001) y una cuenta de prueba local.
 * Cada caso real (observacion del Asociado, del area legal, grupo de documentos, contrato,
 * devolucion sin detalle, reenvio...) se reproduce interceptando la respuesta del listado con
 * datos de DEMOSTRACION (sin datos de clientes). Las acciones que escriben (subir, firmar,
 * reenviar) se bloquean: el script solo abre ventanas y toma capturas.
 *
 * Uso: node scripts/capturas-manual-casos.mjs
 */
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:3001";
const EMAIL = "correo12412@correo.com";
const PASSWORD_TEMPORAL = "capturas123";
const OUT = "public/manual/casos";

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

/* ---------- Datos de demostracion ---------- */
const T_OBS = "2026-11-20T16:00:00.000Z";
const ANTES = "2026-11-18T10:00:00.000Z";
const DESPUES = "2026-11-21T10:00:00.000Z";
const VIGENCIA = "Vigencia de Poder (o equivalente, en caso de empresa extranjera)";

function demo(base, cambios) {
  const userId = base.userId;
  const url = base.docsAdjuntos?.[0]?.url ?? "/uploads/demo.pdf";
  const doc = (id, extra) => ({
    id, url, nombre: `${id}.pdf`, userId, uploadedBy: "contacto@empresademo.pe", categoria: "anexo", requisito: null,
    origen: null, estado: "activo", motivoObservacion: null, observadoPor: null, observadoAt: null,
    sgcObservationId: null, sgcDocumentId: null, sgcTitle: null, sgcPieceId: null, createdAt: ANTES, ...extra,
  });
  const docs = {
    ruc: doc("ficha-ruc", { requisito: "ficha-ruc", nombre: "ficha-ruc.pdf" }),
    vig: doc("vigencia-poder", { requisito: "vigencia-poder", nombre: "vigencia-poder.pdf" }),
    dni: doc("dni", { requisito: "dni-representante", nombre: "dni-representante.pdf" }),
    admin: (createdAt) => doc("contrato-admin", { userId: null, uploadedBy: "sistema", categoria: "contrato", origen: "generado", nombre: "Contrato de exhibicion (100%).pdf", createdAt }),
    firmado: (createdAt, extra = {}) => doc("contrato-firmado", { categoria: "contrato_firmado", nombre: "contrato-firmado.pdf", createdAt, ...extra }),
    doc,
  };
  const fila = {
    ...base,
    empresa: "EMPRESA DEMO S.A.C.",
    email: "contacto@empresademo.pe",
    nombreUsuario: "Representante Demo",
    standCode: "E-90",
    standCodes: ["E-90"],
    pabellon: "EXTERIORES",
    ddEstado: null,
    estadoPago: null,
    tieneFacturacion: false,
    facturacionId: null,
    sgcEstadoEnvio: "creado",
    sgcLifecycleStatus: "observed",
    sgcStage: "drafting",
    sgcDevolucionMotivo: null,
    sgcSubsanacionReenviadaAt: null,
    sgcObservaciones: [],
    revisiones: [{ ...base.revisiones?.[0], area: "asociado", estado: "aprobado", comentario: null }],
    revisionAsociado: { ...base.revisionAsociado, estado: "aprobado", comentario: null },
    estadoSolicitud: "observado",
    contratoHabilitado: true,
    ...cambios(docs),
  };
  fila.docsAdjuntosCount = fila.docsAdjuntos.length;
  fila.clienteDocsAdjuntosCount = fila.docsAdjuntos.filter((d) => d.userId).length;
  fila.docsAdminCount = fila.docsAdjuntos.filter((d) => !d.userId).length;
  return fila;
}

const obsVigencia = { observationId: "obs-vig", documentId: "doc-vig", category: "annex", requisito: "vigencia-poder", title: VIGENCIA, message: `Corrige el adjunto «${VIGENCIA}» y vuelve a enviarlo.`, status: "open", requiresDocumentChange: true, createdAt: T_OBS };
const obsContrato = { observationId: "obs-con", documentId: "doc-con", category: "contract", title: "Contrato de separación de stand v1", message: "Corrige el contrato «Contrato de separación de stand v1» y vuelve a enviarlo.", status: "open", requiresDocumentChange: true, createdAt: T_OBS };
const piezas = [
  { id: "p1", title: "Vigencia de Poder actualizada del apoderado", acceptedDocumentId: null },
  { id: "p2", title: "DNI (en PDF) del apoderado", acceptedDocumentId: null },
  { id: "p3", title: "Ficha RUC actualizada de la empresa", acceptedDocumentId: null },
];
const obsGrupo = { observationId: "obs-grupo", documentId: null, category: "annex", title: "Se solicita documentos", message: "Falta adjuntar: Se solicita documentos.", status: "open", requiresDocumentChange: true, requiresNewDocument: true, expectedDocuments: 3, pieces: piezas, createdAt: T_OBS };
const obsImplicita = { observationId: "devolucion-sin-obs-v5", documentId: "doc-con", category: "contract", title: "Contrato de separación de stand v1", message: "El área legal devolvió el trámite sin marcar documentos: adjunta los documentos que te solicitó el área legal y firma nuevamente el contrato.", status: "open", requiresDocumentChange: true, createdAt: T_OBS };
const asociadoObservado = { area: "asociado", estado: "observado", comentario: "La vigencia de poder adjunta está vencida. Sube una vigencia actualizada." };

/** Cada caso: datos + pasos de captura. */
const SOLO = process.env.SOLO ? process.env.SOLO.split(",") : null;
const CASOS = [
  {
    id: "en-revision",
    fila: (d) => ({ estadoSolicitud: "aprobado", sgcLifecycleStatus: "legal-review", sgcStage: "internal-review", docsAdjuntos: [d.ruc, d.vig, d.dni, d.admin(ANTES), d.firmado(DESPUES)] }),
    pasos: async (p) => { await p.tarjeta("en-revision-1", () => p.page.getByText("Area legal", { exact: false }).first()); },
  },
  {
    id: "firmar-contrato",
    fila: (d) => ({ estadoSolicitud: "pendiente", sgcEstadoEnvio: null, sgcLifecycleStatus: null, sgcStage: null, revisiones: [{ area: "asociado", estado: "pendiente", comentario: null }], revisionAsociado: { area: "asociado", estado: "pendiente", comentario: null }, docsAdjuntos: [d.ruc, d.vig, d.dni, d.admin(ANTES)] }),
    pasos: async (p) => {
      await p.tarjeta("firmar-contrato-1", () => p.boton("Firmar contrato"));
      await p.boton("Firmar contrato").click();
      await p.dialogo("firmar-contrato-2", () => p.dialog().getByRole("button", { name: /Firmar contrato/ }).first());
    },
  },
  {
    id: "asociado-documentos",
    fila: (d) => ({ sgcEstadoEnvio: null, sgcLifecycleStatus: null, sgcStage: null, revisiones: [asociadoObservado], revisionAsociado: asociadoObservado,
      docsAdjuntos: [d.ruc, { ...d.vig, estado: "observado", motivoObservacion: "Vigencia vencida", observadoPor: "asociado@iimp.org.pe" }, d.dni, d.admin(ANTES), d.firmado(DESPUES)] }),
    pasos: async (p) => {
      await p.tarjeta("asociado-documentos-1", () => p.boton("Subir / reemplazar documentos"));
      await p.boton("Subir / reemplazar documentos").click();
      await p.dialogo("asociado-documentos-2", () => p.dialog().getByRole("button", { name: "Adjuntar" }).first());
    },
  },
  {
    id: "asociado-documentos-reenvio",
    fila: (d) => ({ sgcEstadoEnvio: null, sgcLifecycleStatus: null, sgcStage: null, revisiones: [asociadoObservado], revisionAsociado: asociadoObservado,
      docsAdjuntos: [d.ruc, { ...d.vig, estado: "observado", motivoObservacion: "Vigencia vencida" }, { ...d.vig, id: "vig-nueva", createdAt: DESPUES }, d.dni, d.admin(ANTES), d.firmado(DESPUES)] }),
    pasos: async (p) => { await p.tarjeta("asociado-documentos-3", () => p.boton("Reenviar a revisión")); },
  },
  {
    id: "asociado-contrato",
    fila: (d) => ({ sgcEstadoEnvio: null, sgcLifecycleStatus: null, sgcStage: null, revisiones: [{ ...asociadoObservado, comentario: "Falta la firma del segundo representante." }], revisionAsociado: { ...asociadoObservado, comentario: "Falta la firma del segundo representante." },
      docsAdjuntos: [d.ruc, d.vig, d.dni, d.admin(ANTES), d.firmado("2026-11-19T10:00:00.000Z", { estado: "observado", motivoObservacion: "Falta firma" })] }),
    pasos: async (p) => { await p.tarjeta("asociado-contrato-1", () => p.boton("Esperando contrato corregido")); },
  },
  {
    id: "sgc-documentos",
    fila: (d) => ({ sgcObservaciones: [obsVigencia], docsAdjuntos: [d.ruc, d.vig, d.dni, d.admin(ANTES), d.firmado(ANTES)] }),
    pasos: async (p) => {
      await p.tarjeta("sgc-documentos-1", () => p.boton("Subir / reemplazar documentos"));
      await p.boton("Subir / reemplazar documentos").click();
      await p.dialogo("sgc-documentos-2", () => p.dialog().getByRole("button", { name: "Reemplazar" }).first());
    },
  },
  {
    id: "sgc-grupo",
    fila: (d) => ({ sgcObservaciones: [obsGrupo], docsAdjuntos: [d.ruc, d.vig, d.dni, d.admin(ANTES), d.firmado(ANTES),
      d.doc("pieza-1", { nombre: "vigencia-apoderado.pdf", sgcObservationId: "obs-grupo", sgcPieceId: "p1", sgcTitle: piezas[0].title, createdAt: DESPUES })] }),
    pasos: async (p) => {
      await p.boton("Subir / reemplazar documentos").click();
      await p.dialogo("sgc-grupo-1", () => p.dialog().getByText("Se solicita documentos").first());
    },
  },
  {
    id: "sgc-contrato",
    fila: (d) => ({ sgcObservaciones: [obsContrato], docsAdjuntos: [d.ruc, d.vig, d.dni, d.admin(ANTES), d.firmado(ANTES)] }),
    pasos: async (p) => {
      await p.tarjeta("sgc-contrato-1", () => p.boton("Subsanar observación"));
      await p.boton("Subsanar observación").click();
      await p.dialogo("sgc-contrato-2", () => p.dialog().getByText("Preparando contrato corregido").first());
    },
  },
  {
    id: "sgc-contrato-listo",
    fila: (d) => ({ sgcObservaciones: [obsContrato], docsAdjuntos: [d.ruc, d.vig, d.dni, d.admin(DESPUES), d.firmado(ANTES)] }),
    pasos: async (p) => { await p.tarjeta("sgc-contrato-3", () => p.boton("Firmar contrato corregido")); },
  },
  {
    id: "sgc-sin-detalle",
    fila: (d) => ({ sgcObservaciones: [obsImplicita], docsAdjuntos: [d.ruc, d.vig, d.dni, d.admin(DESPUES), d.firmado(ANTES)] }),
    pasos: async (p) => {
      await p.tarjeta("sgc-sin-detalle-1", () => p.page.getByText("sin marcar documentos", { exact: false }).first());
      await p.boton("Subir / reemplazar documentos").click();
      await p.dialogo("sgc-sin-detalle-2", () => p.dialog().getByText("sin marcar documentos", { exact: false }).first());
    },
  },
  {
    id: "sgc-reenviar",
    fila: (d) => ({ sgcObservaciones: [obsVigencia], docsAdjuntos: [d.ruc, d.vig, d.dni, d.admin(ANTES), d.firmado(ANTES),
      d.doc("vig-corregida", { nombre: "vigencia-corregida.pdf", requisito: "vigencia-poder", sgcObservationId: "obs-vig", sgcDocumentId: "doc-vig", sgcTitle: VIGENCIA, createdAt: DESPUES })] }),
    pasos: async (p) => {
      await p.tarjeta("sgc-reenviar-1", () => p.boton("Solicitar nueva revisión"));
      await p.boton("Solicitar nueva revisión").click();
      await p.dialogo("sgc-reenviar-2", () => p.dialog().getByRole("button", { name: /Reenviar/ }));
      await p.page.keyboard.press("Escape");
    },
  },
  {
    id: "pago",
    fila: (d) => ({ estadoSolicitud: "pendiente_pago", estadoPago: "pendiente_pago", sgcLifecycleStatus: "active", sgcStage: "validity", tieneFacturacion: true, docsAdjuntos: [d.ruc, d.vig, d.dni, d.admin(ANTES), d.firmado(DESPUES)] }),
    pasos: async (p) => { await p.tarjeta("pago-1", () => p.page.getByText(/pago/i).first()); },
  },
];

/* ---------- Ejecucion ---------- */
mkdirSync(OUT, { recursive: true });
const db = new pg.Client({ connectionString: databaseUrl() });
await db.connect();
const passwordAnterior = (await db.query("SELECT password FROM user_role WHERE email = $1", [EMAIL])).rows[0]?.password;
let browser;
try {
  await db.query("UPDATE user_role SET password = $1 WHERE email = $2", [hashPassword(PASSWORD_TEMPORAL), EMAIL]);
  browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: "es-PE", deviceScaleFactor: 1.5 });
  const login = await context.request.post(`${BASE}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD_TEMPORAL } });
  if (!login.ok()) throw new Error(`Login fallo: ${login.status()}`);
  const token = /token=([^;]+)/.exec(login.headers()["set-cookie"] ?? "")?.[1];
  await context.addCookies([{ name: "token", value: token, domain: "localhost", path: "/" }]);

  /* Seguridad: ninguna accion que escriba sale del navegador. */
  for (const patron of ["**/api/solicitudes/reenviar-observacion**", "**/api/solicitudes/upload-doc**", "**/api/contratos/**", "**/api/sgc/**", "**/api/upload**"]) {
    await context.route(patron, (route) => (route.request().method() === "GET" ? route.continue() : route.fulfill({ status: 409, json: { success: false, error: { message: "Bloqueado en capturas" } } })));
  }

  let filaActual = null;
  await context.route("**/api/solicitudes/listar**", async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    const base = json?.data?.data?.find((r) => (r.docsAdjuntos ?? []).length > 0) ?? json?.data?.data?.[0];
    const fila = filaActual ? demo(base, filaActual) : base;
    filaDemo = filaActual ? fila : null;
    await route.fulfill({ response: res, json: { ...json, data: { ...json.data, data: [fila], total: 1, totalPages: 1 } } });
  });

  /* Firmantes de demostracion: nombres y firmas ficticios (no se muestran datos reales del perfil). */
  const firmaPage = await context.newPage();
  await firmaPage.setContent('<div id="f" style="display:inline-block;padding:6px 14px;font:italic 34px cursive;color:#1e3a8a;background:transparent">Firma Demo</div>');
  const firmaDemo = await firmaPage.locator("#f").screenshot({ omitBackground: true });
  await firmaPage.close();
  await context.route("**/manual-demo/firma.png", (route) => route.fulfill({ status: 200, contentType: "image/png", body: firmaDemo }));
  const FIRMA = "/manual-demo/firma.png";
  await context.route("**/api/auth/perfil", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const json = await res.json();
    const d = json.data ?? {};
    const reps = ["Apoderado Demo Uno", "Apoderado Demo Dos"];
    const empresa = d.empresa ? { ...d.empresa, razonSocial: "EMPRESA DEMO S.A.C.", representanteLegalNombre: "Representante Legal Demo",
      representantesAdicionales: (d.empresa.representantesAdicionales ?? []).slice(0, 2).map((r, i) => ({ ...r, nombre: reps[i], documento: "00000000", correo: "demo@empresademo.pe", firmaUrl: FIRMA })) } : d.empresa;
    await route.fulfill({ response: res, json: { ...json, data: { ...d, email: "contacto@empresademo.pe", representanteNombre: "Representante Legal Demo", firmaUrl: FIRMA, empresa } } });
  });

  let filaDemo = null;
  await context.route("**/api/solicitudes/detalle**", async (route) => {
    if (!filaDemo) return route.continue();
    const res = await route.fetch();
    const json = await res.json();
    await route.fulfill({ response: res, json: { ...json, data: filaDemo } });
  });

  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const resaltar = async (loc) => loc.evaluate((el) => {
    el.style.outline = "3px solid #dc2626";
    el.style.outlineOffset = "3px";
    el.style.borderRadius = "8px";
  });
  const ayudas = {
    page,
    boton: (nombre) => page.getByRole("button", { name: nombre }).first(),
    dialog: () => page.getByRole("dialog").last(),
    tarjeta: async (archivo, objetivo) => {
      const card = page.locator("article").first();
      await card.waitFor();
      if (objetivo) await resaltar(objetivo());
      await card.screenshot({ path: `${OUT}/${archivo}.png` });
      console.log("ok", archivo);
    },
    dialogo: async (archivo, objetivo) => {
      const d = ayudas.dialog();
      await d.waitFor();
      await page.waitForTimeout(700);
      if (objetivo) await resaltar(objetivo());
      await d.screenshot({ path: `${OUT}/${archivo}.png` });
      console.log("ok", archivo);
    },
  };

  for (const caso of CASOS.filter((c) => !SOLO || SOLO.includes(c.id))) {
    filaActual = caso.fila;
    await page.goto(`${BASE}/dashboard/mis-solicitudes`, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    try {
      if (process.env.VERIFICAR) {
        /* Solo verificacion visual del manual contextual (no genera imagenes del manual). */
        await page.getByRole("button", { name: "Manual para esta solicitud" }).first().click();
        const d = ayudas.dialog();
        await d.waitFor();
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${process.env.VERIFICAR}/manual-${caso.id}.png` });
        console.log("verificado", caso.id);
        continue;
      }
      await caso.pasos(ayudas);
    } catch (err) {
      console.error("FALLO", caso.id, err.message.split("\n")[0]);
    }
    await page.keyboard.press("Escape").catch(() => undefined);
  }
} finally {
  if (passwordAnterior) await db.query("UPDATE user_role SET password = $1 WHERE email = $2", [passwordAnterior, EMAIL]).catch(() => undefined);
  await db.end();
  await browser?.close();
}
