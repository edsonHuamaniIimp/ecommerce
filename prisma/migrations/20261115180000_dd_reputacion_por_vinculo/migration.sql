-- Dictamen reputacional por vinculo de matriz.
-- Compatibilidad: los casos existentes quedan con vinculo_id = NULL (legacy).

ALTER TABLE "debida_diligencia_reputacion"
  ADD COLUMN "vinculo_id" TEXT;

-- La unicidad anterior (expediente + nombre) impide dictaminar dos veces
-- el mismo nombre cuando aparece en dos vinculos distintos.
DO $$
DECLARE
  restriccion record;
BEGIN
  FOR restriccion IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'debida_diligencia_reputacion'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (expediente_id, nombre_a_revisar)'
  LOOP
    EXECUTE format(
      'ALTER TABLE "debida_diligencia_reputacion" DROP CONSTRAINT %I',
      restriccion.conname
    );
  END LOOP;
END $$;

-- Un caso por vinculo.
CREATE UNIQUE INDEX "debida_diligencia_reputacion_expediente_id_vinculo_id_key"
  ON "debida_diligencia_reputacion" ("expediente_id", "vinculo_id");

-- Los casos legacy mantienen una sola fila por nombre dentro del expediente.
CREATE UNIQUE INDEX "debida_diligencia_reputacion_legacy_nombre_key"
  ON "debida_diligencia_reputacion" ("expediente_id", "nombre_a_revisar")
  WHERE "vinculo_id" IS NULL;

CREATE INDEX "debida_diligencia_reputacion_vinculo_id_idx"
  ON "debida_diligencia_reputacion" ("vinculo_id");

ALTER TABLE "debida_diligencia_reputacion"
  ADD CONSTRAINT "debida_diligencia_reputacion_vinculo_id_fkey"
  FOREIGN KEY ("vinculo_id") REFERENCES "dd_matriz_vinculo"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;