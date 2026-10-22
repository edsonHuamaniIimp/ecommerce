-- Habilitador del revisor para eventos con contrato posterior: no genera ni
-- modifica el contrato; solo permite mostrar al cliente la firma en Mis solicitudes.
ALTER TABLE "solicitud"
  ADD COLUMN "contrato_habilitado" BOOLEAN NOT NULL DEFAULT false;
