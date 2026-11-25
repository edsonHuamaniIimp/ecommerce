// Ronda 6: estado "Documentacion recibida" (doc_recibida). Flujos completos con empresas nuevas R70..R79.
// Corre dentro del contenedor ctrst-e2e (sin correos). Cada caso afirma el comportamiento CORRECTO: un FAIL es un posible defecto.
import fs from "node:fs";
import pg from "pg";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const EVENTO = "c0a354e0-4c79-4b38-b88d-ff824cd28964"; // Perumin 2027 (evento activo de los clientes)
const PASSWORD = "E2eTest#2026";
const SOLO = (process.env.E2E_SOLO || "").split(",").filter(Boolean);
const HOY = new Date().toISOString().slice(0, 10);
/* Espejo de src/lib/shared/constants.ts: el script corre dentro del contenedor y no importa TypeScript.
 * src/lib/shared/__tests__/scripts-espejo-constantes.test.ts falla si estos valores se desincronizan. */
const DD_ESTADOS = { BORRADOR: "borrador", DOCUMENTACION_RECIBIDA: "doc_recibida", EN_REVISION: "en_revision", EN_LEGAL: "en_legal", OBSERVADA: "observada", APROBADA: "aprobada" };
const DD_MATRIZ_RESULTADOS_FINALES = {
  DOCUMENTACION_RECIBIDA: "documentacion_recibida",
  APTO: "apto",
  APTO_CON_OBSERVACIONES: "apto_con_observaciones",
  DOCUMENTACION_OBSERVADA: "documentacion_observada",
  EN_REVISION: "en_revision",
  NO_APTO: "no_apto",
  SIN_RESPUESTA: "sin_respuesta",
};
const DD_ACCIONES_REVISION = { APROBAR: "aprobar", OBSERVAR: "observar", RECHAZAR: "rechazar" };
const DD_ACCIONES_LEGAL = { APROBAR: "aprobar", RECHAZAR: "rechazar", OBSERVAR: "observar" };
const DD_ALCANCES_REVISION = { EXPEDIENTE: "expediente" };
const DD_DOCUMENTOS = { FICHA_RUC: "ficha_ruc", PODERES: "poderes", IDENTIDAD_REPRESENTANTE: "identidad_representante", DECLARACION_JURADA: "declaracion_jurada" };
const DD_VINCULOS = { EXHIBIDOR: "exhibidor" };
const DD_TIPOS_DOCUMENTO_REPRESENTANTE = { DNI: "DNI" };
const DD_TIPOS_VINCULO_PERSONA = { BENEFICIARIO_FINAL: "beneficiario_final" };
const DD_MATRIZ_TIPOS_VINCULO = { EMPRESA: "empresa" };
const DD_MATRIZ_ADJUNTO_CATEGORIAS = { SIG_INFORME: "sig_informe" };
const DD_MATRIZ_RESULTADOS = { ACEPTADO: "aceptado" };
const DD_MATRIZ_CONCLUSIONES = { SIN_OBSERVACIONES: "sin_observaciones" };
const DD_MATRIZ_SI_NO_NA = { NO: "no" };
const DD_MATRIZ_LISTA_OTROS = "otros";
const DD_REPUTACION_RESULTADOS = { ACEPTADO: "aceptado" };
const DD_HISTORIAL_TIPOS = { INICIO_REVISION: "inicio_revision" };
const DD_RESULTADOS = { PENDIENTE: "pendiente" };
const RECIBIDA = DD_ESTADOS.DOCUMENTACION_RECIBIDA;
const EN_REVISION = DD_ESTADOS.EN_REVISION;
const resultados = [];
const sesiones = {};

// ---------------------------------------------------------------- infraestructura (igual que ronda 5)
const corto = (v, max = 220) => (typeof v === "string" ? v : JSON.stringify(v) ?? "").replace(/\s+/g, " ").slice(0, max);
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
async function http(usuario, metodo, ruta, cuerpo, formulario = false) {
  const s = sesiones[usuario];
  const headers = {};
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
  return { status: r.status, json, texto, ok: r.ok && json?.success !== false };
}
const mensaje = (r) => corto(r.json?.error?.message || r.json?.error || r.texto || `HTTP ${r.status}`, 160);
async function api(usuario, metodo, ruta, cuerpo, formulario) {
  const r = await http(usuario, metodo, ruta, cuerpo, formulario);
  if (!r.ok) throw new Error(`${metodo} ${ruta} -> ${r.status} ${mensaje(r)}`);
  return r.json.data ?? r.json;
}
/** Afirma un rechazo controlado (4xx, opcionalmente con status exacto), nunca aceptado ni 5xx. */
function debeRechazar(r, etiqueta, status) {
  if (r.status >= 500) throw new Error(`${etiqueta}: error del servidor ${r.status} ${mensaje(r)}`);
  if (r.ok) throw new Error(`${etiqueta}: FUE ACEPTADO (${r.status})`);
  if (status && r.status !== status) throw new Error(`${etiqueta}: status ${r.status} (se esperaba ${status}) ${mensaje(r)}`);
  return `${r.status}`;
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
const pdf = (texto) =>
  new Blob([`%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n% ${texto}\n${"% e2e ".repeat(300)}\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`], { type: "application/pdf" });
async function subirOk(usuario, tipo, etiqueta) {
  const fd = new FormData();
  fd.append("file", pdf(etiqueta), `${tipo}-${etiqueta}.pdf`);
  fd.append("tipo", tipo);
  const r = await http(usuario, "POST", "/api/debida-diligencia/documento", fd, true);
  if (!r.ok) throw new Error(`subir ${tipo} -> ${r.status} ${mensaje(r)}`);
  const d = r.json.data ?? r.json;
  return { tipo, nombre: d.nombre, url: d.url };
}
const TIPOS_REQ = [DD_DOCUMENTOS.FICHA_RUC, DD_DOCUMENTOS.PODERES, DD_DOCUMENTOS.IDENTIDAD_REPRESENTANTE, DD_DOCUMENTOS.DECLARACION_JURADA];
const razon = (n) => `E2E RONDA2 R${n} S.A.C.`;
function cuerpoCliente(n, docs, beneficiarios, extra = {}) {
  return {
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
    beneficiarios,
    documentos: docs.map((d) => ({ tipo: d.tipo, nombre: d.nombre, url: d.url })),
    ...extra,
  };
}
const benef = (n, k = 1) => ({
  nombre: `SOCIO ${k} R${n}`,
  documento: `4${String(Number(n) * 10 + k + 2000).padStart(7, "0")}`,
  tipoDocumento: DD_TIPOS_DOCUMENTO_REPRESENTANTE.DNI,
  nacionalidad: "Perú",
  porcentaje: 30,
  tipoVinculoPersona: DD_TIPOS_VINCULO_PERSONA.BENEFICIARIO_FINAL,
});

/** Cliente: borrador, documentos, guardar y enviar. Exige que la empresa no tenga DD en el evento. */
async function clienteEnvia(n, { beneficiarios } = {}) {
  const usuario = `cli${n}`;
  await login(usuario, `e2e-r${n}@example.invalid`);
  const ctx = { n, usuario, docs: [], benef: beneficiarios ?? [benef(n, 1)] };
  await api(usuario, "POST", "/api/debida-diligencia/nueva", {});
  for (const tipo of TIPOS_REQ) ctx.docs.push(await subirOk(usuario, tipo, `r${n}`));
  const e = await api(usuario, "POST", "/api/debida-diligencia/guardar", cuerpoCliente(n, ctx.docs, ctx.benef));
  ctx.expedienteId = e.id;
  ctx.estadoAntesDeEnviar = e.estado;
  await api(usuario, "POST", "/api/debida-diligencia/enviar", {});
  return ctx;
}
const detalleExp = (ctx, quien = "sig") => api(quien, "GET", `/api/debida-diligencia/detalle?id=${ctx.expedienteId}`);
const estado = async (ctx) => (await detalleExp(ctx)).estado;
const historial = (ctx) => api("sig", "GET", `/api/debida-diligencia/historial?id=${ctx.expedienteId}`);
async function eventosHistorial(ctx) {
  const h = await historial(ctx);
  return h.eventos ?? h.items ?? h ?? [];
}
async function inicios(ctx) {
  const [r] = await db("select count(*)::int n from debida_diligencia_historial where expediente_id=$1 and tipo=$2", [ctx.expedienteId, DD_HISTORIAL_TIPOS.INICIO_REVISION]);
  return r.n;
}
async function filasMatriz(ctx) {
  const m = await api("sig", "GET", `/api/debida-diligencia/matriz-evaluacion?expedienteId=${ctx.expedienteId}&perPage=100`);
  ctx.filas = m.data || [];
  ctx.empresaFila = ctx.filas.find((f) => f.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA) || ctx.filas[0];
  return ctx.filas;
}
const detFila = (id) => api("sig", "GET", `/api/debida-diligencia/matriz-evaluacion/detalle?id=${id}`);
const finalSig = (ctx, resultadoFinal, extra = {}) =>
  http("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", {
    id: ctx.empresaFila.id,
    resultadoFinal,
    finalFecha: HOY,
    finalPor: "R6 SIG",
    finalComentario: "R6",
    ...extra,
  });
async function borrador(ctx, fila = ctx.empresaFila) {
  const det = await detFila(fila.id);
  const codigo = det.listas?.[0]?.codigo;
  return http("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", {
    id: fila.id,
    borrador: true,
    listas: codigo ? { [codigo]: DD_MATRIZ_SI_NO_NA.NO } : {},
    sig: { observaciones: "R6 avance" },
  });
}
const revisar = (ctx, accion, extra = {}) =>
  http("sig", "POST", "/api/debida-diligencia/revisar", {
    expedienteId: ctx.expedienteId,
    alcance: DD_ALCANCES_REVISION.EXPEDIENTE,
    accion,
    motivo: `R6 ${accion}`,
    informeLogisticaUrl: "https://drive.google.com/r6-informe",
    documentosObservados: accion === DD_ACCIONES_REVISION.OBSERVAR ? [DD_DOCUMENTOS.FICHA_RUC] : [],
    observaciones: accion === DD_ACCIONES_REVISION.OBSERVAR ? [{ documentoTipo: DD_DOCUMENTOS.FICHA_RUC, texto: "R6 observacion" }] : [],
    derivarComunicaciones: false,
    ...extra,
  });
const legal = (ctx, decision, extra = {}) =>
  http("legal", "POST", "/api/debida-diligencia/legal/resolver", {
    expedienteId: ctx.expedienteId,
    decision,
    motivo: decision === DD_ACCIONES_LEGAL.APROBAR ? null : `R6: ${decision}`,
    documentosObservados: [],
    informeLegalNombre: null,
    informeLegalUrl: null,
    ...extra,
  });
async function reemplazarDoc(ctx, tipo, etiqueta) {
  const nuevo = await subirOk(ctx.usuario, tipo, etiqueta);
  ctx.docs = ctx.docs.filter((d) => d.tipo !== tipo).concat([nuevo]);
}
const reguardar = (ctx) => http(ctx.usuario, "POST", "/api/debida-diligencia/guardar", cuerpoCliente(ctx.n, ctx.docs, ctx.benef));
const enviar = (ctx) => http(ctx.usuario, "POST", "/api/debida-diligencia/enviar", {});

/** Comunicaciones sin hallazgos y SIG con listas y conclusion en todas las filas (deja todo listo para APTO). */
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
      sig: { fecha: HOY, responsable: "R6 SIG", resultado: DD_MATRIZ_RESULTADOS.ACEPTADO, observaciones: null, conclusion: DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES },
    });
    await api("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", { id: f.id, reputacional: { conclusion: DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES } });
  }
}
const esperarEstado = async (ctx, esperado, etiqueta) => {
  const e = await estado(ctx);
  if (e !== esperado) throw new Error(`${etiqueta}: estado=${e} (se esperaba ${esperado})`);
  return e;
};

// ================================================================ bloques
async function primerEnvioYBloqueos() {
  const c = await clienteEnvia("70");
  await caso("D1", "primer envio: queda en Documentacion recibida (SIG y cliente)", async () => {
    const d = await detalleExp(c);
    const m = await api(c.usuario, "GET", "/api/debida-diligencia/mi-expediente?soloEvento=1");
    if (d.estado !== RECIBIDA) throw new Error(`SIG ve ${d.estado}`);
    if (m.expediente?.estado !== RECIBIDA) throw new Error(`cliente ve ${m.expediente?.estado}`);
    return `antes de enviar=${c.estadoAntesDeEnviar}; ahora=${d.estado}; fechaEnvio=${String(d.fechaEnvio).slice(0, 19)}`;
  });
  await caso("D1", "historial: hito 'Documentacion recibida' con estado doc_recibida", async () => {
    const ev = await eventosHistorial(c);
    const hito = ev.find((x) => x.titulo === "Documentación recibida");
    if (!hito) throw new Error(`no hay hito; titulos: ${ev.map((x) => x.titulo).join(" | ")}`);
    if (hito.estado !== RECIBIDA) throw new Error(`estado del hito=${hito.estado}`);
    return `${ev.length} eventos`;
  });
  await caso("D1", "cliente: no puede editar ni reenviar mientras esta recibida", async () => {
    const g = await reguardar(c);
    const e = await enviar(c);
    const r1 = debeRechazar(g, "guardar");
    const r2 = debeRechazar(e, "reenviar");
    if (!/Recibimos tu documentaci/.test(mensaje(g))) throw new Error(`mensaje de guardar: ${mensaje(g)}`);
    return `guardar ${r1} "${mensaje(g).slice(0, 60)}"; enviar ${r2}`;
  });
  await caso("D1", "cliente: no puede abrir otra DD en el mismo evento", async () => {
    const n = await http(c.usuario, "POST", "/api/debida-diligencia/nueva", {});
    const [{ total }] = await db("select count(*)::int total from debida_diligencia where empresa_id=(select empresa_id from debida_diligencia where id=$1) and evento_id=$2", [c.expedienteId, EVENTO]);
    if (total !== 1) throw new Error(`hay ${total} DD de la empresa en el evento (nueva -> ${n.status})`);
    return `nueva -> ${n.status} ${n.ok ? "(devuelve la actual)" : mensaje(n).slice(0, 60)}; DD en evento=1`;
  });
  await caso("D1", "abrir detalle, historial y matriz NO inicia la revision", async () => {
    await detalleExp(c);
    await historial(c);
    await api("sig", "GET", `/api/debida-diligencia/matriz-evaluacion/abrir?expedienteId=${c.expedienteId}`);
    for (const f of await filasMatriz(c)) await detFila(f.id);
    await esperarEstado(c, RECIBIDA, "tras abrir");
    if ((await inicios(c)) !== 0) throw new Error("se registro inicio de revision al solo abrir");
    return `${c.filas.length} filas abiertas; sigue ${RECIBIDA}`;
  });
  await caso("D1", "bandeja: filtro Documentacion recibida la trae, En revision no; resumen la cuenta", async () => {
    const q = `perPage=50&eventoId=${EVENTO}&search=${encodeURIComponent(razon("70"))}`;
    const rec = await api("sig", "GET", `/api/debida-diligencia/bandeja?${q}&estado=${RECIBIDA}`);
    const rev = await api("sig", "GET", `/api/debida-diligencia/bandeja?${q}&estado=${EN_REVISION}`);
    const todas = await api("sig", "GET", `/api/debida-diligencia/bandeja?perPage=5&eventoId=${EVENTO}`);
    const enRec = (rec.data || []).some((x) => x.id === c.expedienteId);
    const enRev = (rev.data || []).some((x) => x.id === c.expedienteId);
    if (!enRec || enRev) throw new Error(`filtro recibida=${enRec} en_revision=${enRev}`);
    if (typeof todas.resumen?.documentacionRecibida !== "number" || todas.resumen.documentacionRecibida < 1) throw new Error(`resumen=${JSON.stringify(todas.resumen)}`);
    return `resumen.documentacionRecibida=${todas.resumen.documentacionRecibida}; enRevision=${todas.resumen.enRevision}`;
  });
  await caso("D1", "matriz: resultado final efectivo DOCUMENTACION RECIBIDA y filtro por ese resultado", async () => {
    /* La fila trae el resultado guardado (null) y el estado del expediente; la UI deriva el efectivo. */
    const malas = c.filas.filter((f) => f.resultadoFinal || f.expedienteEstado !== RECIBIDA).map((f) => `${f.nombre}=${f.resultadoFinal}/${f.expedienteEstado}`);
    if (malas.length) throw new Error(`filas: ${malas.join("; ")}`);
    const base = `/api/debida-diligencia/matriz-evaluacion?eventoId=${EVENTO}&perPage=100&search=${encodeURIComponent(razon("70"))}`;
    const conFiltro = await api("sig", "GET", `${base}&resultadoFinal=${DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_RECIBIDA}`);
    const enRevision = await api("sig", "GET", `${base}&resultadoFinal=${DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION}`);
    const ids = (x) => (x.data || []).filter((f) => f.expedienteId === c.expedienteId).length;
    if (ids(conFiltro) === 0) throw new Error("el filtro documentacion_recibida no la trae");
    if (ids(enRevision) !== 0) throw new Error("el filtro en_revision la trae");
    return `${c.filas.length} filas con DOCUMENTACION RECIBIDA; filtro ok`;
  });
  await caso("D1", "matriz: resumen, exportacion y panel responden y cuentan el estado nuevo", async () => {
    const res = await api("sig", "GET", `/api/debida-diligencia/matriz-evaluacion/resumen?eventoId=${EVENTO}`);
    const conteo = (res.resultadoFinalEmpresas || []).find((x) => x.valor === DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_RECIBIDA);
    if (!conteo) throw new Error(`resumen sin documentacion_recibida: ${JSON.stringify(res.resultadoFinalEmpresas)}`);
    const exp = await api("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/exportar", { eventoId: EVENTO, search: razon("70"), resultadoFinal: DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_RECIBIDA });
    const filas = exp.data || exp;
    if (!Array.isArray(filas) || filas.length === 0) throw new Error(`exportar sin filas: ${corto(exp, 120)}`);
    const valores = [...new Set(filas.map((f) => f.vinculo?.resultadoFinal ?? f.resultadoFinal))];
    if (valores.length !== 1 || valores[0] !== DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_RECIBIDA) throw new Error(`export resultadoFinal=${valores.join(",")}`);
    const panel = await http("sig", "GET", `/api/debida-diligencia/panel?eventoId=${EVENTO}`);
    if (panel.status >= 500) throw new Error(`panel ${panel.status}`);
    return `resumen empresas=${conteo.total}; export=${filas.length} filas (${valores.join(",")}); panel ${panel.status}`;
  });
  await caso("D1", "SIG NO puede concluir: aprobar/observar/derivar Legal -> 409", async () => {
    const out = [];
    for (const accion of Object.values(DD_ACCIONES_REVISION)) {
      const r = await revisar(c, accion);
      out.push(`${accion} ${debeRechazar(r, accion, 409)}`);
      if (!/no inici/i.test(mensaje(r))) throw new Error(`${accion}: mensaje "${mensaje(r)}"`);
    }
    await esperarEstado(c, RECIBIDA, "tras intentos");
    return out.join("; ");
  });
  await caso("D1", "matriz: ningun resultado final se registra (APTO, NO APTO, DOC. OBSERVADA, SIN RESPUESTA)", async () => {
    const out = [];
    for (const rf of [DD_MATRIZ_RESULTADOS_FINALES.APTO, DD_MATRIZ_RESULTADOS_FINALES.APTO_CON_OBSERVACIONES, DD_MATRIZ_RESULTADOS_FINALES.NO_APTO, DD_MATRIZ_RESULTADOS_FINALES.SIN_RESPUESTA, DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION]) {
      out.push(`${rf} ${debeRechazar(await finalSig(c, rf), rf, 409)}`);
    }
    const obs = await finalSig(c, DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA, { clienteComentario: "R6", documentosObservados: [DD_DOCUMENTOS.FICHA_RUC], vinculosObservados: [] });
    out.push(`documentacion_observada ${debeRechazar(obs, DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA, 409)}`);
    const manual = await finalSig(c, DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_RECIBIDA);
    out.push(`documentacion_recibida ${debeRechazar(manual, "manual")}`);
    await esperarEstado(c, RECIBIDA, "tras intentos de resultado final");
    const [v] = await db("select resultado_final from dd_matriz_vinculo where id=$1", [c.empresaFila.id]);
    if (v.resultado_final) throw new Error(`se guardo resultado_final=${v.resultado_final}`);
    return out.join("; ");
  });
  await caso("D1", "Legal no puede resolver una DD recibida", async () => {
    return `aprobar ${debeRechazar(await legal(c, DD_ACCIONES_LEGAL.APROBAR), "legal aprobar")}; rechazar ${debeRechazar(await legal(c, DD_ACCIONES_LEGAL.RECHAZAR), "legal rechazar")}`;
  });
  await caso("D1", "guardar BORRADOR en un vinculo inicia la revision (una sola vez)", async () => {
    const b = await borrador(c);
    if (!b.ok) throw new Error(`borrador: ${mensaje(b)}`);
    await esperarEstado(c, EN_REVISION, "tras borrador");
    const b2 = await borrador(c, c.filas[c.filas.length - 1]);
    if (!b2.ok) throw new Error(`borrador 2: ${mensaje(b2)}`);
    const n = await inicios(c);
    if (n !== 1) throw new Error(`hitos de inicio=${n}`);
    const ev = await eventosHistorial(c);
    const hito = ev.find((x) => x.tipo === DD_HISTORIAL_TIPOS.INICIO_REVISION);
    const [aud] = await db("select count(*)::int n from audit_log where entidad=(select codigo from debida_diligencia where id=$1) and metadata->>'accion'=$2", [c.expedienteId, DD_HISTORIAL_TIPOS.INICIO_REVISION]);
    return `en_revision; historial "${hito?.titulo}" (${corto(hito?.detalle, 70)}); auditoria=${aud.n}`;
  });
  await caso("D1", "cliente ve 'en revision' y la matriz ya no muestra DOCUMENTACION RECIBIDA", async () => {
    const m = await api(c.usuario, "GET", "/api/debida-diligencia/mi-expediente?soloEvento=1");
    await filasMatriz(c);
    const malas = c.filas.filter((f) => f.resultadoFinal || f.expedienteEstado !== EN_REVISION).map((f) => `${f.nombre}=${f.resultadoFinal}/${f.expedienteEstado}`);
    if (m.expediente?.estado !== EN_REVISION) throw new Error(`cliente ve ${m.expediente?.estado}`);
    if (malas.length) throw new Error(malas.join("; "));
    return `cliente=${m.expediente.estado}; filas=en_revision`;
  });
  await caso("D1", "ya en revision: SIG llega a APTO (Comunicaciones + conclusiones)", async () => {
    await comunicacionesYConclusiones(c);
    const f = await finalSig(c, DD_MATRIZ_RESULTADOS_FINALES.APTO);
    if (!f.ok) throw new Error(`APTO: ${mensaje(f)}`);
    const e = await estado(c);
    if (e !== DD_ESTADOS.APROBADA) throw new Error(`estado=${e}`);
    const b = await borrador(c);
    const e2 = await estado(c);
    if (e2 !== DD_ESTADOS.APROBADA) throw new Error(`un borrador posterior cambio el estado a ${e2}`);
    return `aprobada; borrador posterior ${b.ok ? "aceptado" : `rechazado ${b.status}`} y no cambia el estado`;
  });
}

async function disparadores() {
  // D2: evidencia
  const c2 = await clienteEnvia("71");
  await caso("D2", "subir una EVIDENCIA en la matriz inicia la revision", async () => {
    await esperarEstado(c2, RECIBIDA, "tras envio");
    await filasMatriz(c2);
    const fd = new FormData();
    fd.append("file", pdf("r6 evidencia"), "evidencia-r6.pdf");
    fd.append("vinculoId", c2.empresaFila.id);
    fd.append("categoria", DD_MATRIZ_ADJUNTO_CATEGORIAS.SIG_INFORME);
    const r = await http("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/adjunto", fd, true);
    if (!r.ok) throw new Error(`adjunto: ${r.status} ${mensaje(r)}`);
    await esperarEstado(c2, EN_REVISION, "tras evidencia");
    return `en_revision; inicios=${await inicios(c2)}`;
  });
  await caso("D2", "eliminar la evidencia no regresa a recibida", async () => {
    const det = await detFila(c2.empresaFila.id);
    const adj = (det.adjuntos || [])[0];
    if (!adj) throw new Error("sin adjunto");
    const r = await http("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/adjunto/eliminar", { id: adj.id });
    if (!r.ok) throw new Error(`eliminar: ${mensaje(r)}`);
    await esperarEstado(c2, EN_REVISION, "tras eliminar");
    return "sigue en_revision";
  });

  // D5: evaluacion SIG (no borrador)
  const c5 = await clienteEnvia("74");
  await caso("D5", "guardar la EVALUACION SIG de un vinculo inicia la revision", async () => {
    await esperarEstado(c5, RECIBIDA, "tras envio");
    await filasMatriz(c5);
    const det = await detFila(c5.empresaFila.id);
    const listas = {};
    for (const l of det.listas) listas[l.codigo] = l.codigo === DD_MATRIZ_LISTA_OTROS ? null : DD_MATRIZ_SI_NO_NA.NO;
    const r = await http("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", {
      id: c5.empresaFila.id, listas, sig: { fecha: HOY, responsable: "R6 SIG", resultado: DD_MATRIZ_RESULTADOS.ACEPTADO, conclusion: DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES },
    });
    if (!r.ok) throw new Error(`guardar: ${mensaje(r)}`);
    await esperarEstado(c5, EN_REVISION, "tras evaluacion");
    return EN_REVISION;
  });
  await caso("D5", "guardar evaluacion CON resultado final estando recibida: se rechaza y NO inicia", async () => {
    const c = await clienteEnvia("78");
    await filasMatriz(c);
    const r = await finalSig(c, DD_MATRIZ_RESULTADOS_FINALES.APTO, { sig: { resultado: DD_MATRIZ_RESULTADOS.ACEPTADO, conclusion: DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES } });
    const st = debeRechazar(r, "evaluacion + final", 409);
    await esperarEstado(c, RECIBIDA, "tras rechazo");
    return `${st}; sigue recibida (todo o nada)`;
  });

  // D6: concurrencia
  const c6 = await clienteEnvia("77", { beneficiarios: [benef("77", 1), benef("77", 2)] });
  await caso("D6", "3 acciones simultaneas: un solo hito de inicio y estado en_revision", async () => {
    await filasMatriz(c6);
    const rs = await Promise.all([
      borrador(c6, c6.filas[0]),
      borrador(c6, c6.filas[1] ?? c6.filas[0]),
      http("sig", "POST", "/api/debida-diligencia/vinculos-completos", { expedienteId: c6.expedienteId, completos: true }),
    ]);
    const fallas = rs.filter((r) => !r.ok).map((r) => `${r.status} ${mensaje(r)}`);
    if (fallas.length) throw new Error(fallas.join("; "));
    await esperarEstado(c6, EN_REVISION, "tras concurrencia");
    const n = await inicios(c6);
    if (n !== 1) throw new Error(`hitos de inicio=${n}`);
    return "1 hito; en_revision";
  });
}

/** Disparadores que exigen la matriz sincronizada (como al abrir el modal de revision). */
async function disparadoresVinculos() {
  // D3: vinculos completos
  const c3 = await clienteEnvia("80");
  await caso("D3", "declarar VINCULOS COMPLETOS inicia la revision", async () => {
    await esperarEstado(c3, RECIBIDA, "tras envio");
    await filasMatriz(c3); // la UI sincroniza la matriz al abrir el modal
    await esperarEstado(c3, RECIBIDA, "tras sincronizar");
    await api("sig", "POST", "/api/debida-diligencia/vinculos-completos", { expedienteId: c3.expedienteId, completos: true });
    await esperarEstado(c3, EN_REVISION, "tras declarar");
    return `en_revision; inicios=${await inicios(c3)}`;
  });
  await caso("D3", "retirar la declaracion no regresa a recibida", async () => {
    await api("sig", "POST", "/api/debida-diligencia/vinculos-completos", { expedienteId: c3.expedienteId, completos: false });
    await esperarEstado(c3, EN_REVISION, "tras retirar");
    return "sigue en_revision";
  });

  // D4: derivar a Comunicaciones (con vinculos completos marcados por BD para aislar el disparador)
  const c4 = await clienteEnvia("81");
  await caso("D4", "DERIVAR A COMUNICACIONES inicia la revision", async () => {
    await esperarEstado(c4, RECIBIDA, "tras envio");
    await filasMatriz(c4);
    await db("update debida_diligencia set vinculos_completos=true, vinculos_completos_por='r6@example.invalid', vinculos_completos_en=now() where id=$1", [c4.expedienteId]);
    await esperarEstado(c4, RECIBIDA, "tras marcar por BD");
    const d = await api("sig", "POST", "/api/debida-diligencia/derivar-comunicaciones", { expedienteId: c4.expedienteId });
    await esperarEstado(c4, EN_REVISION, "tras derivar");
    const [h] = await db("select detalle from debida_diligencia_historial where expediente_id=$1 and tipo=$2", [c4.expedienteId, DD_HISTORIAL_TIPOS.INICIO_REVISION]);
    return `derivados=${d.derivados}; en_revision; motivo="${h?.detalle}"`;
  });

}

async function ciclosCompletos() {
  // D7: observacion de documentos -> subsanacion vuelve a EN REVISION (nunca a recibida)
  const c = await clienteEnvia("75");
  await caso("D7", "recibida -> borrador -> DOCUMENTACION OBSERVADA -> cliente subsana -> EN REVISION", async () => {
    await filasMatriz(c);
    const b = await borrador(c);
    if (!b.ok) throw new Error(`borrador: ${mensaje(b)}`);
    const o = await finalSig(c, DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA, { clienteComentario: "R6: actualizar ficha RUC", documentosObservados: [DD_DOCUMENTOS.FICHA_RUC], vinculosObservados: [] });
    if (!o.ok) throw new Error(`observar: ${mensaje(o)}`);
    const e1 = await estado(c);
    if (e1 !== DD_ESTADOS.OBSERVADA) throw new Error(`tras observar=${e1}`);
    await reemplazarDoc(c, DD_DOCUMENTOS.FICHA_RUC, "r6-subsana");
    const g = await reguardar(c);
    if (!g.ok) throw new Error(`reguardar: ${mensaje(g)}`);
    const r = await enviar(c);
    if (!r.ok) throw new Error(`reenviar: ${mensaje(r)}`);
    const e2 = await estado(c);
    if (e2 !== EN_REVISION) throw new Error(`tras subsanar=${e2} (se esperaba en_revision)`);
    return `${RECIBIDA} -> ${EN_REVISION} -> ${e1} -> ${e2}`;
  });
  await caso("D7", "tras la subsanacion SIG puede concluir APTO", async () => {
    await comunicacionesYConclusiones(c);
    const f = await finalSig(c, DD_MATRIZ_RESULTADOS_FINALES.APTO);
    if (!f.ok) throw new Error(`APTO: ${mensaje(f)}`);
    return `estado=${await estado(c)}`;
  });

  // D8: Legal observa -> subsanacion vuelve a EN LEGAL -> Legal aprueba -> EN REVISION -> APTO
  const c8 = await clienteEnvia("76");
  await caso("D8", "recibida -> revision -> Legal observa -> cliente subsana -> EN LEGAL", async () => {
    await comunicacionesYConclusiones(c8);
    const d = await revisar(c8, DD_ACCIONES_REVISION.RECHAZAR);
    if (!d.ok) throw new Error(`derivar a Legal: ${mensaje(d)}`);
    const e0 = await estado(c8);
    const o = await legal(c8, DD_ACCIONES_LEGAL.OBSERVAR, { documentosObservados: [DD_DOCUMENTOS.PODERES], motivo: "R6 poder vigente" });
    if (!o.ok) throw new Error(`legal observar: ${mensaje(o)}`);
    const e1 = await estado(c8);
    await reemplazarDoc(c8, DD_DOCUMENTOS.PODERES, "r6-legal");
    await reguardar(c8);
    const r = await enviar(c8);
    if (!r.ok) throw new Error(`reenviar: ${mensaje(r)}`);
    const e2 = await estado(c8);
    if (e2 !== DD_ESTADOS.EN_LEGAL) throw new Error(`tras subsanar=${e2} (se esperaba en_legal)`);
    return `${e0} -> ${e1} -> ${e2}`;
  });
  await caso("D8", "Legal aprueba -> en_revision -> SIG declara APTO", async () => {
    const a = await legal(c8, DD_ACCIONES_LEGAL.APROBAR);
    if (!a.ok) throw new Error(`legal aprobar: ${mensaje(a)}`);
    const e1 = await estado(c8);
    if (e1 !== EN_REVISION) throw new Error(`tras Legal=${e1}`);
    const f = await finalSig(c8, DD_MATRIZ_RESULTADOS_FINALES.APTO);
    if (!f.ok) throw new Error(`APTO: ${mensaje(f)}`);
    return `${e1} -> ${await estado(c8)}`;
  });

  // D9: NO APTO tras iniciar
  const c9 = await clienteEnvia("79");
  await caso("D9", "recibida -> evidencia -> NO APTO definitivo", async () => {
    await filasMatriz(c9);
    const b = await borrador(c9);
    if (!b.ok) throw new Error(mensaje(b));
    const f = await finalSig(c9, DD_MATRIZ_RESULTADOS_FINALES.NO_APTO);
    if (!f.ok) throw new Error(`NO APTO: ${mensaje(f)}`);
    return `estado=${await estado(c9)}`;
  });
}

async function listadosCliente() {
  await caso("D10", "cliente: Mis DD lista el estado nuevo sin error", async () => {
    await login("cli72b", "e2e-r72@example.invalid");
    const m = await api("cli72b", "GET", "/api/debida-diligencia/mis-expedientes?perPage=10");
    const items = m.items || m.data || [];
    return `${items.length} DD; estados=${[...new Set(items.map((x) => x.estado))].join(",")}`;
  });
  await caso("D10", "empresas/clientes con resultado PENDIENTE responden (filtro incluye recibida)", async () => {
    const e = await http("sig", "GET", `/api/debida-diligencia/empresas?perPage=5&resultado=${DD_RESULTADOS.PENDIENTE}&search=${encodeURIComponent("E2E RONDA2")}`);
    const cl = await http("sig", "GET", `/api/debida-diligencia/clientes?perPage=5&estado=${RECIBIDA}`);
    if (e.status >= 500 || cl.status >= 500) throw new Error(`empresas ${e.status}; clientes ${cl.status}`);
    return `empresas ${e.status}; clientes?estado=${RECIBIDA} ${cl.status}`;
  });
}

// ---------------------------------------------------------------- ejecucion
const BLOQUES = [["B", primerEnvioYBloqueos], ["T", disparadores], ["V", disparadoresVinculos], ["C", ciclosCompletos], ["L", listadosCliente]];
(async () => {
  for (const u of [["sig", "e2e-sig@example.invalid"], ["com", "e2e-com@example.invalid"], ["legal", "e2e-legal@example.invalid"]]) await login(u[0], u[1]);
  for (const [clave, fn] of BLOQUES) {
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
  console.log(`=== RESUMEN RONDA 6: ${okc}/${resultados.length} OK, ${resultados.length - okc} FAIL ===`);
  fs.writeFileSync("/tmp/ronda6-resultados.json", JSON.stringify(resultados, null, 1));
})().catch((e) => {
  console.log("FATAL", e.message);
  process.exit(1);
});
