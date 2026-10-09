-- CreateTable
CREATE TABLE "portal_config" (
    "id" VARCHAR(20) NOT NULL DEFAULT 'default',
    "mesa_ayuda_email" VARCHAR(200),
    "contacto_email" VARCHAR(200),
    "manual_url" VARCHAR(500),
    "reglamento_url" VARCHAR(500),
    "updated_by" VARCHAR(200),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_config_pkey" PRIMARY KEY ("id")
);
