-- Convierte el vinculo unico en una lista de vinculos comerciales.
ALTER TABLE "debida_diligencia"
  ALTER COLUMN "tipo_relacion_comercial" TYPE TEXT[]
  USING CASE
    WHEN "tipo_relacion_comercial" IS NULL
      OR btrim("tipo_relacion_comercial") = '' THEN ARRAY[]::TEXT[]
    ELSE ARRAY["tipo_relacion_comercial"]
  END;

ALTER TABLE "debida_diligencia"
  ALTER COLUMN "tipo_relacion_comercial" SET DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "debida_diligencia"
  ALTER COLUMN "tipo_relacion_comercial" SET NOT NULL;
