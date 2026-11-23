-- Solicitudes de factura programadas (solicitudes internas). Idempotente.
CREATE TABLE IF NOT EXISTS "facturacion_programada" (
    "id" TEXT NOT NULL,
    "solicitud_id" TEXT NOT NULL,
    "cuota_id" TEXT NOT NULL,
    "fecha_programada" TIMESTAMP(3) NOT NULL,
    "requisitos" JSONB NOT NULL,
    "archivos" JSONB NOT NULL DEFAULT '[]',
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "ultimo_error" VARCHAR(500),
    "ejecutada_at" TIMESTAMP(3),
    "created_by" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "facturacion_programada_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "facturacion_programada_estado_fecha_programada_idx" ON "facturacion_programada"("estado", "fecha_programada");
CREATE INDEX IF NOT EXISTS "facturacion_programada_solicitud_id_idx" ON "facturacion_programada"("solicitud_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facturacion_programada_solicitud_id_fkey') THEN
    ALTER TABLE "facturacion_programada"
      ADD CONSTRAINT "facturacion_programada_solicitud_id_fkey"
      FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMENT ON TABLE "facturacion_programada" IS 'Solicitud de factura programada para una solicitud interna: guarda requisitos y documentos y el cron la registra en la fecha configurada.';
COMMENT ON COLUMN "facturacion_programada"."id" IS 'Identificador de la tarea (uuid).';
COMMENT ON COLUMN "facturacion_programada"."solicitud_id" IS 'Solicitud de stand a la que pertenece la tarea.';
COMMENT ON COLUMN "facturacion_programada"."cuota_id" IS 'Cuota de origen de los requisitos y documentos.';
COMMENT ON COLUMN "facturacion_programada"."fecha_programada" IS 'Fecha y hora (UTC) desde la que el cron registra la solicitud de factura.';
COMMENT ON COLUMN "facturacion_programada"."requisitos" IS 'Requisitos de facturacion declarados (OC, HES, plataforma, valorizacion, otros, ninguna, descripcion).';
COMMENT ON COLUMN "facturacion_programada"."archivos" IS 'Documentos adjuntos de los requisitos (tipo, cuota, link, nombre).';
COMMENT ON COLUMN "facturacion_programada"."estado" IS 'pendiente | procesando | ejecutada | error | cancelada.';
COMMENT ON COLUMN "facturacion_programada"."ultimo_error" IS 'Motivo del ultimo intento fallido de ejecucion.';
COMMENT ON COLUMN "facturacion_programada"."ejecutada_at" IS 'Fecha y hora en que se registro la solicitud de factura.';
COMMENT ON COLUMN "facturacion_programada"."created_by" IS 'Usuario que configuro la fecha.';
COMMENT ON COLUMN "facturacion_programada"."created_at" IS 'Fecha de creacion.';
COMMENT ON COLUMN "facturacion_programada"."updated_at" IS 'Fecha de la ultima actualizacion.';
