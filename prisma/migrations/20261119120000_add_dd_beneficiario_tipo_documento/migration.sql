-- Tipo de documento declarado por cada persona o empresa vinculada.
ALTER TABLE "debida_diligencia_beneficiario"
  ADD COLUMN "tipo_documento" VARCHAR(30);

-- Backfill para expedientes existentes.
UPDATE "debida_diligencia_beneficiario"
SET "tipo_documento" = CASE
  WHEN "tipo_vinculo_persona" = 'empresa_vinculada' THEN 'RUC'
  WHEN "documento" ~ '^\d{11}$' THEN 'RUC'
  WHEN "documento" ~ '^\d{8}$' THEN 'DNI'
  ELSE NULL
END;

COMMENT ON COLUMN "debida_diligencia_beneficiario"."tipo_documento"
  IS 'Tipo de documento del vínculo (DNI, Carnet de extranjería, Pasaporte o RUC).';
