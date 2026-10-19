-- Duracion configurable del bloqueo temporal de stands desde /dashboard/configuracion.
ALTER TABLE "portal_config"
  ADD COLUMN "hold_reserva_minutos" INTEGER NOT NULL DEFAULT 25;
