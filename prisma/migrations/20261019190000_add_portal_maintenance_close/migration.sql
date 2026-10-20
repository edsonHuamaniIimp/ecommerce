-- Permite configurar si el aviso de mantenimiento puede cerrarse.
ALTER TABLE "portal_config"
  ADD COLUMN "mantenimiento_permite_cerrar" BOOLEAN NOT NULL DEFAULT false;
