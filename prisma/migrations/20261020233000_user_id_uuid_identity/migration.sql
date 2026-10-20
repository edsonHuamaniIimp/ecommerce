-- Identidad inmutable: user_id pasa de "user|<correo>" a UUID.
-- initial_user_id conserva el valor original para rollback.
-- Esta migracion es aditiva y no elimina datos.

ALTER TABLE "user_role" ADD COLUMN "initial_user_id" VARCHAR(100);
ALTER TABLE "solicitud" ADD COLUMN "initial_user_id" VARCHAR(100);
ALTER TABLE "solicitud_documento" ADD COLUMN "initial_user_id" VARCHAR(100);
ALTER TABLE "alerta" ADD COLUMN "initial_user_id" VARCHAR(100);
ALTER TABLE "gess_stand" ADD COLUMN "initial_user_id" VARCHAR(100);
ALTER TABLE "error_log" ADD COLUMN "initial_user_id" VARCHAR(100);

CREATE INDEX "user_role_initial_user_id_idx" ON "user_role"("initial_user_id");
CREATE INDEX "solicitud_initial_user_id_idx" ON "solicitud"("initial_user_id");
CREATE INDEX "solicitud_documento_initial_user_id_idx" ON "solicitud_documento"("initial_user_id");
CREATE INDEX "alerta_initial_user_id_idx" ON "alerta"("initial_user_id");
CREATE INDEX "gess_stand_initial_user_id_idx" ON "gess_stand"("initial_user_id");

UPDATE "user_role" SET "initial_user_id" = "user_id" WHERE "initial_user_id" IS NULL;
UPDATE "solicitud" SET "initial_user_id" = "user_id" WHERE "initial_user_id" IS NULL;
UPDATE "solicitud_documento" SET "initial_user_id" = "user_id" WHERE "initial_user_id" IS NULL;
UPDATE "alerta" SET "initial_user_id" = "user_id" WHERE "initial_user_id" IS NULL;
UPDATE "gess_stand" SET "initial_user_id" = "user_id" WHERE "initial_user_id" IS NULL;
UPDATE "error_log" SET "initial_user_id" = "user_id" WHERE "initial_user_id" IS NULL;

CREATE TEMP TABLE "_identity_map" AS
SELECT
  u."user_id" AS "old_user_id",
  gen_random_uuid()::text AS "new_user_id"
FROM (
  SELECT DISTINCT "user_id"
  FROM "user_role"
  WHERE "user_id" IS NOT NULL
) u;

UPDATE "user_role" ur
SET "user_id" = m."new_user_id"
FROM "_identity_map" m
WHERE ur."user_id" = m."old_user_id";

UPDATE "solicitud" s
SET "user_id" = m."new_user_id"
FROM "_identity_map" m
WHERE s."user_id" = m."old_user_id";

UPDATE "solicitud_documento" d
SET "user_id" = m."new_user_id"
FROM "_identity_map" m
WHERE d."user_id" = m."old_user_id";

UPDATE "alerta" a
SET "user_id" = m."new_user_id"
FROM "_identity_map" m
WHERE a."user_id" = m."old_user_id";

UPDATE "gess_stand" g
SET "user_id" = m."new_user_id"
FROM "_identity_map" m
WHERE g."user_id" = m."old_user_id";

UPDATE "error_log" e
SET "user_id" = m."new_user_id"
FROM "_identity_map" m
WHERE e."user_id" = m."old_user_id";

DROP TABLE "_identity_map";
