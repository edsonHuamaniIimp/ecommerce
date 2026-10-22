-- El contrato siempre se genera y firma al final; deja de ser configurable.
ALTER TABLE "evento"
  ALTER COLUMN "contrato_posterior" SET DEFAULT true;

UPDATE "evento"
SET "contrato_posterior" = true
WHERE "contrato_posterior" = false;
