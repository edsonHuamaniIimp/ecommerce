-- Politica fija: el contrato siempre se genera al final. Se elimina la
-- configuracion por evento y su columna.
ALTER TABLE "evento"
  DROP COLUMN "contrato_posterior";
