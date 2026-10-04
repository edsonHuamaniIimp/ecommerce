-- Rol dedicado "Asociado" (RF-14/15): unifica Logistica + Comunicacion en el nivel
-- local previo a Legal. El permiso de revision se mueve de los roles legacy al nuevo.

-- CreateRol
INSERT INTO "role" ("id", "nombre", "descripcion", "permisos", "created_at", "updated_at")
VALUES (
  gen_random_uuid()::text,
  'asociado',
  'Area de Asociados (revision previa a Legal)',
  ARRAY['dashboard:view', 'eventos:datos', 'stands:plano', 'auspicios:view', 'read:reservas', 'solicitudes:view', 'solicitudes:gestion', 'solicitudes:review:asociado']::text[],
  now(),
  now()
)
ON CONFLICT ("nombre") DO UPDATE
SET "descripcion" = EXCLUDED."descripcion", "permisos" = EXCLUDED."permisos", "updated_at" = now();

-- Los roles legacy dejan de revisar (el permiso pasa al rol Asociado) y se limpian
-- las claves de revision antiguas (ya no existen en el catalogo de permisos).
UPDATE "role"
SET "permisos" = array_remove(array_remove(array_remove("permisos", 'solicitudes:review:asociado'), 'solicitudes:review:comunicacion'), 'solicitudes:review:logistica'),
    "updated_at" = now()
WHERE "nombre" IN ('logistica', 'comunicacion');

-- Admin: reemplaza los permisos de revision legacy por el nuevo.
UPDATE "role"
SET "permisos" = array_remove(array_remove(array_remove("permisos", 'solicitudes:review:comunicacion'), 'solicitudes:review:logistica'), 'solicitudes:review:asociado') || ARRAY['solicitudes:review:asociado']::text[],
    "updated_at" = now()
WHERE "nombre" = 'admin';
