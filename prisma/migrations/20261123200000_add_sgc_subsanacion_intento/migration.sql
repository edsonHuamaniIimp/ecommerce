-- Bitacora de intentos de reenvio/subsanacion al SGC (exitos y errores).
-- Idempotente (IF NOT EXISTS) para tolerar un ambiente donde se cree a mano.
CREATE TABLE IF NOT EXISTS "sgc_subsanacion_intento" (
    "id" TEXT NOT NULL,
    "solicitud_id" TEXT NOT NULL,
    "origen" VARCHAR(20) NOT NULL,
    "actor" VARCHAR(200),
    "resultado" VARCHAR(20) NOT NULL,
    "http_status" INTEGER,
    "mensaje" VARCHAR(1000),
    "sgc_lifecycle" VARCHAR(20),
    "sgc_stage" VARCHAR(40),
    "requeridos" INTEGER,
    "cubiertos" INTEGER,
    "detalle" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sgc_subsanacion_intento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sgc_subsanacion_intento_solicitud_id_idx" ON "sgc_subsanacion_intento"("solicitud_id");
CREATE INDEX IF NOT EXISTS "sgc_subsanacion_intento_resultado_created_at_idx" ON "sgc_subsanacion_intento"("resultado", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sgc_subsanacion_intento_solicitud_id_fkey') THEN
    ALTER TABLE "sgc_subsanacion_intento"
      ADD CONSTRAINT "sgc_subsanacion_intento_solicitud_id_fkey"
      FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

COMMENT ON TABLE "sgc_subsanacion_intento" IS 'Bitacora de cada intento de solicitar una nueva revision al SGC (subsanacion): exitos y errores con el estado del expediente y lo que faltaba.';
COMMENT ON COLUMN "sgc_subsanacion_intento"."id" IS 'Identificador del intento (uuid).';
COMMENT ON COLUMN "sgc_subsanacion_intento"."solicitud_id" IS 'Solicitud de stand sobre la que se intento el reenvio.';
COMMENT ON COLUMN "sgc_subsanacion_intento"."origen" IS 'Quien lo ejecuto: cliente (Mis solicitudes) | admin (panel SGC).';
COMMENT ON COLUMN "sgc_subsanacion_intento"."actor" IS 'Correo del actor que pulso el reenvio.';
COMMENT ON COLUMN "sgc_subsanacion_intento"."resultado" IS 'exito | validacion (bloqueado por reglas locales) | error_sgc | error.';
COMMENT ON COLUMN "sgc_subsanacion_intento"."http_status" IS 'Codigo HTTP del error (409 local, 4xx/5xx del SGC); null en exito.';
COMMENT ON COLUMN "sgc_subsanacion_intento"."mensaje" IS 'Mensaje mostrado al cliente o devuelto por el SGC (sin secretos).';
COMMENT ON COLUMN "sgc_subsanacion_intento"."sgc_lifecycle" IS 'Ciclo de vida del expediente en el SGC al momento del intento.';
COMMENT ON COLUMN "sgc_subsanacion_intento"."sgc_stage" IS 'Etapa del expediente en el SGC al momento del intento.';
COMMENT ON COLUMN "sgc_subsanacion_intento"."requeridos" IS 'Archivos que pedia el SGC (estadoCorreccionSgc).';
COMMENT ON COLUMN "sgc_subsanacion_intento"."cubiertos" IS 'Archivos cubiertos al momento del intento.';
COMMENT ON COLUMN "sgc_subsanacion_intento"."detalle" IS 'Faltantes, observaciones abiertas y datos de diagnostico (JSON).';
COMMENT ON COLUMN "sgc_subsanacion_intento"."created_at" IS 'Fecha y hora del intento.';
