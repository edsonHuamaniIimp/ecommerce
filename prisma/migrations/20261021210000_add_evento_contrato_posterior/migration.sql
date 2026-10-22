-- Configuracion por version de evento: el contrato se genera despues del envio
-- de la solicitud y el cliente solo lo firma digitalmente en Mis solicitudes.
ALTER TABLE "evento"
  ADD COLUMN "contrato_posterior" BOOLEAN NOT NULL DEFAULT false;
