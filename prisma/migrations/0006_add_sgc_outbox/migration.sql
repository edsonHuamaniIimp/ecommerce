-- CreateTable
CREATE TABLE "sgc_outbox" (
    "id" TEXT NOT NULL,
    "operacion" VARCHAR(40) NOT NULL,
    "idempotency_key" VARCHAR(160),
    "payload" JSONB NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimo_error" VARCHAR(500),
    "programado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sgc_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sgc_outbox_idempotency_key_key" ON "sgc_outbox"("idempotency_key");

-- CreateIndex
CREATE INDEX "sgc_outbox_estado_programado_at_idx" ON "sgc_outbox"("estado", "programado_at");
