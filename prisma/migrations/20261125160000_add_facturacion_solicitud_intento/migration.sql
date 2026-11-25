-- Bitacora de solicitudes de factura que fallaron al registrarse en el SIE.
-- Guarda lo declarado (requisitos, documentos) y el payload enviado. Idempotente.
CREATE TABLE IF NOT EXISTS "facturacion_solicitud_intento" (
    "id" TEXT NOT NULL,
    "solicitud_id" TEXT NOT NULL,
    "cuota_id" TEXT NOT NULL,
    "origen" VARCHAR(20) NOT NULL,
    "actor" VARCHAR(200),
    "resultado" VARCHAR(20) NOT NULL,
    "http_status" INTEGER,
    "mensaje" VARCHAR(1000),
    "identificador_sie" VARCHAR(40),
    "requisitos" JSONB,
    "archivos" JSONB,
    "payload" JSONB,
    "respuesta_sie" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "facturacion_solicitud_intento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "facturacion_solicitud_intento_solicitud_id_idx" ON "facturacion_solicitud_intento"("solicitud_id");
CREATE INDEX IF NOT EXISTS "facturacion_solicitud_intento_created_at_idx" ON "facturacion_solicitud_intento"("created_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facturacion_solicitud_intento_solicitud_id_fkey') THEN
    ALTER TABLE "facturacion_solicitud_intento"
      ADD CONSTRAINT "facturacion_solicitud_intento_solicitud_id_fkey"
      FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

COMMENT ON TABLE "facturacion_solicitud_intento" IS 'Bitacora de solicitudes de factura que fallaron al registrarse en el SIE: lo declarado por el usuario y el payload enviado.';
COMMENT ON COLUMN "facturacion_solicitud_intento"."id" IS 'Identificador del intento (uuid).';
COMMENT ON COLUMN "facturacion_solicitud_intento"."solicitud_id" IS 'Solicitud de stand sobre la que se intento registrar la factura.';
COMMENT ON COLUMN "facturacion_solicitud_intento"."cuota_id" IS 'Cuota desde la que se pidio la factura.';
COMMENT ON COLUMN "facturacion_solicitud_intento"."origen" IS 'Quien la disparo: cliente | staff | programada.';
COMMENT ON COLUMN "facturacion_solicitud_intento"."actor" IS 'Correo del usuario que pulso el envio (cliente o staff).';
COMMENT ON COLUMN "facturacion_solicitud_intento"."resultado" IS 'error_sie (el SIE rechazo o no respondio) | error_posterior (el SIE registro pero fallo el guardado local).';
COMMENT ON COLUMN "facturacion_solicitud_intento"."http_status" IS 'Codigo HTTP de la respuesta del SIE.';
COMMENT ON COLUMN "facturacion_solicitud_intento"."mensaje" IS 'Mensaje de error mostrado al usuario.';
COMMENT ON COLUMN "facturacion_solicitud_intento"."identificador_sie" IS 'Codigo identificador del SIE (500) para ubicar la llamada en sus logs.';
COMMENT ON COLUMN "facturacion_solicitud_intento"."requisitos" IS 'Requisitos de facturacion declarados por el usuario.';
COMMENT ON COLUMN "facturacion_solicitud_intento"."archivos" IS 'Documentos (OC, HES, etc.) que el usuario adjunto.';
COMMENT ON COLUMN "facturacion_solicitud_intento"."payload" IS 'Payload exacto enviado al SIE.';
COMMENT ON COLUMN "facturacion_solicitud_intento"."respuesta_sie" IS 'Cuerpo de la respuesta del SIE.';
COMMENT ON COLUMN "facturacion_solicitud_intento"."created_at" IS 'Fecha y hora del intento fallido.';
