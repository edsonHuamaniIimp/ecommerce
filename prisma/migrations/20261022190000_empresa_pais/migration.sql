-- Pais de la empresa (ISO 3166-1 alpha-2). Las empresas existentes quedan en PE.
ALTER TABLE "empresa"
  ADD COLUMN "pais" VARCHAR(2) NOT NULL DEFAULT 'PE';
