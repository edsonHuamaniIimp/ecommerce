// Ronda 3: vinculos de varios paises/tipos, repositorio (importacion con y sin IA), informes y envio a Legal.
// Corre dentro del contenedor ctrst-e2e (sin correos). Cada caso afirma el comportamiento CORRECTO: un FAIL es un posible defecto.
import fs from "node:fs";
import pg from "pg";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const EVENTO = "c0a354e0-4c79-4b38-b88d-ff824cd28964"; // Perumin 2027 (evento activo de los clientes)
const _OTRO_EVENTO = "5084409c-b905-4b55-bf5b-05255ff3d9c0"; // Proexplo 2026
const PASSWORD = "E2eTest#2026";
const SOLO = (process.env.E2E_SOLO || "").split(",").filter(Boolean);
const HOY = new Date().toISOString().slice(0, 10);
const _PLANTILLA_IMPORTADO = "91556c14-6179-402d-8752-c85762ce0a89";
const resultados = [];
const sesiones = {};

// ---------------------------------------------------------------- infraestructura
const corto = (v, max = 190) => (typeof v === "string" ? v : JSON.stringify(v) ?? "").replace(/\s+/g, " ").slice(0, max);
function reg(esc, caso, ok, detalle) {
  resultados.push({ esc, caso, ok, detalle: corto(detalle) });
  console.log(`${ok ? "OK  " : "FAIL"}|${esc}|${caso}|${corto(detalle)}`);
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
async function http(usuario, metodo, ruta, cuerpo, formulario = false, extra = {}) {
  const s = sesiones[usuario];
  const headers = { ...extra };
  if (s?.token) headers.cookie = `token=${s.token}`;
  let body;
  if (cuerpo !== undefined) {
    if (formulario) body = cuerpo;
    else {
      headers["content-type"] = "application/json";
      body = typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo);
    }
  }
  let r;
  for (let intento = 0; ; intento += 1) {
    try {
      r = await fetch(BASE + ruta, { method: metodo, headers, body, redirect: "manual" });
      break;
    } catch (e) {
      if (intento >= 1) throw e;
    }
  }
  const m = /token=([^;]+)/.exec(r.headers.get("set-cookie") || "");
  if (m && s) s.token = m[1];
  const texto = await r.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    json = null;
  }
  return { status: r.status, json, texto, headers: r.headers, ok: r.ok && json?.success !== false };
}
const mensaje = (r) => corto(r.json?.error?.message || r.json?.error || r.texto || `HTTP ${r.status}`, 150);
async function api(usuario, metodo, ruta, cuerpo, formulario) {
  const r = await http(usuario, metodo, ruta, cuerpo, formulario);
  if (!r.ok) throw new Error(`${metodo} ${ruta} -> ${r.status} ${mensaje(r)}`);
  return r.json.data ?? r.json;
}
/** Afirma que la peticion es rechazada de forma controlada (4xx), nunca aceptada ni con error 5xx. */
function debeRechazar(r, etiqueta) {
  if (r.status >= 500) throw new Error(`${etiqueta}: error del servidor ${r.status} ${mensaje(r)}`);
  if (r.ok) throw new Error(`${etiqueta}: FUE ACEPTADO (${r.status})`);
  return `rechazado ${r.status}: ${mensaje(r)}`;
}
async function login(usuario, email, evento = EVENTO) {
  sesiones[usuario] = { token: null };
  const r = await http(usuario, "POST", "/api/auth/login", { email, password: PASSWORD });
  if (!r.ok) throw new Error(`login ${email} -> ${r.status} ${mensaje(r)}`);
  sesiones[usuario].token = r.json.token || sesiones[usuario].token;
  const sel = await http(usuario, "POST", "/api/auth/seleccionar-evento", { eventoId: evento });
  if (!sel.ok) throw new Error(`seleccionar-evento -> ${sel.status} ${mensaje(sel)}`);
}
async function _db(sql, params = []) {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    return (await c.query(sql, params)).rows;
  } finally {
    await c.end();
  }
}
const pdf = (texto, extra = "") =>
  new Blob([`%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n% ${texto}\n${"% e2e ".repeat(300)}${extra}\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`], { type: "application/pdf" });
async function subir(usuario, tipo, etiqueta, archivo, nombre) {
  const fd = new FormData();
  fd.append("file", archivo ?? pdf(etiqueta), nombre ?? `${tipo}-${etiqueta}.pdf`);
  fd.append("tipo", tipo);
  return http(usuario, "POST", "/api/debida-diligencia/documento", fd, true);
}
async function subirOk(usuario, tipo, etiqueta) {
  const r = await subir(usuario, tipo, etiqueta);
  if (!r.ok) throw new Error(`subir ${tipo} -> ${r.status} ${mensaje(r)}`);
  const d = r.json.data ?? r.json;
  return { tipo, nombre: d.nombre, url: d.url };
}
const TIPOS_REQ = ["ficha_ruc", "poderes", "identidad_representante", "declaracion_jurada"];

function cuerpoCliente(n, docs, beneficiarios, extra = {}) {
  return {
    tipoRelacionComercial: ["exhibidor"],
    actividadEconomica: "Servicios",
    paisConstitucion: "Perú",
    sitioWeb: `https://r${n}.example.com`,
    emailRepresentante: `rep-r${n}@example.com`,
    aceptaDatos: true,
    aceptaVerificacion: true,
    declaraVerdad: true,
    representanteNombre: `REPRESENTANTE R${n}`,
    representanteTipoDocumento: "DNI",
    representanteDocumento: `4${String(Number(n) + 1000).padStart(7, "0")}`,
    representanteNacionalidad: "Perú",
    beneficiarios,
    documentos: docs.map((d) => ({ tipo: d.tipo, nombre: d.nombre, url: d.url })),
    ...extra,
  };
}
const benef = (n, k = 1, extra = {}) => ({
  nombre: `SOCIO ${k} R${n}`,
  documento: `4${String(Number(n) * 10 + k + 2000).padStart(7, "0")}`,
  tipoDocumento: "DNI",
  nacionalidad: "Perú",
  porcentaje: 30,
  tipoVinculoPersona: "beneficiario_final",
  ...extra,
});

/** Cliente: crea el borrador, sube documentos, guarda y (opcional) envia. Devuelve el contexto del expediente. */
async function _clienteCrea(n, { enviar = true, beneficiarios } = {}) {
  const usuario = `cli${n}`;
  await login(usuario, `e2e-r${n}@example.invalid`);
  const ctx = { n, usuario, docs: [], benef: beneficiarios ?? [benef(n, 1)] };
  await api(usuario, "POST", "/api/debida-diligencia/nueva", {});
  for (const tipo of TIPOS_REQ) ctx.docs.push(await subirOk(usuario, tipo, `r${n}`));
  const e = await api(usuario, "POST", "/api/debida-diligencia/guardar", cuerpoCliente(n, ctx.docs, ctx.benef));
  ctx.expedienteId = e.id;
  if (enviar) await api(usuario, "POST", "/api/debida-diligencia/enviar", {});
  return ctx;
}
const detalleExp = (ctx, quien = "sig") => api(quien, "GET", `/api/debida-diligencia/detalle?id=${ctx.expedienteId}`);
const _miExp = async (usuario, soloEvento = true) => {
  const m = await api(usuario, "GET", `/api/debida-diligencia/mi-expediente${soloEvento ? "?soloEvento=1" : ""}`);
  return m;
};
async function filasMatriz(ctx) {
  const m = await api("sig", "GET", `/api/debida-diligencia/matriz-evaluacion?expedienteId=${ctx.expedienteId}&perPage=100`);
  ctx.filas = m.data || [];
  ctx.empresaFila = ctx.filas.find((f) => f.tipo === "empresa") || ctx.filas[0];
  return ctx.filas;
}
async function sigAComunicacionesYConclusiones(ctx, { observados = [] } = {}) {
  await filasMatriz(ctx);
  await api("sig", "POST", "/api/debida-diligencia/vinculos-completos", { expedienteId: ctx.expedienteId, completos: true });
  await api("sig", "POST", "/api/debida-diligencia/derivar-comunicaciones", { expedienteId: ctx.expedienteId });
  const razon = `E2E RONDA2 R${ctx.n} S.A.C.`;
  const r = await api("com", "GET", `/api/debida-diligencia/reputacion/listar?search=${encodeURIComponent(razon)}&perPage=50`);
  const grupo = (r.data || []).find((g) => g.expedienteId === ctx.expedienteId);
  if (!grupo) throw new Error("Comunicaciones no ve el expediente derivado");
  for (const c of grupo.casos) {
    const obs = observados.some((o) => c.nombreARevisar.includes(o));
    await api("com", "POST", "/api/debida-diligencia/reputacion/iniciar", { id: c.id });
    await api("com", "POST", "/api/debida-diligencia/reputacion/observar", {
      id: c.id,
      resultado: obs ? "observado" : "aceptado",
      comentario: obs ? "R2: hallazgo simulado" : "Sin observaciones",
      linkHallazgos: obs ? "https://example.com/fuente" : "",
      cerrar: true,
      notificar: false,
    });
  }
  for (const f of ctx.filas) {
    const det = await api("sig", "GET", `/api/debida-diligencia/matriz-evaluacion/detalle?id=${f.id}`);
    const obs = observados.some((o) => f.nombre.includes(o));
    const listas = {};
    det.listas.forEach((l, i) => {
      listas[l.codigo] = l.codigo === "otros" ? null : obs && i === 0 ? "si" : "no";
    });
    await api("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", {
      id: f.id,
      listas,
      sig: { fecha: HOY, responsable: "R2 SIG", resultado: obs ? "observado" : "aceptado", observaciones: obs ? "R2 coincidencia" : null, conclusion: obs ? "requiere_dd_reforzada" : "sin_observaciones" },
    });
    await api("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", {
      id: f.id,
      reputacional: { conclusion: obs ? "requiere_dd_reforzada" : "sin_observaciones" },
    });
  }
}
const finalSig = (ctx, resultadoFinal, extra = {}) =>
  http("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", {
    id: ctx.empresaFila.id,
    resultadoFinal,
    finalFecha: HOY,
    finalPor: "R2 SIG",
    finalComentario: "R2",
    ...extra,
  });
const derivarLegal = (ctx) =>
  http("sig", "POST", "/api/debida-diligencia/revisar", {
    expedienteId: ctx.expedienteId,
    alcance: "expediente",
    accion: "rechazar",
    motivo: "R2: derivado a Legal",
    informeLogisticaUrl: "https://drive.google.com/r2-informe",
    derivarComunicaciones: false,
  });
const _observarSig = (ctx, docs, texto = "R2 observacion", extra = {}) =>
  http("sig", "POST", "/api/debida-diligencia/revisar", {
    expedienteId: ctx.expedienteId,
    alcance: "expediente",
    accion: "observar",
    motivo: texto,
    documentosObservados: docs,
    observaciones: docs.map((d) => ({ documentoTipo: d, texto: `${texto} (${d})` })),
    derivarComunicaciones: false,
    ...extra,
  });
const legal = (ctx, decision, extra = {}) =>
  http("legal", "POST", "/api/debida-diligencia/legal/resolver", {
    expedienteId: ctx.expedienteId,
    decision,
    motivo: decision === "aprobar" ? null : `R2: ${decision}`,
    documentosObservados: [],
    informeLegalNombre: null,
    informeLegalUrl: null,
    ...extra,
  });
async function estado(ctx, quien = "sig") {
  return (await detalleExp(ctx, quien)).estado;
}
async function reemplazarDoc(ctx, tipo, etiqueta) {
  const nuevo = await subirOk(ctx.usuario, tipo, etiqueta);
  ctx.docs = ctx.docs.filter((d) => d.tipo !== tipo).concat([nuevo]);
  return nuevo;
}
const reguardar = (ctx, extra = {}) =>
  http(ctx.usuario, "POST", "/api/debida-diligencia/guardar", cuerpoCliente(ctx.n, ctx.docs, ctx.benef, extra));
const enviar = (ctx) => http(ctx.usuario, "POST", "/api/debida-diligencia/enviar", {});


// ---------------------------------------------------------------- ronda 3: datos
const SIN_IA = process.env.E2E_SIN_IA === "1";
const docNac = (n, k) => `7${String(Number(n) * 100 + k).padStart(7, "0")}`;
const persona = (nombre, tipoDocumento, documento, nacionalidad, porcentaje, tipoVinculoPersona = "beneficiario_final") => ({
  nombre, tipoDocumento, documento, nacionalidad, porcentaje, tipoVinculoPersona,
});
/** Diez vinculos de paises y tipos distintos (empresa + representante + 8). */
const vinculosMixtos = (n) => [
  persona("JUAN CARLOS QUISPE MAMANI", "DNI", docNac(n, 1), "Perú", 20),
  persona("JOHN MICHAEL SMITH", "Pasaporte", "P12345678", "Estados Unidos", 15),
  persona("WEI ZHANG", "Pasaporte", "G98765432", "China", 12, "socio_10"),
  persona("MARIA ELENA GARCIA RUIZ", "Carnet de extranjería", "001234567", "Venezuela", 10, "director"),
  persona("INVERSIONES ANDINAS S.A.C.", "RUC", "20512345678", "Perú", 18, "empresa_vinculada"),
  persona("ACME MINING CHILE SPA", "RUC", "76123456789", "Chile", 10, "empresa_vinculada"),
  persona("PEDRO PEREZ LOPEZ", "DNI", docNac(n, 7), "Perú", 0, "apoderado"),
  persona("SVETLANA IVANOVA", "Pasaporte", "RU778899", "Rusia", 10, "gerente"),
];
const EXTRANJEROS = ["SMITH", "ZHANG", "GARCIA RUIZ", "ACME MINING", "IVANOVA"];
const esExtranjero = (nombre) => EXTRANJEROS.some((e) => nombre.includes(e));

/** Crea (o reutiliza) el expediente enviado de una empresa de prueba. */
async function obtenerCtx(n, benefs, extra = {}) {
  const usuario = `cli${n}`;
  await login(usuario, `e2e-r${n}@example.invalid`);
  const previo = await http(usuario, "GET", "/api/debida-diligencia/mi-expediente?soloEvento=1");
  const dato = (previo.json?.data ?? previo.json)?.expediente;
  if (previo.ok && dato?.id && dato.estado && dato.estado !== "borrador") {
    const ctx = { n, usuario, docs: [], benef: benefs, expedienteId: dato.id, reutilizado: true };
    ctx.docs = (dato.documentos || []).map((d) => ({ tipo: d.tipo, nombre: d.nombre, url: d.url }));
    return ctx;
  }
  const ctx = { n, usuario, docs: [], benef: benefs };
  await api(usuario, "POST", "/api/debida-diligencia/nueva", {});
  for (const tipo of TIPOS_REQ) ctx.docs.push(await subirOk(usuario, tipo, `r${n}`));
  const e = await api(usuario, "POST", "/api/debida-diligencia/guardar", cuerpoCliente(n, ctx.docs, benefs, extra));
  ctx.expedienteId = e.id;
  await api(usuario, "POST", "/api/debida-diligencia/enviar", {});
  return ctx;
}
const detFila = (id) => api("sig", "GET", `/api/debida-diligencia/matriz-evaluacion/detalle?id=${id}`);
const filaPor = (ctx, texto) => ctx.filas.find((f) => f.nombre.includes(texto));
const codigosListas = (det) => (det.listas || []).map((l) => l.codigo);
const razon = (n) => `E2E RONDA2 R${n} S.A.C.`;


// ================================================================ RONDA 5: flujos completos con empresas nuevas (R51..R62)
const miExp = _miExp;
const observarSig = _observarSig;
const PLANT = "91556c14-6179-402d-8752-c85762ce0a89";
async function sembrar(n, { origen = "importado", estadoExp = "aprobada", aprobadaHace = 30, venceEn = 150 } = {}) {
  const crypto = await import("node:crypto");
  const [empresa] = await _db("select id from empresa where ruc=$1", [`20999992${String(Number(n)).padStart(3, "0")}`]);
  const [plantilla] = await _db("select * from debida_diligencia where id=$1", [PLANT]);
  const fila = { ...plantilla, id: crypto.randomUUID(), empresa_id: empresa.id, evento_id: _OTRO_EVENTO, codigo: `R5-${crypto.randomBytes(5).toString("hex")}`.slice(0, 20), origen, estado: estadoExp,
    fecha_aprobacion: new Date(Date.now() - aprobadaHace * 86400000), fecha_vencimiento: new Date(Date.now() + venceEn * 86400000), created_at: new Date(), updated_at: new Date() };
  const k = Object.keys(fila);
  await _db(`insert into debida_diligencia(${k.map((x) => `"${x}"`).join(",")}) values(${k.map((_, i) => `$${i + 1}`).join(",")})`, k.map((x) => fila[x]));
  return fila.id;
}
const aptoFinal = (ctx) => finalSig(ctx, "apto");
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function vigenciaYEventos() {
  // V1: empresa con DD APTO importada de otro evento -> declaracion de vigencia (cargar, observar, subsanar, aprobar)
  const impId = await sembrar("51");
  await login("cli51", "e2e-r51@example.invalid");
  await caso("V1", "empresa de otro evento: el cliente ve que debe subir su declaracion de vigencia", async () => {
    const m = await miExp("cli51", false);
    if (!(m.esOtroEvento && m.requiereDeclaracionVigencia && m.puedeRegularizarDeclaracionVigencia)) throw new Error(`flags otroEvento=${m.esOtroEvento} requiere=${m.requiereDeclaracionVigencia} puede=${m.puedeRegularizarDeclaracionVigencia}`);
    return `vence ${String(m.expediente?.fechaVencimiento).slice(0, 10)}`;
  });
  const d1 = await subirOk("cli51", "declaracion_vigencia", "v1-a");
  await caso("V1", "cliente sube la declaracion y queda pendiente de revision", async () => {
    await api("cli51", "POST", "/api/debida-diligencia/regularizar-vigencia", { expedienteId: impId, nombre: d1.nombre, url: d1.url });
    const m = await miExp("cli51", false);
    return `estadoDeclaracion=${m.declaracionVigenciaEstado}`;
  });
  await caso("V1", "SIG observa la declaracion y el cliente puede volver a subirla", async () => {
    const r = await http("sig", "POST", "/api/debida-diligencia/revisar", { expedienteId: impId, alcance: "declaracion_vigencia", accion: "observar", motivo: "R5: falta firma" });
    if (!r.ok) throw new Error(mensaje(r));
    const m = await miExp("cli51", false);
    if (m.declaracionVigenciaEstado !== "observado" || !m.puedeRegularizarDeclaracionVigencia) throw new Error(`estado=${m.declaracionVigenciaEstado} puede=${m.puedeRegularizarDeclaracionVigencia}`);
  });
  const d2 = await subirOk("cli51", "declaracion_vigencia", "v1-b");
  await caso("V1", "cliente subsana y SIG aprueba la declaracion", async () => {
    await api("cli51", "POST", "/api/debida-diligencia/regularizar-vigencia", { expedienteId: impId, nombre: d2.nombre, url: d2.url });
    const r = await http("sig", "POST", "/api/debida-diligencia/revisar", { expedienteId: impId, alcance: "declaracion_vigencia", accion: "aprobar", motivo: null });
    if (!r.ok) throw new Error(mensaje(r));
    const m = await miExp("cli51", false);
    return `estadoDeclaracion=${m.declaracionVigenciaEstado}; expediente=${m.expediente?.estado}`;
  });
  await caso("V1", "con la vigencia aprobada, que ve el cliente para el evento activo", async () => {
    const m = await miExp("cli51", true);
    return `soloEvento: expediente=${m.expediente?.estado ?? "ninguno"}; requiere=${m.requiereDeclaracionVigencia}`;
  });

  // V2: DD importada VENCIDA -> debe hacer una DD nueva completa y llega a revision
  await sembrar("52", { aprobadaHace: 400, venceEn: -10 });
  await login("cli52", "e2e-r52@example.invalid");
  await caso("V2", "DD vencida de otro evento: no admite declaracion, pero puede presentar una DD nueva y enviarla", async () => {
    const m = await miExp("cli52", false);
    if (m.puedeRegularizarDeclaracionVigencia) throw new Error("permite declaracion en una DD vencida");
    const ctx = await _clienteCrea("52", { enviar: true });
    return `nueva DD ${ctx.expedienteId} estado=${await estado(ctx)}`;
  });

  // V3: DD APTO por flujo regular en otro evento, vigente
  await sembrar("53", { origen: "flujo_regular" });
  await login("cli53", "e2e-r53@example.invalid");
  await caso("V3", "DD regular aprobada de otro evento y vigente: el cliente tiene un camino (declaracion o DD nueva)", async () => {
    const m = await miExp("cli53", false);
    const n = await http("cli53", "POST", "/api/debida-diligencia/nueva", {});
    if (!m.puedeRegularizarDeclaracionVigencia && !n.ok) throw new Error(`sin camino: declaracion=${m.puedeRegularizarDeclaracionVigencia}; nueva=${n.status} ${mensaje(n)}`);
    return `declaracion=${m.puedeRegularizarDeclaracionVigencia}; nueva=${n.status}`;
  });
}

async function observacionSubsanacion() {
  // S1: dos rondas de observacion de documentos hasta APTO
  const c = await _clienteCrea("54");
  await caso("S1", "SIG observa 2 documentos; reenvio sin cambios y subsanacion parcial son rechazados", async () => {
    const o = await observarSig(c, ["ficha_ruc", "poderes"]);
    if (!o.ok) throw new Error(mensaje(o));
    const mal = [];
    await reguardar(c);
    if ((await enviar(c)).ok) mal.push("reenvio sin cambios ACEPTADO");
    await reemplazarDoc(c, "ficha_ruc", "s1");
    await reguardar(c);
    if ((await enviar(c)).ok) mal.push("subsanacion parcial ACEPTADA");
    if (mal.length) throw new Error(mal.join("; "));
  });
  await caso("S1", "subsanar ambos reenvia a revision sin observaciones abiertas", async () => {
    await reemplazarDoc(c, "poderes", "s1");
    await reguardar(c);
    const r = await enviar(c);
    if (!r.ok) throw new Error(mensaje(r));
    const d = await detalleExp(c);
    const ab = (d.observaciones || []).filter((o) => o.estado === "abierta").length;
    if (ab) throw new Error(`${ab} abiertas`);
    return `estado=${d.estado}`;
  });
  await caso("S1", "segunda ronda de observacion, subsanacion y llegada a APTO", async () => {
    const o = await observarSig(c, ["identidad_representante"], "R5 ronda 2");
    if (!o.ok) throw new Error(mensaje(o));
    await reemplazarDoc(c, "identidad_representante", "s1b");
    await reguardar(c);
    const r = await enviar(c);
    if (!r.ok) throw new Error(mensaje(r));
    await sigAComunicacionesYConclusiones(c);
    const f = await aptoFinal(c);
    if (!f.ok) throw new Error(mensaje(f));
    const m = await miExp(c.usuario);
    return `estado final=${await estado(c)}; cliente ve ${m.expediente?.estado}`;
  });

  // S2: documento adicional
  const c2 = await _clienteCrea("55");
  await caso("S2", "SIG pide documento adicional: sin el se rechaza el reenvio, con el se acepta", async () => {
    const o = await observarSig(c2, ["documento_adicional"], "R5 carta adicional");
    if (!o.ok) throw new Error(mensaje(o));
    await reguardar(c2);
    if ((await enviar(c2)).ok) throw new Error("reenvio sin el adicional ACEPTADO");
    c2.docs.push(await subirOk(c2.usuario, "documento_adicional", "s2"));
    await reguardar(c2);
    const r = await enviar(c2);
    if (!r.ok) throw new Error(mensaje(r));
    return `estado=${await estado(c2)}`;
  });

  // S3: observar un vinculo y que el cliente lo corrija
  const c3 = await _clienteCrea("56", { beneficiarios: [benef("56", 1), benef("56", 2)] });
  await caso("S3", "SIG observa un vinculo; el cliente lo corrige y la matriz no duplica al socio", async () => {
    await sigAComunicacionesYConclusiones(c3);
    const d = await detalleExp(c3);
    const b = d.beneficiarios[1];
    const f = await finalSig(c3, "documentacion_observada", { clienteComentario: "R5: revisar socio 2", documentosObservados: [], vinculosObservados: [{ tipo: "beneficiario", beneficiarioId: b.id, comentario: "Documento no coincide" }] });
    if (!f.ok) throw new Error(`observar vinculo: ${mensaje(f)}`);
    c3.benef = [benef("56", 1), benef("56", 2, { documento: "49999998", nombre: "SOCIO 2 CORREGIDO" })];
    const g = await reguardar(c3);
    if (!g.ok) throw new Error(mensaje(g));
    const r = await enviar(c3);
    if (!r.ok) throw new Error(mensaje(r));
    const filas = await filasMatriz(c3);
    const dup = filas.filter((x) => x.nombre.includes("SOCIO 2")).length;
    if (dup !== 1) throw new Error(`filas del socio 2: ${dup} (${filas.map((x) => x.nombre).join(" | ")})`);
    return `estado=${await estado(c3)}; ${filas.length} filas`;
  });
}

async function legalYCierres() {
  // L1: Legal observa -> cliente subsana -> Legal aprueba -> SIG declara APTO aunque Comunicaciones tenga hallazgos
  const c = await _clienteCrea("57");
  await caso("L1", "derivar a Legal, Legal observa, cliente subsana y vuelve a Legal", async () => {
    await sigAComunicacionesYConclusiones(c, { observados: ["SOCIO"] });
    const d = await derivarLegal(c);
    if (!d.ok) throw new Error(`derivar: ${mensaje(d)}`);
    const o = await legal(c, "observar", { documentosObservados: ["poderes"], motivo: "R5 falta poder vigente" });
    if (!o.ok) throw new Error(`legal observar: ${mensaje(o)}`);
    const e1 = await estado(c);
    const bloqueo = await derivarLegal(c);
    if (bloqueo.ok) throw new Error(`SIG pudo derivar de nuevo con Legal observado (estado ${e1})`);
    await reemplazarDoc(c, "poderes", "l1");
    await reguardar(c);
    const r = await enviar(c);
    if (!r.ok) throw new Error(`reenviar: ${mensaje(r)}`);
    return `${e1} -> ${await estado(c)}`;
  });
  await caso("L1", "Legal aprueba y SIG puede declarar APTO con hallazgos de Comunicaciones", async () => {
    const a = await legal(c, "aprobar");
    if (!a.ok) throw new Error(`legal aprobar: ${mensaje(a)}`);
    const f = await aptoFinal(c);
    if (!f.ok) throw new Error(`APTO: ${mensaje(f)}`);
    return `estado=${await estado(c)}`;
  });

  // L2: Legal rechaza -> NO APTO; la empresa queda bloqueada
  const c2 = await _clienteCrea("58");
  await caso("L2", "Legal rechaza: cierre NO APTO automatico (se informa si la empresa puede abrir otra DD)", async () => {
    await sigAComunicacionesYConclusiones(c2);
    const d = await derivarLegal(c2);
    if (!d.ok) throw new Error(mensaje(d));
    const r = await legal(c2, "rechazar", { motivo: "R5 rechazo legal" });
    if (!r.ok) throw new Error(mensaje(r));
    await filasMatriz(c2);
    const det = await detFila(c2.empresaFila.id);
    const n = await http(c2.usuario, "POST", "/api/debida-diligencia/nueva", {});
    if (det.resultadoFinal !== "no_apto") throw new Error(`resultadoFinal=${det.resultadoFinal} (se esperaba no_apto)`);
    return `estado=${await estado(c2)}; resultadoFinal=${det.resultadoFinal}; nueva DD=${n.status} ${n.ok ? "(permitida)" : mensaje(n)}`;
  });

  // SR1: SIN RESPUESTA manual
  const c3 = await _clienteCrea("59");
  await caso("SR1", "SIG cierra SIN RESPUESTA: el cliente puede presentar una DD nueva", async () => {
    await filasMatriz(c3);
    const f = await finalSig(c3, "sin_respuesta");
    if (!f.ok) throw new Error(`sin_respuesta: ${mensaje(f)}`);
    const n = await http(c3.usuario, "POST", "/api/debida-diligencia/nueva", {});
    if (!n.ok) throw new Error(`estado=${await estado(c3)}; nueva DD ${n.status} ${mensaje(n)}`);
    return `estado=${await estado(c3)}; nueva=${n.status}`;
  });

  // SR2: cierre automatico a los 10 dias sin subsanar
  const c4 = await _clienteCrea("60");
  const cfgFilas = await _db("select * from dd_configuracion limit 1").catch(() => []);
  console.log("CONFIG:", JSON.stringify(cfgFilas[0] ?? {}).slice(0, 300));
  await caso("SR2", "observada y sin subsanar por 15 dias: se cierra sola como SIN RESPUESTA", async () => {
    const o = await observarSig(c4, ["ficha_ruc"], "R5 sin respuesta");
    if (!o.ok) throw new Error(mensaje(o));
    await _db("update debida_diligencia set fecha_revision = now() - interval '15 days', updated_at = now() - interval '15 days' where id=$1", [c4.expedienteId]);
    await _db("update debida_diligencia_observacion set created_at = now() - interval '15 days' where expediente_id=$1", [c4.expedienteId]).catch(() => null);
    /* Se tocan las pantallas que el sistema podria usar para disparar el cierre. */
    await http("sig", "GET", "/api/debida-diligencia/bandeja?perPage=5");
    await http(c4.usuario, "GET", "/api/debida-diligencia/mi-expediente?soloEvento=1");
    await http("sig", "GET", `/api/debida-diligencia/matriz-evaluacion?expedienteId=${c4.expedienteId}&perPage=5`);
    await pausa(2000);
    const e = await estado(c4);
    const [vinc] = await _db("select resultado_final from dd_matriz_vinculo where expediente_id=$1 and tipo='empresa'", [c4.expedienteId]).catch(() => [{}]);
    if (e === "observada" && vinc?.resultado_final !== "sin_respuesta") throw new Error(`NO se cerro: sigue "${e}" tras 15 dias (resultado matriz=${vinc?.resultado_final ?? "ninguno"}). No hay tarea programada que aplique el plazo configurado.`);
    return `estado=${e}; matriz=${vinc?.resultado_final}`;
  });
}

async function diezVinculos() {
  // C: expediente con 10 vinculos (peruanos, extranjeros, empresa peruana y empresas extranjeras con RUT) hasta APTO
  const benefs = [
    persona("JUAN CARLOS QUISPE MAMANI", "DNI", docNac("62", 1), "Perú", 25),
    persona("ROSA ELENA HUAMAN CCOPA", "DNI", docNac("62", 2), "Perú", 10, "socio_10"),
    persona("PEDRO PEREZ LOPEZ", "DNI", docNac("62", 3), "Perú", 0, "apoderado"),
    persona("JOHN MICHAEL SMITH", "Pasaporte", "P12345678", "Estados Unidos", 15),
    persona("WEI ZHANG", "Pasaporte", "G98765432", "China", 12, "socio_10"),
    persona("MARIA ELENA GARCIA RUIZ", "Carnet de extranjería", "001234567", "Venezuela", 0, "director"),
    persona("SVETLANA IVANOVA", "Pasaporte", "RU778899", "Rusia", 0, "gerente"),
    persona("INVERSIONES ANDINAS S.A.C.", "RUC", "20512345678", "Perú", 18, "empresa_vinculada"),
    persona("ACME MINING GMBH", "RUT", "DE123456789", "Alemania", 10, "empresa_vinculada"),
    persona("PACIFIC COPPER SPA", "RUT", "76123456-7", "Chile", 0, "empresa_vinculada"),
  ];
  let c;
  await caso("C1", "cliente declara 10 vinculos (peruanos, extranjeros, RUC y RUT) y envia", async () => {
    c = await obtenerCtx("62", benefs);
    const f = await filasMatriz(c);
    return `${f.length} filas`;
  });
  if (!c) return;
  await caso("C1", "empresa vinculada de Peru declarada con RUT: se normaliza a RUC o se rechaza (no queda inconsistente)", async () => {
    await login("cli61", "e2e-r61@example.invalid");
    await api("cli61", "POST", "/api/debida-diligencia/nueva", {});
    const docs = [];
    for (const t of TIPOS_REQ) docs.push(await subirOk("cli61", t, "r61"));
    const r = await http("cli61", "POST", "/api/debida-diligencia/guardar", cuerpoCliente("61", docs, [persona("EMPRESA PERU CON RUT", "RUT", "123456", "Perú", 10, "empresa_vinculada")]));
    if (r.status >= 500) throw new Error(`500 ${mensaje(r)}`);
    return r.ok ? "guardado (se normaliza)" : `rechazado ${r.status}: ${mensaje(r)}`;
  });
  await caso("C1", "SIG completa vinculos, Comunicaciones responde y SIG declara APTO", async () => {
    await sigAComunicacionesYConclusiones(c);
    const f = await aptoFinal(c);
    if (!f.ok) throw new Error(mensaje(f));
    return `estado=${await estado(c)}`;
  });
}

// ---- importador de carpeta + sugeridor de IA (archivos de ~2 KB; empresa R40 ya tiene su DD)
async function importadorIA() {
  const ctx = await obtenerCtx("40", []);
  await filasMatriz(ctx);
  const f = (t) => ctx.filas.find((x) => x.nombre.includes(t));
  const empresa = ctx.empresaFila;
  const vinculos = ctx.filas.map((x) => ({ id: x.id, nombre: x.nombre, tipo: x.tipo }));
  const ESP = [
    ["01. OFAC JOHN MICHAEL SMITH P12345678.pdf", "SMITH", "criterio_ofac"],
    ["02. Naciones Unidas SVETLANA IVANOVA RU778899.pdf", "IVANOVA", "criterio_naciones_unidas"],
    ["03. OpenSanctions WEI ZHANG G98765432.pdf", "ZHANG", "criterio_opensanctions"],
    ["04. Sentinel INVERSIONES ANDINAS SAC 20512345678.pdf", "INVERSIONES", "criterio_central_riesgo_empresa"],
    ["05. Sentinel JUAN CARLOS QUISPE MAMANI 70004001.pdf", "JUAN CARLOS", "criterio_central_riesgo_persona"],
    ["06. PEPs MARIA ELENA GARCIA RUIZ 001234567.pdf", "GARCIA RUIZ", "criterio_peps_prp_persona"],
    ["07. Noticia prensa ACME MINING GMBH DE123456789.pdf", "ACME", "reputacional_sustento"],
    ["08. INDECOPI INVERSIONES ANDINAS 20512345678.pdf", "INVERSIONES", "criterio_indecopi"],
    ["09. Informe SIG consolidado 2099999200.pdf", null, "sig_informe"],
    ["10. lista ofac Smith John P12345678 captura.pdf", "SMITH", "criterio_ofac"],
    ["11. Ivanova S. onu sanciones.pdf", "IVANOVA", "criterio_naciones_unidas"],
    ["12. Interpol zhang wei.pdf", "ZHANG", "criterio_interpol"],
    ["13. Sanciones UE Acme Mining.pdf", "ACME", "criterio_sanciones_europa"],
    ["14. Pacific Copper ofac 76123456-7.pdf", "PACIFIC", "criterio_ofac"],
  ];
  let resp;
  const t0 = Date.now();
  await caso("I1", `sugeridor responde con IA (no reglas) en menos de 40 s para ${ESP.length} archivos`, async () => {
    const r = await http("sig", "POST", "/api/debida-diligencia/clasificar-archivos", { empresa: { id: empresa.empresaId ?? empresa.id, razonSocial: empresa.empresaRazonSocial ?? "", ruc: empresa.empresaRuc ?? "" }, vinculos, archivos: ESP.map((e) => ({ nombre: e[0] })) });
    if (!r.ok) throw new Error(`${r.status} ${mensaje(r)}`);
    resp = r.json.data ?? r.json;
    const seg = ((Date.now() - t0) / 1000).toFixed(1);
    if (resp.origen !== "ia") throw new Error(`origen=${resp.origen} tras ${seg}s (cayo a reglas)`);
    return `origen ia en ${seg}s`;
  });
  let ok = 0;
  const lote = [];
  for (const [i, [nombre, vinc, cat]] of ESP.entries()) {
    const s = resp?.sugerencias.find((x) => x.indice === i);
    await caso("I2", `IA: ${nombre.slice(0, 44)}`, async () => {
      if (!s) throw new Error("sin sugerencia");
      const mal = [];
      if (s.categoria !== cat) mal.push(`categoria ${s.categoria} (esperada ${cat})`);
      if (vinc && s.vinculoId !== f(vinc)?.id) mal.push(`vinculo ${ctx.filas.find((x) => x.id === s.vinculoId)?.nombre} (esperado ${vinc})`);
      if (mal.length) throw new Error(mal.join("; "));
      ok += 1;
      return `conf ${s.confianza}`;
    });
    lote.push({ nombre, vid: s?.vinculoId ?? (vinc ? f(vinc)?.id : empresa.id), cat: s?.categoria ?? cat });
  }
  console.log(`IA ACIERTA ${ok}/${ESP.length}`);
  const adj = (vid, cat, nombre) => {
    const fd = new FormData();
    fd.append("file", pdf(nombre), nombre);
    fd.append("vinculoId", vid);
    fd.append("categoria", cat);
    return http("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/adjunto", fd, true);
  };
  const subidos = [];
  await caso("I3", `importar las ${ESP.length} evidencias sugeridas (una por archivo, de a una)`, async () => {
    const mal = [];
    for (const x of lote) {
      const r = await adj(x.vid, x.cat, x.nombre);
      if (r.ok) subidos.push({ ...(r.json.data ?? r.json), vid: x.vid });
      else mal.push(`${x.nombre.slice(0, 16)}: ${r.status} ${mensaje(r)}`);
      await pausa(150);
    }
    if (mal.length) throw new Error(mal.join("; "));
    return `${subidos.length} subidos`;
  });
  await caso("I3", "las evidencias importadas aparecen en el detalle de su vinculo", async () => {
    let visibles = 0;
    for (const vid of new Set(subidos.map((s) => s.vid))) {
      const det = await detFila(vid);
      visibles += subidos.filter((s) => s.vid === vid && (det.adjuntos || []).some((a) => a.id === s.id)).length;
    }
    if (visibles !== subidos.length) throw new Error(`${visibles}/${subidos.length}`);
    return `${visibles}/${subidos.length}`;
  });
  await caso("I4", "archivos no permitidos (exe, pdf falso, vacio) se rechazan sin 500", async () => {
    const vid = f("SMITH").id;
    const mal = [];
    for (const [etq, blob, nombre] of [["exe", new Blob([new Uint8Array([0x4d, 0x5a, 0, 1])]), "x.exe"], ["pdf falso", new Blob(["no soy pdf"]), "falso.pdf"], ["vacio", new Blob([]), "vacio.pdf"]]) {
      const fd = new FormData();
      fd.append("file", blob, nombre);
      fd.append("vinculoId", vid);
      fd.append("categoria", "criterio_ofac");
      const r = await http("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/adjunto", fd, true);
      if (r.ok) mal.push(`${etq} aceptado`);
      else if (r.status >= 500) mal.push(`${etq} 500`);
    }
    if (mal.length) throw new Error(mal.join("; "));
  });
}

// ---------------------------------------------------------------- ejecucion
const BLOQUES5 = [["V", vigenciaYEventos], ["S", observacionSubsanacion], ["L", legalYCierres], ["C", diezVinculos], ["I", importadorIA]];
(async () => {
  for (const u of [["sig", "e2e-sig@example.invalid"], ["com", "e2e-com@example.invalid"], ["legal", "e2e-legal@example.invalid"]]) await login(u[0], u[1]);
  for (const [clave, fn] of BLOQUES5) {
    if (SOLO.length && !SOLO.includes(clave)) continue;
    console.log(`=== Bloque ${clave} ===`);
    try {
      await fn();
    } catch (e) {
      reg(clave, "excepcion no controlada del bloque", false, e.stack?.split("\n").slice(0, 3).join(" / ") ?? e.message);
    }
    const h = await fetch(BASE + "/api/health").then((r) => r.status).catch(() => "caido");
    console.log(`   salud tras bloque ${clave}: ${h}`);
  }
  const okc = resultados.filter((r) => r.ok).length;
  console.log(`=== RESUMEN RONDA 5: ${okc}/${resultados.length} OK, ${resultados.length - okc} FAIL ===`);
  fs.writeFileSync("/tmp/ronda5-resultados.json", JSON.stringify(resultados, null, 1));
})().catch((e) => {
  console.log("FATAL", e.message);
  process.exit(1);
});
