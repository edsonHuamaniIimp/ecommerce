// Smoke / integracion E2E de Debida Diligencia contra la API real (corre dentro del contenedor ctrst-e2e, sin correos).
const fs = require("fs");
const BASE = process.env.E2E_BASE || "http://localhost:3000";
const EVENTO = "c0a354e0-4c79-4b38-b88d-ff824cd28964";
const PASSWORD = "E2eTest#2026";
const SOLO = (process.env.E2E_SOLO || "").split(",").filter(Boolean); // p.ej. "A,B"
const HOY = new Date().toISOString().slice(0, 10);
const resultados = [];

const sesiones = {};
function corto(valor, max = 170) {
  const t = typeof valor === "string" ? valor : JSON.stringify(valor);
  return (t ?? "").replace(/\s+/g, " ").slice(0, max);
}
function registrar(esc, paso, ok, detalle) {
  const fila = { esc, paso, ok, detalle: corto(detalle) };
  resultados.push(fila);
  console.log(`${ok ? "OK  " : "FAIL"}|${esc}|${paso}|${fila.detalle}`);
}

async function http(usuario, metodo, ruta, cuerpo, esFormulario = false) {
  const s = sesiones[usuario];
  const headers = {};
  if (s?.token) headers.cookie = `token=${s.token}`;
  let body;
  if (cuerpo !== undefined) {
    if (esFormulario) body = cuerpo;
    else {
      headers["content-type"] = "application/json";
      body = JSON.stringify(cuerpo);
    }
  }
  const r = await fetch(BASE + ruta, { method: metodo, headers, body, redirect: "manual" });
  const setCookie = r.headers.get("set-cookie") || "";
  const m = /token=([^;]+)/.exec(setCookie);
  if (m && s) s.token = m[1];
  let json = null;
  try {
    json = await r.json();
  } catch {
    json = null;
  }
  return { status: r.status, json, ok: r.ok && json && json.success !== false };
}
async function api(usuario, metodo, ruta, cuerpo, formulario) {
  const r = await http(usuario, metodo, ruta, cuerpo, formulario);
  if (!r.ok) {
    const msg = r.json?.error?.message || r.json?.error || `HTTP ${r.status}`;
    throw new Error(`${metodo} ${ruta} -> ${r.status} ${corto(msg, 140)}`);
  }
  return r.json.data !== undefined ? r.json.data : r.json;
}

async function login(usuario, email) {
  sesiones[usuario] = { token: null };
  const r = await http(usuario, "POST", "/api/auth/login", { email, password: PASSWORD });
  if (!r.ok) throw new Error(`login ${email} -> ${r.status} ${corto(r.json)}`);
  sesiones[usuario].token = r.json.token || sesiones[usuario].token;
  const sel = await http(usuario, "POST", "/api/auth/seleccionar-evento", { eventoId: EVENTO });
  if (!sel.ok) throw new Error(`seleccionar-evento ${email} -> ${sel.status} ${corto(sel.json)}`);
  return r.json.roles;
}

async function paso(esc, nombre, fn) {
  try {
    const detalle = await fn();
    registrar(esc, nombre, true, detalle ?? "");
    return { ok: true, valor: detalle };
  } catch (e) {
    registrar(esc, nombre, false, e.message);
    return { ok: false, error: e.message };
  }
}

function pdf(texto) {
  const relleno = "% e2e ".repeat(300);
  return new Blob([`%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n% ${texto}\n${relleno}\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`], { type: "application/pdf" });
}
async function subirDocumento(usuario, tipo, etiqueta) {
  const fd = new FormData();
  fd.append("file", pdf(etiqueta), `${tipo}-${etiqueta}.pdf`);
  fd.append("tipo", tipo);
  return api(usuario, "POST", "/api/debida-diligencia/documento", fd, true);
}

async function sembrarBeneficiarios(esc, ctx, beneficiarios) {
  if (!beneficiarios.length) return;
  const { Client } = require("pg");
  const { randomUUID } = require("crypto");
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    const n = (await c.query("select count(*)::int n from debida_diligencia_beneficiario where expediente_id=$1", [ctx.expedienteId])).rows[0].n;
    if (n >= beneficiarios.length) return;
    let orden = n;
    for (const b of beneficiarios.slice(n)) {
      await c.query(
        "insert into debida_diligencia_beneficiario(id,expediente_id,orden,nombre,documento,tipo_documento,nacionalidad,porcentaje,tipo_vinculo_persona,created_at,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())",
        [randomUUID(), ctx.expedienteId, orden++, b.nombre, b.documento, b.tipoDocumento, b.nacionalidad, b.porcentaje, b.tipoVinculoPersona],
      );
    }
    registrar(esc, "BYPASS bug#1: beneficiarios no se persistieron con guardar; se insertan por BD", true, `${beneficiarios.length - n} insertados`);
  } finally {
    await c.end();
  }
}

const TIPOS_REQ = ["ficha_ruc", "poderes", "identidad_representante", "declaracion_jurada"];

function payloadCliente(esc, beneficiarios, documentos) {
  return {
    tipoRelacionComercial: ["exhibidor"],
    actividadEconomica: "Servicios",
    paisConstitucion: "Perú",
    sitioWeb: `https://e2e-${esc.toLowerCase()}.example.com`,
    emailRepresentante: `rep-${esc.toLowerCase()}@example.com`,
    aceptaDatos: true,
    aceptaVerificacion: true,
    declaraVerdad: true,
    representanteNombre: `REPRESENTANTE E2E ${esc}`,
    representanteTipoDocumento: "DNI",
    representanteDocumento: `4${String(esc.charCodeAt(0)).padStart(7, "0")}`,
    representanteNacionalidad: "Perú",
    beneficiarios,
    documentos: documentos.map((d) => ({ tipo: d.tipo, nombre: d.nombre, url: d.url })),
  };
}

const BENEF_NACIONAL = (esc) => [
  { nombre: `SOCIO NACIONAL ${esc}`, documento: "45871236", tipoDocumento: "DNI", nacionalidad: "Perú", porcentaje: 60, tipoVinculoPersona: "beneficiario_final" },
];
const BENEF_EXTRANJERO = [
  { nombre: "SOCIO PERUANO F", documento: "45871237", tipoDocumento: "DNI", nacionalidad: "Perú", porcentaje: 20, tipoVinculoPersona: "beneficiario_final" },
  { nombre: "MARIA GOMEZ ARGENTINA", documento: "AAB123456", tipoDocumento: "Pasaporte", nacionalidad: "Argentina", porcentaje: 25, tipoVinculoPersona: "beneficiario_final" },
  { nombre: "LI WEI ZHANG CHINA", documento: "E12345678", tipoDocumento: "Pasaporte", nacionalidad: "China", porcentaje: 15, tipoVinculoPersona: "socio_10" },
  { nombre: "HANS MUELLER ALEMANIA", documento: "C01X00T47", tipoDocumento: "Pasaporte", nacionalidad: "Alemania", porcentaje: 0, tipoVinculoPersona: "director" },
  { nombre: "CARMEN DIAZ VENEZUELA", documento: "002345678", tipoDocumento: "Carnet de extranjería", nacionalidad: "Venezuela", porcentaje: 0, tipoVinculoPersona: "apoderado" },
  { nombre: "INVERSIONES ANDINAS LTDA", documento: "76123456", tipoDocumento: "RUC", nacionalidad: "Chile", porcentaje: 12, tipoVinculoPersona: "empresa_vinculada" },
];

const BENEF_EXTRANJERO_OK = BENEF_EXTRANJERO.map((b) => (b.tipoVinculoPersona === "empresa_vinculada" ? { ...b, documento: "20123456789" } : b));

// ---- Acciones por rol --------------------------------------------------------------------------
async function clienteEnvia(esc, usuario, beneficiarios, ctx, opciones = {}) {
  await paso(esc, "cliente: crear/iniciar DD (nueva)", async () => {
    const e = await api(usuario, "POST", "/api/debida-diligencia/nueva", {});
    return `estado=${e.estado} codigo=${e.codigo}`;
  });
  const docs = [];
  const subida = await paso(esc, "cliente: subir 4 documentos obligatorios", async () => {
    for (const tipo of TIPOS_REQ) {
      const d = await subirDocumento(usuario, tipo, esc);
      docs.push({ tipo, nombre: d.nombre, url: d.url });
    }
    return `${docs.length} documentos`;
  });
  ctx.docs = docs;
  if (opciones.intentoPrevio) {
    const prev = await paso(esc, "cliente: declarar empresa vinculada extranjera con su ID local (Chile, 8 digitos)", async () => {
      await api(usuario, "POST", "/api/debida-diligencia/guardar", payloadCliente(esc, opciones.intentoPrevio, docs));
      return "aceptado";
    });
    if (!prev.ok) registrar(esc, "BYPASS bug#4: se reintenta con un RUC de 11 digitos para la empresa vinculada", true, "continua");
  }
  await paso(esc, "cliente: guardar formulario (vinculos/beneficiarios)", async () => {
    const e = await api(usuario, "POST", "/api/debida-diligencia/guardar", payloadCliente(esc, beneficiarios, docs));
    ctx.expedienteId = e.id;
    return `id=${e.id} estado=${e.estado} beneficiarios=${e.beneficiarios?.length}`;
  });
  await paso(esc, "cliente: los beneficiarios guardados quedan en el expediente", async () => {
    const mi = await api(usuario, "GET", "/api/debida-diligencia/mi-expediente?soloEvento=1");
    const exp = mi.expediente || mi;
    const n = exp.beneficiarios?.length ?? 0;
    if (n < beneficiarios.length) throw new Error(`enviados=${beneficiarios.length} guardados=${n}`);
    return `${n} beneficiarios`;
  });
  await sembrarBeneficiarios(esc, ctx, beneficiarios).catch((e) => registrar(esc, "bypass beneficiarios", false, e.message));
  const env = await paso(esc, "cliente: enviar a revision", async () => {
    const e = await api(usuario, "POST", "/api/debida-diligencia/enviar", {});
    ctx.expedienteId = ctx.expedienteId || e.id;
    return `estado=${e.estado} codigo=${e.codigo}`;
  });
  return env.ok && subida.ok;
}

async function estadoExp(usuario, ctx) {
  const e = await api(usuario, "GET", `/api/debida-diligencia/detalle?id=${ctx.expedienteId}`);
  return e;
}

async function sigBandeja(esc, ctx, ruc) {
  return paso(esc, "SIG: ver expediente en su bandeja", async () => {
    const b = await api("sig", "GET", `/api/debida-diligencia/bandeja?eventoId=${EVENTO}&search=${ruc}&perPage=20`);
    const fila = (b.data || []).find((r) => r.empresa?.ruc === ruc);
    if (!fila) throw new Error(`no aparece en la bandeja (total=${b.total})`);
    ctx.expedienteId = ctx.expedienteId || fila.id;
    return `codigo=${fila.codigo} estado=${fila.estado} docs=${fila.documentoCargados}/${fila.documentoTotal}`;
  });
}

async function sigMatrizFilas(ctx) {
  const m = await api("sig", "GET", `/api/debida-diligencia/matriz-evaluacion?expedienteId=${ctx.expedienteId}&perPage=100`);
  ctx.filas = m.data || [];
  ctx.empresaFila = ctx.filas.find((f) => f.tipo === "empresa") || ctx.filas[0];
  return ctx.filas;
}

async function sigDerivaComunicaciones(esc, ctx) {
  await paso(esc, "SIG: matriz sincroniza vinculos del expediente", async () => {
    const filas = await sigMatrizFilas(ctx);
    ctx.tipos = filas.map((f) => `${f.tipo}:${f.ambito}:${f.pais ?? "-"}`).join(", ");
    if (filas.length === 0) throw new Error("matriz sin vinculos");
    return `${filas.length} vinculos -> ${ctx.tipos}`;
  });
  await paso(esc, "SIG: declara vinculos completos", async () => {
    const e = await api("sig", "POST", "/api/debida-diligencia/vinculos-completos", { expedienteId: ctx.expedienteId, completos: true });
    return `vinculosCompletos=${e.vinculosCompletos}`;
  });
  await paso(esc, "SIG: deriva a Comunicaciones", async () => {
    const r = await api("sig", "POST", "/api/debida-diligencia/derivar-comunicaciones", { expedienteId: ctx.expedienteId });
    return `derivados=${r.derivados} existentes=${r.existentes} total=${r.total}`;
  });
}

async function comunicacionesResponde(esc, ctx, razon, observados = []) {
  await paso(esc, "Comunicaciones: ve los casos del expediente", async () => {
    const r = await api("com", "GET", `/api/debida-diligencia/reputacion/listar?search=${encodeURIComponent(razon)}&perPage=50`);
    const grupo = (r.data || []).find((g) => g.expedienteId === ctx.expedienteId);
    if (!grupo) throw new Error(`grupo no encontrado (total=${r.total})`);
    ctx.casos = grupo.casos;
    return `${grupo.casos.length} casos (pendientes=${grupo.pendientes})`;
  });
  await paso(esc, "Comunicaciones: inicia y declara resultado por vinculo", async () => {
    let obs = 0;
    for (const caso of ctx.casos || []) {
      await api("com", "POST", "/api/debida-diligencia/reputacion/iniciar", { id: caso.id });
      const observado = observados.some((o) => caso.nombreARevisar.includes(o));
      if (observado) obs += 1;
      await api("com", "POST", "/api/debida-diligencia/reputacion/observar", {
        id: caso.id,
        resultado: observado ? "observado" : "aceptado",
        comentario: observado ? "E2E: hallazgo de prensa simulado." : "Sin observaciones.",
        linkHallazgos: observado ? "https://example.com/e2e-fuente-prensa" : "",
        cerrar: true,
        notificar: false,
      });
    }
    return `${(ctx.casos || []).length} cerrados (${obs} observados)`;
  });
}

async function sigDecideVinculos(esc, ctx, { observados = [], reforzada = false } = {}) {
  await paso(esc, "SIG: evalua listas y declara conclusion por vinculo", async () => {
    const filas = await sigMatrizFilas(ctx);
    const resumen = [];
    for (const fila of filas) {
      const det = await api("sig", "GET", `/api/debida-diligencia/matriz-evaluacion/detalle?id=${fila.id}`);
      const esObs = observados.some((o) => fila.nombre.includes(o));
      const listas = {};
      det.listas.forEach((l, i) => {
        listas[l.codigo] = l.codigo === "otros" ? null : esObs && i === 0 ? "si" : "no";
      });
      const cuerpo = {
        id: fila.id,
        listas,
        sig: {
          fecha: HOY,
          responsable: "E2E SIG",
          resultado: esObs ? "observado" : "aceptado",
          observaciones: esObs ? "E2E: coincidencia en lista, requiere revision reforzada." : null,
          conclusion: esObs && reforzada ? "requiere_dd_reforzada" : "sin_observaciones",
        },
      };
      await api("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", cuerpo);
      if (esObs && reforzada) {
        const intento = await paso(esc, `SIG: conclusion reputacional REQUIERE DD REFORZADA (${fila.nombre.slice(0, 14)})`, async () => {
          await api("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", {
            id: fila.id,
            reputacional: { conclusion: "requiere_dd_reforzada" },
          });
          return "guardado";
        });
        if (!intento.ok) {
          await api("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", {
            id: fila.id,
            reputacional: { conclusion: "requiere_debida_diligencia" },
          });
          registrar(esc, "BYPASS bug#2: se usa el valor 'requiere_debida_diligencia' para la conclusion reputacional", true, "guardado");
        }
      } else {
        try {
          await api("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", {
            id: fila.id,
            reputacional: { conclusion: "sin_observaciones" },
          });
        } catch (e) {
          resumen.push(`rep(${fila.nombre.slice(0, 12)}): ${e.message.slice(-70)}`);
        }
      }
    }
    return `${filas.length} vinculos evaluados${resumen.length ? " | " + resumen.join(" ; ") : ""}`;
  });
}

async function sigDerivaLegal(esc, ctx) {
  return paso(esc, "SIG: deriva a Legal (requiere DD reforzada)", async () => {
    const e = await api("sig", "POST", "/api/debida-diligencia/revisar", {
      expedienteId: ctx.expedienteId,
      alcance: "expediente",
      accion: "rechazar",
      motivo: "E2E: SIG y Comunicaciones concluyen que requiere debida diligencia reforzada.",
      informeLogisticaUrl: "https://drive.google.com/e2e-informe-logistica",
      derivarComunicaciones: false,
    });
    return `estado=${e.estado}`;
  });
}

async function legalVe(esc, ctx, ruc) {
  return paso(esc, "Legal: ve el expediente en su bandeja", async () => {
    const b = await api("legal", "GET", `/api/debida-diligencia/legal/bandeja?search=${ruc}&perPage=20`);
    const fila = (b.data || []).find((r) => r.empresa?.ruc === ruc);
    if (!fila) throw new Error(`no aparece en bandeja legal (total=${b.total})`);
    return `estado=${fila.estado} codigo=${fila.codigo}`;
  });
}

async function legalResuelve(esc, ctx, decision, extra = {}) {
  return paso(esc, `Legal: ${decision}`, async () => {
    const e = await api("legal", "POST", "/api/debida-diligencia/legal/resolver", {
      expedienteId: ctx.expedienteId,
      decision,
      motivo: decision === "aprobar" ? null : `E2E: ${decision} por Legal.`,
      documentosObservados: [],
      informeLegalNombre: null,
      informeLegalUrl: null,
      ...extra,
    });
    return `estado=${e.estado} decisionLegal=${e.decisionLegal}`;
  });
}

async function verEstado(esc, ctx, usuario, etiqueta, esperado) {
  return paso(esc, `estado tras ${etiqueta}`, async () => {
    const e = await estadoExp(usuario, ctx);
    if (esperado && e.estado !== esperado) throw new Error(`esperado=${esperado} real=${e.estado}`);
    return `estado=${e.estado} legal=${e.decisionLegal ?? "-"} aprobada=${e.fechaAprobacion ?? "-"} vence=${e.fechaVencimiento ?? "-"}`;
  });
}

async function sigAprueba(esc, ctx) {
  return paso(esc, "SIG: aprueba el expediente", async () => {
    const e = await api("sig", "POST", "/api/debida-diligencia/revisar", {
      expedienteId: ctx.expedienteId,
      alcance: "expediente",
      accion: "aprobar",
      motivo: null,
      documentosObservados: [],
      observaciones: [],
      derivarComunicaciones: false,
    });
    return `estado=${e.estado}`;
  });
}

async function sigConclusionFinal(esc, ctx, resultadoFinal, comentario) {
  return paso(esc, `SIG: conclusion final = ${resultadoFinal}`, async () => {
    if (!ctx.empresaFila) await sigMatrizFilas(ctx);
    const d = await api("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", {
      id: ctx.empresaFila.id,
      resultadoFinal,
      finalFecha: HOY,
      finalPor: "E2E SIG",
      finalComentario: comentario,
    });
    return `resultadoFinal=${d.resultadoFinal} fecha=${d.finalFecha}`;
  });
}

async function verificaFinalEnTodasLasFilas(esc, ctx, esperado) {
  await paso(esc, "matriz: la fila de la empresa tiene el resultado final", async () => {
    const filas = await sigMatrizFilas(ctx);
    const emp = filas.find((f) => f.tipo === "empresa");
    if (!emp || emp.resultadoFinal !== esperado) throw new Error(`empresa.resultadoFinal=${emp?.resultadoFinal ?? "null"} esperado=${esperado}`);
    return `empresa=${emp.resultadoFinal}`;
  });
  return paso(esc, "matriz: el resultado final se muestra en TODAS las filas de vinculos (regla R10)", async () => {
    const filas = await sigMatrizFilas(ctx);
    const distintos = filas.filter((f) => f.resultadoFinal !== esperado);
    if (distintos.length) throw new Error(`solo ${filas.length - distintos.length}/${filas.length} filas tienen ${esperado}; el resto: ${distintos.map((f) => f.resultadoFinal ?? "null").join(",")}`);
    return `${filas.length}/${filas.length} filas = ${esperado}`;
  });
}

// ---- Escenarios --------------------------------------------------------------------------------
const RUC = { A: "20999991001", B: "20999991002", C: "20999991003", D: "20999991004", E: "20999991005", F: "20999991006", G: "20999991007", H: "20999991008" };
const RAZON = (e) => `E2E EMPRESA ${e} S.A.C.`;

async function escenarioA() {
  const esc = "A";
  const ctx = {};
  await paso(esc, "login cliente", () => login("cliA", "e2e-cli-a@example.invalid").then((r) => `roles=${r}`));
  await clienteEnvia(esc, "cliA", BENEF_NACIONAL(esc), ctx);
  await sigBandeja(esc, ctx, RUC.A);
  await sigDerivaComunicaciones(esc, ctx);
  await comunicacionesResponde(esc, ctx, RAZON(esc));
  await sigDecideVinculos(esc, ctx);
  await sigConclusionFinal(esc, ctx, "apto", "E2E: sin observaciones en ninguna area.");
  await verEstado(esc, ctx, "sig", "conclusion final apto", "aprobada");
  await verificaFinalEnTodasLasFilas(esc, ctx, "apto");
}

async function llegarALegal(esc, ctx, usuarioCli, ruc, razon, benef) {
  await paso(esc, "login cliente", () => login(usuarioCli, `e2e-cli-${esc.toLowerCase()}@example.invalid`).then((r) => `roles=${r}`));
  await clienteEnvia(esc, usuarioCli, benef, ctx);
  await sigBandeja(esc, ctx, ruc);
  await sigDerivaComunicaciones(esc, ctx);
  await comunicacionesResponde(esc, ctx, razon, ["SOCIO NACIONAL"]);
  await sigDecideVinculos(esc, ctx, { observados: ["SOCIO NACIONAL"], reforzada: true });
  await sigDerivaLegal(esc, ctx);
  await verEstado(esc, ctx, "sig", "derivar a Legal", "en_legal");
  await legalVe(esc, ctx, ruc);
}

async function escenarioB() {
  const esc = "B";
  const ctx = {};
  await llegarALegal(esc, ctx, "cliB", RUC.B, RAZON(esc), BENEF_NACIONAL(esc));
  await legalResuelve(esc, ctx, "aprobar");
  await verEstado(esc, ctx, "sig", "aprobacion de Legal (vuelve a Logistica)", null);
  const apto = await sigConclusionFinal(esc, ctx, "apto", "E2E: Legal dio conformidad pese a DD reforzada.");
  if (!apto.ok) {
    registrar(esc, "BYPASS bug#3: Legal ya aprobo pero APTO se bloquea por el veredicto de Comunicaciones; se usa APTO CON OBSERVACIONES", true, "continua");
    await sigConclusionFinal(esc, ctx, "apto_con_observaciones", "E2E: Legal dio conformidad pese a DD reforzada.");
  }
  await verEstado(esc, ctx, "sig", "conclusion final tras Legal", "aprobada");
  await verificaFinalEnTodasLasFilas(esc, ctx, "apto");
}

async function subsanar(esc, ctx, usuario, tipo, etiqueta) {
  await paso(esc, `cliente: ve la observacion y subsana (${etiqueta})`, async () => {
    const mi = await api(usuario, "GET", "/api/debida-diligencia/mi-expediente?soloEvento=1");
    const exp = mi.expediente || mi;
    const obs = (exp.observaciones || []).filter((o) => o.estado === "abierta").length;
    const nuevo = await subirDocumento(usuario, tipo, `${esc}-subsanado`);
    const docs = (ctx.docs || []).filter((d) => d.tipo !== tipo).concat([{ tipo, nombre: nuevo.nombre, url: nuevo.url }]);
    ctx.docs = docs;
    await api(usuario, "POST", "/api/debida-diligencia/guardar", payloadCliente(esc, ctx.benef, docs));
    return `observaciones abiertas=${obs}; documento ${tipo} reemplazado`;
  });
  return paso(esc, "cliente: reenvia", async () => {
    const e = await api(usuario, "POST", "/api/debida-diligencia/enviar", {});
    return `estado=${e.estado}`;
  });
}

async function escenarioC() {
  const esc = "C";
  const ctx = { benef: BENEF_NACIONAL(esc) };
  await llegarALegal(esc, ctx, "cliC", RUC.C, RAZON(esc), ctx.benef);
  await legalResuelve(esc, ctx, "observar", { documentosObservados: ["poderes"], motivo: "E2E: la vigencia de poderes esta desactualizada." });
  await verEstado(esc, ctx, "legal", "observacion de Legal", "observada");
  await subsanar(esc, ctx, "cliC", "poderes", "vigencia de poderes");
  await verEstado(esc, ctx, "legal", "subsanacion del cliente", "en_legal");
  await paso(esc, "Legal: ve el expediente subsanado en su bandeja de seguimiento", async () => {
    const b = await api("legal", "GET", `/api/debida-diligencia/legal/bandeja?search=${RUC.C}&perPage=20`);
    const fila = (b.data || []).find((r) => r.empresa?.ruc === RUC.C);
    if (!fila) throw new Error("no aparece");
    return `estado=${fila.estado} decisionLegal=${fila.decisionLegal ?? "-"}`;
  });
  await legalResuelve(esc, ctx, "aprobar");
  await sigConclusionFinal(esc, ctx, "apto_con_observaciones", "E2E: aprobado tras subsanacion pedida por Legal.");
  await verEstado(esc, ctx, "sig", "conclusion final apto con observaciones", "aprobada");
  await verificaFinalEnTodasLasFilas(esc, ctx, "apto_con_observaciones");
}

async function escenarioD() {
  const esc = "D";
  const ctx = {};
  await llegarALegal(esc, ctx, "cliD", RUC.D, RAZON(esc), BENEF_NACIONAL(esc));
  const informe = await paso(esc, "Legal: sube el informe legal (PDF)", async () => {
    const fd = new FormData();
    fd.append("file", pdf("informe-legal-D"), "informe-legal-D.pdf");
    const r = await api("legal", "POST", "/api/debida-diligencia/legal/informe", fd, true);
    ctx.informe = r;
    return `${r.nombre}`;
  });
  await legalResuelve(esc, ctx, "rechazar", {
    motivo: "E2E: riesgo reputacional critico, no procede el vinculo.",
    informeLegalNombre: ctx.informe?.nombre ?? null,
    informeLegalUrl: ctx.informe?.url ?? null,
  });
  await verEstado(esc, ctx, "sig", "rechazo de Legal", "rechazada");
  await sigConclusionFinal(esc, ctx, "no_apto", "E2E: Legal rechazo la solicitud.");
  await verificaFinalEnTodasLasFilas(esc, ctx, "no_apto");
  await paso(esc, "cliente: ve el resultado (rechazada) en su expediente", async () => {
    await login("cliD", "e2e-cli-d@example.invalid");
    const mi = await api("cliD", "GET", "/api/debida-diligencia/mi-expediente?soloEvento=1");
    const exp = mi.expediente || mi;
    return `estado=${exp.estado} motivo=${corto(exp.motivoRechazo ?? exp.motivoLegal ?? "-", 60)}`;
  });
}

async function escenarioE() {
  const esc = "E";
  const ctx = { benef: BENEF_NACIONAL(esc) };
  await paso(esc, "login cliente", () => login("cliE", "e2e-cli-e@example.invalid").then((r) => `roles=${r}`));
  await clienteEnvia(esc, "cliE", ctx.benef, ctx);
  await sigBandeja(esc, ctx, RUC.E);
  await paso(esc, "SIG: observa la documentacion (ficha RUC)", async () => {
    const e = await api("sig", "POST", "/api/debida-diligencia/revisar", {
      expedienteId: ctx.expedienteId,
      alcance: "expediente",
      accion: "observar",
      motivo: "E2E: la ficha RUC debe tener maximo 3 meses de antiguedad.",
      documentosObservados: ["ficha_ruc"],
      observaciones: [{ documentoTipo: "ficha_ruc", texto: "Ficha RUC desactualizada; suba una vigente." }],
      derivarComunicaciones: false,
    });
    return `estado=${e.estado}`;
  });
  await verEstado(esc, ctx, "sig", "observacion de SIG", "observada");
  await subsanar(esc, ctx, "cliE", "ficha_ruc", "ficha RUC");
  await verEstado(esc, ctx, "sig", "subsanacion del cliente", "en_revision");
  await sigDerivaComunicaciones(esc, ctx);
  await comunicacionesResponde(esc, ctx, RAZON(esc));
  await sigDecideVinculos(esc, ctx);
  await sigConclusionFinal(esc, ctx, "apto_con_observaciones", "E2E: aprobado tras subsanar documentacion.");
  await verEstado(esc, ctx, "sig", "conclusion final apto con observaciones", "aprobada");
  await verificaFinalEnTodasLasFilas(esc, ctx, "apto_con_observaciones");
}

async function escenarioF() {
  const esc = "F";
  const ctx = {};
  await paso(esc, "login cliente", () => login("cliF", "e2e-cli-f@example.invalid").then((r) => `roles=${r}`));
  await clienteEnvia(esc, "cliF", BENEF_EXTRANJERO_OK, ctx, { intentoPrevio: BENEF_EXTRANJERO });
  ctx.benef = BENEF_EXTRANJERO_OK;
  await sigBandeja(esc, ctx, RUC.F);
  await sigDerivaComunicaciones(esc, ctx);
  await paso(esc, "matriz: criterios distintos para nacional y extranjero", async () => {
    const out = [];
    for (const f of ctx.filas) {
      const d = await api("sig", "GET", `/api/debida-diligencia/matriz-evaluacion/detalle?id=${f.id}`);
      const codigos = d.listas.map((l) => l.codigo);
      out.push(`${f.nombre.slice(0, 14)}[${f.ambito}/${f.pais ?? "-"}]=${codigos.length} (${codigos.includes("sanciones_europa") ? "UE" : "sinUE"},${codigos.includes("interpol") ? "interpol" : "sinInterpol"},${codigos.some((c) => /sentinel|central|peps/.test(c)) ? "nacional" : "sinNac"})`);
    }
    return out.join(" | ");
  });
  await comunicacionesResponde(esc, ctx, RAZON(esc), ["MARIA GOMEZ"]);
  await sigDecideVinculos(esc, ctx, { observados: ["MARIA GOMEZ"], reforzada: false });
  await sigConclusionFinal(esc, ctx, "apto_con_observaciones", "E2E: observacion menor de un vinculo extranjero.");
  await verEstado(esc, ctx, "sig", "conclusion final apto con observaciones", "aprobada");
  await verificaFinalEnTodasLasFilas(esc, ctx, "apto_con_observaciones");
  await automatizacionGeneral(esc, ctx);
}

async function automatizacionGeneral(esc, ctx) {
  const vinc = (ctx.filas || []).find((f) => f.nombre.includes("MARIA GOMEZ")) || (ctx.filas || [])[1];
  if (!vinc) return registrar(esc, "automatizar todo", false, "sin vinculo");
  let job = null;
  const ini = await paso(esc, `SIG: lanza 'Automatizar todo' (asincrono) en ${vinc.nombre.slice(0, 18)}`, async () => {
    job = await api("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/automatizar-todo", { vinculoId: vinc.id });
    return `jobId=${job.jobId.slice(0, 8)} criterios=${job.total} estado=${job.estado}`;
  });
  if (!ini.ok) return;
  await paso(esc, "automatizacion: avance y termino (polling)", async () => {
    const t0 = Date.now();
    let actual = job;
    while (Date.now() - t0 < 270000) {
      await new Promise((r) => setTimeout(r, 8000));
      actual = await api("sig", "GET", `/api/debida-diligencia/matriz-evaluacion/automatizacion?jobId=${job.jobId}`);
      if (actual.estado !== "en_curso") break;
    }
    const ok = actual.criterios.filter((c) => c.estado === "ok").length;
    const err = actual.criterios.filter((c) => c.estado === "error");
    const detalle = `estado=${actual.estado} ${ok}/${actual.total} ok en ${Math.round((Date.now() - t0) / 1000)}s${err.length ? " | errores: " + err.slice(0, 4).map((c) => c.codigo + ":" + (c.mensaje || "").slice(0, 45)).join("; ") : ""}`;
    if (actual.estado === "en_curso") throw new Error("sigue en curso tras 270s: " + detalle);
    if (err.length) throw new Error(detalle);
    return detalle;
  });
}

async function escenarioG() {
  const esc = "G";
  const ctx = { benef: BENEF_NACIONAL(esc) };
  await paso(esc, "login cliente", () => login("cliG", "e2e-cli-g@example.invalid").then((r) => `roles=${r}`));
  await clienteEnvia(esc, "cliG", ctx.benef, ctx);
  await sigBandeja(esc, ctx, RUC.G);
  await sigDerivaComunicaciones(esc, ctx);
  await comunicacionesResponde(esc, ctx, RAZON(esc));
  await sigDecideVinculos(esc, ctx);
  await paso(esc, "SIG: conclusion final DOCUMENTACION OBSERVADA con comentario y documento para el cliente", async () => {
    const d = await api("sig", "POST", "/api/debida-diligencia/matriz-evaluacion/guardar", {
      id: ctx.empresaFila.id,
      resultadoFinal: "documentacion_observada",
      finalFecha: HOY,
      finalPor: "E2E SIG",
      finalComentario: "E2E: documentacion observada.",
      clienteComentario: "E2E: el documento de identidad del representante esta borroso.",
      documentosObservados: ["identidad_representante"],
      vinculosObservados: [],
    });
    return `resultadoFinal=${d.resultadoFinal}`;
  });
  await verEstado(esc, ctx, "sig", "documentacion observada final", "observada");
  await subsanar(esc, ctx, "cliG", "identidad_representante", "documento de identidad");
  await verEstado(esc, ctx, "sig", "subsanacion del cliente", "en_revision");
  await sigConclusionFinal(esc, ctx, "apto", "E2E: apto tras subsanar documentos.");
  await verEstado(esc, ctx, "sig", "conclusion final apto", "aprobada");
}

async function escenarioH() {
  const esc = "H";
  const ctx = { benef: BENEF_NACIONAL(esc) };
  await paso(esc, "login cliente", () => login("cliH", "e2e-cli-h@example.invalid").then((r) => `roles=${r}`));
  await clienteEnvia(esc, "cliH", ctx.benef, ctx);
  await sigBandeja(esc, ctx, RUC.H);
  await sigDerivaComunicaciones(esc, ctx);
  await sigConclusionFinal(esc, ctx, "sin_respuesta", "E2E: la empresa no respondio a la observacion.");
  await verEstado(esc, ctx, "sig", "conclusion final SIN RESPUESTA", null);
}

async function transversales() {
  const esc = "T";
  await paso(esc, "salud del servicio", async () => {
    const r = await http("anon", "GET", "/api/health");
    return corto(r.json);
  });
  for (const [u, email] of [["sig", "e2e-sig@example.invalid"], ["com", "e2e-com@example.invalid"], ["legal", "e2e-legal@example.invalid"]]) {
    await paso(esc, `login ${u}`, () => login(u, email).then((r) => `roles=${r}`));
  }
  await login("cliA", "e2e-cli-a@example.invalid").catch(() => undefined);
  await paso(esc, "permisos: cliente NO puede ver la bandeja de SIG", async () => {
    const r = await http("cliA", "GET", `/api/debida-diligencia/bandeja?eventoId=${EVENTO}`);
    if (r.ok) throw new Error("el cliente pudo ver la bandeja");
    return `bloqueado (${r.status})`;
  });
  await paso(esc, "permisos: Comunicaciones NO puede ver la bandeja Legal", async () => {
    const r = await http("com", "GET", "/api/debida-diligencia/legal/bandeja");
    if (r.ok) throw new Error("Comunicaciones pudo ver la bandeja legal");
    return `bloqueado (${r.status})`;
  });
  await paso(esc, "permisos: Legal NO puede derivar a Comunicaciones", async () => {
    const r = await http("legal", "POST", "/api/debida-diligencia/derivar-comunicaciones", { expedienteId: "x" });
    if (r.ok) throw new Error("Legal pudo derivar");
    return `bloqueado (${r.status})`;
  });
}

async function resumenFinal() {
  await paso("T", "vista extendida: un registro por expediente (porEmpresa)", async () => {
    const m = await api("sig", "GET", `/api/debida-diligencia/matriz-evaluacion?eventoId=${EVENTO}&porEmpresa=true&search=E2E&perPage=50`);
    const exps = new Set((m.data || []).map((f) => f.expedienteId));
    return `total=${m.total} expedientes=${exps.size} filas=${(m.data || []).length}`;
  });
  await paso("T", "informe: datos de matriz y expediente accesibles (empresa A)", async () => {
    const b = await api("sig", "GET", `/api/debida-diligencia/bandeja?eventoId=${EVENTO}&search=${RUC.A}`);
    const fila = (b.data || [])[0];
    if (!fila) throw new Error("sin fila");
    const d = await api("sig", "GET", `/api/debida-diligencia/detalle?id=${fila.id}`);
    return `estado=${d.estado} docs=${d.documentos?.length} reputacion=${d.reputacion?.length} observaciones=${d.observaciones?.length}`;
  });
}

async function reiniciarDatosE2E() {
  const { Client } = require("pg");
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    const r = await c.query("delete from debida_diligencia where empresa_id in (select id from empresa where ruc like '2099999100%')");
    console.log("RESET expedientes E2E eliminados:", r.rowCount);
  } finally {
    await c.end();
  }
}

(async () => {
  if (process.env.E2E_RESET === "1") await reiniciarDatosE2E();
  const quiere = (x) => SOLO.length === 0 || SOLO.includes(x);
  if (quiere("T")) await transversales();
  else {
    for (const [u, email] of [["sig", "e2e-sig@example.invalid"], ["com", "e2e-com@example.invalid"], ["legal", "e2e-legal@example.invalid"]]) {
      await login(u, email);
    }
  }
  for (const [clave, fn] of [["A", escenarioA], ["B", escenarioB], ["C", escenarioC], ["D", escenarioD], ["E", escenarioE], ["F", escenarioF], ["G", escenarioG], ["H", escenarioH]]) {
    if (quiere(clave)) {
      console.log(`=== Escenario ${clave} ===`);
      try {
        await fn();
      } catch (e) {
        registrar(clave, "excepcion no controlada", false, e.message);
      }
    }
  }
  if (quiere("T") || SOLO.length === 0) await resumenFinal();
  const ok = resultados.filter((r) => r.ok).length;
  console.log(`=== RESUMEN: ${ok}/${resultados.length} pasos OK, ${resultados.length - ok} FAIL ===`);
  fs.writeFileSync("/tmp/e2e-results.json", JSON.stringify(resultados, null, 1));
})().catch((e) => {
  console.log("FATAL", e.message);
  process.exit(1);
});
