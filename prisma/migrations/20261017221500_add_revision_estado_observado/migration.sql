-- Resultado de revision "Observado" en la maestra (catalogo revision_estado).
-- Idempotente: no duplica si el item ya existe en algun entorno.
INSERT INTO "maestra" ("id", "nid_maestra_padre", "tabla", "item_id", "num_orden", "nombre", "activo", "created_at", "updated_at")
SELECT (SELECT COALESCE(MAX("id"), 0) + 1 FROM "maestra"), 0, 'revision_estado', 4, 4, 'Observado', true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "maestra" WHERE "tabla" = 'revision_estado' AND "item_id" = 4
);