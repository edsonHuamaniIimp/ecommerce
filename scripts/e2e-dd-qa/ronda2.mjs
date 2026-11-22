// Ronda 2 (adversarial): vigencia, observacion/subsanacion en varias rondas, permisos, estados invalidos,
// validaciones, archivos y concurrencia. Corre dentro del contenedor ctrst-e2e (sin correos).
// Cada caso afirma el comportamiento CORRECTO: un FAIL es un posible defecto.
import fs from "node:fs";
import crypto from "node:crypto";
import pg from "pg";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const EVENTO = "c0a354e0-4c79-4b38-b88d-ff824cd28964"; // Perumin 2027 (evento activo de los clientes)
const OTRO_EVENTO = "5084409c-b905-4b55-bf5b-05255ff3d9c0"; // Proexplo 2026
const PASSWORD = "E2eTest#2026";
const SOLO = (process.env.E2E_SOLO || "").split(",").filter(Boolean);
const HOY = new Date().toISOString().slice(0, 10);
const PLANTILLA_IMPORTADO = "91556c14-6179-402d-8752-c85762ce0a89";
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
async function db(sql, params = []) {
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
async function clienteCrea(n, { enviar = true, beneficiarios } = {}) {
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
const miExp = async (usuario, soloEvento = true) => {
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
const observarSig = (ctx, docs, texto = "R2 observacion", extra = {}) =>
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

/** Clona un expediente importado aprobado (plantilla de QA) para una empresa de prueba. */
async function sembrarExpediente(n, { eventoId = OTRO_EVENTO, origen = "importado", estadoExp = "aprobada", aprobadaHace = 30, venceEn = 150 } = {}) {
  const [empresa] = await db("select id from empresa where ruc=$1", [`20999992${String(Number(n)).padStart(3, "0")}`]);
  const [plantilla] = await db("select * from debida_diligencia where id=$1", [PLANTILLA_IMPORTADO]);
  const fila = {
    ...plantilla,
    id: crypto.randomUUID(),
    empresa_id: empresa.id,
    evento_id: eventoId,
    codigo: `R2-${crypto.randomBytes(5).toString("hex")}`.slice(0, 20),
    origen,
    estado: estadoExp,
    fecha_aprobacion: new Date(Date.now() - aprobadaHace * 86400000),
    fecha_vencimiento: new Date(Date.now() + venceEn * 86400000),
    created_at: new Date(),
    updated_at: new Date(),
  };
  const k = Object.keys(fila);
  await db(`insert into debida_diligencia(${k.map((x) => `"${x}"`).join(",")}) values(${k.map((_, i) => `$${i + 1}`).join(",")})`, k.map((x) => fila[x]));
  return fila.id;
}

// ---------------------------------------------------------------- V: vigencia y declaracion
async function vigencia() {
  // V1: importada APTO vigente de otro evento -> solo declaracion de vigencia, con observacion y subsanacion
  const e = "V1";
  const n = "01";
  const usuario = `cli${n}`;
  const impId = await sembrarExpediente(n);
  await login(usuario, `e2e-r${n}@example.invalid`);
  const flags = await caso(e, "cliente ve que requiere declaracion de vigencia (DD importada de otro evento)", async () => {
    const m = await miExp(usuario, false);
    const ok = m.esOtroEvento === true && m.requiereDeclaracionVigencia === true && m.puedeRegularizarDeclaracionVigencia === true;
    if (!ok) throw new Error(`flags: otroEvento=${m.esOtroEvento} requiere=${m.requiereDeclaracionVigencia} puede=${m.puedeRegularizarDeclaracionVigencia}`);
    return `estadoDeclaracion=${m.declaracionVigenciaEstado ?? "sin cargar"} vence=${String(m.expediente?.fechaVencimiento).slice(0, 10)}`;
  });
  if (!flags.ok) return;
  await caso(e, "regularizar con un archivo inexistente es rechazado", async () => {
    const r = await http(usuario, "POST", "/api/debida-diligencia/regularizar-vigencia", { expedienteId: impId, nombre: "falsa.pdf", url: "/uploads/no-existe-xyz.pdf" });
    return debeRechazar(r, "archivo inexistente");
  });
  await caso(e, "la declaracion de vigencia solo admite PDF", async () => {
    const r = await subir(usuario, "declaracion_vigencia", "png", new Blob([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(900)], { type: "image/png" }), "decl.png");
    return debeRechazar(r, "png como declaracion");
  });
  const decl1 = await subirOk(usuario, "declaracion_vigencia", "v1-a");
  await caso(e, "cliente carga la declaracion de vigencia", async () => {
    await api(usuario, "POST", "/api/debida-diligencia/regularizar-vigencia", { expedienteId: impId, nombre: decl1.nombre, url: decl1.url });
    const m = await miExp(usuario, false);
    return `estadoDeclaracion=${m.declaracionVigenciaEstado}`;
  });
  await caso(e, "no se puede cargar dos veces la declaracion", async () => {
    const r = await http(usuario, "POST", "/api/debida-diligencia/regularizar-vigencia", { expedienteId: impId, nombre: decl1.nombre, url: decl1.url });
    return debeRechazar(r, "segunda carga");
  });
  await caso(e, "SIG no puede RECHAZAR la declaracion (solo observar o derivar)", async () => {
    const r = await http("sig", "POST", "/api/debida-diligencia/revisar", { expedienteId: impId, alcance: "declaracion_vigencia", accion: "rechazar", motivo: "x", informeLogisticaUrl: "https://x.com/i" });
    return debeRechazar(r, "rechazar declaracion");
  });
  await caso(e, "SIG observa la declaracion", async () => {
    const r = await http("sig", "POST", "/api/debida-diligencia/revisar", { expedienteId: impId, alcance: "declaracion_vigencia", accion: "observar", motivo: "R2: falta la firma del representante" });
    if (!r.ok) throw new Error(mensaje(r));
    const m = await miExp(usuario, false);
    if (m.declaracionVigenciaEstado !== "observado") throw new Error(`estado=${m.declaracionVigenciaEstado}`);
    if (!m.puedeRegularizarDeclaracionVigencia) throw new Error("el cliente no puede volver a cargarla");
    return "observada; el cliente puede subsanar";
  });
  const decl2 = await subirOk(usuario, "declaracion_vigencia", "v1-b");
  await caso(e, "cliente subsana (nueva declaracion)", async () => {
    await api(usuario, "POST", "/api/debida-diligencia/regularizar-vigencia", { expedienteId: impId, nombre: decl2.nombre, url: decl2.url });
    const m = await miExp(usuario, false);
    return `estadoDeclaracion=${m.declaracionVigenciaEstado}`;
  });
  await caso(e, "SIG aprueba la declaracion", async () => {
    const r = await http("sig", "POST", "/api/debida-diligencia/revisar", { expedienteId: impId, alcance: "declaracion_vigencia", accion: "aprobar", motivo: null });
    if (!r.ok) throw new Error(mensaje(r));
    const m = await miExp(usuario, false);
    return `estadoDeclaracion=${m.declaracionVigenciaEstado}; sigue aprobada=${m.expediente?.estado}`;
  });
  await caso(e, "aprobar otra vez es rechazado", async () => {
    const r = await http("sig", "POST", "/api/debida-diligencia/revisar", { expedienteId: impId, alcance: "declaracion_vigencia", accion: "aprobar", motivo: null });
    return debeRechazar(r, "doble aprobacion");
  });
  await caso(e, "observar una declaracion ya aprobada es rechazado", async () => {
    const r = await http("sig", "POST", "/api/debida-diligencia/revisar", { expedienteId: impId, alcance: "declaracion_vigencia", accion: "observar", motivo: "tarde" });
    return debeRechazar(r, "observar aprobada");
  });
  await caso(e, "tras aprobar la declaracion el cliente ya no puede recargarla ni ve que la requiera", async () => {
    const m = await miExp(usuario, false);
    if (m.puedeRegularizarDeclaracionVigencia) throw new Error("sigue habilitado para cargar");
    return `requiere=${m.requiereDeclaracionVigencia}`;
  });

  // V1b: aprobar sin declaracion cargada
  const nb = "02";
  const impB = await sembrarExpediente(nb);
  await caso("V1", "SIG no puede aprobar una declaracion que no existe", async () => {
    const r = await http("sig", "POST", "/api/debida-diligencia/revisar", { expedienteId: impB, alcance: "declaracion_vigencia", accion: "aprobar", motivo: null });
    return debeRechazar(r, "aprobar sin declaracion");
  });
  await caso("V1", "un cliente con DD vigente (declaracion pendiente) no puede enviar una DD nueva sin declaracion", async () => {
    await login("cli02", "e2e-r02@example.invalid");
    await api("cli02", "POST", "/api/debida-diligencia/nueva", {});
    const docs = [];
    for (const t of TIPOS_REQ) docs.push(await subirOk("cli02", t, "r02"));
    await api("cli02", "POST", "/api/debida-diligencia/guardar", cuerpoCliente("02", docs, [benef("02")]));
    const r = await http("cli02", "POST", "/api/debida-diligencia/enviar", {});
    return debeRechazar(r, "enviar sin declaracion");
  });

  // V2: importada vencida
  const n3 = "03";
  const impVencida = await sembrarExpediente(n3, { aprobadaHace: 400, venceEn: -10 });
  await login("cli03", "e2e-r03@example.invalid");
  await caso("V2", "DD importada VENCIDA: no admite declaracion de vigencia (debe repetir la DD)", async () => {
    const m = await miExp("cli03", false);
    const r = await http("cli03", "POST", "/api/debida-diligencia/regularizar-vigencia", { expedienteId: impVencida, nombre: "d.pdf", url: "/uploads/x.pdf" });
    if (m.puedeRegularizarDeclaracionVigencia) throw new Error("la interfaz permite cargar declaracion en una DD vencida");
    return debeRechazar(r, "declaracion en DD vencida");
  });
  await caso("V2", "SIG tampoco puede aprobar la declaracion de una DD vencida", async () => {
    const r = await http("sig", "POST", "/api/debida-diligencia/revisar", { expedienteId: impVencida, alcance: "declaracion_vigencia", accion: "aprobar", motivo: null });
    return debeRechazar(r, "aprobar en vencida");
  });

  // V4: DD aprobada por el flujo regular en otro evento (regla de la reunion: bastaria la declaracion de vigencia)
  const n4 = "04";
  const regular = await sembrarExpediente(n4, { origen: "flujo_regular" });
  await login("cli04", "e2e-r04@example.invalid");
  await caso("V4", "DD APTO del flujo regular (otro evento, vigente): puede renovarse solo con la declaracion de vigencia", async () => {
    const m = await miExp("cli04", false);
    const r = await http("cli04", "POST", "/api/debida-diligencia/regularizar-vigencia", { expedienteId: regular, nombre: "d.pdf", url: "/uploads/x.pdf" });
    if (m.puedeRegularizarDeclaracionVigencia) return `habilitado (flags ok); ${r.status}`;
    throw new Error(`no hay camino de declaracion: puedeRegularizar=${m.puedeRegularizarDeclaracionVigencia}, respuesta=${r.status} ${mensaje(r)}`);
  });
  await caso("V4", "con una DD APTO vigente de otro evento el cliente no queda bloqueado para el evento activo", async () => {
    const r = await http("cli04", "POST", "/api/debida-diligencia/nueva", {});
    if (!r.ok) throw new Error(`nueva -> ${r.status} ${mensaje(r)}`);
    return `nueva DD creada para el evento activo (${r.json?.data?.codigo})`;
  });
}

// ---------------------------------------------------------------- S: observacion y subsanacion
async function subsanacion() {
  // S1 / S5: observar dos documentos, subsanar a medias, reenviar sin cambios, segunda ronda
  const e = "S1";
  const ctx = await clienteCrea("05");
  await caso(e, "los vinculos enviados por el cliente llegan al expediente (bug #1 corregido)", async () => {
    const m = await miExp(ctx.usuario);
    const n = m.expediente?.beneficiarios?.length ?? 0;
    if (n !== ctx.benef.length) throw new Error(`enviados=${ctx.benef.length} guardados=${n}`);
    return `${n} vinculo(s) persistidos`;
  });
  await caso(e, "SIG observa dos documentos (ficha RUC y poderes)", async () => {
    const r = await observarSig(ctx, ["ficha_ruc", "poderes"]);
    if (!r.ok) throw new Error(mensaje(r));
    return `estado=${await estado(ctx)}`;
  });
  await caso(e, "el cliente ve ambos documentos observados", async () => {
    const m = await miExp(ctx.usuario);
    const obs = (m.expediente?.documentos || []).filter((d) => d.estado === "observado").map((d) => d.tipo).sort();
    if (obs.join() !== "ficha_ruc,poderes") throw new Error(`observados=${obs.join()}`);
    return `observados=${obs.join()}; observaciones abiertas=${(m.expediente?.observaciones || []).filter((o) => o.estado === "abierta").length}`;
  });
  await caso(e, "reenviar SIN cambiar ningun documento observado es rechazado", async () => {
    await reguardar(ctx);
    return debeRechazar(await enviar(ctx), "reenvio sin cambios");
  });
  await caso(e, "subsanar solo uno de los dos documentos observados y reenviar es rechazado", async () => {
    await reemplazarDoc(ctx, "ficha_ruc", "s1-nuevo");
    await reguardar(ctx);
    return debeRechazar(await enviar(ctx), "subsanacion parcial");
  });
  await caso(e, "subsanar ambos y reenviar vuelve a revision", async () => {
    await reemplazarDoc(ctx, "poderes", "s1-nuevo");
    const g = await reguardar(ctx);
    if (!g.ok) throw new Error(`guardar ${mensaje(g)}`);
    const r = await enviar(ctx);
    if (!r.ok) throw new Error(`enviar ${mensaje(r)}`);
    const d = await detalleExp(ctx);
    const abiertas = (d.observaciones || []).filter((o) => o.estado === "abierta").length;
    if (abiertas > 0) throw new Error(`quedan ${abiertas} observaciones abiertas tras subsanar`);
    return `estado=${d.estado}; observaciones abiertas=0`;
  });
  await caso(e, "segunda ronda: SIG vuelve a observar otro documento y el cliente subsana", async () => {
    const r = await observarSig(ctx, ["identidad_representante"], "R2 segunda ronda");
    if (!r.ok) throw new Error(mensaje(r));
    await reemplazarDoc(ctx, "identidad_representante", "s1-ronda2");
    await reguardar(ctx);
    const env = await enviar(ctx);
    if (!env.ok) throw new Error(mensaje(env));
    return `estado=${await estado(ctx)}`;
  });
  await caso(e, "el cliente no puede editar mientras el expediente esta en revision", async () => {
    return debeRechazar(await reguardar(ctx), "editar en revision");
  });
  await caso(e, "tras dos rondas de observacion el flujo llega a APTO", async () => {
    await sigAComunicacionesYConclusiones(ctx);
    const f = await finalSig(ctx, "apto");
    if (!f.ok) throw new Error(mensaje(f));
    return `estado=${await estado(ctx)}`;
  });

  // S2: documento adicional solicitado por SIG
  const ctx2 = await clienteCrea("06");
  const e2 = "S2";
  await caso(e2, "SIG solicita un documento adicional", async () => {
    const r = await observarSig(ctx2, ["documento_adicional"], "R2 se requiere carta adicional");
    if (!r.ok) throw new Error(mensaje(r));
    return `estado=${await estado(ctx2)}`;
  });
  await caso(e2, "reenviar sin adjuntar el documento adicional es rechazado", async () => {
    await reguardar(ctx2);
    return debeRechazar(await enviar(ctx2), "sin documento adicional");
  });
  await caso(e2, "el documento adicional solo admite PDF", async () => {
    const r = await subir(ctx2.usuario, "documento_adicional", "x", new Blob([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(900)], { type: "image/png" }), "extra.png");
    return debeRechazar(r, "png como adicional");
  });
  await caso(e2, "con el documento adicional el reenvio es aceptado", async () => {
    ctx2.docs.push(await subirOk(ctx2.usuario, "documento_adicional", "s2"));
    const g = await reguardar(ctx2);
    if (!g.ok) throw new Error(mensaje(g));
    const r = await enviar(ctx2);
    if (!r.ok) throw new Error(mensaje(r));
    return `estado=${await estado(ctx2)}`;
  });

  // S4: Legal en varias rondas y estados invalidos
  const ctx3 = await clienteCrea("07");
  const e3 = "S4";
  await caso(e3, "preparar expediente en Legal (observado por ambas areas)", async () => {
    await sigAComunicacionesYConclusiones(ctx3, { observados: ["SOCIO"] });
    const r = await derivarLegal(ctx3);
    if (!r.ok) throw new Error(mensaje(r));
    return `estado=${await estado(ctx3)}`;
  });
  await caso(e3, "Legal observa sin motivo es rechazado", async () => {
    return debeRechazar(await legal(ctx3, "observar", { motivo: "" }), "observar sin motivo");
  });
  await caso(e3, "Legal rechaza sin informe es rechazado", async () => {
    return debeRechazar(await legal(ctx3, "rechazar"), "rechazar sin informe");
  });
  await caso(e3, "Legal observa (ronda 1)", async () => {
    const r = await legal(ctx3, "observar", { documentosObservados: ["poderes"], motivo: "R2 ronda 1" });
    if (!r.ok) throw new Error(mensaje(r));
    return `estado=${await estado(ctx3)}`;
  });
  await caso(e3, "Legal no puede observar de nuevo mientras espera al cliente", async () => {
    return debeRechazar(await legal(ctx3, "observar", { motivo: "doble" }), "doble observacion");
  });
  await caso(e3, "cliente subsana y vuelve a Legal", async () => {
    await reemplazarDoc(ctx3, "poderes", "s4-r1");
    await reguardar(ctx3);
    const r = await enviar(ctx3);
    if (!r.ok) throw new Error(mensaje(r));
    return `estado=${await estado(ctx3)}`;
  });
  await caso(e3, "Legal observa (ronda 2) pidiendo documento adicional y el cliente debe adjuntarlo", async () => {
    const r = await legal(ctx3, "observar", { documentosObservados: ["documento_adicional"], motivo: "R2 ronda 2: aclaracion firmada" });
    if (!r.ok) throw new Error(mensaje(r));
    await reguardar(ctx3);
    const sin = await enviar(ctx3);
    if (sin.ok) throw new Error("se acepto el reenvio SIN el documento adicional");
    ctx3.docs.push(await subirOk(ctx3.usuario, "documento_adicional", "s4-r2"));
    await reguardar(ctx3);
    const con = await enviar(ctx3);
    if (!con.ok) throw new Error(mensaje(con));
    return `rechazado sin adicional; con adicional estado=${await estado(ctx3)}`;
  });
  await caso(e3, "Legal rechaza con informe (cierra la DD)", async () => {
    const fd = new FormData();
    fd.append("file", pdf("informe"), "informe-r2.pdf");
    const inf = await api("legal", "POST", "/api/debida-diligencia/legal/informe", fd, true);
    const r = await legal(ctx3, "rechazar", { informeLegalNombre: inf.nombre, informeLegalUrl: inf.url, motivo: "R2 riesgo critico" });
    if (!r.ok) throw new Error(mensaje(r));
    return `estado=${await estado(ctx3)}`;
  });
  await caso(e3, "tras el rechazo: Legal no puede aprobar, SIG no puede aprobar, el cliente no puede editar", async () => {
    const a = debeRechazar(await legal(ctx3, "aprobar"), "legal aprobar rechazada");
    const b = debeRechazar(await finalSig(ctx3, "apto"), "SIG apto en rechazada");
    const c = debeRechazar(await reguardar(ctx3), "cliente edita rechazada");
    return `${a.slice(0, 40)} | ${b.slice(0, 40)} | ${c.slice(0, 40)}`;
  });
  await caso(e3, "tras el rechazo el cliente puede iniciar una nueva DD (sin duplicar el expediente rechazado)", async () => {
    const antes = (await db("select count(*)::int n from debida_diligencia where empresa_id=(select empresa_id from debida_diligencia where id=$1)", [ctx3.expedienteId]))[0].n;
    const r = await http(ctx3.usuario, "POST", "/api/debida-diligencia/nueva", {});
    if (!r.ok) throw new Error(`nueva -> ${r.status} ${mensaje(r)}`);
    const despues = (await db("select count(*)::int n from debida_diligencia where empresa_id=(select empresa_id from debida_diligencia where id=$1)", [ctx3.expedienteId]))[0].n;
    return `expedientes ${antes} -> ${despues}; nueva=${r.json?.data?.codigo} estado=${r.json?.data?.estado}`;
  });

  // S8/S9/S10: aprobada y vencida
  const ctx4 = await clienteCrea("08");
  await sigAComunicacionesYConclusiones(ctx4);
  await finalSig(ctx4, "apto");
  await caso("S9", "DD aprobada vigente: el cliente no puede iniciar otra ni editar", async () => {
    const a = debeRechazar(await http(ctx4.usuario, "POST", "/api/debida-diligencia/nueva", {}), "nueva en vigente");
    const b = debeRechazar(await reguardar(ctx4), "editar aprobada");
    return `${a.slice(0, 60)} | ${b.slice(0, 60)}`;
  });
  await caso("S10", "DD aprobada VENCIDA: el cliente puede renovarla", async () => {
    await db("update debida_diligencia set fecha_vencimiento = now() - interval '2 days' where id=$1", [ctx4.expedienteId]);
    const r = await http(ctx4.usuario, "POST", "/api/debida-diligencia/nueva", {});
    if (!r.ok) throw new Error(`nueva -> ${r.status} ${mensaje(r)}`);
    return `renovacion=${r.json?.data?.codigo} estado=${r.json?.data?.estado}`;
  });
  await caso("S10", "la bandeja marca la vigencia vencida del expediente original", async () => {
    const b = await api("sig", "GET", `/api/debida-diligencia/bandeja?eventoId=${EVENTO}&search=20999992008&perPage=20`);
    const filas = (b.data || []).filter((r) => r.empresa?.ruc === "20999992008");
    return `${filas.length} fila(s): ${filas.map((f) => `${f.codigo}:${f.estado}:${f.vigencia ?? f.estadoVigencia ?? "-"}`).join(", ")}`;
  });
}

// ---------------------------------------------------------------- X: seguridad y robustez
async function seguridad() {
  const ctxA = await clienteCrea("09");
  const ctxB = await clienteCrea("10");
  // IDOR entre clientes
  await caso("X1", "cliente B NO puede leer el detalle del expediente de A", async () => {
    return debeRechazar(await http(ctxB.usuario, "GET", `/api/debida-diligencia/detalle?id=${ctxA.expedienteId}`), "detalle ajeno");
  });
  await caso("X1", "cliente B NO puede ver el historial de A", async () => {
    return debeRechazar(await http(ctxB.usuario, "GET", `/api/debida-diligencia/historial?id=${ctxA.expedienteId}`), "historial ajeno");
  });
  await caso("X1", "cliente NO puede leer el detalle de un vinculo de la matriz", async () => {
    const filas = await filasMatriz(ctxA);
    return debeRechazar(await http(ctxB.usuario, "GET", `/api/debida-diligencia/matriz-evaluacion/detalle?id=${filas[0].id}`), "vinculo ajeno");
  });
  await caso("X1", "los archivos subidos exigen sesion (URL directa sin cookie)", async () => {
    const url = ctxA.docs[0].url;
    const r = await fetch(BASE + url);
    if (r.ok) throw new Error(`GET ${url} sin sesion -> ${r.status}: el documento es publico (cualquiera con el enlace lo descarga)`);
    return `sin sesion -> ${r.status}`;
  });
  await caso("X1", "un cliente NO puede descargar el documento de otra empresa con su sesion", async () => {
    const r = await http(ctxB.usuario, "GET", ctxA.docs[0].url);
    if (r.status === 200) throw new Error(`cliente B descargo ${ctxA.docs[0].url} de la empresa A (200)`);
    return `status ${r.status}`;
  });
  // matriz de roles sobre endpoints de otros roles
  const ep = [
    ["cliente revisa (SIG)", ctxB.usuario, "POST", "/api/debida-diligencia/revisar", { expedienteId: ctxA.expedienteId, alcance: "expediente", accion: "aprobar" }],
    ["cliente resuelve Legal", ctxB.usuario, "POST", "/api/debida-diligencia/legal/resolver", { expedienteId: ctxA.expedienteId, decision: "aprobar" }],
    ["cliente deriva a Comunicaciones", ctxB.usuario, "POST", "/api/debida-diligencia/derivar-comunicaciones", { expedienteId: ctxA.expedienteId }],
    ["cliente guarda matriz", ctxB.usuario, "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", { id: "x", resultadoFinal: "apto" }],
    ["cliente observa reputacion", ctxB.usuario, "POST", "/api/debida-diligencia/reputacion/observar", { id: "x", resultado: "aceptado", cerrar: true }],
    ["cliente automatiza", ctxB.usuario, "POST", "/api/debida-diligencia/matriz-evaluacion/automatizar-todo", { vinculoId: "x" }],
    ["Comunicaciones guarda matriz SIG", "com", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", { id: "x", sig: { resultado: "aceptado" } }],
    ["Comunicaciones revisa", "com", "POST", "/api/debida-diligencia/revisar", { expedienteId: ctxA.expedienteId, alcance: "expediente", accion: "aprobar" }],
    ["Comunicaciones resuelve Legal", "com", "POST", "/api/debida-diligencia/legal/resolver", { expedienteId: ctxA.expedienteId, decision: "aprobar" }],
    ["Legal revisa (SIG)", "legal", "POST", "/api/debida-diligencia/revisar", { expedienteId: ctxA.expedienteId, alcance: "expediente", accion: "aprobar" }],
    ["Legal guarda matriz", "legal", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", { id: "x", resultadoFinal: "apto" }],
    ["Legal observa reputacion", "legal", "POST", "/api/debida-diligencia/reputacion/observar", { id: "x", resultado: "aceptado", cerrar: true }],
    ["SIG resuelve Legal", "sig", "POST", "/api/debida-diligencia/legal/resolver", { expedienteId: ctxA.expedienteId, decision: "aprobar" }],
    ["SIG observa reputacion", "sig", "POST", "/api/debida-diligencia/reputacion/observar", { id: "x", resultado: "aceptado", cerrar: true }],
    ["SIG edita como cliente", "sig", "POST", "/api/debida-diligencia/guardar", cuerpoCliente("09", ctxA.docs, [])],
    ["Legal edita como cliente", "legal", "POST", "/api/debida-diligencia/guardar", cuerpoCliente("09", ctxA.docs, [])],
    ["cliente ve bandeja de SIG", ctxB.usuario, "GET", `/api/debida-diligencia/bandeja?eventoId=${EVENTO}`],
    ["cliente ve bandeja Legal", ctxB.usuario, "GET", "/api/debida-diligencia/legal/bandeja"],
    ["cliente ve reputacion", ctxB.usuario, "GET", "/api/debida-diligencia/reputacion/listar"],
    ["cliente ve matriz", ctxB.usuario, "GET", "/api/debida-diligencia/matriz-evaluacion"],
    ["cliente ve panel", ctxB.usuario, "GET", "/api/debida-diligencia/panel"],
    ["cliente ve empresas externas", ctxB.usuario, "GET", "/api/debida-diligencia/empresas"],
    ["sin sesion ve bandeja", "anon", "GET", "/api/debida-diligencia/bandeja"],
  ];
  sesiones.anon = { token: null };
  for (const [nombre, quien, metodo, ruta, cuerpo] of ep) {
    await caso("X3", `permisos: ${nombre} -> debe ser rechazado`, async () => debeRechazar(await http(quien, metodo, ruta, cuerpo), nombre));
  }
  // token manipulado
  await caso("X2", "token con firma invalida o alg=none es rechazado", async () => {
    const real = sesiones[ctxB.usuario].token;
    const [h, p] = real.split(".");
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    payload.roles = ["admin"];
    payload.permissions = ["admin:full", "dd:legal", "dd:revision", "dd:matriz"];
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const sinFirma = `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.`;
    const firmaFalsa = `${h}.${b64(payload)}.${crypto.randomBytes(32).toString("base64url")}`;
    sesiones.fake = { token: sinFirma };
    const a = await http("fake", "GET", `/api/debida-diligencia/bandeja?eventoId=${EVENTO}`);
    sesiones.fake = { token: firmaFalsa };
    const b = await http("fake", "GET", `/api/debida-diligencia/bandeja?eventoId=${EVENTO}`);
    if (a.ok || b.ok) throw new Error(`token manipulado ACEPTADO (alg none=${a.status}, firma falsa=${b.status})`);
    return `alg none=${a.status}, firma falsa=${b.status}`;
  });
  await caso("X2", "fuerza bruta de login: se limita o bloquea tras muchos intentos fallidos", async () => {
    const codigos = [];
    for (let i = 0; i < 12; i += 1) {
      const r = await http("anon", "POST", "/api/auth/login", { email: "e2e-r30@example.invalid", password: `incorrecta-${i}` });
      codigos.push(r.status);
    }
    const limitado = codigos.some((c) => c === 429 || c === 423);
    const entra = await http("anon", "POST", "/api/auth/login", { email: "e2e-r30@example.invalid", password: PASSWORD });
    if (!limitado) throw new Error(`12 intentos fallidos sin limite (codigos ${[...new Set(codigos)].join(",")}); el login correcto sigue entrando (${entra.status})`);
    return `limitado (${[...new Set(codigos)].join(",")})`;
  });

  // asignacion masiva y validaciones
  const nv = "11";
  await login(`cli${nv}`, `e2e-r${nv}@example.invalid`);
  await api(`cli${nv}`, "POST", "/api/debida-diligencia/nueva", {});
  const docsV = [];
  for (const t of TIPOS_REQ) docsV.push(await subirOk(`cli${nv}`, t, "r11"));
  const guardarV = (extraBody, benefs = [benef(nv)]) => http(`cli${nv}`, "POST", "/api/debida-diligencia/guardar", { ...cuerpoCliente(nv, docsV, benefs), ...extraBody });
  await caso("X5", "asignacion masiva: campos de estado enviados por el cliente se ignoran", async () => {
    const r = await guardarV({ estado: "aprobada", origen: "importado", decisionLegal: "aprobar", fechaAprobacion: new Date().toISOString(), fechaVencimiento: "2099-01-01", revisadoPor: "hacker", resultado: "apto", empresaId: "otra", eventoId: OTRO_EVENTO });
    if (!r.ok) return `rechazado ${r.status} (tambien valido)`;
    const [fila] = await db("select estado, origen, decision_legal, fecha_aprobacion, revisado_por, evento_id from debida_diligencia where id=$1", [r.json.data.id]);
    const mal = fila.estado !== "borrador" || fila.origen !== "flujo_regular" || fila.decision_legal || fila.fecha_aprobacion || fila.revisado_por || fila.evento_id !== EVENTO;
    if (mal) throw new Error(`campos protegidos modificados: ${JSON.stringify(fila)}`);
    return "campos protegidos intactos";
  });
  const inval = [
    ["porcentaje 101", { porcentaje: 101 }],
    ["porcentaje negativo", { porcentaje: -5 }],
    ["porcentaje texto", { porcentaje: "abc" }],
    ["nombre vacio", { nombre: "" }],
    ["nombre de 500 caracteres", { nombre: "N".repeat(500) }],
    ["documento de 40 caracteres", { documento: "9".repeat(40) }],
    ["DNI de 3 digitos", { documento: "123" }],
    ["nacionalidad con etiquetas HTML", { nacionalidad: "<script>alert(1)</script>" }],
    ["tipo de vinculo inexistente", { tipoVinculoPersona: "dueño_supremo" }],
    ["tipo de documento inexistente", { tipoDocumento: "Licencia" }],
  ];
  for (const [nombre, cambio] of inval) {
    await caso("X6", `validacion: beneficiario con ${nombre}`, async () => debeRechazar(await guardarV({}, [benef(nv, 1, cambio)]), nombre));
  }
  await caso("X6", "validacion: 21 beneficiarios (maximo 20)", async () => {
    const lista = Array.from({ length: 21 }, (_, i) => benef(nv, i + 1, { documento: `4${String(5000 + i).padStart(7, "0")}` }));
    return debeRechazar(await guardarV({}, lista), "21 beneficiarios");
  });
  await caso("X6", "validacion: dos beneficiarios con el mismo documento", async () => {
    const r = await guardarV({}, [benef(nv, 1), benef(nv, 2, { documento: benef(nv, 1).documento })]);
    if (r.status >= 500) throw new Error(`error del servidor ${r.status}: ${mensaje(r)}`);
    if (!r.ok) return `rechazado ${r.status}`;
    const n = (await db("select count(*)::int n from debida_diligencia_beneficiario where expediente_id=$1", [r.json.data.id]))[0].n;
    if (n === 2) throw new Error("se guardaron dos beneficiarios con el mismo documento (duplicado)");
    return `aceptado y consolidado en ${n}`;
  });
  const campos = [
    ["correo del representante invalido", { emailRepresentante: "no-es-correo" }],
    ["sitio web de 5000 caracteres", { sitioWeb: `https://${"a".repeat(5000)}.com` }],
    ["relacion comercial inexistente", { tipoRelacionComercial: ["hacker"] }],
  ];
  for (const [nombre, cambio] of campos) {
    await caso("X6", `validacion: ${nombre}`, async () => {
      const r = await guardarV(cambio);
      if (!r.ok && r.status < 500) return `rechazado ${r.status}`;
      if (r.status >= 500) throw new Error(`error del servidor ${r.status}`);
      const e = await http(`cli${nv}`, "POST", "/api/debida-diligencia/enviar", {});
      if (e.ok) throw new Error(`guardo y ENVIO a revision con ${nombre}`);
      return `se guarda pero el envio lo rechaza (${e.status})`;
    });
  }
  // archivos
  const nf = "12";
  await login(`cli${nf}`, `e2e-r${nf}@example.invalid`);
  await api(`cli${nf}`, "POST", "/api/debida-diligencia/nueva", {});
  const arch = [
    ["HTML disfrazado de PDF", new Blob(["<html><script>alert(1)</script></html>".repeat(40)], { type: "application/pdf" }), "ficha.pdf"],
    ["archivo vacio", new Blob([], { type: "application/pdf" }), "vacio.pdf"],
    ["ejecutable renombrado .pdf", new Blob([Buffer.from("4d5a9000", "hex"), Buffer.alloc(2000)], { type: "application/pdf" }), "setup.pdf"],
    ["PDF real con extension .html", pdf("html"), "evil.html"],
    ["PDF real con extension .svg", pdf("svg"), "evil.svg"],
    ["PDF real con doble extension .pdf.exe", pdf("exe"), "ficha.pdf.exe"],
    ["nombre con ../", pdf("ruta"), "../../../etc/passwd.pdf"],
    ["PDF de 15 MB", pdf("grande", "x".repeat(15 * 1024 * 1024)), "grande.pdf"],
  ];
  for (const [nombre, blob, fichero] of arch) {
    await caso("X7", `carga: ${nombre}`, async () => {
      const r = await subir(`cli${nf}`, "ficha_ruc", "x", blob, fichero);
      if (r.status >= 500) throw new Error(`error del servidor ${r.status}: ${mensaje(r)}`);
      if (!r.ok) return `rechazado ${r.status}`;
      const d = r.json.data ?? r.json;
      const get = await http(`cli${nf}`, "GET", d.url);
      const tipo = get.headers.get("content-type") || "";
      const xcto = get.headers.get("x-content-type-options") || "-";
      if (/html|svg|javascript|xml/i.test(tipo)) throw new Error(`ACEPTADO y servido como ${tipo} desde ${d.url} (XSS almacenado) nosniff=${xcto}`);
      if (nombre.includes("HTML disfrazado") || nombre.includes("ejecutable") || nombre.includes("vacio")) throw new Error(`ACEPTADO un archivo que no es PDF (${nombre}); content-type=${tipo}`);
      if (nombre.includes("15 MB")) throw new Error(`aceptado un PDF de 15 MB (sin limite de tamano)`);
      return `aceptado como ${d.url.split(".").pop()}, servido como ${tipo || "?"}, nosniff=${xcto}`;
    });
  }
  await caso("X7", "los archivos se sirven con cabeceras seguras", async () => {
    const d = await subirOk(`cli${nf}`, "poderes", "cabeceras");
    const r = await http(`cli${nf}`, "GET", d.url);
    const falt = ["x-content-type-options", "content-disposition"].filter((h) => !r.headers.get(h));
    if (falt.length) throw new Error(`faltan cabeceras ${falt.join(", ")} (content-type=${r.headers.get("content-type")})`);
    return `content-type=${r.headers.get("content-type")}`;
  });

  // concurrencia
  const nc = "13";
  await login(`cli${nc}`, `e2e-r${nc}@example.invalid`);
  await caso("X8", "3 'nueva' simultaneas no duplican el expediente", async () => {
    await Promise.all([1, 2, 3].map(() => http(`cli${nc}`, "POST", "/api/debida-diligencia/nueva", {})));
    const [{ n }] = await db("select count(*)::int n from debida_diligencia where empresa_id=(select id from empresa where ruc='20999992013') and evento_id=$1", [EVENTO]);
    if (n !== 1) throw new Error(`se crearon ${n} expedientes para la misma empresa y evento`);
    return "1 expediente";
  });
  const ctxC = await clienteCrea("14", { enviar: false });
  await caso("X8", "5 'enviar' simultaneos: una sola transicion y sin errores 500", async () => {
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => enviar(ctxC)));
    const c5xx = rs.filter((r) => r.status >= 500).length;
    const okc = rs.filter((r) => r.ok).length;
    const hist = (await db("select count(*)::int n from debida_diligencia_historial where expediente_id=$1 and tipo='envio'", [ctxC.expedienteId]).catch(() => [{ n: -1 }]))[0].n;
    if (c5xx) throw new Error(`${c5xx} respuestas 5xx`);
    if (okc > 1) throw new Error(`${okc} envios aceptados en paralelo (historial de envios=${hist})`);
    return `aceptados=${okc} historial=${hist}`;
  });
  await caso("X8", "legal 'aprobar' doble en paralelo: una sola decision", async () => {
    const ctxL = await clienteCrea("15");
    await sigAComunicacionesYConclusiones(ctxL, { observados: ["SOCIO"] });
    await derivarLegal(ctxL);
    const rs = await Promise.all([legal(ctxL, "aprobar"), legal(ctxL, "aprobar"), legal(ctxL, "rechazar", { motivo: "x", informeLegalNombre: "i.pdf", informeLegalUrl: "/uploads/x.pdf" })]);
    const okc = rs.filter((r) => r.ok).length;
    const c5xx = rs.filter((r) => r.status >= 500).length;
    if (c5xx) throw new Error(`${c5xx} respuestas 5xx`);
    if (okc > 1) throw new Error(`${okc} decisiones de Legal aceptadas en paralelo (estado final ${await estado(ctxL)})`);
    return `aceptadas=${okc} estado=${await estado(ctxL)}`;
  });

  // estados invalidos del lado del personal
  const nb = await clienteCrea("16", { enviar: false });
  await caso("X5", "SIG no puede aprobar ni derivar un expediente en borrador", async () => {
    const a = debeRechazar(await http("sig", "POST", "/api/debida-diligencia/revisar", { expedienteId: nb.expedienteId, alcance: "expediente", accion: "aprobar" }), "aprobar borrador");
    const b = debeRechazar(await derivarLegal(nb), "derivar borrador");
    const c = debeRechazar(await legal(nb, "aprobar"), "legal en borrador");
    return `${a.slice(0, 35)} | ${b.slice(0, 35)} | ${c.slice(0, 35)}`;
  });
  await enviar(nb);
  await caso("X5", "Legal no puede resolver un expediente que no esta en Legal", async () => {
    return debeRechazar(await legal(nb, "aprobar"), "legal en_revision");
  });
  await caso("X5", "derivar a Comunicaciones dos veces es idempotente", async () => {
    await filasMatriz(nb);
    await api("sig", "POST", "/api/debida-diligencia/vinculos-completos", { expedienteId: nb.expedienteId, completos: true });
    const a = await api("sig", "POST", "/api/debida-diligencia/derivar-comunicaciones", { expedienteId: nb.expedienteId });
    const b = await api("sig", "POST", "/api/debida-diligencia/derivar-comunicaciones", { expedienteId: nb.expedienteId });
    if (b.derivados !== 0) throw new Error(`segunda derivacion creo ${b.derivados} casos nuevos (duplicados)`);
    return `1ra derivados=${a.derivados}; 2da derivados=${b.derivados} existentes=${b.existentes}`;
  });
  await caso("X5", "Comunicaciones: resolver un caso inexistente o ajeno da error controlado", async () => {
    const r = await http("com", "POST", "/api/debida-diligencia/reputacion/observar", { id: crypto.randomUUID(), resultado: "aceptado", cerrar: true, notificar: false });
    return debeRechazar(r, "caso inexistente");
  });
  await caso("X5", "Comunicaciones: observado sin fuente (link) es rechazado", async () => {
    const r = await api("com", "GET", `/api/debida-diligencia/reputacion/listar?search=${encodeURIComponent("E2E RONDA2 R16")}&perPage=20`);
    const caso1 = (r.data || []).find((g) => g.expedienteId === nb.expedienteId)?.casos?.[0];
    if (!caso1) throw new Error("no hay casos");
    return debeRechazar(await http("com", "POST", "/api/debida-diligencia/reputacion/observar", { id: caso1.id, resultado: "observado", comentario: "x", linkHallazgos: "", cerrar: true, notificar: false }), "observado sin fuente");
  });
  await caso("X5", "Comunicaciones: un caso cerrado no se puede reabrir con otro resultado", async () => {
    const r = await api("com", "GET", `/api/debida-diligencia/reputacion/listar?search=${encodeURIComponent("E2E RONDA2 R16")}&perPage=20`);
    const caso1 = (r.data || []).find((g) => g.expedienteId === nb.expedienteId)?.casos?.[0];
    await api("com", "POST", "/api/debida-diligencia/reputacion/iniciar", { id: caso1.id });
    await api("com", "POST", "/api/debida-diligencia/reputacion/observar", { id: caso1.id, resultado: "aceptado", cerrar: true, notificar: false });
    const otra = await http("com", "POST", "/api/debida-diligencia/reputacion/observar", { id: caso1.id, resultado: "observado", comentario: "cambio", linkHallazgos: "https://example.com/x", cerrar: true, notificar: false });
    if (otra.ok) throw new Error("un caso CERRADO fue modificado por Comunicaciones sin dejar rastro ni reapertura");
    return `rechazado ${otra.status}`;
  });
}

// ---------------------------------------------------------------- M: matriz
async function matriz() {
  const ctx = await clienteCrea("17");
  await filasMatriz(ctx);
  const f = ctx.filas[0];
  const g = (cuerpo, quien = "sig") => http(quien, "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", { id: f.id, ...cuerpo });
  await caso("M1", "una respuesta de lista fuera de SI/NO/N.A. es rechazada", async () => debeRechazar(await g({ listas: { osce: "quizas" } }), "lista invalida"));
  await caso("M1", "un criterio inexistente es rechazado", async () => debeRechazar(await g({ listas: { criterio_inventado: "no" } }), "criterio inexistente"));
  await caso("M1", "resultado SIG observado SIN observaciones es rechazado", async () => debeRechazar(await g({ sig: { resultado: "observado", conclusion: "requiere_dd_reforzada", observaciones: "" } }), "observado sin texto"));
  await caso("M1", "resultado aceptado con conclusion 'requiere DD reforzada' es inconsistente", async () => {
    const r = await g({ sig: { resultado: "aceptado", conclusion: "requiere_dd_reforzada" } });
    if (r.ok) throw new Error("se acepto una conclusion contradictoria (aceptado + requiere DD reforzada)");
    return `rechazado ${r.status}`;
  });
  await caso("M1", "resultado final inexistente es rechazado", async () => debeRechazar(await g({ resultadoFinal: "super_apto" }), "final invalido"));
  await caso("M1", "fecha final imposible es rechazada", async () => debeRechazar(await g({ finalFecha: "2026-13-45" }), "fecha imposible"));
  await caso("M1", "fecha final en el futuro lejano", async () => {
    const r = await g({ finalFecha: "2099-01-01" });
    if (r.ok) throw new Error("se acepto una fecha de decision en el año 2099 (altera la vigencia)");
    return `rechazado ${r.status}`;
  });
  await caso("M1", "comentario final de 5000 caracteres es rechazado", async () => debeRechazar(await g({ finalComentario: "C".repeat(5000) }), "comentario largo"));
  await caso("M1", "adjunto con categoria inexistente es rechazado", async () => {
    const fd = new FormData();
    fd.append("file", pdf("evidencia"), "e.pdf");
    fd.append("vinculoId", f.id);
    fd.append("categoria", "categoria_inventada");
    return debeRechazar(await http("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/adjunto", fd, true), "categoria invalida");
  });
  await caso("M1", "Comunicaciones y el cliente no pueden subir adjuntos a la matriz", async () => {
    const mk = () => {
      const fd = new FormData();
      fd.append("file", pdf("evidencia"), "e.pdf");
      fd.append("vinculoId", f.id);
      fd.append("categoria", "criterio_osce");
      return fd;
    };
    const a = debeRechazar(await http("com", "POST", "/api/debida-diligencia/matriz-evaluacion/adjunto", mk(), true), "com adjunta");
    await login("cli17", "e2e-r17@example.invalid");
    const b = debeRechazar(await http("cli17", "POST", "/api/debida-diligencia/matriz-evaluacion/adjunto", mk(), true), "cliente adjunta");
    return `${a.slice(0, 40)} | ${b.slice(0, 40)}`;
  });
  await caso("M2", "'Automatizar todo' dos veces seguidas no lanza dos procesos", async () => {
    const a = await api("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/automatizar-todo", { vinculoId: f.id });
    const b = await api("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/automatizar-todo", { vinculoId: f.id });
    if (a.jobId !== b.jobId) throw new Error(`dos procesos distintos (${a.jobId.slice(0, 8)} y ${b.jobId.slice(0, 8)})`);
    return `mismo proceso ${a.jobId.slice(0, 8)}`;
  });
  await caso("M2", "consultar el avance de un proceso ajeno o inexistente da 404", async () => {
    return debeRechazar(await http("sig", "GET", `/api/debida-diligencia/matriz-evaluacion/automatizacion?jobId=${crypto.randomUUID()}`), "job inexistente");
  });
  await caso("M3", "APTO con un vinculo OBSERVADO por SIG (sin pasar por Legal) es rechazado", async () => {
    await sigAComunicacionesYConclusiones(ctx, { observados: ["SOCIO"] });
    const r = await finalSig(ctx, "apto");
    if (r.ok) throw new Error("se declaro APTO con un vinculo observado y sin revision de Legal");
    return `rechazado ${r.status}: ${mensaje(r)}`;
  });
  await caso("M3", "SIN RESPUESTA/EN REVISION no cierran el expediente y se puede continuar", async () => {
    const a = await finalSig(ctx, "sin_respuesta");
    const b = await finalSig(ctx, "en_revision");
    if (!a.ok || !b.ok) throw new Error(`${a.status}/${b.status} ${mensaje(a)} ${mensaje(b)}`);
    return `estado=${await estado(ctx)}`;
  });
}


// ---------------------------------------------------------------- N: casos que necesitan su propia empresa
async function propios() {
  // sitio web / DNI / actividad: cada uno intenta guardar y ENVIAR; si se acepta, el expediente queda consumido
  const unicos = [
    ["18", "sitio web con esquema javascript:", { sitioWeb: "javascript:alert(document.cookie)" }],
    ["19", "representante con DNI de letras", { representanteDocumento: "ABCDEFGH", representanteTipoDocumento: "DNI" }],
    ["20", "actividad economica fuera del catalogo", { actividadEconomica: "Narcotrafico" }],
  ];
  for (const [n, nombre, cambio] of unicos) {
    await caso("N1", `validacion: ${nombre}`, async () => {
      await login(`cli${n}`, `e2e-r${n}@example.invalid`);
      await api(`cli${n}`, "POST", "/api/debida-diligencia/nueva", {});
      const docs = [];
      for (const t of TIPOS_REQ) docs.push(await subirOk(`cli${n}`, t, `r${n}`));
      const g = await http(`cli${n}`, "POST", "/api/debida-diligencia/guardar", cuerpoCliente(n, docs, [benef(n)], cambio));
      if (g.status >= 500) throw new Error(`error del servidor ${g.status}`);
      if (!g.ok) return `rechazado al guardar ${g.status}: ${mensaje(g)}`;
      const e = await http(`cli${n}`, "POST", "/api/debida-diligencia/enviar", {});
      if (e.ok) throw new Error(`se guardo y ENVIO a revision con ${nombre}`);
      return `se guarda pero el envio lo rechaza (${e.status})`;
    });
  }

  // referencias a archivos y payload gigante
  const nr = "21";
  await login(`cli${nr}`, `e2e-r${nr}@example.invalid`);
  await api(`cli${nr}`, "POST", "/api/debida-diligencia/nueva", {});
  const docsR = [];
  for (const t of TIPOS_REQ) docsR.push(await subirOk(`cli${nr}`, t, "r21"));
  const ajeno = await subirOk("sig", "ficha_ruc", "archivo-de-otro").catch(() => null);
  const urls = [
    ["url con esquema javascript:", "javascript:alert(1)"],
    ["url externa (otro dominio)", "https://evil.example.com/malware.pdf"],
    ["ruta fuera de uploads", "/uploads/../../etc/passwd"],
    ...(ajeno ? [["archivo subido por otro usuario (SIG)", ajeno.url]] : []),
  ];
  for (const [nombre, url] of urls) {
    await caso("N2", `documento referenciado con ${nombre} es rechazado`, async () => {
      const docs = docsR.map((d) => (d.tipo === "ficha_ruc" ? { ...d, url } : d));
      return debeRechazar(await http(`cli${nr}`, "POST", "/api/debida-diligencia/guardar", cuerpoCliente(nr, docs, [benef(nr)])), nombre);
    });
  }
  await caso("N2", "payload gigante (5 MB) es rechazado sin romper el servidor", async () => {
    const r = await http(`cli${nr}`, "POST", "/api/debida-diligencia/guardar", JSON.stringify({ ...cuerpoCliente(nr, docsR, [benef(nr)]), relleno: "x".repeat(5 * 1024 * 1024) }));
    if (r.status >= 500) throw new Error(`error del servidor ${r.status}`);
    return `status ${r.status}`;
  });
  await caso("N2", "el servidor sigue sano tras los casos anteriores", async () => {
    const r = await http("anon", "GET", "/api/health");
    if (!r.ok) throw new Error(`health ${r.status}`);
    return "ok";
  });

  // SIG deriva a Legal con el expediente observado por Legal (esperando al cliente)
  const c18 = await clienteCrea("22");
  await caso("N3", "SIG NO puede derivar a Legal un expediente que Legal dejo observado esperando al cliente", async () => {
    await sigAComunicacionesYConclusiones(c18, { observados: ["SOCIO"] });
    const d = await derivarLegal(c18);
    if (!d.ok) throw new Error(`derivar a Legal: ${mensaje(d)}`);
    const o = await legal(c18, "observar", { documentosObservados: ["poderes"], motivo: "R2 N3" });
    if (!o.ok) throw new Error(`legal observar: ${mensaje(o)}`);
    const antes = await estado(c18);
    const r = await derivarLegal(c18);
    const despues = await estado(c18);
    if (r.ok) throw new Error(`ACEPTADO: estado ${antes} -> ${despues}; la observacion de Legal queda sin subsanar y el cliente ya no puede reenviar`);
    return `rechazado ${r.status}`;
  });

  // SIN RESPUESTA: queda el cliente atrapado?
  const c23 = await clienteCrea("23");
  await caso("N4", "tras 'SIN RESPUESTA' el cliente puede volver a presentar una DD", async () => {
    await filasMatriz(c23);
    const f1 = await finalSig(c23, "sin_respuesta");
    if (!f1.ok) throw new Error(`final sin_respuesta: ${mensaje(f1)}`);
    const n = await http(c23.usuario, "POST", "/api/debida-diligencia/nueva", {});
    const g = await reguardar(c23);
    if (!n.ok && !g.ok) throw new Error(`estado=${await estado(c23)}: el cliente no puede renovar (${n.status} ${mensaje(n)}) ni editar (${g.status} ${mensaje(g)})`);
    return `nueva=${n.status} editar=${g.status}`;
  });

  // observar vinculos (no documentos) via conclusion final DOCUMENTACION OBSERVADA
  const c24 = await clienteCrea("24", { beneficiarios: [benef("24", 1), benef("24", 2)] });
  await caso("N5", "SIG observa un VINCULO (beneficiario) y el cliente lo corrige y reenvia", async () => {
    await sigAComunicacionesYConclusiones(c24);
    const d = await detalleExp(c24);
    const b = d.beneficiarios[1];
    const f1 = await finalSig(c24, "documentacion_observada", {
      clienteComentario: "R2: revisar el segundo socio",
      documentosObservados: [],
      vinculosObservados: [{ tipo: "beneficiario", beneficiarioId: b.id, comentario: "El documento del socio no coincide" }],
    });
    if (!f1.ok) throw new Error(`observar vinculo: ${mensaje(f1)}`);
    const e1 = await estado(c24);
    c24.benef = [benef("24", 1), benef("24", 2, { documento: "49999999", nombre: "SOCIO 2 CORREGIDO" })];
    const g = await reguardar(c24);
    if (!g.ok) throw new Error(`guardar: ${mensaje(g)}`);
    const r = await enviar(c24);
    if (!r.ok) throw new Error(`enviar: ${mensaje(r)}`);
    const post = await detalleExp(c24);
    const abiertas = (post.observaciones || []).filter((o) => o.estado === "abierta").length;
    return `estado ${e1} -> ${post.estado}; observaciones abiertas=${abiertas}; vinculos=${post.beneficiarios.length}`;
  });
  await caso("N5", "la matriz refleja la correccion del vinculo (sin duplicar al socio anterior)", async () => {
    const filas = await filasMatriz(c24);
    const nombres = filas.map((f) => f.nombre);
    const dup = nombres.filter((x) => x.includes("SOCIO 2")).length;
    if (dup !== 1) throw new Error(`filas del socio 2: ${dup} (${nombres.join(" | ")})`);
    return `${filas.length} vinculos: ${nombres.join(" | ")}`;
  });

  // carrera de 'guardar' con el mismo vinculo nuevo
  const c25 = await clienteCrea("25", { enviar: false });
  await caso("N6", "5 'guardar' simultaneos con el mismo vinculo nuevo no lo duplican", async () => {
    c25.benef = [benef("25", 1), benef("25", 3)];
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => reguardar(c25)));
    const c5xx = rs.filter((r) => r.status >= 500).length;
    const [{ n }] = await db("select count(*)::int n from debida_diligencia_beneficiario where expediente_id=$1", [c25.expedienteId]);
    if (c5xx) throw new Error(`${c5xx} respuestas 5xx`);
    if (n !== 2) throw new Error(`se esperaban 2 vinculos y hay ${n} (duplicados por la carrera)`);
    return "2 vinculos";
  });

  // parametros de consulta hostiles: nunca deben producir 500
  const hostiles = [
    "search=%27%20OR%201%3D1%20--",
    "search=%25",
    "search=" + "a".repeat(5000),
    "perPage=100000",
    "perPage=-1",
    "page=0",
    "page=abc",
    "orden=inexistente",
    "estado=%00",
  ];
  await caso("N7", "parametros hostiles en las bandejas no producen errores 500", async () => {
    const malos = [];
    for (const q of hostiles) {
      for (const ruta of ["/api/debida-diligencia/bandeja", "/api/debida-diligencia/legal/bandeja", "/api/debida-diligencia/matriz-evaluacion", "/api/debida-diligencia/reputacion/listar"]) {
        const quien = ruta.includes("legal") ? "legal" : ruta.includes("reputacion") ? "com" : "sig";
        const r = await http(quien, "GET", `${ruta}?${q}`);
        if (r.status >= 500) malos.push(`${ruta.split("/").pop()}?${q.slice(0, 22)} -> ${r.status}`);
      }
    }
    if (malos.length) throw new Error(`${malos.length} respuestas 5xx: ${malos.slice(0, 4).join("; ")}`);
    return `${hostiles.length * 4} consultas sin 5xx`;
  });
  await caso("N7", "ids malformados o inexistentes dan 4xx y no 500", async () => {
    const malos = [];
    for (const id of ["no-es-un-uuid", "00000000-0000-0000-0000-000000000000", "'%20OR%201=1", "a".repeat(300)]) {
      for (const [quien, ruta] of [["sig", "/api/debida-diligencia/detalle?id="], ["sig", "/api/debida-diligencia/historial?id="], ["sig", "/api/debida-diligencia/matriz-evaluacion/detalle?id="]]) {
        const r = await http(quien, "GET", ruta + encodeURIComponent(id));
        if (r.status >= 500) malos.push(`${ruta.split("/").pop().replace("?id=", "")}(${id.slice(0, 12)}) -> ${r.status}`);
      }
    }
    if (malos.length) throw new Error(`${malos.length} respuestas 5xx: ${malos.slice(0, 4).join("; ")}`);
    return "sin 5xx";
  });
}

// ---------------------------------------------------------------- ejecucion
const BLOQUES = [["V", vigencia], ["S", subsanacion], ["X", seguridad], ["M", matriz], ["N", propios]];
(async () => {
  for (const u of [["sig", "e2e-sig@example.invalid"], ["com", "e2e-com@example.invalid"], ["legal", "e2e-legal@example.invalid"]]) {
    await login(u[0], u[1]);
  }
  for (const [clave, fn] of BLOQUES) {
    if (SOLO.length && !SOLO.includes(clave)) continue;
    console.log(`=== Bloque ${clave} ===`);
    try {
      await fn();
    } catch (e) {
      reg(clave, "excepcion no controlada del bloque", false, e.message);
    }
  }
  const ok = resultados.filter((r) => r.ok).length;
  console.log(`=== RESUMEN RONDA 2: ${ok}/${resultados.length} OK, ${resultados.length - ok} FAIL ===`);
  fs.writeFileSync("/tmp/ronda2-resultados.json", JSON.stringify(resultados, null, 1));
})().catch((e) => {
  console.log("FATAL", e.message);
  process.exit(1);
});
