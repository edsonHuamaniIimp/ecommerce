INSERT INTO "role" ("id", "nombre", "descripcion", "permisos", "modulos", "created_at", "updated_at")
VALUES (
  gen_random_uuid()::text,
  'contabilidad',
  'Gestion de facturacion y pagos',
  ARRAY['dashboard:view', 'eventos:datos', 'facturacion:view']::text[],
  ARRAY['dashboard', 'facturacion']::text[],
  now(),
  now()
)
ON CONFLICT ("nombre") DO NOTHING;
