-- CreateTable
CREATE TABLE "sgc_expediente" (
    "id" TEXT NOT NULL,
    "solicitud_id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "contract_id" VARCHAR(64),
    "estado_envio" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "stage" VARCHAR(40),
    "lifecycle_status" VARCHAR(20),
    "version" INTEGER,
    "area_code" VARCHAR(40) NOT NULL,
    "contract_type_code" VARCHAR(40) NOT NULL,
    "last_synced_at" TIMESTAMP(3),
    "last_error" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sgc_expediente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgc_documento" (
    "id" TEXT NOT NULL,
    "sgc_expediente_id" TEXT NOT NULL,
    "document_id" VARCHAR(64) NOT NULL,
    "current_version_id" VARCHAR(64),
    "category" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "checksum_sha256" VARCHAR(64),
    "size_bytes" INTEGER,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'reservado',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sgc_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgc_webhook_evento" (
    "id" TEXT NOT NULL,
    "event_id" VARCHAR(64) NOT NULL,
    "event_type" VARCHAR(40) NOT NULL,
    "resource_id" VARCHAR(64),
    "resource_code" VARCHAR(50),
    "payload" JSONB NOT NULL,
    "procesado_at" TIMESTAMP(3),
    "error" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sgc_webhook_evento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sgc_expediente_solicitud_id_key" ON "sgc_expediente"("solicitud_id");

-- CreateIndex
CREATE UNIQUE INDEX "sgc_expediente_code_key" ON "sgc_expediente"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sgc_expediente_contract_id_key" ON "sgc_expediente"("contract_id");

-- CreateIndex
CREATE INDEX "sgc_expediente_estado_envio_idx" ON "sgc_expediente"("estado_envio");

-- CreateIndex
CREATE INDEX "sgc_expediente_stage_idx" ON "sgc_expediente"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "sgc_documento_document_id_key" ON "sgc_documento"("document_id");

-- CreateIndex
CREATE INDEX "sgc_documento_sgc_expediente_id_idx" ON "sgc_documento"("sgc_expediente_id");

-- CreateIndex
CREATE UNIQUE INDEX "sgc_webhook_evento_event_id_key" ON "sgc_webhook_evento"("event_id");

-- CreateIndex
CREATE INDEX "sgc_webhook_evento_event_type_idx" ON "sgc_webhook_evento"("event_type");

-- CreateIndex
CREATE INDEX "sgc_webhook_evento_resource_id_idx" ON "sgc_webhook_evento"("resource_id");

-- AddForeignKey
ALTER TABLE "sgc_expediente" ADD CONSTRAINT "sgc_expediente_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sgc_documento" ADD CONSTRAINT "sgc_documento_sgc_expediente_id_fkey" FOREIGN KEY ("sgc_expediente_id") REFERENCES "sgc_expediente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
