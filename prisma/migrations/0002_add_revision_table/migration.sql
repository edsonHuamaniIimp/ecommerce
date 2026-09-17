-- Migracion 0002: crea las tablas que faltaban respecto a schema.prisma
-- (solicitud, revision, revision_historial, reevaluacion, facturacion, planos, maestra, ...)
-- Generada con: prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
-- Nota: el archivo original estaba corrupto (contenia la salida de error de un comando).

-- AlterTable
ALTER TABLE "gess_stand" ADD COLUMN     "documentos" JSONB DEFAULT '[]',
ADD COLUMN     "email" VARCHAR(200),
ADD COLUMN     "imagenes" JSONB DEFAULT '[]',
ADD COLUMN     "user_id" VARCHAR(100);

-- AlterTable
ALTER TABLE "user_role" ADD COLUMN     "apellidos" VARCHAR(200),
ADD COLUMN     "id_empresa" VARCHAR(50),
ADD COLUMN     "nombre" VARCHAR(200),
ADD COLUMN     "nombre_empresa" VARCHAR(200),
ADD COLUMN     "reset_token" VARCHAR(200),
ADD COLUMN     "reset_token_expires" TIMESTAMP(3),
ADD COLUMN     "telefono" VARCHAR(20),
ADD COLUMN     "tipo_usuario_id" INTEGER;

-- CreateTable
CREATE TABLE "evento_metadata" (
    "tipo_evento" INTEGER NOT NULL,
    "codigo_evento" INTEGER NOT NULL,
    "plano" VARCHAR(50),
    "flg_visible" BOOLEAN NOT NULL DEFAULT false,
    "imagen" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evento_metadata_pkey" PRIMARY KEY ("tipo_evento","codigo_evento")
);

-- CreateTable
CREATE TABLE "solicitud" (
    "id" TEXT NOT NULL,
    "gess_stand_id" TEXT,
    "user_id" VARCHAR(100),
    "email" VARCHAR(200),
    "documentos" JSONB DEFAULT '[]',
    "flg_activo" BOOLEAN NOT NULL DEFAULT true,
    "estado" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision" (
    "id" TEXT NOT NULL,
    "solicitud_id" TEXT NOT NULL,
    "area" VARCHAR(20) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "comentario" TEXT,
    "created_by" VARCHAR(100),
    "updated_by" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_historial" (
    "id" TEXT NOT NULL,
    "solicitud_id" TEXT NOT NULL,
    "area" VARCHAR(20) NOT NULL,
    "estado_anterior" VARCHAR(20) NOT NULL,
    "comentario_anterior" TEXT,
    "motivo" VARCHAR(500) NOT NULL,
    "created_by" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_historial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reevaluacion" (
    "id" TEXT NOT NULL,
    "solicitud_id" TEXT NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "motivo" VARCHAR(1000),
    "documentos" JSONB DEFAULT '[]',
    "created_by" VARCHAR(100),
    "updated_by" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reevaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_log" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "digest" TEXT,
    "url" TEXT,
    "user_id" VARCHAR(100),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturacion" (
    "id" TEXT NOT NULL,
    "solicitud_id" TEXT NOT NULL,
    "tipo" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "monto_total" DECIMAL(12,2) NOT NULL,
    "moneda" VARCHAR(5) NOT NULL DEFAULT 'US$',
    "modo_pago" VARCHAR(10) NOT NULL DEFAULT 'cuotas',
    "created_by" VARCHAR(100),
    "flg_activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facturacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturacion_cuota" (
    "id" TEXT NOT NULL,
    "facturacion_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "fecha_vencimiento" TIMESTAMP(3),
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "comprobante" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facturacion_cuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturacion_historial" (
    "id" TEXT NOT NULL,
    "facturacion_id" TEXT NOT NULL,
    "accion" VARCHAR(20) NOT NULL,
    "detalle" VARCHAR(500) NOT NULL,
    "metadata" JSONB,
    "created_by" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facturacion_historial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerta" (
    "id" TEXT NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "mensaje" VARCHAR(1000) NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "url" VARCHAR(500),
    "solicitud_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_documento" (
    "id" TEXT NOT NULL,
    "solicitud_id" TEXT NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "uploaded_by" VARCHAR(100),
    "user_id" VARCHAR(100),
    "flg_activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitud_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_stand" (
    "id" TEXT NOT NULL,
    "solicitud_id" TEXT NOT NULL,
    "gess_stand_id" TEXT NOT NULL,

    CONSTRAINT "solicitud_stand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maestra" (
    "id" SERIAL NOT NULL,
    "nid_maestra_padre" INTEGER NOT NULL DEFAULT 0,
    "tabla" VARCHAR(100) NOT NULL,
    "item_id" INTEGER,
    "num_orden" INTEGER NOT NULL DEFAULT 0,
    "nombre" VARCHAR(250) NOT NULL,
    "descripcion" VARCHAR(500),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maestra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plano" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(300),
    "tipo" VARCHAR(10) NOT NULL DEFAULT 'simple',
    "imagen_fondo" VARCHAR(500),
    "config" JSONB,
    "flg_activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plano_seccion" (
    "id" TEXT NOT NULL,
    "plano_id" TEXT NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "w" REAL NOT NULL,
    "h" REAL NOT NULL,
    "rotacion" REAL NOT NULL DEFAULT 0,
    "color" VARCHAR(10) NOT NULL DEFAULT '#3b82f6',
    "plano_hijo_id" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plano_seccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plano_tipo_bloque" (
    "id" TEXT NOT NULL,
    "plano_id" TEXT NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "label" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "w" REAL NOT NULL,
    "d" REAL NOT NULL,
    "h" REAL NOT NULL,
    "color" VARCHAR(10) NOT NULL,

    CONSTRAINT "plano_tipo_bloque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plano_bloque" (
    "id" TEXT NOT NULL,
    "plano_id" TEXT NOT NULL,
    "tipo_id" TEXT,
    "bloqueId" VARCHAR(50) NOT NULL,
    "tipoCodigo" VARCHAR(20) NOT NULL,
    "tipologia" VARCHAR(1),
    "x" REAL NOT NULL,
    "z" REAL NOT NULL,
    "rot_y" REAL NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "flg_activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plano_bloque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plano_furniture" (
    "id" TEXT NOT NULL,
    "plano_id" TEXT NOT NULL,
    "ref_id" VARCHAR(50) NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "x" REAL NOT NULL,
    "z" REAL NOT NULL,
    "rot_y" REAL NOT NULL DEFAULT 0,
    "config" JSONB,

    CONSTRAINT "plano_furniture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitud_gess_stand_id_idx" ON "solicitud"("gess_stand_id");

-- CreateIndex
CREATE UNIQUE INDEX "revision_solicitud_id_area_key" ON "revision"("solicitud_id", "area");

-- CreateIndex
CREATE INDEX "revision_historial_solicitud_id_idx" ON "revision_historial"("solicitud_id");

-- CreateIndex
CREATE INDEX "revision_historial_solicitud_id_area_idx" ON "revision_historial"("solicitud_id", "area");

-- CreateIndex
CREATE INDEX "revision_historial_created_at_idx" ON "revision_historial"("created_at");

-- CreateIndex
CREATE INDEX "reevaluacion_solicitud_id_idx" ON "reevaluacion"("solicitud_id");

-- CreateIndex
CREATE INDEX "reevaluacion_estado_idx" ON "reevaluacion"("estado");

-- CreateIndex
CREATE INDEX "error_log_created_at_idx" ON "error_log"("created_at");

-- CreateIndex
CREATE INDEX "facturacion_solicitud_id_idx" ON "facturacion"("solicitud_id");

-- CreateIndex
CREATE INDEX "facturacion_estado_idx" ON "facturacion"("estado");

-- CreateIndex
CREATE INDEX "facturacion_cuota_facturacion_id_idx" ON "facturacion_cuota"("facturacion_id");

-- CreateIndex
CREATE INDEX "facturacion_historial_facturacion_id_idx" ON "facturacion_historial"("facturacion_id");

-- CreateIndex
CREATE INDEX "facturacion_historial_created_at_idx" ON "facturacion_historial"("created_at");

-- CreateIndex
CREATE INDEX "alerta_user_id_idx" ON "alerta"("user_id");

-- CreateIndex
CREATE INDEX "alerta_user_id_leida_idx" ON "alerta"("user_id", "leida");

-- CreateIndex
CREATE INDEX "alerta_created_at_idx" ON "alerta"("created_at");

-- CreateIndex
CREATE INDEX "solicitud_documento_solicitud_id_idx" ON "solicitud_documento"("solicitud_id");

-- CreateIndex
CREATE INDEX "solicitud_stand_solicitud_id_idx" ON "solicitud_stand"("solicitud_id");

-- CreateIndex
CREATE INDEX "solicitud_stand_gess_stand_id_idx" ON "solicitud_stand"("gess_stand_id");

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_stand_solicitud_id_gess_stand_id_key" ON "solicitud_stand"("solicitud_id", "gess_stand_id");

-- CreateIndex
CREATE INDEX "maestra_tabla_idx" ON "maestra"("tabla");

-- CreateIndex
CREATE INDEX "maestra_nid_maestra_padre_idx" ON "maestra"("nid_maestra_padre");

-- CreateIndex
CREATE UNIQUE INDEX "plano_codigo_key" ON "plano"("codigo");

-- CreateIndex
CREATE INDEX "plano_seccion_plano_id_idx" ON "plano_seccion"("plano_id");

-- CreateIndex
CREATE UNIQUE INDEX "plano_seccion_plano_id_codigo_key" ON "plano_seccion"("plano_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "plano_tipo_bloque_plano_id_codigo_key" ON "plano_tipo_bloque"("plano_id", "codigo");

-- CreateIndex
CREATE INDEX "plano_bloque_plano_id_idx" ON "plano_bloque"("plano_id");

-- CreateIndex
CREATE UNIQUE INDEX "plano_bloque_plano_id_bloqueId_key" ON "plano_bloque"("plano_id", "bloqueId");

-- CreateIndex
CREATE INDEX "plano_furniture_plano_id_idx" ON "plano_furniture"("plano_id");

-- CreateIndex
CREATE UNIQUE INDEX "plano_furniture_plano_id_ref_id_key" ON "plano_furniture"("plano_id", "ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "evento_tipo_evento_codigo_evento_key" ON "evento"("tipo_evento", "codigo_evento");

-- CreateIndex
CREATE UNIQUE INDEX "gess_stand_evento_id_stand_code_key" ON "gess_stand"("evento_id", "stand_code");

-- CreateIndex
CREATE UNIQUE INDEX "gess_stand_evento_id_bloque_id_key" ON "gess_stand"("evento_id", "bloque_id");

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_gess_stand_id_fkey" FOREIGN KEY ("gess_stand_id") REFERENCES "gess_stand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision" ADD CONSTRAINT "revision_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reevaluacion" ADD CONSTRAINT "reevaluacion_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturacion" ADD CONSTRAINT "facturacion_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturacion_cuota" ADD CONSTRAINT "facturacion_cuota_facturacion_id_fkey" FOREIGN KEY ("facturacion_id") REFERENCES "facturacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_documento" ADD CONSTRAINT "solicitud_documento_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_stand" ADD CONSTRAINT "solicitud_stand_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_stand" ADD CONSTRAINT "solicitud_stand_gess_stand_id_fkey" FOREIGN KEY ("gess_stand_id") REFERENCES "gess_stand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_seccion" ADD CONSTRAINT "plano_seccion_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "plano"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_tipo_bloque" ADD CONSTRAINT "plano_tipo_bloque_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "plano"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_bloque" ADD CONSTRAINT "plano_bloque_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "plano"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_bloque" ADD CONSTRAINT "plano_bloque_tipo_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "plano_tipo_bloque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_furniture" ADD CONSTRAINT "plano_furniture_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "plano"("id") ON DELETE CASCADE ON UPDATE CASCADE;
