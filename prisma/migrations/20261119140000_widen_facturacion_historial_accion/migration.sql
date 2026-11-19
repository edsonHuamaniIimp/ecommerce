-- Amplia las acciones del historial de facturacion para notificar_recordatorio.
ALTER TABLE "facturacion_historial" ALTER COLUMN "accion" TYPE VARCHAR(30);
