-- La unicidad legacy por (expediente, nombre) impide crear un caso para el
-- mismo nombre cuando aparece en dos vinculos distintos. El esquema nuevo
-- solo debe limitar (expediente, vinculo) y mantener el indice parcial para
-- casos legacy.

ALTER TABLE "debida_diligencia_reputacion"
  DROP CONSTRAINT IF EXISTS "debida_diligencia_reputacion_expediente_id_nombre_a_revisar_key";

DROP INDEX IF EXISTS "debida_diligencia_reputacion_expediente_id_nombre_a_revisar_key";
