-- Permisos propios del modulo Debida Diligencia (dd:*).
-- Se agregan solo si el rol existe y aun no tiene el permiso, para no duplicar
-- ni alterar roles personalizados.

UPDATE "role"
SET permisos = array_append(permisos, 'dd:ver')
WHERE nombre = 'logistica' AND NOT ('dd:ver' = ANY (permisos));

UPDATE "role"
SET permisos = array_append(permisos, 'dd:panel')
WHERE nombre = 'logistica' AND NOT ('dd:panel' = ANY (permisos));

UPDATE "role"
SET permisos = array_append(permisos, 'dd:revision')
WHERE nombre = 'logistica' AND NOT ('dd:revision' = ANY (permisos));

UPDATE "role"
SET permisos = array_append(permisos, 'dd:ver')
WHERE nombre = 'legal' AND NOT ('dd:ver' = ANY (permisos));

UPDATE "role"
SET permisos = array_append(permisos, 'dd:ver')
WHERE nombre = 'comunicacion' AND NOT ('dd:ver' = ANY (permisos));

UPDATE "role"
SET permisos = array_append(permisos, 'dd:reputacion')
WHERE nombre = 'comunicacion' AND NOT ('dd:reputacion' = ANY (permisos));

UPDATE "role"
SET permisos = array_append(permisos, 'dd:formulario')
WHERE nombre = 'cliente' AND NOT ('dd:formulario' = ANY (permisos));
