-- Cuenta del representante legal vinculada a la empresa.
ALTER TABLE "empresa"
  ADD COLUMN "representante_user_id" VARCHAR(100);

CREATE INDEX "empresa_representante_user_id_idx"
  ON "empresa" ("representante_user_id");

-- Backfill no destructivo: solo cuando el correo del representante coincide
-- exactamente con una cuenta de la misma empresa.
UPDATE "empresa" e
SET "representante_user_id" = u."user_id"
FROM "user_role" u
WHERE u."empresa_id" = e."id"
  AND e."representante_correo" IS NOT NULL
  AND lower(u."email") = lower(e."representante_correo");
