-- Migracion retirada: era un seed de DATOS (planos del Laboratorio 3D), no schema.
-- Insertaba planos con UUIDs fijos y fallaba donde el plano ya existia con otro id
-- (FK plano_tipo_bloque), rompiendo `prisma migrate deploy` y el arranque del contenedor.
-- El seed debe reintroducirse como script idempotente que resuelva los ids por `codigo`
-- (no como migracion). El SQL original queda en el historial de git (commit 9b17b98).
--
-- No-op: mantiene el registro de la migracion para no romper el historial.
SELECT 1;
