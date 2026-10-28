UPDATE "role"
SET "permisos" = array_remove("permisos", 'solicitudes:view'),
    "updated_at" = now()
WHERE "nombre" = 'cliente'
  AND 'solicitudes:view' = ANY ("permisos");
