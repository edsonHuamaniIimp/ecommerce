-- La importacion de resultados alimenta directamente la DD interna.
-- La tabla externa anterior queda fuera de la bandeja; se conserva temporalmente
-- para auditoria hasta completar la verificacion de la migracion.

CREATE TABLE "dd_importacion" (
  "id" TEXT NOT NULL,
  "archivo" VARCHAR(255) NOT NULL,
  "hash" VARCHAR(64) NOT NULL,
  "evento_id" TEXT NOT NULL,
  "usuario" VARCHAR(200) NOT NULL,
  "total" INTEGER NOT NULL,
  "importados" INTEGER NOT NULL DEFAULT 0,
  "actualizados" INTEGER NOT NULL DEFAULT 0,
  "omitidos" INTEGER NOT NULL DEFAULT 0,
  "errores" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dd_importacion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "debida_diligencia" ADD COLUMN "origen" VARCHAR(20) NOT NULL DEFAULT 'flujo_regular';
ALTER TABLE "debida_diligencia" ADD COLUMN "estado_origen" VARCHAR(80);
ALTER TABLE "debida_diligencia" ADD COLUMN "evento_proyecto" VARCHAR(120);
ALTER TABLE "debida_diligencia" ADD COLUMN "motivo_importacion" VARCHAR(250);
ALTER TABLE "debida_diligencia" ADD COLUMN "importacion_id" TEXT;

CREATE INDEX "dd_importacion_evento_id_idx" ON "dd_importacion"("evento_id");
CREATE INDEX "dd_importacion_created_at_idx" ON "dd_importacion"("created_at");
CREATE INDEX "debida_diligencia_origen_idx" ON "debida_diligencia"("origen");
CREATE INDEX "debida_diligencia_importacion_id_idx" ON "debida_diligencia"("importacion_id");

ALTER TABLE "debida_diligencia"
  ADD CONSTRAINT "debida_diligencia_importacion_id_fkey"
  FOREIGN KEY ("importacion_id") REFERENCES "dd_importacion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
