-- Limite configurable de stands por solicitud de reserva desde /dashboard/configuracion.
ALTER TABLE "portal_config" ADD COLUMN "max_stands_reserva" INTEGER NOT NULL DEFAULT 2;

ALTER TABLE "portal_config"
  ADD CONSTRAINT "portal_config_max_stands_reserva_check"
  CHECK ("max_stands_reserva" BETWEEN 1 AND 50);
