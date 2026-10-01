-- Empresa exhibidora registrada por el backoffice (cuenta del Portal del Cliente).

-- CreateTable
CREATE TABLE "empresa" (
    "id" TEXT NOT NULL,
    "ruc" VARCHAR(11) NOT NULL,
    "razon_social" VARCHAR(200) NOT NULL,
    "nombre_comercial" VARCHAR(200),
    "direccion_fiscal" VARCHAR(250),
    "telefono" VARCHAR(30),
    "email_contacto" VARCHAR(200),
    "email_facturacion" VARCHAR(200),
    "representante_legal_nombre" VARCHAR(200),
    "representante_legal_dni" VARCHAR(15),
    "tipo_comprobante" VARCHAR(20) NOT NULL DEFAULT 'factura',
    "sitio_web" VARCHAR(200),
    "estado" VARCHAR(20) NOT NULL DEFAULT 'activa',
    "cuenta_creada" BOOLEAN NOT NULL DEFAULT false,
    "primer_acceso_completado" BOOLEAN NOT NULL DEFAULT false,
    "datos_validados_en" TIMESTAMP(3),
    "creado_por" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresa_ruc_key" ON "empresa"("ruc");

-- CreateIndex
CREATE INDEX "empresa_razon_social_idx" ON "empresa"("razon_social");

-- CreateIndex
CREATE INDEX "empresa_estado_idx" ON "empresa"("estado");
