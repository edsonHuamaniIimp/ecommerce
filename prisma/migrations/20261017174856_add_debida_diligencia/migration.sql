-- CreateTable
CREATE TABLE "debida_diligencia" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "evento_id" TEXT NOT NULL,
    "codigo" VARCHAR(30) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'borrador',
    "tipo_relacion_comercial" VARCHAR(40),
    "actividad_economica" VARCHAR(120),
    "actividad_economica_otro" VARCHAR(200),
    "sitio_web" VARCHAR(200),
    "email_representante" VARCHAR(200),
    "acepta_datos" BOOLEAN NOT NULL DEFAULT false,
    "acepta_verificacion" BOOLEAN NOT NULL DEFAULT false,
    "declara_verdad" BOOLEAN NOT NULL DEFAULT false,
    "representante_nombre" VARCHAR(200),
    "representante_tipo_documento" VARCHAR(30),
    "representante_documento" VARCHAR(20),
    "representante_nacionalidad" VARCHAR(80),
    "fecha_envio" TIMESTAMP(3),
    "fecha_revision" TIMESTAMP(3),
    "fecha_aprobacion" TIMESTAMP(3),
    "fecha_vencimiento" TIMESTAMP(3),
    "fecha_rechazo" TIMESTAMP(3),
    "revisado_por" VARCHAR(200),
    "motivo_rechazo" VARCHAR(1000),
    "creado_por" VARCHAR(200) NOT NULL,
    "actualizado_por" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debida_diligencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debida_diligencia_beneficiario" (
    "id" TEXT NOT NULL,
    "expediente_id" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "nombre" VARCHAR(200) NOT NULL,
    "documento" VARCHAR(30) NOT NULL,
    "nacionalidad" VARCHAR(80) NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debida_diligencia_beneficiario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debida_diligencia_documento" (
    "id" TEXT NOT NULL,
    "expediente_id" TEXT NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "nombre" VARCHAR(250) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'cargado',
    "observacion" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debida_diligencia_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debida_diligencia_observacion" (
    "id" TEXT NOT NULL,
    "expediente_id" TEXT NOT NULL,
    "area" VARCHAR(30) NOT NULL,
    "documento_tipo" VARCHAR(40),
    "texto" VARCHAR(1000) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'abierta',
    "creado_por" VARCHAR(200) NOT NULL,
    "fecha_resolucion" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debida_diligencia_observacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debida_diligencia_reputacion" (
    "id" TEXT NOT NULL,
    "expediente_id" TEXT NOT NULL,
    "nombre_a_revisar" VARCHAR(200) NOT NULL,
    "sitio_web" VARCHAR(200),
    "estado" VARCHAR(30) NOT NULL DEFAULT 'por_revisar',
    "resultado" VARCHAR(30),
    "comentario" VARCHAR(1500),
    "derivado_por" VARCHAR(200) NOT NULL,
    "fecha_derivacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisor" VARCHAR(200),
    "fecha_cierre" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debida_diligencia_reputacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "debida_diligencia_codigo_key" ON "debida_diligencia"("codigo");

-- CreateIndex
CREATE INDEX "debida_diligencia_evento_id_estado_idx" ON "debida_diligencia"("evento_id", "estado");

-- CreateIndex
CREATE INDEX "debida_diligencia_fecha_vencimiento_idx" ON "debida_diligencia"("fecha_vencimiento");

-- CreateIndex
CREATE INDEX "debida_diligencia_codigo_idx" ON "debida_diligencia"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "debida_diligencia_empresa_id_evento_id_key" ON "debida_diligencia"("empresa_id", "evento_id");

-- CreateIndex
CREATE INDEX "debida_diligencia_beneficiario_expediente_id_idx" ON "debida_diligencia_beneficiario"("expediente_id");

-- CreateIndex
CREATE INDEX "debida_diligencia_documento_expediente_id_idx" ON "debida_diligencia_documento"("expediente_id");

-- CreateIndex
CREATE UNIQUE INDEX "debida_diligencia_documento_expediente_id_tipo_key" ON "debida_diligencia_documento"("expediente_id", "tipo");

-- CreateIndex
CREATE INDEX "debida_diligencia_observacion_expediente_id_estado_idx" ON "debida_diligencia_observacion"("expediente_id", "estado");

-- CreateIndex
CREATE INDEX "debida_diligencia_reputacion_expediente_id_idx" ON "debida_diligencia_reputacion"("expediente_id");

-- CreateIndex
CREATE INDEX "debida_diligencia_reputacion_estado_idx" ON "debida_diligencia_reputacion"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "debida_diligencia_reputacion_expediente_id_nombre_a_revisar_key" ON "debida_diligencia_reputacion"("expediente_id", "nombre_a_revisar");

-- AddForeignKey
ALTER TABLE "debida_diligencia" ADD CONSTRAINT "debida_diligencia_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debida_diligencia" ADD CONSTRAINT "debida_diligencia_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debida_diligencia_beneficiario" ADD CONSTRAINT "debida_diligencia_beneficiario_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "debida_diligencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debida_diligencia_documento" ADD CONSTRAINT "debida_diligencia_documento_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "debida_diligencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debida_diligencia_observacion" ADD CONSTRAINT "debida_diligencia_observacion_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "debida_diligencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debida_diligencia_reputacion" ADD CONSTRAINT "debida_diligencia_reputacion_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "debida_diligencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
