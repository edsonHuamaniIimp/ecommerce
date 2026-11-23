// Ronda 2: crea (idempotente) 30 empresas y usuarios cliente de prueba (R01..R30). Se ejecuta dentro del contenedor de la app.
import pg from "pg";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";

const EVENTO_ID = "c0a354e0-4c79-4b38-b88d-ff824cd28964"; // Perumin 2027
const PASSWORD = "E2eTest#2026";
const TOTAL = Number(process.env.E2E_TOTAL || 30);

function hash(plano) {
  const salt = randomBytes(16);
  const clave = scryptSync(plano, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64url")}$${clave.toString("base64url")}`;
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  const insertar = async (tabla, fila) => {
    const k = Object.keys(fila);
    await c.query(
      `insert into ${tabla}(${k.map((x) => `"${x}"`).join(",")}) values(${k.map((_, i) => `$${i + 1}`).join(",")})`,
      k.map((x) => fila[x]),
    );
  };
  const plantillaCliente = (
    await c.query(
      "select u.* from user_role u join role r on r.id=u.role_id where r.nombre='cliente' and u.empresa_id is not null order by u.id desc limit 1",
    )
  ).rows[0];
  const empresaPlantilla = (await c.query("select * from empresa where id=$1", [plantillaCliente.empresa_id])).rows[0];
  let creados = 0;
  for (let i = 1; i <= TOTAL; i += 1) {
    const n = String(i).padStart(2, "0");
    const ruc = `20999992${String(i).padStart(3, "0")}`;
    const razon = `E2E RONDA2 R${n} S.A.C.`;
    let empresa = (await c.query("select * from empresa where ruc=$1", [ruc])).rows[0];
    if (!empresa) {
      empresa = { ...empresaPlantilla, id: randomUUID(), razon_social: razon, ruc };
      if ("created_at" in empresa) empresa.created_at = new Date();
      if ("updated_at" in empresa) empresa.updated_at = new Date();
      await insertar("empresa", empresa);
      creados += 1;
    }
    const email = `e2e-r${n}@example.invalid`;
    const existe = (await c.query("select id from user_role where email=$1", [email])).rows[0];
    if (existe) {
      await c.query("update user_role set password=$2, flg_activo=true, debe_cambiar_password=false where email=$1", [email, hash(PASSWORD)]);
      continue;
    }
    const fila = {
      ...plantillaCliente,
      id: randomUUID(),
      user_id: randomUUID(),
      email,
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
      empresa_id: empresa.id,
      evento_id: EVENTO_ID,
      nombre_empresa: razon,
      ruc,
    };
    if ("id_empresa" in plantillaCliente) fila.id_empresa = empresa.id;
    await insertar("user_role", fila);
  }
  console.log(`empresas nuevas: ${creados}; usuarios R01..R${TOTAL} listos`);
} finally {
  await c.end();
}
