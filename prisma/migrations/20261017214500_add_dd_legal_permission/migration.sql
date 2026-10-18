UPDATE "role"
SET "permisos" = array_append("permisos", 'dd:legal')
WHERE "nombre" IN ('admin', 'legal')
  AND NOT ('dd:legal' = ANY("permisos"));
