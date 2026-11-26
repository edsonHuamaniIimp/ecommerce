// Ronda 7 E2E en QA: asistente IA / OCR de la matriz, regla «Exigir evidencia por campo aplicable» y cierre automatico.
// Corre en una PC con AWS CLI (perfil con SSM sobre la EC2 de QA) contra la URL de QA. QA no envia correos (RESEND_API_KEY vacio).
// El SQL y la llamada al cron se ejecutan DENTRO de la EC2 por SSM: el secreto del cron y la BD no salen del servidor.
// Requiere: ronda2-setup.mjs con E2E_TOTAL>=95 y ronda7-setup.mjs (usuario e2e-admin) ejecutados en el contenedor de QA.
// Cada caso afirma el comportamiento CORRECTO: un FAIL es un posible defecto. Deja el estado en E2E_OUT/ronda7-estado.json.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const ejecutar = promisify(execFile);
const BASE = process.env.E2E_BASE || "https://qa-ecommerce.sistemasiimp.org.pe";
const EVENTO = "c0a354e0-4c79-4b38-b88d-ff824cd28964"; // Perumin 2027 (evento activo de los clientes)
const PASSWORD = "E2eTest#2026";
const PERFIL = process.env.E2E_AWS_PROFILE || "sistemas-aws";
const INSTANCIA = process.env.E2E_QA_INSTANCE || "i-0a921fcd0b8767fb5";
const EJEMPLOS = process.env.E2E_EJEMPLOS || path.resolve("scratch/dd-asistente-ejemplos");
const OUT = process.env.E2E_OUT || path.resolve("e2e-capturas/ronda7");
const N0 = Number(process.env.E2E_DESDE || 82); // empresas E2E RONDA2 R82..R90 sin DD en el evento
const SOLO = (process.env.E2E_SOLO || "").split(",").filter(Boolean);
const HOY = new Date().toISOString().slice(0, 10);
/** Inicio del plazo para los casos vencidos y plazo (dias habiles) que solo los alcanza a ellos. */
const FECHA_VENCIDA = "2020-01-06T15:00:00Z";
const PLAZO_AISLADO = 1500;
/* Espejo de src/lib/shared/constants.ts: el script corre suelto y no importa TypeScript.
 * src/lib/shared/__tests__/scripts-espejo-constantes.test.ts falla si estos valores se desincronizan. */
const DD_ESTADOS = { OBSERVADA: "observada", EN_REVISION: "en_revision", EN_LEGAL: "en_legal", RECHAZADA: "rechazada" };
const DD_MATRIZ_RESULTADOS_FINALES = { DOCUMENTACION_OBSERVADA: "documentacion_observada", SIN_RESPUESTA: "sin_respuesta", NO_APTO: "no_apto" };
const DD_CONFIG_CIERRE_ESTADOS = { SIN_RESPUESTA: "sin_respuesta", NO_APTO: "no_apto", DOCUMENTACION_OBSERVADA: "documentacion_observada" };
const DD_CIERRE_AUTOMATICO = { ACTOR: "sistema:cierre-automatico" };
const DD_MENSAJES = {
  CIERRE_SIN_RESPUESTA: "Cierre por falta de respuesta de la empresa: la debida diligencia ya no puede usarse; la empresa debe presentar una nueva.",
  CIERRE_PLAZO_VENCIDO: "Cierre automático: venció el plazo para subsanar las observaciones; la debida diligencia queda NO APTO.",
  MATRIZ_EVIDENCIA_REQUERIDA: "Sube al menos una evidencia en estos criterios (regla «Exigir evidencia por campo aplicable»):",
  MATRIZ_OBSERVACION_CRITERIO_REQUERIDA: "Registra la observación del criterio en estos criterios marcados SI:",
};
const DD_ASISTENTE_MODOS = { IA: "ia", OCR: "ocr" };
const DD_ASISTENTE_METODOS_TEXTO = { TEXTO_PDF: "texto_pdf", OCR: "ocr", DOCX: "docx" };
const DD_ASISTENTE_MENSAJES = {
  SIN_PERMISO: "Solo SIG puede usar el asistente de observaciones.",
  CRITERIO_NO_HABILITADO: "El asistente solo está disponible para OEFA, OSCE, INDECOPI, lavado/corrupción y Otros.",
  SIN_EVIDENCIA: "Sube o automatiza una evidencia en este criterio antes de usar el asistente.",
  EVIDENCIA_AJENA: "La evidencia elegida no pertenece a este criterio.",
  DESHABILITADO: "El asistente de IA está deshabilitado en Configuración de Debida Diligencia (Reglas de evaluación).",
};
const DD_MATRIZ_CRITERIO_PREFIJO = "criterio_";
const DD_MATRIZ_LISTA_OSCE = "osce";
const DD_MATRIZ_LISTA_OTROS = "otros";
const DD_MATRIZ_SI_NO_NA = { SI: "si", NO: "no", NA: "na" };
const DD_MATRIZ_TIPOS_VINCULO = { EMPRESA: "empresa" };
const DD_MATRIZ_RESULTADOS = { ACEPTADO: "aceptado" };
const DD_MATRIZ_CONCLUSIONES = { SIN_OBSERVACIONES: "sin_observaciones" };
const DD_ACCIONES_REVISION = { OBSERVAR: "observar", RECHAZAR: "rechazar" };
const DD_ACCIONES_LEGAL = { OBSERVAR: "observar" };
const DD_ALCANCES_REVISION = { EXPEDIENTE: "expediente" };
const DD_DOCUMENTOS = { FICHA_RUC: "ficha_ruc", PODERES: "poderes", IDENTIDAD_REPRESENTANTE: "identidad_representante", DECLARACION_JURADA: "declaracion_jurada" };
const DD_VINCULOS = { EXHIBIDOR: "exhibidor" };
const DD_TIPOS_DOCUMENTO_REPRESENTANTE = { DNI: "DNI" };
const DD_TIPOS_VINCULO_PERSONA = { BENEFICIARIO_FINAL: "beneficiario_final" };
const DD_REPUTACION_RESULTADOS = { ACEPTADO: "aceptado" };

/** Evidencias de ejemplo (datos ficticios de MINERA DEMO / CONSTRUCTORA DEMO ANDINA) por criterio. */
const EVIDENCIAS = [
  { codigo: "oefa", archivo: "01-oefa-con-texto.pdf", mime: "application/pdf" },
  { codigo: "indecopi", archivo: "02-indecopi-escaneado.pdf", mime: "application/pdf" },
  { codigo: "corrupcion_empresa", archivo: "03-lavado-captura.png", mime: "image/png" },
  { codigo: DD_MATRIZ_LISTA_OTROS, archivo: "04-otros-informe.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
];
const EVIDENCIA_OSCE = { codigo: DD_MATRIZ_LISTA_OSCE, archivo: "05-osce-reporte-largo.pdf", mime: "application/pdf" };

fs.mkdirSync(OUT, { recursive: true });
const resultados = [];
const sesiones = {};
const ARCHIVO_ESTADO = path.join(OUT, "ronda7-estado.json");
/* Con E2E_SOLO se conserva lo que dejaron los bloques que no se vuelven a correr (lo usa ronda7-ui.mjs). */
const previo = SOLO.length && fs.existsSync(ARCHIVO_ESTADO) ? JSON.parse(fs.readFileSync(ARCHIVO_ESTADO, "utf8")) : {};
delete previo.resultados;
const estadoSalida = { ...previo, base: BASE, fecha: new Date().toISOString(), empresas: { ...(previo.empresas ?? {}) } };

// ---------------------------------------------------------------- infraestructura
const corto = (v, max = 240) => (typeof v === "string" ? v : JSON.stringify(v) ?? "").replace(/\s+/g, " ").slice(0, max);
function reg(esc, nombre, ok, detalle) {
  resultados.push({ esc, nombre, ok, detalle: corto(detalle) });
  console.log(`${ok ? "OK  " : "FAIL"}|${esc}|${nombre}|${corto(detalle)}`);
}
async function caso(esc, nombre, fn) {
  try {
    const r = await fn();
    reg(esc, nombre, true, r ?? "");
    return { ok: true, valor: r };
  } catch (e) {
    reg(esc, nombre, false, e.message);
    return { ok: false, error: e.message };
  }
}
const correr = (bloque) => SOLO.length === 0 || SOLO.includes(bloque);
async function http(usuario, metodo, ruta, cuerpo, formulario = false, extraHeaders = {}) {
  const s = sesiones[usuario];
  const headers = { ...extraHeaders };
  if (s?.token) headers.cookie = `token=${s.token}`;
  let body;
  if (cuerpo !== undefined) {
    if (formulario) body = cuerpo;
    else {
      headers["content-type"] = "application/json";
      body = JSON.stringify(cuerpo);
    }
  }
  const r = await fetch(BASE + ruta, { method: metodo, headers, body, redirect: "manual" });
  const m = /token=([^;]+)/.exec(r.headers.get("set-cookie") || "");
  if (m && s) s.token = m[1];
  const texto = await r.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    json = null;
  }
  return { status: r.status, json, texto, ok: r.ok && json?.success !== false };
}
const mensaje = (r) => corto(r.json?.error?.message || r.json?.error || r.texto || `HTTP ${r.status}`, 200);
async function api(usuario, metodo, ruta, cuerpo, formulario) {
  const r = await http(usuario, metodo, ruta, cuerpo, formulario);
  if (!r.ok) throw new Error(`${metodo} ${ruta} -> ${r.status} ${mensaje(r)}`);
  return r.json.data ?? r.json;
}
function debeRechazar(r, etiqueta, status, textoEsperado) {
  if (r.status >= 500) throw new Error(`${etiqueta}: error del servidor ${r.status} ${mensaje(r)}`);
  if (r.ok) throw new Error(`${etiqueta}: FUE ACEPTADO (${r.status})`);
  if (status && r.status !== status) throw new Error(`${etiqueta}: status ${r.status} (se esperaba ${status}) ${mensaje(r)}`);
  if (textoEsperado && !mensaje(r).includes(textoEsperado.slice(0, 60))) throw new Error(`${etiqueta}: mensaje "${mensaje(r)}"`);
  return `${r.status} ${mensaje(r)}`;
}
async function login(usuario, email) {
  sesiones[usuario] = { token: null };
  const r = await http(usuario, "POST", "/api/auth/login", { email, password: PASSWORD });
  if (!r.ok) throw new Error(`login ${email} -> ${r.status} ${mensaje(r)}`);
  sesiones[usuario].token = r.json.token || sesiones[usuario].token;
  const sel = await http(usuario, "POST", "/api/auth/seleccionar-evento", { eventoId: EVENTO });
  if (!sel.ok) throw new Error(`seleccionar-evento ${email} -> ${sel.status} ${mensaje(sel)}`);
}

// ---------------------------------------------------------------- EC2 de QA por SSM (SQL y cron)
const esperarMs = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
async function enQa(comandos, timeout = 300) {
  const solicitud = path.join(os.tmpdir(), `ronda7-ssm-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(
    solicitud,
    JSON.stringify({
      DocumentName: "AWS-RunShellScript",
      Comment: "e2e dd ronda7",
      TimeoutSeconds: timeout,
      Parameters: { commands: comandos, executionTimeout: [String(timeout)] },
    }),
  );
  const comun = ["--profile", PERFIL, "--region", "us-east-1", "--output", "json"];
  try {
    const { stdout } = await ejecutar("aws", ["ssm", "send-command", ...comun, "--instance-ids", INSTANCIA, "--cli-input-json", `file://${solicitud.replace(/\\/g, "/")}`]);
    const id = JSON.parse(stdout).Command.CommandId;
    for (let i = 0; i < timeout / 2 + 30; i += 1) {
      await esperarMs(2000);
      let inv;
      try {
        inv = JSON.parse((await ejecutar("aws", ["ssm", "get-command-invocation", ...comun, "--command-id", id, "--instance-id", INSTANCIA])).stdout);
      } catch {
        continue;
      }
      if (["Pending", "InProgress", "Delayed"].includes(inv.Status)) continue;
      if (inv.Status !== "Success") throw new Error(`SSM ${inv.Status}: ${corto(inv.StandardErrorContent || inv.StandardOutputContent, 400)}`);
      return inv.StandardOutputContent;
    }
    throw new Error("SSM sin respuesta");
  } finally {
    fs.rmSync(solicitud, { force: true });
  }
}
/** La salida viaja en base64: la consola de SSM en Windows no decodifica bien UTF-8 (tildes). */
const desdeBase64 = (salida) => Buffer.from(salida.trim(), "base64").toString("utf8");
/** Ejecuta SQL en la BD de QA (contenedor postgres de la EC2) y devuelve la salida de psql -At. */
async function sql(consulta) {
  const b64 = Buffer.from(consulta, "utf8").toString("base64");
  return desdeBase64(
    await enQa([
      "set -o pipefail",
      `echo ${b64} | base64 -d > /tmp/ronda7.sql`,
      "docker cp /tmp/ronda7.sql ctrst-qa-postgres:/tmp/ronda7.sql",
      `docker exec ctrst-qa-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -v ON_ERROR_STOP=1 -f /tmp/ronda7.sql' | base64 -w0`,
      "rm -f /tmp/ronda7.sql",
    ]),
  ).trim();
}
/* json_agg separa los elementos con saltos de linea: se quitan para leer una sola linea JSON. */
const sqlJson = async (consulta) =>
  JSON.parse((await sql(`select replace(coalesce(json_agg(t), '[]'::json)::text, E'\\n', ' ') from (${consulta}) t;`)).split("\n").pop() || "[]");
const uuid = (v) => {
  if (!/^[0-9a-f-]{36}$/i.test(v)) throw new Error(`id invalido: ${v}`);
  return `'${v}'`;
};
/** Llama al cron desde dentro del contenedor de la app con su propio CRON_SECRET. */
async function cron(simular) {
  const salida = await enQa([
    `docker exec ctrst-qa-app sh -c 'curl -s -X POST -H "x-cron-secret: $CRON_SECRET" "http://localhost:3000/api/cron/dd-cierre-automatico${simular ? "?simular=1" : ""}"' | base64 -w0`,
  ]);
  const json = JSON.parse(desdeBase64(salida));
  if (!json.success) throw new Error(`cron -> ${corto(json)}`);
  return json.data;
}

// ---------------------------------------------------------------- flujos DD (igual que ronda 6)
const pdf = (texto) =>
  new Blob([`%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n% ${texto}\n${"% e2e ".repeat(300)}\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`], { type: "application/pdf" });
async function subirDoc(usuario, tipo, etiqueta) {
  const fd = new FormData();
  fd.append("file", pdf(etiqueta), `${tipo}-${etiqueta}.pdf`);
  fd.append("tipo", tipo);
  const d = await api(usuario, "POST", "/api/debida-diligencia/documento", fd, true);
  return { tipo, nombre: d.nombre, url: d.url };
}
const TIPOS_REQ = [DD_DOCUMENTOS.FICHA_RUC, DD_DOCUMENTOS.PODERES, DD_DOCUMENTOS.IDENTIDAD_REPRESENTANTE, DD_DOCUMENTOS.DECLARACION_JURADA];
const razon = (n) => `E2E RONDA2 R${n} S.A.C.`;
const cuerpoCliente = (n, docs) => ({
  tipoRelacionComercial: [DD_VINCULOS.EXHIBIDOR],
  actividadEconomica: "Servicios",
  paisConstitucion: "Perú",
  sitioWeb: `https://r${n}.example.com`,
  emailRepresentante: `rep-r${n}@example.com`,
  aceptaDatos: true,
  aceptaVerificacion: true,
  declaraVerdad: true,
  representanteNombre: `REPRESENTANTE R${n}`,
  representanteTipoDocumento: DD_TIPOS_DOCUMENTO_REPRESENTANTE.DNI,
  representanteDocumento: `4${String(Number(n) + 1000).padStart(7, "0")}`,
  representanteNacionalidad: "Perú",
  beneficiarios: [{
    nombre: `SOCIO 1 R${n}`,
    documento: `4${String(Number(n) * 10 + 1 + 2000).padStart(7, "0")}`,
    tipoDocumento: DD_TIPOS_DOCUMENTO_REPRESENTANTE.DNI,
    nacionalidad: "Perú",
    porcentaje: 30,
    tipoVinculoPersona: DD_TIPOS_VINCULO_PERSONA.BENEFICIARIO_FINAL,
  }],
  documentos: docs.map((d) => ({ tipo: d.tipo, nombre: d.nombre, url: d.url })),
});
/** Cliente: borrador, documentos, guardar y enviar. Exige que la empresa no tenga DD en el evento. */
async function clienteEnvia(n) {
  const usuario = `cli${n}`;
  await login(usuario, `e2e-r${n}@example.invalid`);
  const previa = await http(usuario, "GET", "/api/debida-diligencia/mi-expediente?soloEvento=1");
  if (previa.json?.data?.expediente) throw new Error(`R${n} ya tiene DD (${previa.json.data.expediente.codigo}); usa E2E_DESDE con empresas libres`);
  const ctx = { n, usuario, docs: [] };
  await api(usuario, "POST", "/api/debida-diligencia/nueva", {});
  for (const tipo of TIPOS_REQ) ctx.docs.push(await subirDoc(usuario, tipo, `r${n}`));
  const e = await api(usuario, "POST", "/api/debida-diligencia/guardar", cuerpoCliente(n, ctx.docs));
  ctx.expedienteId = e.id;
  ctx.codigo = e.codigo;
  await api(usuario, "POST", "/api/debida-diligencia/enviar", {});
  return ctx;
}
const detalleExp = (ctx) => api("sig", "GET", `/api/debida-diligencia/detalle?id=${ctx.expedienteId}`);
const estado = async (ctx) => (await detalleExp(ctx)).estado;
async function filasMatriz(ctx) {
  const m = await api("sig", "GET", `/api/debida-diligencia/matriz-evaluacion?expedienteId=${ctx.expedienteId}&perPage=100`);
  ctx.filas = m.data || [];
  ctx.empresaFila = ctx.filas.find((f) => f.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA) || ctx.filas[0];
  return ctx.filas;
}
const detFila = (id, quien = "sig") => api(quien, "GET", `/api/debida-diligencia/matriz-evaluacion/detalle?id=${id}`);
const guardarFila = (cuerpo) => http("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", cuerpo);
/** Inicia la revision con un borrador (doc_recibida -> en_revision). */
async function iniciarRevision(ctx) {
  await filasMatriz(ctx);
  const det = await detFila(ctx.empresaFila.id);
  const codigo = det.listas?.find((l) => l.codigo !== DD_MATRIZ_LISTA_OTROS)?.codigo;
  const r = await guardarFila({ id: ctx.empresaFila.id, borrador: true, listas: codigo ? { [codigo]: DD_MATRIZ_SI_NO_NA.NO } : {}, sig: { observaciones: "R7 avance" } });
  if (!r.ok) throw new Error(`borrador: ${mensaje(r)}`);
  const e = await estado(ctx);
  if (e !== DD_ESTADOS.EN_REVISION) throw new Error(`tras borrador=${e}`);
  return det;
}
const finalSig = (ctx, resultadoFinal, extra = {}) =>
  guardarFila({ id: ctx.empresaFila.id, resultadoFinal, finalFecha: HOY, finalPor: "R7 SIG", finalComentario: "R7", ...extra });
const revisar = (ctx, accion, extra = {}) =>
  http("sig", "POST", "/api/debida-diligencia/revisar", {
    expedienteId: ctx.expedienteId,
    alcance: DD_ALCANCES_REVISION.EXPEDIENTE,
    accion,
    motivo: `R7 ${accion}`,
    informeLogisticaUrl: "https://drive.google.com/r7-informe",
    documentosObservados: accion === DD_ACCIONES_REVISION.OBSERVAR ? [DD_DOCUMENTOS.FICHA_RUC] : [],
    observaciones: accion === DD_ACCIONES_REVISION.OBSERVAR ? [{ documentoTipo: DD_DOCUMENTOS.FICHA_RUC, texto: "R7 observacion" }] : [],
    derivarComunicaciones: false,
    ...extra,
  });
/** Comunicaciones sin hallazgos y SIG con listas NO y conclusion en todas las filas (como ronda 6). */
async function comunicacionesYConclusiones(ctx) {
  await filasMatriz(ctx);
  await api("sig", "POST", "/api/debida-diligencia/vinculos-completos", { expedienteId: ctx.expedienteId, completos: true });
  await api("sig", "POST", "/api/debida-diligencia/derivar-comunicaciones", { expedienteId: ctx.expedienteId });
  const r = await api("com", "GET", `/api/debida-diligencia/reputacion/listar?search=${encodeURIComponent(razon(ctx.n))}&perPage=50`);
  const grupo = (r.data || []).find((g) => g.expedienteId === ctx.expedienteId);
  if (!grupo) throw new Error("Comunicaciones no ve el expediente derivado");
  for (const c of grupo.casos) {
    await api("com", "POST", "/api/debida-diligencia/reputacion/iniciar", { id: c.id });
    await api("com", "POST", "/api/debida-diligencia/reputacion/observar", {
      id: c.id, resultado: DD_REPUTACION_RESULTADOS.ACEPTADO, comentario: "Sin observaciones", linkHallazgos: "", cerrar: true, notificar: false,
    });
  }
  for (const f of ctx.filas) {
    const det = await detFila(f.id);
    const listas = {};
    for (const l of det.listas) listas[l.codigo] = l.codigo === DD_MATRIZ_LISTA_OTROS ? null : DD_MATRIZ_SI_NO_NA.NO;
    await api("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", {
      id: f.id,
      listas,
      sig: { fecha: HOY, responsable: "R7 SIG", resultado: DD_MATRIZ_RESULTADOS.ACEPTADO, observaciones: null, conclusion: DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES },
    });
    await api("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", { id: f.id, reputacional: { conclusion: DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES } });
  }
}
const configuracion = () => api("admin", "GET", "/api/debida-diligencia/configuracion");
async function cambiarConfig(cambios) {
  const actual = await configuracion();
  return api("admin", "POST", "/api/debida-diligencia/configuracion", { ...actual, ...cambios });
}
async function subirEvidencia(filaId, evidencia) {
  const fd = new FormData();
  fd.append("file", new Blob([fs.readFileSync(path.join(EJEMPLOS, evidencia.archivo))], { type: evidencia.mime }), evidencia.archivo);
  fd.append("vinculoId", filaId);
  fd.append("categoria", `${DD_MATRIZ_CRITERIO_PREFIJO}${evidencia.codigo}`);
  return api("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/adjunto", fd, true);
}
const asistente = (quien, cuerpo) => http(quien, "POST", "/api/debida-diligencia/matriz-evaluacion/asistente", cuerpo);

// ================================================================ A: asistente IA / OCR
async function bloqueAsistente(ctx) {
  const det = await iniciarRevision(ctx);
  const fila = ctx.empresaFila;
  const codigos = new Set(det.listas.map((l) => l.codigo));
  estadoSalida.asistente = { expedienteId: ctx.expedienteId, codigo: ctx.codigo, filaId: fila.id, razon: razon(ctx.n) };
  const adjuntos = {};
  await caso("A", "SIG sube las evidencias de ejemplo en OEFA, INDECOPI, lavado y Otros", async () => {
    const subidas = [];
    for (const ev of EVIDENCIAS.filter((e) => codigos.has(e.codigo))) {
      adjuntos[ev.codigo] = await subirEvidencia(fila.id, ev);
      subidas.push(`${ev.codigo}:${ev.archivo}`);
    }
    if (subidas.length < 3) throw new Error(`solo ${subidas.length} criterios aplican: ${[...codigos].join(",")}`);
    return subidas.join(" ");
  });

  await caso("A", "regla apagada: la matriz no ofrece el asistente y el endpoint responde 403", async () => {
    await cambiarConfig({ asistenteIaHabilitado: false });
    const d = await detFila(fila.id);
    if (d.permisos?.usarAsistenteIa !== false) throw new Error(`usarAsistenteIa=${d.permisos?.usarAsistenteIa}`);
    const r = await asistente("sig", { vinculoId: fila.id, codigo: "oefa", modo: DD_ASISTENTE_MODOS.IA, prompt: "Resume la evidencia.", adjuntoIds: [adjuntos.oefa.id] });
    return debeRechazar(r, "asistente apagado", 403, DD_ASISTENTE_MENSAJES.DESHABILITADO);
  });
  await caso("A", "regla encendida desde Configuracion: la matriz ofrece el asistente a SIG", async () => {
    const c = await cambiarConfig({ asistenteIaHabilitado: true });
    if (c.asistenteIaHabilitado !== true) throw new Error("no se guardo la regla");
    const d = await detFila(fila.id);
    if (d.permisos?.usarAsistenteIa !== true) throw new Error(`usarAsistenteIa=${d.permisos?.usarAsistenteIa}`);
    return "usarAsistenteIa=true";
  });

  const consulta = async (codigo, modo, prompt, ids, metodoEsperado) => {
    const t0 = Date.now();
    const r = await asistente("sig", { vinculoId: fila.id, codigo, modo, prompt, adjuntoIds: ids });
    const seg = ((Date.now() - t0) / 1000).toFixed(1);
    if (!r.ok) throw new Error(`${r.status} ${mensaje(r)} (${seg}s)`);
    const d = r.json.data;
    if (!d.texto?.trim()) throw new Error("respuesta vacia");
    const metodo = d.evidencias?.[0]?.metodo ?? null;
    if (metodo !== metodoEsperado) throw new Error(`metodo=${metodo} (se esperaba ${metodoEsperado})`);
    return `${seg}s ${metodo ?? "archivo"} ${d.evidencias?.[0]?.paginas ?? ""}p: ${corto(d.texto, 140)}`;
  };
  if (adjuntos.oefa) {
    await caso("A", "Ayudate con IA (OEFA, PDF completo a la IA)", () =>
      consulta("oefa", DD_ASISTENTE_MODOS.IA, "Solo dime los números de resolución o expediente que aparecen.", [adjuntos.oefa.id], null));
    await caso("A", "OCR + prompt sobre PDF con texto (OEFA): usa la capa de texto", () =>
      consulta("oefa", DD_ASISTENTE_MODOS.OCR, "¿Cuántas infracciones registra? Responde solo el número.", [adjuntos.oefa.id], DD_ASISTENTE_METODOS_TEXTO.TEXTO_PDF));
  }
  if (adjuntos.indecopi) {
    await caso("A", "OCR + prompt sobre PDF escaneado (INDECOPI): Tesseract", () =>
      consulta("indecopi", DD_ASISTENTE_MODOS.OCR, "Solo dime el RUC de la empresa.", [adjuntos.indecopi.id], DD_ASISTENTE_METODOS_TEXTO.OCR));
  }
  if (adjuntos.corrupcion_empresa) {
    await caso("A", "OCR + prompt sobre imagen PNG (lavado/corrupcion)", () =>
      consulta("corrupcion_empresa", DD_ASISTENTE_MODOS.OCR, "Resume en una línea lo que muestra la captura.", [adjuntos.corrupcion_empresa.id], DD_ASISTENTE_METODOS_TEXTO.OCR));
  }
  if (adjuntos[DD_MATRIZ_LISTA_OTROS]) {
    await caso("A", "Ayudate con IA sobre Word (Otros): el servidor extrae el texto del DOCX", () =>
      consulta(DD_MATRIZ_LISTA_OTROS, DD_ASISTENTE_MODOS.IA, "Resume el informe en una línea.", [adjuntos[DD_MATRIZ_LISTA_OTROS].id], DD_ASISTENTE_METODOS_TEXTO.DOCX));
  }
  if (codigos.has(DD_MATRIZ_LISTA_OSCE)) {
    await caso("A", "OSCE sin evidencia: 400 Sube o automatiza una evidencia", async () => {
      const r = await asistente("sig", { vinculoId: fila.id, codigo: DD_MATRIZ_LISTA_OSCE, modo: DD_ASISTENTE_MODOS.IA, prompt: "Resume la evidencia.", adjuntoIds: [adjuntos.oefa.id] });
      return debeRechazar(r, "osce sin evidencia", 400, DD_ASISTENTE_MENSAJES.SIN_EVIDENCIA);
    });
    adjuntos[DD_MATRIZ_LISTA_OSCE] = await subirEvidencia(fila.id, EVIDENCIA_OSCE).catch((e) => reg("A", "subir evidencia OSCE", false, e.message));
    await caso("A", "OSCE con evidencia de otro criterio: 400 evidencia ajena", async () => {
      const r = await asistente("sig", { vinculoId: fila.id, codigo: DD_MATRIZ_LISTA_OSCE, modo: DD_ASISTENTE_MODOS.IA, prompt: "Resume la evidencia.", adjuntoIds: [adjuntos.oefa.id] });
      return debeRechazar(r, "evidencia ajena", 400, DD_ASISTENTE_MENSAJES.EVIDENCIA_AJENA);
    });
    if (adjuntos[DD_MATRIZ_LISTA_OSCE]?.id) {
      await caso("A", "OSCE habilitado: Ayudate con IA responde", () =>
        consulta(DD_MATRIZ_LISTA_OSCE, DD_ASISTENTE_MODOS.IA, "¿El proveedor tiene inhabilitación definitiva? Responde sí o no y la resolución.", [adjuntos[DD_MATRIZ_LISTA_OSCE].id], null));
    }
  }
  await caso("A", "criterio fuera del alcance (no OEFA/OSCE/INDECOPI/lavado/Otros): 400", async () => {
    const otro = det.listas.find((l) => !["oefa", "indecopi", "corrupcion_empresa", "corrupcion_persona", DD_MATRIZ_LISTA_OTROS, DD_MATRIZ_LISTA_OSCE].includes(l.codigo));
    if (!otro) throw new Error("no hay criterio fuera del alcance en el vinculo");
    const r = await asistente("sig", { vinculoId: fila.id, codigo: otro.codigo, modo: DD_ASISTENTE_MODOS.IA, prompt: "Resume la evidencia.", adjuntoIds: [adjuntos.oefa.id] });
    return `${otro.codigo}: ${debeRechazar(r, "criterio no habilitado", 400, DD_ASISTENTE_MENSAJES.CRITERIO_NO_HABILITADO)}`;
  });
  await caso("A", "indicacion demasiado corta: 400 con mensaje en español", async () => {
    const r = await asistente("sig", { vinculoId: fila.id, codigo: "oefa", modo: DD_ASISTENTE_MODOS.IA, prompt: "a", adjuntoIds: [adjuntos.oefa.id] });
    return debeRechazar(r, "prompt corto", 400);
  });
  await caso("A", "modo invalido: 400", async () => {
    const r = await asistente("sig", { vinculoId: fila.id, codigo: "oefa", modo: "otro", prompt: "Resume la evidencia.", adjuntoIds: [adjuntos.oefa.id] });
    return debeRechazar(r, "modo invalido", 400);
  });
  await caso("A", "Legal no puede usar el asistente (403)", async () => {
    const r = await asistente("legal", { vinculoId: fila.id, codigo: "oefa", modo: DD_ASISTENTE_MODOS.IA, prompt: "Resume la evidencia.", adjuntoIds: [adjuntos.oefa.id] });
    return debeRechazar(r, "legal", 403);
  });
  await caso("A", "sin sesion: 401", async () => {
    const r = await http("anonimo", "POST", "/api/debida-diligencia/matriz-evaluacion/asistente", { vinculoId: fila.id, codigo: "oefa", modo: DD_ASISTENTE_MODOS.IA, prompt: "Resume la evidencia.", adjuntoIds: [adjuntos.oefa.id] });
    return debeRechazar(r, "anonimo", 401);
  });
  estadoSalida.asistente.adjuntos = Object.fromEntries(Object.entries(adjuntos).filter(([, a]) => a?.id).map(([k, a]) => [k, a.id]));
  return { det, adjuntos };
}

// ================================================================ E: Exigir evidencia por campo aplicable
async function bloqueEvidencia(ctx, det, adjuntos) {
  const fila = ctx.empresaFila;
  const conEvidencia = new Set(Object.keys(adjuntos).filter((k) => adjuntos[k]?.id));
  const sinEvidencia = det.listas.find((l) => !conEvidencia.has(l.codigo) && l.codigo !== DD_MATRIZ_LISTA_OTROS);
  if (!sinEvidencia) {
    reg("E", "preparacion", false, "no hay criterio sin evidencia");
    return;
  }
  estadoSalida.evidencia = { criterioSinEvidencia: sinEvidencia.codigo, label: sinEvidencia.label };
  /* Un SI se sustenta con la observacion del criterio (regla de la matriz); se envia salvo `sinObservacion`. */
  const evaluar = (valor, codigo = sinEvidencia.codigo, borrador = false, sinObservacion = false) =>
    guardarFila({
      id: fila.id,
      ...(borrador ? { borrador: true } : {}),
      listas: { [codigo]: valor },
      ...(valor === DD_MATRIZ_SI_NO_NA.SI && !sinObservacion ? { listasObservaciones: { [codigo]: "R7: sustento del criterio" } } : {}),
    });
  await cambiarConfig({ exigirEvidencia: true, permitirNaSinEvidencia: true });
  await caso("E", "Guardar evaluacion con SI sin evidencia: 400 y nombra el criterio", async () => {
    const r = await evaluar(DD_MATRIZ_SI_NO_NA.SI);
    const m = debeRechazar(r, "SI sin evidencia", 400, DD_MENSAJES.MATRIZ_EVIDENCIA_REQUERIDA);
    if (!m.includes(sinEvidencia.label.slice(0, 20))) throw new Error(`no nombra «${sinEvidencia.label}»: ${m}`);
    return m;
  });
  await caso("E", "Guardar borrador con SI sin evidencia: permitido", async () => {
    const r = await evaluar(DD_MATRIZ_SI_NO_NA.SI, sinEvidencia.codigo, true);
    if (!r.ok) throw new Error(mensaje(r));
    return "200";
  });
  await caso("E", "N.A. sin evidencia con «Permitir N.A. sin evidencia» encendida: permitido", async () => {
    const r = await evaluar(DD_MATRIZ_SI_NO_NA.NA);
    if (!r.ok) throw new Error(mensaje(r));
    return "200";
  });
  await caso("E", "N.A. sin evidencia con «Permitir N.A. sin evidencia» apagada: 400", async () => {
    await cambiarConfig({ permitirNaSinEvidencia: false });
    try {
      return debeRechazar(await evaluar(DD_MATRIZ_SI_NO_NA.NA), "NA sin evidencia", 400, DD_MENSAJES.MATRIZ_EVIDENCIA_REQUERIDA);
    } finally {
      await cambiarConfig({ permitirNaSinEvidencia: true });
    }
  });
  await caso("E", "NO sin evidencia: permitido", async () => {
    const r = await evaluar(DD_MATRIZ_SI_NO_NA.NO);
    if (!r.ok) throw new Error(mensaje(r));
    return "200";
  });
  if (adjuntos.oefa?.id) {
    await caso("E", "SI con evidencia pero sin observacion del criterio: 400 y nombra el criterio", async () => {
      const r = await evaluar(DD_MATRIZ_SI_NO_NA.SI, "oefa", false, true);
      return debeRechazar(r, "SI sin observacion", 400, DD_MENSAJES.MATRIZ_OBSERVACION_CRITERIO_REQUERIDA);
    });
    await caso("E", "SI en un criterio con evidencia (OEFA): permitido", async () => {
      const r = await evaluar(DD_MATRIZ_SI_NO_NA.SI, "oefa");
      if (!r.ok) throw new Error(mensaje(r));
      return "200";
    });
  }
  await caso("E", "regla apagada: SI sin evidencia se guarda", async () => {
    await cambiarConfig({ exigirEvidencia: false });
    try {
      const r = await evaluar(DD_MATRIZ_SI_NO_NA.SI);
      if (!r.ok) throw new Error(mensaje(r));
      return "200";
    } finally {
      await cambiarConfig({ exigirEvidencia: true });
      await evaluar(DD_MATRIZ_SI_NO_NA.NO);
    }
  });
}

// ================================================================ K: cierre automatico
async function bloqueCierre() {
  const n = (k) => String(N0 + k);
  const casos = {};
  const preparar = async (clave, etiqueta, fn) => {
    const r = await caso("K", `preparar ${clave}: ${etiqueta}`, async () => {
      const ctx = await fn();
      casos[clave] = ctx;
      estadoSalida.empresas[clave] = { n: ctx.n, razon: razon(ctx.n), expedienteId: ctx.expedienteId, codigo: ctx.codigo, filaId: ctx.empresaFila?.id ?? null, email: `e2e-r${ctx.n}@example.invalid` };
      return `${ctx.codigo} estado=${await estado(ctx)}`;
    });
    return r.ok;
  };

  await caso("K", "cron sin secreto o con secreto incorrecto: 401", async () => {
    const a = await http("anonimo", "POST", "/api/cron/dd-cierre-automatico?simular=1");
    const b = await http("anonimo", "POST", "/api/cron/dd-cierre-automatico?simular=1", undefined, false, { "x-cron-secret": "incorrecto" });
    return `${debeRechazar(a, "sin secreto", 401)} / ${debeRechazar(b, "secreto incorrecto", 401)}`;
  });

  // Casos que SI deben cerrarse (observados en el sistema y con el plazo vencido)
  await preparar("A", "SIG registra DOCUMENTACION OBSERVADA en la matriz (conclusion guardada)", async () => {
    const c = await clienteEnvia(n(1));
    await iniciarRevision(c);
    const o = await finalSig(c, DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA, { clienteComentario: "R7: actualizar ficha RUC", documentosObservados: [DD_DOCUMENTOS.FICHA_RUC], vinculosObservados: [] });
    if (!o.ok) throw new Error(`observar: ${mensaje(o)}`);
    return c;
  });
  await preparar("B", "SIG observa desde la revision (conclusion deducida)", async () => {
    const c = await clienteEnvia(n(2));
    await iniciarRevision(c);
    const o = await revisar(c, DD_ACCIONES_REVISION.OBSERVAR);
    if (!o.ok) throw new Error(`observar: ${mensaje(o)}`);
    return c;
  });
  await preparar("C", "Legal observa", async () => {
    const c = await clienteEnvia(n(3));
    await comunicacionesYConclusiones(c);
    const d = await revisar(c, DD_ACCIONES_REVISION.RECHAZAR);
    if (!d.ok) throw new Error(`derivar a Legal: ${mensaje(d)}`);
    const o = await http("legal", "POST", "/api/debida-diligencia/legal/resolver", {
      expedienteId: c.expedienteId, decision: DD_ACCIONES_LEGAL.OBSERVAR, motivo: "R7 poder vigente",
      documentosObservados: [DD_DOCUMENTOS.PODERES], informeLegalNombre: null, informeLegalUrl: null,
    });
    if (!o.ok) throw new Error(`legal observar: ${mensaje(o)}`);
    return c;
  });
  // Casos que NO deben cerrarse
  await preparar("D", "observada recien (dentro del plazo)", async () => {
    const c = await clienteEnvia(n(4));
    await iniciarRevision(c);
    const o = await revisar(c, DD_ACCIONES_REVISION.OBSERVAR);
    if (!o.ok) throw new Error(`observar: ${mensaje(o)}`);
    return c;
  });
  await preparar("E", "observada vencida pero el cliente subsano y reenvio", async () => {
    const c = await clienteEnvia(n(5));
    await iniciarRevision(c);
    const o = await revisar(c, DD_ACCIONES_REVISION.OBSERVAR);
    if (!o.ok) throw new Error(`observar: ${mensaje(o)}`);
    await sql(`update debida_diligencia set fecha_revision='${FECHA_VENCIDA}' where id=${uuid(c.expedienteId)};`);
    const nuevo = await subirDoc(c.usuario, DD_DOCUMENTOS.FICHA_RUC, `r${c.n}-subsana`);
    c.docs = c.docs.filter((d) => d.tipo !== DD_DOCUMENTOS.FICHA_RUC).concat([nuevo]);
    const g = await http(c.usuario, "POST", "/api/debida-diligencia/guardar", cuerpoCliente(c.n, c.docs));
    if (!g.ok) throw new Error(`reguardar: ${mensaje(g)}`);
    const r = await http(c.usuario, "POST", "/api/debida-diligencia/enviar", {});
    if (!r.ok) throw new Error(`reenviar: ${mensaje(r)}`);
    await filasMatriz(c);
    return c;
  });
  await preparar("F", "como importada del Excel: Observada sin observaciones en el sistema", async () => {
    const c = await clienteEnvia(n(6));
    await filasMatriz(c); // la fila de empresa de la matriz existe (se sincroniza al listar)
    await sql(`update debida_diligencia set estado='${DD_ESTADOS.OBSERVADA}', fecha_revision='${FECHA_VENCIDA}' where id=${uuid(c.expedienteId)};`);
    return c;
  });

  const ids = (claves) => claves.filter((k) => casos[k]).map((k) => casos[k].expedienteId);
  const vencer = ids(["A", "B", "C"]);
  if (vencer.length) {
    await sql(
      `update debida_diligencia set fecha_revision='${FECHA_VENCIDA}' where id in (${vencer.map(uuid).join(",")});\n` +
      `update dd_matriz_vinculo set final_fecha='${FECHA_VENCIDA}' where tipo='${DD_MATRIZ_TIPOS_VINCULO.EMPRESA}' and final_fecha is not null and expediente_id in (${vencer.map(uuid).join(",")});`,
    );
  }

  // Configuracion: se aisla el plazo para que solo alcance a los casos de la prueba (se restaura al final
  // con los valores leidos al inicio). Sin fila guardada, la crea con esos valores.
  const fijarCierre = (plazo, estadoCierre) =>
    sql(
      `insert into dd_configuracion (id, plazo_dias_habiles, estado_cierre_automatico, updated_by, updated_at)
       values ('default', ${Number(plazo)}, '${estadoCierre}', 'e2e-ronda7', now())
       on conflict (id) do update set plazo_dias_habiles=excluded.plazo_dias_habiles, estado_cierre_automatico=excluded.estado_cierre_automatico;`,
    );
  const aislar = (estadoCierre) => fijarCierre(PLAZO_AISLADO, estadoCierre);
  const observados = ids(["A", "B", "C", "D", "E", "F"]);
  try {
    await aislar(DD_CONFIG_CIERRE_ESTADOS.SIN_RESPUESTA);
    const sim = await caso("K", "simulacion: solo los observados en el sistema con plazo vencido (A, B, C)", async () => {
      const r = await cron(true);
      const esperados = new Set(vencer);
      const extra = r.cerrados.filter((id) => !esperados.has(id));
      const faltan = vencer.filter((id) => !r.cerrados.includes(id));
      if (!r.simulado) throw new Error("no vino simulado");
      if (faltan.length) throw new Error(`faltan: ${faltan.map((id) => Object.keys(casos).find((k) => casos[k].expedienteId === id)).join(",")}`);
      if (extra.length) throw new Error(`incluye otros expedientes: ${extra.join(",")}`);
      return `candidatos=${r.candidatos} cerrados(simulados)=${r.cerrados.length}; excluidos D (reciente), E (subsanado), F (importado sin observaciones)`;
    });
    await caso("K", "simulacion no cambia nada", async () => {
      const filas = await sqlJson(`select id, estado from debida_diligencia where id in (${vencer.map(uuid).join(",")})`);
      const cambiados = filas.filter((f) => f.estado !== DD_ESTADOS.OBSERVADA);
      if (cambiados.length) throw new Error(`cambiaron: ${corto(cambiados)}`);
      return "siguen Observadas";
    });

    if (sim.ok) {
      await caso("K", "cierre real (SIN RESPUESTA): cierra exactamente A, B y C", async () => {
        const r = await cron(false);
        const ordenados = [...r.cerrados].sort().join(",");
        if (ordenados !== [...vencer].sort().join(",") || r.errores) throw new Error(`cerrados=${r.cerrados.length} errores=${r.errores}`);
        return `cerrados=${r.cerrados.length}`;
      });
      const filas = await sqlJson(
        `select d.id, d.codigo, d.estado, d.motivo_rechazo, d.revisado_por, m.resultado_final, m.final_por, m.final_comentario,
           (select h.titulo from debida_diligencia_historial h where h.expediente_id=d.id and h.actor='${DD_CIERRE_AUTOMATICO.ACTOR}' order by h.created_at desc limit 1) as historial
         from debida_diligencia d left join dd_matriz_vinculo m on m.expediente_id=d.id and m.tipo='${DD_MATRIZ_TIPOS_VINCULO.EMPRESA}'
         where d.id in (${observados.map(uuid).join(",")})`,
      );
      const fila = (k) => filas.find((f) => f.id === casos[k]?.expedienteId);
      for (const k of ["A", "B", "C"]) {
        await caso("K", `${k}: matriz SIN RESPUESTA + DD del cliente cerrada + historial`, async () => {
          const f = fila(k);
          if (!f) throw new Error("sin fila");
          if (f.resultado_final !== DD_MATRIZ_RESULTADOS_FINALES.SIN_RESPUESTA) throw new Error(`matriz=${f.resultado_final}`);
          if (f.final_por !== DD_CIERRE_AUTOMATICO.ACTOR) throw new Error(`final_por=${f.final_por}`);
          if (f.estado !== DD_ESTADOS.RECHAZADA) throw new Error(`estado=${f.estado}`);
          if (f.motivo_rechazo !== DD_MENSAJES.CIERRE_SIN_RESPUESTA) throw new Error(`motivo=${f.motivo_rechazo}`);
          if (!f.historial) throw new Error("sin evento en el historial");
          return `${f.codigo}: ${f.resultado_final} / ${f.estado} / «${corto(f.historial, 80)}»`;
        });
      }
      for (const k of ["D", "E", "F"]) {
        await caso("K", `${k}: no se toca`, async () => {
          const f = fila(k);
          if (!f) throw new Error("sin fila");
          if (f.estado === DD_ESTADOS.RECHAZADA || f.final_por === DD_CIERRE_AUTOMATICO.ACTOR || f.historial) throw new Error(`cerrado: ${corto(f)}`);
          return `${f.codigo}: ${f.estado} / matriz ${f.resultado_final ?? "sin guardar"}`;
        });
      }
      if (casos.A) {
        await caso("K", "A: el cliente ve su DD cerrada con el motivo", async () => {
          const m = await api(casos.A.usuario, "GET", "/api/debida-diligencia/mi-expediente?soloEvento=1");
          const e = m.expediente ?? m;
          if (e?.estado !== DD_ESTADOS.RECHAZADA) throw new Error(`estado cliente=${e?.estado}`);
          return `${e.codigo}: ${e.estado}`;
        });
        await caso("K", "A: la matriz (API de SIG) muestra SIN RESPUESTA", async () => {
          const valor = (await detFila(casos.A.empresaFila.id)).resultadoFinal;
          if (valor !== DD_MATRIZ_RESULTADOS_FINALES.SIN_RESPUESTA) throw new Error(`resultadoFinal=${valor}`);
          return valor;
        });
      }
      await caso("K", "segunda corrida: no vuelve a cerrar los ya cerrados", async () => {
        const r = await cron(true);
        const repetidos = r.cerrados.filter((id) => vencer.includes(id));
        if (repetidos.length) throw new Error(`repite ${repetidos.length}`);
        return `candidatos=${r.candidatos}`;
      });
    }

    // Opcion NO APTO
    const okG = await preparar("G", "observada vencida con la opcion NO APTO", async () => {
      const c = await clienteEnvia(n(7));
      await iniciarRevision(c);
      const o = await revisar(c, DD_ACCIONES_REVISION.OBSERVAR);
      if (!o.ok) throw new Error(`observar: ${mensaje(o)}`);
      await sql(`update debida_diligencia set fecha_revision='${FECHA_VENCIDA}' where id=${uuid(c.expedienteId)};`);
      return c;
    });
    if (okG) {
      await aislar(DD_CONFIG_CIERRE_ESTADOS.NO_APTO);
      await caso("K", "opcion NO APTO: matriz NO APTO y motivo de plazo vencido", async () => {
        const s = await cron(true);
        if (s.cerrados.join(",") !== casos.G.expedienteId) throw new Error(`simulacion=${corto(s)}`);
        const r = await cron(false);
        if (!r.cerrados.includes(casos.G.expedienteId)) throw new Error(`real=${corto(r)}`);
        const [f] = await sqlJson(`select d.estado, d.motivo_rechazo, m.resultado_final from debida_diligencia d join dd_matriz_vinculo m on m.expediente_id=d.id and m.tipo='${DD_MATRIZ_TIPOS_VINCULO.EMPRESA}' where d.id=${uuid(casos.G.expedienteId)}`);
        if (f.resultado_final !== DD_MATRIZ_RESULTADOS_FINALES.NO_APTO || f.estado !== DD_ESTADOS.RECHAZADA || f.motivo_rechazo !== DD_MENSAJES.CIERRE_PLAZO_VENCIDO) throw new Error(corto(f));
        return `${casos.G.codigo}: ${f.resultado_final} / ${f.estado}`;
      });
    }

    // Opcion DOCUMENTACION OBSERVADA: no cierra
    const okH = await preparar("H", "observada vencida con la opcion DOCUMENTACION OBSERVADA", async () => {
      const c = await clienteEnvia(n(8));
      await iniciarRevision(c);
      const o = await revisar(c, DD_ACCIONES_REVISION.OBSERVAR);
      if (!o.ok) throw new Error(`observar: ${mensaje(o)}`);
      await sql(`update debida_diligencia set fecha_revision='${FECHA_VENCIDA}' where id=${uuid(c.expedienteId)};`);
      return c;
    });
    if (okH) {
      await aislar(DD_CONFIG_CIERRE_ESTADOS.DOCUMENTACION_OBSERVADA);
      await caso("K", "opcion DOCUMENTACION OBSERVADA: no cierra nada", async () => {
        const r = await cron(false);
        if (r.candidatos !== 0 || r.cerrados.length) throw new Error(corto(r));
        const [f] = await sqlJson(`select estado from debida_diligencia where id=${uuid(casos.H.expedienteId)}`);
        if (f.estado !== DD_ESTADOS.OBSERVADA) throw new Error(`estado=${f.estado}`);
        return `estadoConfigurado=${r.estadoConfigurado}, ${casos.H.codigo} sigue ${f.estado}`;
      });
    }
  } finally {
    /* Los casos que no se cerraron vuelven a la fecha actual: con la fecha vencida contaminarian la
     * siguiente corrida (y el cron de QA si alguien lo ejecuta). */
    const pendientes = Object.values(casos).map((c) => c.expedienteId);
    if (pendientes.length) {
      await caso("K", "casos sin cerrar vuelven a la fecha actual", async () => {
        const lista = pendientes.map(uuid).join(",");
        await sql(
          `update debida_diligencia set fecha_revision=now() where estado='${DD_ESTADOS.OBSERVADA}' and fecha_revision < '2021-01-01' and id in (${lista});\n` +
          `update dd_matriz_vinculo set final_fecha=now() where final_fecha < '2021-01-01' and expediente_id in (${lista});`,
        );
        return `${pendientes.length} revisados`;
      });
    }
    await caso("K", "plazo y cierre automatico restaurados", async () => {
      const { plazoDiasHabiles, estadoCierreAutomatico } = estadoSalida.configInicial;
      await fijarCierre(plazoDiasHabiles, estadoCierreAutomatico);
      const [actual] = await sqlJson("select plazo_dias_habiles, estado_cierre_automatico from dd_configuracion where id='default'");
      if (actual.plazo_dias_habiles !== plazoDiasHabiles || actual.estado_cierre_automatico !== estadoCierreAutomatico) throw new Error(corto(actual));
      return corto(actual);
    });
  }
}

// ================================================================ main
try {
  await login("sig", "e2e-sig@example.invalid");
  await login("com", "e2e-com@example.invalid");
  await login("legal", "e2e-legal@example.invalid");
  await login("admin", "e2e-admin@example.invalid");
  const filaConfig = await sqlJson("select id from dd_configuracion where id='default'");
  const configInicial = await configuracion();
  estadoSalida.configInicial = { existiaFila: filaConfig.length > 0, ...configInicial };
  try {
    if (correr("A") || correr("E")) {
      const ctx = await clienteEnvia(String(N0));
      estadoSalida.empresas.ASIST = { n: ctx.n, razon: razon(ctx.n), expedienteId: ctx.expedienteId, codigo: ctx.codigo, email: `e2e-r${ctx.n}@example.invalid` };
      const { det, adjuntos } = await bloqueAsistente(ctx);
      estadoSalida.empresas.ASIST.filaId = ctx.empresaFila.id;
      if (correr("E")) await bloqueEvidencia(ctx, det, adjuntos);
    }
    if (correr("K")) await bloqueCierre();
  } finally {
    await caso("Z", "reglas de Configuracion DD restauradas (asistente, evidencia)", async () => {
      const { asistenteIaHabilitado, exigirEvidencia, permitirNaSinEvidencia } = configInicial;
      const c = await cambiarConfig({ asistenteIaHabilitado, exigirEvidencia, permitirNaSinEvidencia });
      return `asistente=${c.asistenteIaHabilitado} exigirEvidencia=${c.exigirEvidencia} permitirNA=${c.permitirNaSinEvidencia}`;
    });
  }
} catch (e) {
  reg("X", "error general", false, e.stack || e.message);
} finally {
  fs.writeFileSync(ARCHIVO_ESTADO, JSON.stringify({ ...estadoSalida, resultados }, null, 2));
  const fallas = resultados.filter((r) => !r.ok).length;
  console.log(`\nTOTAL ${resultados.length - fallas}/${resultados.length} OK`);
  process.exitCode = fallas ? 1 : 0;
}
