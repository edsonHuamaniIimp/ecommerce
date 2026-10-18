-- Catalogo maestra `documento_estado`: estado logico de los documentos de la solicitud.
-- Filas planas (padre 0) para que `maestra?tabla=documento_estado` las devuelva.
-- Idempotente: cada item se inserta solo si no existe.
INSERT INTO "maestra" ("id", "nid_maestra_padre", "tabla", "item_id", "num_orden", "nombre", "descripcion", "activo", "created_at", "updated_at")
SELECT (SELECT COALESCE(MAX("id"), 0) + 1 FROM "maestra"), 0, 'documento_estado', 1, 1, 'Activo', 'Documento vigente que cubre su requisito', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "maestra" WHERE "tabla" = 'documento_estado' AND "item_id" = 1);

INSERT INTO "maestra" ("id", "nid_maestra_padre", "tabla", "item_id", "num_orden", "nombre", "descripcion", "activo", "created_at", "updated_at")
SELECT (SELECT COALESCE(MAX("id"), 0) + 1 FROM "maestra"), 0, 'documento_estado', 2, 2, 'Observado', 'Observado por el revisor; requiere una nueva version', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "maestra" WHERE "tabla" = 'documento_estado' AND "item_id" = 2);

INSERT INTO "maestra" ("id", "nid_maestra_padre", "tabla", "item_id", "num_orden", "nombre", "descripcion", "activo", "created_at", "updated_at")
SELECT (SELECT COALESCE(MAX("id"), 0) + 1 FROM "maestra"), 0, 'documento_estado', 3, 3, 'Reemplazado', 'Version anterior reemplazada por una nueva', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "maestra" WHERE "tabla" = 'documento_estado' AND "item_id" = 3);

INSERT INTO "maestra" ("id", "nid_maestra_padre", "tabla", "item_id", "num_orden", "nombre", "descripcion", "activo", "created_at", "updated_at")
SELECT (SELECT COALESCE(MAX("id"), 0) + 1 FROM "maestra"), 0, 'documento_estado', 4, 4, 'Baja', 'Baja logica manual; no cubre requisitos', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "maestra" WHERE "tabla" = 'documento_estado' AND "item_id" = 4);