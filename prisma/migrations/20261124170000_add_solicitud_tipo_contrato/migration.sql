-- Plantilla de contrato por solicitud (estandar | operador_internacional). Null = se deduce de solicitud.tipo.
ALTER TABLE "solicitud" ADD COLUMN IF NOT EXISTS "tipo_contrato" VARCHAR(30);
