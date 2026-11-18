-- Moneda del contrato y tipo de cambio por version de evento.
-- Las solicitudes existentes quedan en USD con tipo de cambio 1.

ALTER TABLE "evento"
  ADD COLUMN "tipo_cambio" DOUBLE PRECISION;

ALTER TABLE "solicitud"
  ADD COLUMN "moneda" VARCHAR(3) NOT NULL DEFAULT 'USD',
  ADD COLUMN "tipo_cambio" DOUBLE PRECISION;

UPDATE "solicitud"
SET "tipo_cambio" = 1
WHERE "moneda" = 'USD' AND "tipo_cambio" IS NULL;
