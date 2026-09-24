-- CreateTable
CREATE TABLE "solicitud_cuenta" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "apellidos" VARCHAR(200) NOT NULL,
    "telefono" VARCHAR(20),
    "razon_social" VARCHAR(200) NOT NULL,
    "ruc" VARCHAR(11),
    "cargo" VARCHAR(100),
    "mensaje" TEXT,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "motivo_rechazo" TEXT,
    "revisado_por" VARCHAR(200),
    "revisado_en" TIMESTAMP(3),
    "usuario_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitud_cuenta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitud_cuenta_email_idx" ON "solicitud_cuenta"("email");

-- CreateIndex
CREATE INDEX "solicitud_cuenta_estado_idx" ON "solicitud_cuenta"("estado");
