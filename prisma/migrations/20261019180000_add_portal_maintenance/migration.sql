-- Ventana de mantenimiento configurable desde /dashboard/configuracion.
ALTER TABLE "portal_config"
  ADD COLUMN "mantenimiento_activo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mantenimiento_inicio" TIMESTAMP(3),
  ADD COLUMN "mantenimiento_fin" TIMESTAMP(3);
