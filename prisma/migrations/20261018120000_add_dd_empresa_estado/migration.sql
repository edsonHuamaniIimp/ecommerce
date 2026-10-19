CREATE TABLE "debida_diligencia_empresa_estado" (
    "id" TEXT NOT NULL,
    "documento" VARCHAR(50) NOT NULL,
    "razon_social" VARCHAR(250) NOT NULL,
    "tipo_documento" VARCHAR(20) NOT NULL,
    "motivo_evaluacion" VARCHAR(250),
    "evento_proyecto" VARCHAR(120),
    "resultado" VARCHAR(30) NOT NULL,
    "estado_origen" VARCHAR(80) NOT NULL,
    "fecha_ingreso" TIMESTAMP(3),
    "fecha_revision" TIMESTAMP(3),
    "fecha_vencimiento" TIMESTAMP(3),
    "origen" VARCHAR(40) NOT NULL DEFAULT 'excel_dd',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debida_diligencia_empresa_estado_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "debida_diligencia_empresa_estado_documento_key" ON "debida_diligencia_empresa_estado"("documento");
CREATE INDEX "debida_diligencia_empresa_estado_resultado_idx" ON "debida_diligencia_empresa_estado"("resultado");
CREATE INDEX "debida_diligencia_empresa_estado_fecha_vencimiento_idx" ON "debida_diligencia_empresa_estado"("fecha_vencimiento");
CREATE INDEX "debida_diligencia_empresa_estado_razon_social_idx" ON "debida_diligencia_empresa_estado"("razon_social");