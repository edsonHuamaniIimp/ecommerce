CREATE TABLE "debida_diligencia_documento_version" (
    "id" TEXT NOT NULL,
    "documento_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "nombre" VARCHAR(250) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "creado_por" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debida_diligencia_documento_version_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "debida_diligencia_documento_version_documento_id_version_key" ON "debida_diligencia_documento_version"("documento_id", "version");

CREATE INDEX "debida_diligencia_documento_version_documento_id_idx" ON "debida_diligencia_documento_version"("documento_id");

ALTER TABLE "debida_diligencia_documento_version" ADD CONSTRAINT "debida_diligencia_documento_version_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "debida_diligencia_documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;