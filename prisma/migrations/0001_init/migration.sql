-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "evento_padre" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "vertical" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evento_padre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento" (
    "id" TEXT NOT NULL,
    "evento_padre_id" TEXT NOT NULL,
    "tipo_evento" INTEGER NOT NULL,
    "codigo_evento" INTEGER NOT NULL,
    "anio" VARCHAR(4) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'active',
    "plano_ref" VARCHAR(255),
    "fecha_inicio" TIMESTAMP(3),
    "fecha_fin" TIMESTAMP(3),
    "imagen" VARCHAR(500),
    "flg_activo" BOOLEAN NOT NULL DEFAULT true,
    "flg_visible" BOOLEAN NOT NULL DEFAULT true,
    "plano" VARCHAR(50) NOT NULL DEFAULT 'gess',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipo_stand" (
    "id" TEXT NOT NULL,
    "evento_id" TEXT NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "medidas" VARCHAR(50),
    "monto_base" DOUBLE PRECISION NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipo_stand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_plantilla" (
    "id" TEXT NOT NULL,
    "tipo_stand_id" TEXT NOT NULL,
    "evento_id" TEXT,
    "nombre" VARCHAR(100) NOT NULL,
    "url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contrato_plantilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "descripcion" VARCHAR(200),
    "permisos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role" (
    "id" TEXT NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "role_id" TEXT NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "password" VARCHAR(100) NOT NULL DEFAULT '123456',

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stand" (
    "id" TEXT NOT NULL,
    "evento_id" TEXT NOT NULL,
    "tipo_stand_id" TEXT NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "estado" VARCHAR(20) NOT NULL DEFAULT 'disponible',
    "tipo_camara" VARCHAR(20),
    "numero_camara" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plano_posicion" (
    "id" TEXT NOT NULL,
    "stand_id" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "plano_posicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gess_stand" (
    "id" TEXT NOT NULL,
    "evento_id" TEXT NOT NULL,
    "stand_api_id" VARCHAR(50) NOT NULL,
    "stand_code" VARCHAR(50) NOT NULL,
    "tipo_stand" VARCHAR(100),
    "medidas" VARCHAR(100),
    "estado" VARCHAR(50),
    "empresa" VARCHAR(200),
    "pabellon" VARCHAR(50),
    "ubicacion" VARCHAR(100),
    "raw_data" JSONB,
    "bloque_id" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gess_stand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reserva" (
    "id" TEXT NOT NULL,
    "evento_id" TEXT NOT NULL,
    "empresa_ref" VARCHAR(100) NOT NULL,
    "tipo_comprobante" VARCHAR(20) NOT NULL,
    "datos_facturacion" JSONB NOT NULL,
    "responsable_pago" JSONB,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'registrada',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reserva_stand" (
    "id" TEXT NOT NULL,
    "reserva_id" TEXT NOT NULL,
    "stand_id" TEXT NOT NULL,
    "tipo_stand" VARCHAR(50) NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'USD',

    CONSTRAINT "reserva_stand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuota" (
    "id" TEXT NOT NULL,
    "reserva_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "porcentaje" DOUBLE PRECISION NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "fecha_pago" TIMESTAMP(3),

    CONSTRAINT "cuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aprobacion" (
    "id" TEXT NOT NULL,
    "reserva_id" TEXT NOT NULL,
    "area" VARCHAR(20) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "responsable" VARCHAR(100),
    "comentario" TEXT,
    "fecha" TIMESTAMP(3),

    CONSTRAINT "aprobacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interop_facturacion" (
    "id" TEXT NOT NULL,
    "reserva_id" TEXT NOT NULL,
    "orden_venta" VARCHAR(50),
    "comprobante" VARCHAR(50),
    "estado" VARCHAR(20) NOT NULL DEFAULT 'enviado',
    "request_ref" JSONB,
    "response_ref" JSONB,

    CONSTRAINT "interop_facturacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "entidad" VARCHAR(100),
    "actor" VARCHAR(100),
    "mensaje" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evento_padre_codigo_key" ON "evento_padre"("codigo");

-- CreateIndex
CREATE INDEX "evento_evento_padre_id_idx" ON "evento"("evento_padre_id");

-- CreateIndex
CREATE INDEX "evento_estado_idx" ON "evento"("estado");

-- CreateIndex
CREATE INDEX "tipo_stand_evento_id_idx" ON "tipo_stand"("evento_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_nombre_key" ON "role"("nombre");

-- CreateIndex
CREATE INDEX "user_role_user_id_idx" ON "user_role"("user_id");

-- CreateIndex
CREATE INDEX "user_role_email_idx" ON "user_role"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_user_id_role_id_key" ON "user_role"("user_id", "role_id");

-- CreateIndex
CREATE INDEX "stand_evento_id_estado_idx" ON "stand"("evento_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "plano_posicion_stand_id_key" ON "plano_posicion"("stand_id");

-- CreateIndex
CREATE INDEX "gess_stand_evento_id_idx" ON "gess_stand"("evento_id");

-- CreateIndex
CREATE INDEX "gess_stand_bloque_id_idx" ON "gess_stand"("bloque_id");

-- CreateIndex
CREATE UNIQUE INDEX "gess_stand_evento_id_stand_api_id_key" ON "gess_stand"("evento_id", "stand_api_id");

-- CreateIndex
CREATE INDEX "reserva_evento_id_idx" ON "reserva"("evento_id");

-- CreateIndex
CREATE INDEX "reserva_estado_idx" ON "reserva"("estado");

-- CreateIndex
CREATE INDEX "reserva_empresa_ref_idx" ON "reserva"("empresa_ref");

-- CreateIndex
CREATE INDEX "reserva_stand_reserva_id_idx" ON "reserva_stand"("reserva_id");

-- CreateIndex
CREATE INDEX "reserva_stand_stand_id_idx" ON "reserva_stand"("stand_id");

-- CreateIndex
CREATE INDEX "cuota_reserva_id_idx" ON "cuota"("reserva_id");

-- CreateIndex
CREATE INDEX "aprobacion_reserva_id_idx" ON "aprobacion"("reserva_id");

-- CreateIndex
CREATE UNIQUE INDEX "interop_facturacion_reserva_id_key" ON "interop_facturacion"("reserva_id");

-- CreateIndex
CREATE INDEX "audit_log_tipo_idx" ON "audit_log"("tipo");

-- CreateIndex
CREATE INDEX "audit_log_entidad_idx" ON "audit_log"("entidad");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- AddForeignKey
ALTER TABLE "evento" ADD CONSTRAINT "evento_evento_padre_id_fkey" FOREIGN KEY ("evento_padre_id") REFERENCES "evento_padre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipo_stand" ADD CONSTRAINT "tipo_stand_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_plantilla" ADD CONSTRAINT "contrato_plantilla_tipo_stand_id_fkey" FOREIGN KEY ("tipo_stand_id") REFERENCES "tipo_stand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_plantilla" ADD CONSTRAINT "contrato_plantilla_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stand" ADD CONSTRAINT "stand_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stand" ADD CONSTRAINT "stand_tipo_stand_id_fkey" FOREIGN KEY ("tipo_stand_id") REFERENCES "tipo_stand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_posicion" ADD CONSTRAINT "plano_posicion_stand_id_fkey" FOREIGN KEY ("stand_id") REFERENCES "stand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gess_stand" ADD CONSTRAINT "gess_stand_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva_stand" ADD CONSTRAINT "reserva_stand_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva_stand" ADD CONSTRAINT "reserva_stand_stand_id_fkey" FOREIGN KEY ("stand_id") REFERENCES "stand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuota" ADD CONSTRAINT "cuota_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprobacion" ADD CONSTRAINT "aprobacion_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interop_facturacion" ADD CONSTRAINT "interop_facturacion_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
