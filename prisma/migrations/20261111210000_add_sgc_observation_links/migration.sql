-- Vincula cada archivo local con la observacion exacta del SGC que corrige.
ALTER TABLE "solicitud_documento"
  ADD COLUMN IF NOT EXISTS "sgc_observation_id" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "sgc_document_id" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "sgc_title" VARCHAR(300);

CREATE INDEX IF NOT EXISTS "solicitud_documento_sgc_observation_id_idx"
  ON "solicitud_documento" ("sgc_observation_id");

-- Marca persistente para no depender solo de fechas al detectar un contrato regenerado.
ALTER TABLE "sgc_expediente"
  ADD COLUMN IF NOT EXISTS "contrato_regenerado_observation_id" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "contrato_regenerado_at" TIMESTAMP(3);
