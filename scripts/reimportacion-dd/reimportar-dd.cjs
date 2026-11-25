/* eslint-disable @typescript-eslint/no-require-imports -- script CommonJS que corre suelto en contenedores (sin build) */
/**
 * Reimportacion manual de Debida Diligencia desde el Excel oficial (ya convertido a JSON).
 *
 * Por defecto es SIMULACION: no escribe nada y entrega el reporte. Con --aplicar escribe todo en UNA transaccion.
 *
 *   node reimportar-dd.cjs --entrada=/tmp/excel-dd.json --salida=/tmp/reporte.json [--aplicar]
 *        [--confirmar-bajadas=DOC1,DOC2] [--usuario=admin@iimp.org.pe] [--archivo="nombre del excel"]
 *
 * Reglas (acordadas con el equipo):
 *  - Clave de DD: empresa (documento normalizado) + evento. PROEXPLO/WMC/GESS van a su evento 2026; el resto a PERUMIN 2027.
 *  - Empresa inexistente: se crea (como crearSiNoExiste) y se le asigna su DD.
 *  - DD inexistente: se crea como importada.
 *  - DD importada sin tocar por el equipo, Excel igual o mas reciente y ESTADO distinto: se actualiza estado y fechas (con las fechas del Excel).
 *  - DD ya en el estado correcto (p. ej. APTO declarado): no se reescribe; las diferencias de fechas se omiten (opt-in: --corregir-fechas).
 *  - DD importada en PERUMIN 2027 cuyo evento en el Excel es otro (y sin fila PERUMIN): se reasigna el evento (sin tocar estado ni fechas si ya coinciden).
 *  - Nunca se tocan las DD del portal (flujo_regular) ni las importadas que el equipo ya modifico.
 *  - Un APTO que el Excel baja a otro estado NO se aplica salvo --confirmar-bajadas con ese documento.
 *  - Identificadores raros (texto, parentesis, N/A) van a revision manual y no se importan.
 */
const fs = require("fs");
const crypto = require("crypto");
const pg = require(fs.existsSync("/app/node_modules/pg") ? "/app/node_modules/pg" : "pg");

const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const APLICAR = process.argv.includes("--aplicar");
const ENTRADA = arg("entrada", "/tmp/excel-dd.json");
const SALIDA = arg("salida", "/tmp/reporte-reimportacion.json");
const USUARIO = arg("usuario", "admin@iimp.org.pe");
const ARCHIVO = arg("archivo", "RESULTADO DEBIDA DILIGENCIA FINAL_MOSTRAR.xlsx");
/* Por defecto NO se reescriben fechas de DD que ya estan en el estado correcto (p. ej. APTO ya declarado). */
const CORREGIR_FECHAS = process.argv.includes("--corregir-fechas");
const BAJADAS_OK = new Set(arg("confirmar-bajadas", "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean));
const VIGENCIA_MESES = 6;
const REVISOR_IMPORTACION = "importacion_masiva";

// ---------- normalizacion (replica del importador de la aplicacion) ----------
const sinTildes = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (t) => sinTildes(t).replace(/\s+/g, " ").trim().toUpperCase();
const docNormalizado = (v) => String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
const claveDoc = (v) => docNormalizado(v).replace(/^0+/, "");
const ALIAS = new Map([["TEGA INDUSTRIES CHILE SPA", "202608324489"]]);
function documentoFuente(raw, razon) {
  const d = String(raw ?? "").replace(/^["'\s]+|["'\s]+$/g, "").replace(/\s+/g, "").replace(/\.+$/g, "").trim().toUpperCase();
  return d ? (ALIAS.get(norm(razon)) ?? d) : "";
}
/** Identificadores que se pueden importar sin riesgo; el resto va a revision manual. */
function idImportable(raw, doc) {
  const crudo = String(raw ?? "").trim();
  if (!doc || !/\d/.test(doc)) return false;
  return /^[0-9A-Za-z.\-\/\s]+$/.test(crudo) || ALIAS.has(norm(crudo));
}
function tipoDocumento(doc) { return /^\d{11}$/.test(doc) ? "6" : "0"; } // RUC = 6; no domiciliado = 0 (como en produccion)
function estadoDd(resultadoTxt) {
  const r = norm(resultadoTxt);
  if (r === "APTO" || r === "APTO CON OBSERVACIONES") return "aprobada";
  if (r === "NO APTO") return "rechazada";
  if (r.startsWith("EN REVISION") || r.includes("PROCESO")) return "en_revision";
  if (r.startsWith("DOCUMENTACION OBSERVADA") || r.startsWith("SOLICITUD DE CORRECCION")) return "observada";
  if (r.startsWith("PENDIENTE")) return "pendiente";
  return null;
}
const EVENTOS = {
  PERUMIN: { tipo: 2, codigo: 19, nombre: "PERUMIN", anio: "2027" },
  PROEXPLO: { tipo: 1, codigo: 28, nombre: "PROEXPLO", anio: "2026" },
  WMC: { tipo: 13, codigo: 1, nombre: "WORLD MINING CONGRESS", anio: "2026" },
  GESS: { tipo: 14, codigo: 1, nombre: "GESS", anio: "2026" },
};
function claveEvento(txt) {
  const e = norm(txt);
  if (e.includes("PROEXPLO")) return "PROEXPLO";
  if (e.includes("WMC") || e.includes("WORLD MINING")) return "WMC";
  if (e.includes("GESS")) return "GESS";
  return "PERUMIN";
}
const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const aFecha = (s) => (s ? new Date(`${String(s).slice(0, 10)}T00:00:00Z`) : null);
function sumarMeses(fecha, meses) {
  const r = new Date(fecha.getTime());
  const d = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(d, ultimo));
  return r;
}
const ETIQ = { aprobada: "APTO", rechazada: "NO APTO", en_revision: "EN REVISION", observada: "DOC. OBSERVADA", pendiente: "PENDIENTE", borrador: "BORRADOR", en_legal: "EN LEGAL" };

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no definida");
  const dbNombre = /\/([^/?]+)(\?|$)/.exec(url)?.[1];
  const c = new pg.Client({ connectionString: url, ssl: /sslmode|amazonaws/.test(url) ? { rejectUnauthorized: false } : undefined });
  await c.connect();
  console.log(`Base: ${dbNombre} | modo: ${APLICAR ? "APLICAR (escribe)" : "SIMULACION (solo lectura)"} | entrada: ${ENTRADA}`);
  if (!APLICAR) await c.query("SET default_transaction_read_only = on");
  const q = async (s, p) => (await c.query(s, p)).rows;

  // ---------- 1. Excel ----------
  const filas = JSON.parse(fs.readFileSync(ENTRADA, "utf8"));
  const registros = [];
  const manual = [];
  const sinResultado = [];
  filas.forEach((f, i) => {
    const razon = String(f["PERSONA JURIDICA / PERSONA NATURAL"] ?? "").trim();
    const raw = f["RUC / DNI / ID"];
    const doc = documentoFuente(raw, razon);
    const base = { fila: f.fila ?? i + 15, razon, rawDoc: String(raw ?? "") };
    if (!razon || !idImportable(raw, doc)) { manual.push({ ...base, motivo: "Identificador no importable automaticamente", resultado: f.RESULTADO }); return; }
    const estado = estadoDd(f.RESULTADO);
    if (!estado) { sinResultado.push({ ...base, resultado: f.RESULTADO }); return; }
    const evKey = claveEvento(f["EVENTO O PROYECTO ASOCIADO"]);
    registros.push({
      ...base, documento: docNormalizado(doc), clave: claveDoc(doc), estado, estadoOrigen: String(f.RESULTADO).trim(),
      motivo: String(f["MOTIVO DE LA EVALUACIÓN"] ?? "").trim() || null, eventoProyecto: String(f["EVENTO O PROYECTO ASOCIADO"] ?? "").trim() || null,
      evKey, fechaIngreso: aFecha(f["FECHA DE INGRESO SOLICITUD"]), fechaRevision: aFecha(f["FECHA DE REVISIÓN POR SIG"]),
    });
  });
  // una fila por (empresa, evento): la mas reciente (empate: la ultima del Excel)
  const grupos = new Map();
  for (const r of registros) {
    const k = `${r.clave}|${r.evKey}`;
    const f = (x) => (x.fechaRevision ?? x.fechaIngreso ?? new Date(0)).getTime();
    const p = grupos.get(k);
    if (!p || f(r) >= f(p)) grupos.set(k, r);
  }
  const evPorClave = new Map();
  for (const r of grupos.values()) (evPorClave.get(r.clave) ?? evPorClave.set(r.clave, new Set()).get(r.clave)).add(r.evKey);

  // ---------- 2. Estado actual del sistema ----------
  const empresas = await q("select id, ruc, razon_social from empresa");
  const porClave = new Map();
  for (const e of empresas) (porClave.get(claveDoc(e.ruc)) ?? porClave.set(claveDoc(e.ruc), []).get(claveDoc(e.ruc))).push(e);
  const eventosDb = await q("select id, tipo_evento, codigo_evento from evento");
  const eventoId = (key) => eventosDb.find((e) => e.tipo_evento === EVENTOS[key].tipo && e.codigo_evento === EVENTOS[key].codigo)?.id ?? null;
  const dds = await q("select id, empresa_id, evento_id, codigo, estado, origen, estado_origen, fecha_envio, fecha_revision, fecha_aprobacion, fecha_vencimiento, revisado_por, updated_at from debida_diligencia");
  /* DD con actividad del equipo despues de la carga: historial, observaciones o resultados de la matriz. */
  const conActividad = new Set((await q(`
    select expediente_id id from debida_diligencia_historial
    union select expediente_id from debida_diligencia_observacion
    union select expediente_id from dd_matriz_vinculo where sig_resultado is not null or rep_resultado is not null or cmp_resultado is not null or resultado_final is not null`)).map((x) => x.id));
  const ddsPorEmpresa = new Map();
  for (const d of dds) (ddsPorEmpresa.get(d.empresa_id) ?? ddsPorEmpresa.set(d.empresa_id, []).get(d.empresa_id)).push(d);
  const perumin = eventoId("PERUMIN");

  // ---------- 3. Plan ----------
  const plan = [];
  const eventosNuevos = new Set();
  const empresasPlaneadas = new Set(); // documentos cuya empresa se crea en esta corrida
  let consecutivo = Math.max(0, ...dds.map((d) => (/^DD-2026-(\d+)$/.exec(d.codigo)?.[1] ? Number(/^DD-2026-(\d+)$/.exec(d.codigo)[1]) : 0)));
  const ordenado = [...grupos.values()].sort((a, b) => a.fila - b.fila);
  const nuevaFechas = (r) => ({
    fecha_envio: r.fechaIngreso, fecha_revision: r.fechaRevision,
    fecha_aprobacion: r.estado === "aprobada" ? r.fechaRevision : null,
    fecha_vencimiento: r.estado === "aprobada" && r.fechaRevision ? sumarMeses(r.fechaRevision, VIGENCIA_MESES) : null,
    fecha_rechazo: r.estado === "rechazada" ? (r.fechaRevision ?? r.fechaIngreso) : null,
  });
  for (const r of ordenado) {
    const item = { fila: r.fila, empresa: r.razon, documento: r.documento, evento: r.evKey, excel: ETIQ[r.estado], excelTxt: r.estadoOrigen, excelFecha: dia(r.fechaRevision ?? r.fechaIngreso) };
    const cand = porClave.get(r.clave) ?? [];
    if (cand.length > 1) { plan.push({ ...item, accion: "MANUAL_AMBIGUO", detalle: `Hay ${cand.length} empresas con ese documento` }); continue; }
    const empresa = cand[0] ?? null;
    if (r.evKey !== "PERUMIN" && !eventoId(r.evKey)) eventosNuevos.add(r.evKey);
    const evId = eventoId(r.evKey);
    const nuevo = nuevaFechas(r);
    if (!empresa) {
      consecutivo += 1;
      const yaPlaneada = empresasPlaneadas.has(r.clave);
      empresasPlaneadas.add(r.clave);
      plan.push({ ...item, accion: yaPlaneada ? "CREAR_DD" : "CREAR_EMPRESA_Y_DD", codigoNuevo: `DD-2026-${String(consecutivo).padStart(4, "0")}`, nuevo });
      continue;
    }
    const delEvento = (ddsPorEmpresa.get(empresa.id) ?? []).find((d) => d.evento_id === evId);
    if (delEvento) {
      if (delEvento.origen !== "importado") { plan.push({ ...item, accion: "OMITIR_PORTAL", codigo: delEvento.codigo, sistema: ETIQ[delEvento.estado] ?? delEvento.estado, detalle: "DD del portal: no se toca" }); continue; }
      plan.push(decidirActualizacion(item, r, delEvento, nuevo, null));
      continue;
    }
    // no hay DD en ese evento: reasignar la importada de PERUMIN si el Excel ubica a la empresa SOLO en otro evento
    const enPerumin = (ddsPorEmpresa.get(empresa.id) ?? []).find((d) => d.evento_id === perumin && d.origen === "importado");
    const tienePerumin = evPorClave.get(r.clave)?.has("PERUMIN");
    if (r.evKey !== "PERUMIN" && enPerumin && !tienePerumin) {
      plan.push(decidirActualizacion(item, r, enPerumin, nuevo, evId ?? `NUEVO:${r.evKey}`));
      continue;
    }
    consecutivo += 1;
    plan.push({ ...item, accion: "CREAR_DD", codigoNuevo: `DD-2026-${String(consecutivo).padStart(4, "0")}`, nuevo });
  }
  function decidirActualizacion(item, r, d, nuevo, reasignarA) {
    const base = { ...item, codigo: d.codigo, ddId: d.id, sistema: ETIQ[d.estado] ?? d.estado, sistemaFecha: dia(d.fecha_revision ?? d.fecha_envio), nuevo, reasignarA };
    const tocada = d.revisado_por !== REVISOR_IMPORTACION || conActividad.has(d.id);
    const sysFecha = aFecha(dia(d.fecha_revision ?? d.fecha_envio));
    const exFecha = r.fechaRevision ?? r.fechaIngreso;
    const cambia = d.estado !== r.estado || (reasignarA !== null) ||
      dia(d.fecha_revision) !== dia(r.fechaRevision) || dia(d.fecha_envio) !== dia(r.fechaIngreso) ||
      dia(d.fecha_vencimiento) !== dia(nuevo.fecha_vencimiento) || dia(d.fecha_aprobacion) !== dia(nuevo.fecha_aprobacion);
    if (!cambia) return { ...base, accion: "SIN_CAMBIO" };
    if (tocada) return { ...base, accion: "OMITIR_TOCADA_POR_EQUIPO", detalle: `revisado_por=${d.revisado_por}${conActividad.has(d.id) ? ", con historial/observaciones/resultados de matriz" : ""}` };
    if (sysFecha && exFecha && exFecha < sysFecha) return { ...base, accion: "OMITIR_EXCEL_MAS_ANTIGUO", detalle: `Excel ${dia(exFecha)} < sistema ${dia(sysFecha)}` };
    const bajada = d.estado === "aprobada" && r.estado !== "aprobada";
    if (bajada && !BAJADAS_OK.has(r.documento)) return { ...base, accion: "PENDIENTE_CONFIRMAR_BAJADA", detalle: `APTO en el sistema; el Excel dice ${ETIQ[r.estado]}` };
    /* mismo estado: la DD ya esta declarada; solo se mueve de evento (si corresponde), sin tocar sus fechas */
    if (reasignarA !== null) return { ...base, accion: d.estado === r.estado ? "REASIGNAR_EVENTO" : "REASIGNAR_EVENTO_Y_ACTUALIZAR" };
    if (d.estado === r.estado) return { ...base, accion: CORREGIR_FECHAS ? "CORREGIR_FECHAS" : "OMITIR_SOLO_FECHAS", detalle: "Mismo estado; solo difieren las fechas" };
    return { ...base, accion: "ACTUALIZAR" };
  }

  // ---------- 4. Reporte ----------
  const cuenta = (arr, f) => { const m = {}; arr.forEach((x) => { const k = f(x); m[k] = (m[k] || 0) + 1; }); return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1])); };
  const resumen = {
    base: dbNombre, modo: APLICAR ? "aplicar" : "simulacion", filasExcel: filas.length, combinacionesEmpresaEvento: grupos.size,
    acciones: cuenta(plan, (p) => p.accion),
    porEventoYAccion: cuenta(plan, (p) => `${p.evento} | ${p.accion}`),
    empresasPorCrear: new Set(plan.filter((p) => p.accion === "CREAR_EMPRESA_Y_DD").map((p) => p.documento)).size,
    eventosPorMaterializar: [...eventosNuevos], revisionManual: manual.length, resultadoNoReconocido: sinResultado.length,
    transicionesDeEstado: cuenta(plan.filter((p) => ["ACTUALIZAR", "CORREGIR_FECHAS", "REASIGNAR_EVENTO", "REASIGNAR_EVENTO_Y_ACTUALIZAR"].includes(p.accion)), (p) => `${p.accion === "CORREGIR_FECHAS" ? "(solo fechas) " : ""}${p.sistema} -> ${p.excel}`),
  };
  fs.writeFileSync(SALIDA, JSON.stringify({ resumen, plan, manual, sinResultado }, null, 1));
  console.log(JSON.stringify(resumen, null, 1));
  console.log(`Reporte detallado: ${SALIDA}`);
  if (!APLICAR) { await c.end(); return; }

  // ---------- 5. Aplicar (una transaccion) ----------
  const hash = crypto.createHash("sha256").update(fs.readFileSync(ENTRADA)).digest("hex");
  const ahora = new Date();
  await c.query("BEGIN");
  try {
    const crearEvento = async (key) => {
      const e = EVENTOS[key];
      const ya = await q("select id from evento where tipo_evento=$1 and codigo_evento=$2", [e.tipo, e.codigo]);
      if (ya[0]) return ya[0].id;
      let padre = (await q("select id from evento_padre where codigo=$1", [String(e.tipo)]))[0]?.id;
      if (!padre) {
        padre = crypto.randomUUID();
        await c.query("insert into evento_padre (id, codigo, vertical, nombre, created_at, updated_at) values ($1,$2,'api',$3,$4,$4)", [padre, String(e.tipo), e.nombre, ahora]);
      }
      const id = crypto.randomUUID();
      await c.query("insert into evento (id, evento_padre_id, tipo_evento, codigo_evento, anio, estado, flg_activo, flg_visible, created_at, updated_at) values ($1,$2,$3,$4,$5,'active',true,true,$6,$6)", [id, padre, e.tipo, e.codigo, e.anio, ahora]);
      return id;
    };
    const eventoPorKey = { PERUMIN: perumin };
    for (const key of Object.keys(EVENTOS)) eventoPorKey[key] = eventoId(key) ?? (plan.some((p) => p.evento === key && p.accion !== "SIN_CAMBIO" && !p.accion.startsWith("OMITIR") && !p.accion.startsWith("MANUAL")) ? await crearEvento(key) : null);

    const lote = crypto.randomUUID();
    const accionables = plan.filter((p) => ["CREAR_EMPRESA_Y_DD", "CREAR_DD", "ACTUALIZAR", "CORREGIR_FECHAS", "REASIGNAR_EVENTO", "REASIGNAR_EVENTO_Y_ACTUALIZAR"].includes(p.accion));
    await c.query("insert into dd_importacion (id, archivo, hash, evento_id, usuario, total, importados, actualizados, omitidos, errores, created_at) values ($1,$2,$3,$4,$5,$6,0,0,0,$7,$8)",
      [lote, ARCHIVO, hash, perumin, USUARIO, filas.length, JSON.stringify({ revisionManual: manual.length, resultadoNoReconocido: sinResultado.length }), ahora]);
    let importados = 0, actualizados = 0, empresasCreadas = 0;
    const empresasCreadasPorClave = new Map();
    const audit = async (entidad, mensaje, metadata) => c.query("insert into audit_log (id, tipo, entidad, actor, mensaje, metadata, created_at) values ($1,'debida_diligencia',$2,$3,$4,$5,$6)", [crypto.randomUUID(), entidad, USUARIO, mensaje, JSON.stringify(metadata), ahora]);
    for (const p of accionables) {
      const r = ordenado.find((x) => x.fila === p.fila);
      const evId = eventoPorKey[p.evento];
      if (p.accion === "CREAR_EMPRESA_Y_DD" || p.accion === "CREAR_DD") {
        let empresaId;
        if (p.accion === "CREAR_EMPRESA_Y_DD") {
          empresaId = crypto.randomUUID();
          await c.query("insert into empresa (id, ruc, razon_social, tipo_documento, pais, estado, creado_por, created_at, updated_at) values ($1,$2,$3,$4,$5,'activa',$6,$7,$7)", [empresaId, r.documento, r.razon.slice(0, 250), tipoDocumento(r.documento), tipoDocumento(r.documento) === "6" ? "PE" : "", USUARIO, ahora]);
          empresasCreadas += 1;
          empresasCreadasPorClave.set(r.clave, empresaId);
        } else empresaId = (porClave.get(r.clave) ?? [])[0]?.id ?? empresasCreadasPorClave.get(r.clave);
        await c.query(`insert into debida_diligencia (id, empresa_id, evento_id, codigo, estado, estado_origen, evento_proyecto, motivo_importacion, importacion_id, origen, creado_por, actualizado_por, revisado_por,
            fecha_envio, fecha_revision, fecha_aprobacion, fecha_vencimiento, fecha_rechazo, created_at, updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'importado',$10,$10,$11,$12,$13,$14,$15,$16,$17,$17)`,
          [crypto.randomUUID(), empresaId, evId, p.codigoNuevo, r.estado, r.estadoOrigen.slice(0, 80), (r.eventoProyecto ?? "").slice(0, 120) || null, (r.motivo ?? "").slice(0, 250) || null, lote, USUARIO, REVISOR_IMPORTACION,
            p.nuevo.fecha_envio, p.nuevo.fecha_revision, p.nuevo.fecha_aprobacion, p.nuevo.fecha_vencimiento, p.nuevo.fecha_rechazo, ahora]);
        await audit(p.codigoNuevo, `Reimportacion: se creó la DD de ${r.razon} (${p.evento}) con estado ${ETIQ[r.estado]}`, { accion: "reimportacion_crear", lote, documento: r.documento, evento: p.evento });
        importados += 1;
      } else if (p.accion === "REASIGNAR_EVENTO") {
        const antes = (await q("select estado, evento_id, fecha_revision from debida_diligencia where id=$1", [p.ddId]))[0];
        await c.query("update debida_diligencia set evento_id=$2, evento_proyecto=$3, actualizado_por=$4, updated_at=$5 where id=$1", [p.ddId, evId, (r.eventoProyecto ?? "").slice(0, 120) || null, USUARIO, ahora]);
        await audit(p.codigo, `Reimportacion: ${p.codigo} se reasignó al evento ${p.evento} (estado y fechas sin cambios)`, { accion: "reimportacion_reasignar_evento", lote, antes, despues: { evento: p.evento } });
        actualizados += 1;
      } else {
        const antes = (await q("select estado, evento_id, fecha_envio, fecha_revision, fecha_aprobacion, fecha_vencimiento, fecha_rechazo, estado_origen from debida_diligencia where id=$1", [p.ddId]))[0];
        await c.query(`update debida_diligencia set estado=$2, estado_origen=$3, evento_proyecto=$4, motivo_importacion=$5, evento_id=$6, fecha_envio=$7, fecha_revision=$8, fecha_aprobacion=$9,
            fecha_vencimiento=$10, fecha_rechazo=$11, actualizado_por=$12, updated_at=$13 where id=$1`,
          [p.ddId, r.estado, r.estadoOrigen.slice(0, 80), (r.eventoProyecto ?? "").slice(0, 120) || null, (r.motivo ?? "").slice(0, 250) || null, p.reasignarA ? evId : antes.evento_id,
            p.nuevo.fecha_envio, p.nuevo.fecha_revision, p.nuevo.fecha_aprobacion, p.nuevo.fecha_vencimiento, p.nuevo.fecha_rechazo, USUARIO, ahora]);
        await audit(p.codigo, (p.accion === "CORREGIR_FECHAS" ? `Reimportacion: ${p.codigo} corrigió sus fechas según el Excel oficial` : `Reimportacion: ${p.codigo} pasó de ${p.sistema} a ${ETIQ[r.estado]}${p.reasignarA ? ` y se reasignó al evento ${p.evento}` : ""}`), { accion: "reimportacion_actualizar", lote, antes, despues: { estado: r.estado, evento: p.evento } });
        actualizados += 1;
      }
    }
    await c.query("update dd_importacion set importados=$2, actualizados=$3, omitidos=$4 where id=$1", [lote, importados, actualizados, plan.length - accionables.length]);
    await c.query("COMMIT");
    console.log(`APLICADO. DD creadas: ${importados} | empresas creadas: ${empresasCreadas} | DD actualizadas: ${actualizados} | lote: ${lote}`);
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  }
  await c.end();
})().catch((e) => { console.log("ERR", e.message); process.exit(1); });
