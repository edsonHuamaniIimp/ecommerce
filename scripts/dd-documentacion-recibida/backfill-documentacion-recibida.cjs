/* eslint-disable @typescript-eslint/no-require-imports -- script CommonJS que corre suelto en contenedores (sin build) */
/**
 * Backfill del estado "Documentación recibida" (codigo doc_recibida) en Debida Diligencia.
 *
 * Por defecto es SIMULACION (sesion de solo lectura): no escribe y entrega el reporte.
 * Con --aplicar escribe todo en UNA transaccion. Es idempotente: una segunda corrida no encuentra nada.
 *
 *   node backfill-documentacion-recibida.cjs --salida=/tmp/reporte-doc-recibida.json [--aplicar] [--usuario=admin@iimp.org.pe]
 *
 * Reglas (acordadas con el equipo):
 *  - Solo DD del portal (origen flujo_regular) en estado en_revision.
 *  - Pasa a doc_recibida solo si SIG aun no la trabajo: sin borrador ni evaluacion en la matriz, sin evidencias,
 *    sin casos de Comunicaciones, sin observaciones, sin eventos de historial de SIG/Legal, sin vinculos completos
 *    declarados, sin revisor registrado y sin reenvio (una subsanacion vuelve a en_revision, nunca a doc_recibida).
 *  - Las DD importadas en en_revision se quedan en en_revision.
 *  - El historial visible no se toca; cada cambio deja un registro en audit_log con el lote.
 */
const fs = require("fs");
const crypto = require("crypto");
const pg = require(fs.existsSync("/app/node_modules/pg") ? "/app/node_modules/pg" : "pg");

const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const APLICAR = process.argv.includes("--aplicar");
const SALIDA = arg("salida", "/tmp/reporte-doc-recibida.json");
const USUARIO = arg("usuario", "admin@iimp.org.pe");

const ESTADO_DESDE = "en_revision";
const ESTADO_HACIA = "doc_recibida";
const SENALES = [
  "borrador_matriz",
  "evaluacion_matriz",
  "evidencias",
  "comunicaciones",
  "observaciones",
  "historial_sig",
  "reenviada",
  "vinculos_completos",
  "revisor",
];

const CONSULTA = `
  select d.id, d.codigo, d.origen, d.fecha_envio, e.razon_social, (ep.nombre || chr(32) || ev.anio) as evento,
    exists (select 1 from dd_matriz_vinculo v where v.expediente_id = d.id
      and (v.listas <> '{}'::jsonb or v.listas_observaciones <> '{}'::jsonb or coalesce(trim(v.sig_observaciones), '') <> '')) as borrador_matriz,
    exists (select 1 from dd_matriz_vinculo v where v.expediente_id = d.id
      and (v.sig_resultado is not null or v.sig_conclusion is not null or v.rep_resultado is not null
        or v.cmp_resultado is not null or v.resultado_final is not null)) as evaluacion_matriz,
    exists (select 1 from dd_matriz_adjunto a join dd_matriz_vinculo v on v.id = a.vinculo_id where v.expediente_id = d.id) as evidencias,
    exists (select 1 from debida_diligencia_reputacion r where r.expediente_id = d.id) as comunicaciones,
    exists (select 1 from debida_diligencia_observacion o where o.expediente_id = d.id) as observaciones,
    exists (select 1 from debida_diligencia_historial h where h.expediente_id = d.id and h.tipo not in ('envio', 'reenvio')) as historial_sig,
    exists (select 1 from debida_diligencia_historial h where h.expediente_id = d.id and h.tipo = 'reenvio') as reenviada,
    d.vinculos_completos,
    (d.revisado_por is not null and d.revisado_por <> 'importacion_masiva') as revisor
  from debida_diligencia d
  left join empresa e on e.id = d.empresa_id
  left join evento ev on ev.id = d.evento_id
  left join evento_padre ep on ep.id = ev.evento_padre_id
  where d.estado = $1
  order by d.fecha_envio nulls last, d.codigo`;

(async () => {
  const url = process.env.DATABASE_URL;
  /* Igual que reimportar-dd.cjs: TLS en Aurora (amazonaws/sslmode), sin TLS en el postgres de QA/local. */
  const c = new pg.Client({ connectionString: url, ssl: /sslmode|amazonaws/.test(url) ? { rejectUnauthorized: false } : undefined });
  await c.connect();
  if (!APLICAR) await c.query("SET default_transaction_read_only = on");

  const filas = (await c.query(CONSULTA, [ESTADO_DESDE])).rows;
  const convertir = [];
  const conservar = [];
  for (const f of filas) {
    const senales = SENALES.filter((k) => f[k]);
    const base = { codigo: f.codigo, empresa: f.razon_social, evento: f.evento, origen: f.origen, fechaEnvio: f.fecha_envio };
    if (f.origen !== "flujo_regular") conservar.push({ ...base, motivo: "importada" });
    else if (senales.length > 0) conservar.push({ ...base, motivo: "SIG ya trabajo", senales });
    else convertir.push({ ...base, id: f.id });
  }

  const lote = crypto.randomUUID();
  let aplicadas = 0;
  if (APLICAR && convertir.length > 0) {
    const ahora = new Date();
    await c.query("BEGIN");
    try {
      for (const f of convertir) {
        /* El WHERE repite la condicion: si alguien la movio mientras tanto, no se toca. */
        const r = await c.query(
          "update debida_diligencia set estado = $1, actualizado_por = $2, updated_at = $3 where id = $4 and estado = $5",
          [ESTADO_HACIA, USUARIO, ahora, f.id, ESTADO_DESDE],
        );
        if (r.rowCount !== 1) continue;
        aplicadas += 1;
        await c.query(
          "insert into audit_log (id, tipo, entidad, actor, mensaje, metadata, created_at) values ($1, 'debida_diligencia', $2, $3, $4, $5, $6)",
          [
            crypto.randomUUID(),
            f.codigo,
            USUARIO,
            "Ajuste de estado: En revisión -> Documentación recibida (SIG aún no había iniciado la revisión).",
            JSON.stringify({ accion: "backfill_documentacion_recibida", desde: ESTADO_DESDE, hacia: ESTADO_HACIA, lote }),
            ahora,
          ],
        );
      }
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    }
  }

  const resumen = {
    modo: APLICAR ? "aplicado" : "simulacion",
    lote: APLICAR ? lote : null,
    enRevision: filas.length,
    aConvertir: convertir.length,
    aplicadas,
    conservadas: {
      importadas: conservar.filter((x) => x.motivo === "importada").length,
      portalConTrabajoSig: conservar.filter((x) => x.motivo !== "importada").length,
    },
  };
  fs.writeFileSync(SALIDA, JSON.stringify({ resumen, convertir: convertir.map(({ id: _id, ...r }) => r), conservar }, null, 2));
  console.log("@@RESUMEN " + JSON.stringify(resumen));
  console.log("@@PORTAL_CON_TRABAJO " + JSON.stringify(conservar.filter((x) => x.motivo !== "importada").map((x) => `${x.codigo}:${x.senales.join("+")}`)));
  await c.end();
})().catch((e) => {
  console.error("@@ERR", e.message);
  process.exit(1);
});
