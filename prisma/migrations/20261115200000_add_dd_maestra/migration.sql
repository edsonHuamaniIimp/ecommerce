-- Catalogo maestro de estados y resultados de Debida Diligencia.
-- Los codigos siguen siendo canonicos en el codigo; esta tabla administra
-- etiqueta, orden, disponibilidad y metadatos del catalogo.

CREATE TABLE "dd_maestra" (
  "id" SERIAL NOT NULL,
  "tipo" VARCHAR(50) NOT NULL,
  "codigo" VARCHAR(60) NOT NULL,
  "nombre" VARCHAR(150) NOT NULL,
  "descripcion" VARCHAR(500),
  "orden" INTEGER NOT NULL DEFAULT 0,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "dd_maestra_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dd_maestra_tipo_codigo_key"
  ON "dd_maestra" ("tipo", "codigo");

CREATE INDEX "dd_maestra_tipo_activo_orden_idx"
  ON "dd_maestra" ("tipo", "activo", "orden");
