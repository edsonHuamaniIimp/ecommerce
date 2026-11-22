// Prepara usuarios y empresas de prueba E2E en la BD de QA (idempotente). Se ejecuta dentro del contenedor de la app.
const { Client } = require("pg");
const { randomUUID, randomBytes, scryptSync } = require("crypto");

const EVENTO_ID = "c0a354e0-4c79-4b38-b88d-ff824cd28964"; // Perumin 2027
const PASSWORD = "E2eTest#2026";
const ESCENARIOS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function hash(plano) {
  const salt = randomBytes(16);
  const clave = scryptSync(plano, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64url")}$${clave.toString("base64url")}`;
}

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const ins = async (tabla, fila) => {
    const k = Object.keys(fila);
    await c.query(
      `insert into ${tabla}(${k.map((x) => '"' + x + '"').join(",")}) values(${k.map((_, i) => "$" + (i + 1)).join(",")})`,
      k.map((x) => fila[x]),
    );
  };
  const log = [];

  async function clonarUsuario(emailOrigen, emailNuevo, extra = {}) {
    const ya = await c.query("select id from user_role where email=$1", [emailNuevo]);
    if (ya.rows.length) {
      await c.query("update user_role set password=$2, flg_activo=true, debe_cambiar_password=false where email=$1", [emailNuevo, hash(PASSWORD)]);
      log.push(`usuario ya existe: ${emailNuevo} (password renovada)`);
      return;
    }
    const origen = (await c.query("select * from user_role where email=$1", [emailOrigen])).rows[0];
    if (!origen) throw new Error("sin plantilla " + emailOrigen);
    const fila = {
      ...origen,
      id: randomUUID(),
      user_id: randomUUID(),
      email: emailNuevo,
      password: hash(PASSWORD),
      reset_token: null,
      reset_token_expires: null,
      debe_cambiar_password: false,
      flg_activo: true,
      notification_email: null,
      notification_email_verified_at: null,
      notification_email_pending: null,
      notification_email_code: null,
      notification_email_code_expires: null,
      ...extra,
    };
    if ("created_at" in fila) fila.created_at = new Date();
    if ("updated_at" in fila) fila.updated_at = new Date();
    await ins("user_role", fila);
    log.push(`usuario creado: ${emailNuevo}`);
  }

  // Staff
  await clonarUsuario("logistica@iimp.org.pe", "e2e-sig@example.invalid", { evento_id: EVENTO_ID });
  await clonarUsuario("comunicacion@iimp.org.pe", "e2e-com@example.invalid", { evento_id: EVENTO_ID });
  await clonarUsuario("legal@iimp.org.pe", "e2e-legal@example.invalid", { evento_id: EVENTO_ID });

  // Clientes + empresas
  const plantillaCliente = (
    await c.query(
      `select u.* from user_role u join role r on r.id=u.role_id where r.nombre='cliente' and u.empresa_id is not null order by u.id desc limit 1`,
    )
  ).rows[0];
  if (!plantillaCliente) throw new Error("sin plantilla de cliente");
  const empresaPlantilla = (await c.query("select * from empresa where id=$1", [plantillaCliente.empresa_id])).rows[0];

  for (let i = 0; i < ESCENARIOS.length; i += 1) {
    const esc = ESCENARIOS[i];
    const ruc = `2099999${String(1001 + i)}`; // 11 digitos
    const razon = `E2E EMPRESA ${esc} S.A.C.`;
    let empresa = (await c.query("select * from empresa where ruc=$1", [ruc])).rows[0];
    if (!empresa) {
      const fila = { ...empresaPlantilla, id: randomUUID(), razon_social: razon, ruc };
      if ("created_at" in fila) fila.created_at = new Date();
      if ("updated_at" in fila) fila.updated_at = new Date();
      await ins("empresa", fila);
      empresa = fila;
      log.push(`empresa creada: ${razon} ${ruc}`);
    } else {
      log.push(`empresa ya existe: ${razon} ${ruc}`);
    }
    const extra = {
      empresa_id: empresa.id,
      evento_id: EVENTO_ID,
      nombre_empresa: razon,
      ruc,
    };
    if ("id_empresa" in plantillaCliente) extra.id_empresa = empresa.id;
    await clonarUsuario(plantillaCliente.email, `e2e-cli-${esc.toLowerCase()}@example.invalid`, extra);
  }
  console.log(log.join("\n"));
  await c.end();
})().catch((e) => {
  console.log("ERR", e.message);
  process.exit(1);
});
