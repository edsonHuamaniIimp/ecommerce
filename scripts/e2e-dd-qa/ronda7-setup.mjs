// Ronda 7: crea (idempotente) el usuario de pruebas e2e-admin@example.invalid clonando un administrador activo,
// para probar Configuracion DD, y e2e-reputacion@example.invalid con un rol que solo tiene «Revisión
// reputacional» (dd:reputacion). Se ejecuta dentro del contenedor de la app (usa `pg` y DATABASE_URL).
import pg from "pg";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";

const EVENTO_ID = "c0a354e0-4c79-4b38-b88d-ff824cd28964"; // Perumin 2027
const PASSWORD = "E2eTest#2026";
const EMAIL = "e2e-admin@example.invalid";
const ROL_ADMIN = "admin";
/* Usuario con UNICAMENTE el permiso de la pantalla Revision reputacional. */
const EMAIL_REPUTACION = "e2e-reputacion@example.invalid";
const ROL_REPUTACION = "e2e_reputacion";
const PERMISOS_REPUTACION = ["dd:reputacion"]; // PERMISSIONS.DD_REPUTACION
const MODULOS_REPUTACION = ["debida_diligencia"];
const PLANTILLA_COMUNICACIONES = "e2e-com@example.invalid";

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

  // Rol con solo dd:reputacion (si existe, se deja con exactamente esos permisos).
  let rol = (await c.query("select id from role where nombre=$1", [ROL_REPUTACION])).rows[0];
  if (rol) {
    await c.query("update role set permisos=$2, modulos=$3, updated_at=now() where id=$1", [rol.id, PERMISOS_REPUTACION, MODULOS_REPUTACION]);
  } else {
    rol = { id: randomUUID() };
    await c.query(
      "insert into role (id, nombre, descripcion, permisos, modulos, created_at, updated_at) values ($1,$2,$3,$4,$5,now(),now())",
      [rol.id, ROL_REPUTACION, "Pruebas E2E: solo Revisión reputacional", PERMISOS_REPUTACION, MODULOS_REPUTACION],
    );
  }
  const yaRep = await c.query("select id from user_role where email=$1", [EMAIL_REPUTACION]);
  if (yaRep.rows.length) {
    await c.query(
      "update user_role set role_id=$2, password=$3, flg_activo=true, debe_cambiar_password=false where email=$1",
      [EMAIL_REPUTACION, rol.id, hash(PASSWORD)],
    );
    console.log(`usuario ya existe: ${EMAIL_REPUTACION} (rol ${ROL_REPUTACION}, password renovada)`);
  } else {
    const origen = (await c.query("select * from user_role where email=$1", [PLANTILLA_COMUNICACIONES])).rows[0];
    if (!origen) throw new Error(`sin plantilla ${PLANTILLA_COMUNICACIONES}`);
    const fila = {
      ...origen,
      id: randomUUID(),
      user_id: randomUUID(),
      email: EMAIL_REPUTACION,
      role_id: rol.id,
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
    if ("nombre" in fila) fila.nombre = "E2E Solo reputación";
    if ("created_at" in fila) fila.created_at = new Date();
    if ("updated_at" in fila) fila.updated_at = new Date();
    const k = Object.keys(fila);
    await c.query(
      `insert into user_role(${k.map((x) => `"${x}"`).join(",")}) values(${k.map((_, i) => `$${i + 1}`).join(",")})`,
      k.map((x) => fila[x]),
    );
    console.log(`usuario creado: ${EMAIL_REPUTACION} (rol ${ROL_REPUTACION})`);
  }
} finally {
  await c.end();
}
