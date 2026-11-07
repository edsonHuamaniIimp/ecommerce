-- DD V2: relacion comercial (unidad de resultado), tipo de vinculo de personas y evidencias.
-- Migracion aditiva: no modifica ni elimina columnas ni tablas existentes.

-- AlterTable: rol de la persona vinculada (DD_TIPOS_VINCULO_PERSONA)
ALTER TABLE "debida_diligencia_beneficiario"
  ADD COLUMN "tipo_vinculo_persona" VARCHAR(40);

-- AlterTable: relacion comercial V2 en la matriz
ALTER TABLE "dd_matriz_vinculo"
  ADD COLUMN "relacion_comercial_id" TEXT;

-- CreateTable: relacion comercial (unidad de resultado, vigencia y plazo)
CREATE TABLE "dd_relacion_comercial" (
    "id" TEXT NOT NULL,
    "debida_diligencia_id" TEXT NOT NULL,
    "tipo_relacion" VARCHAR(40) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "resultado_final" VARCHAR(30),
    "fecha_decision" TIMESTAMP(3),
    "vigencia_hasta" TIMESTAMP(3),
    "plazo_vence" TIMESTAMP(3),
    "informe_logistica_url" VARCHAR(500),
    "informe_legal_url" VARCHAR(500),
    "observaciones" VARCHAR(1000),
    "creado_por" VARCHAR(200) NOT NULL,
    "actualizado_por" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dd_relacion_comercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable: evidencia por campo evaluado (archivo y/o link)
CREATE TABLE "dd_evidencia" (
    "id" TEXT NOT NULL,
    "relacion_comercial_id" TEXT NOT NULL,
    "matriz_vinculo_id" TEXT,
    "area" VARCHAR(20) NOT NULL,
    "campo" VARCHAR(80) NOT NULL,
    "resultado" VARCHAR(20),
    "archivo_url" VARCHAR(500),
    "link_externo" VARCHAR(500),
    "comentario" VARCHAR(1000),
    "creado_por" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dd_evidencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dd_relacion_comercial_debida_diligencia_id_tipo_relacion_key" ON "dd_relacion_comercial"("debida_diligencia_id", "tipo_relacion");
CREATE INDEX "dd_relacion_comercial_debida_diligencia_id_idx" ON "dd_relacion_comercial"("debida_diligencia_id");
CREATE INDEX "dd_relacion_comercial_estado_idx" ON "dd_relacion_comercial"("estado");
CREATE INDEX "dd_relacion_comercial_resultado_final_idx" ON "dd_relacion_comercial"("resultado_final");
CREATE INDEX "dd_relacion_comercial_vigencia_hasta_idx" ON "dd_relacion_comercial"("vigencia_hasta");
CREATE INDEX "dd_evidencia_relacion_comercial_id_area_idx" ON "dd_evidencia"("relacion_comercial_id", "area");
CREATE INDEX "dd_evidencia_matriz_vinculo_id_idx" ON "dd_evidencia"("matriz_vinculo_id");
CREATE INDEX "dd_matriz_vinculo_relacion_comercial_id_idx" ON "dd_matriz_vinculo"("relacion_comercial_id");

-- AddForeignKey
ALTER TABLE "dd_relacion_comercial" ADD CONSTRAINT "dd_relacion_comercial_debida_diligencia_id_fkey" FOREIGN KEY ("debida_diligencia_id") REFERENCES "debida_diligencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dd_matriz_vinculo" ADD CONSTRAINT "dd_matriz_vinculo_relacion_comercial_id_fkey" FOREIGN KEY ("relacion_comercial_id") REFERENCES "dd_relacion_comercial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dd_evidencia" ADD CONSTRAINT "dd_evidencia_relacion_comercial_id_fkey" FOREIGN KEY ("relacion_comercial_id") REFERENCES "dd_relacion_comercial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dd_evidencia" ADD CONSTRAINT "dd_evidencia_matriz_vinculo_id_fkey" FOREIGN KEY ("matriz_vinculo_id") REFERENCES "dd_matriz_vinculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
