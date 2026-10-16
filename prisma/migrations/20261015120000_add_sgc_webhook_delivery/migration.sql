-- Dedup de webhooks por entrega (runbook API/hooks §10): `eventId` sigue siendo la
-- identidad de negocio; `deliveryId` (header x-sgc-delivery) identifica cada intento
-- de entrega para que una entrega repetida no reprocese el evento.

-- AlterTable
ALTER TABLE "sgc_webhook_evento" ADD COLUMN "delivery_id" VARCHAR(80);

-- CreateIndex
CREATE UNIQUE INDEX "sgc_webhook_evento_delivery_id_key" ON "sgc_webhook_evento"("delivery_id");
