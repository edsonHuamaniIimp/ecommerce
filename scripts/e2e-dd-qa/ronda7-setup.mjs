// Ronda 7: crea (idempotente) el usuario de pruebas e2e-admin@example.invalid clonando un administrador activo,
// para probar Configuracion DD. Se ejecuta dentro del contenedor de la app (usa `pg` y DATABASE_URL).
import pg from "pg";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";

const EVENTO_ID = "c0a354e0-4c79-4b38-b88d-ff824cd28964"; // Perumin 2027
const PASSWORD = "E2eTest#2026";
const EMAIL = "e2e-admin@example.invalid";
const ROL_ADMIN = "admin";

function hash(plano) {
  const salt = randomBytes(16);
  const clave = scryptSync(plano, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64url")}$${clave.toString("base64url")}`;
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  const ya = await c.query("select id from user_role where email=$1", [EMAIL]);
  if (ya.rows.length) {
    await c.query("update user_role set password=$2, flg_activo=true, debe_cambiar_password=false where email=$1", [EMAIL, hash(PASSWORD)]);
    console.log(`usuario ya existe: ${EMAIL} (password renovada)`);
  } else {
    const origen = (
      await c.query(
        "select u.* from user_role u join role r on r.id=u.role_id where r.nombre=$1 and u.flg_activo order by u.id limit 1",
        [ROL_ADMIN],
      )
    ).rows[0];
    if (!origen) throw new Error("sin administrador activo para clonar");
    const fila = {
      ...origen,
      id: randomUUID(),
      user_id: randomUUID(),
      email: EMAIL,
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
      evento_id: EVENTO_ID,
    };
    if ("created_at" in fila) fila.created_at = new Date();
    if ("updated_at" in fila) fila.updated_at = new Date();
    const k = Object.keys(fila);
    await c.query(
      `insert into user_role(${k.map((x) => `"${x}"`).join(",")}) values(${k.map((_, i) => `$${i + 1}`).join(",")})`,
      k.map((x) => fila[x]),
    );
    console.log(`usuario creado: ${EMAIL}`);
  }
} finally {
  await c.end();
}
