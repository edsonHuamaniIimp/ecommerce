-- AlterTable
ALTER TABLE "solicitud_documento" ADD COLUMN     "estado" VARCHAR(20) NOT NULL DEFAULT 'activo',
ADD COLUMN     "motivo_observacion" VARCHAR(1000),
ADD COLUMN     "observado_at" TIMESTAMP(3),
ADD COLUMN     "observado_por" VARCHAR(200);

-- CreateIndex
CREATE INDEX "solicitud_documento_solicitud_id_estado_idx" ON "solicitud_documento"("solicitud_id", "estado");

-- Estado de solicitud "Observado" en la maestra (filtros/labels de bandejas).
-- La secuencia de maestra esta desfasada por el seed con IDs explicitos: se calcula el id.
-- Idempotente: si produccion ya tuviera el item 7, no se duplica.
INSERT INTO "maestra" ("id", "nid_maestra_padre", "tabla", "item_id", "num_orden", "nombre", "activo", "created_at", "updated_at")
SELECT (SELECT COALESCE(MAX("id"), 0) + 1 FROM "maestra"), 0, 'solicitud_estado', 7, 7, 'Observado', true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "maestra" WHERE "tabla" = 'solicitud_estado' AND "item_id" = 7 AND "nid_maestra_padre" = 0
);
