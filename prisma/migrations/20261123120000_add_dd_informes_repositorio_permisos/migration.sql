-- Permisos propios de Informes DD (dd:informes) y Centro documental DD (dd:repositorio).
-- Hasta ahora ambas vistas colgaban de dd:matriz. Para que ningun rol pierda acceso, se conceden
-- a los roles que ya tienen dd:matriz; despues se pueden asignar por separado desde /dashboard/roles.
UPDATE "role"
SET permisos = array_append(permisos, 'dd:informes')
WHERE 'dd:matriz' = ANY (permisos) AND NOT ('dd:informes' = ANY (permisos));

UPDATE "role"
SET permisos = array_append(permisos, 'dd:repositorio')
WHERE 'dd:matriz' = ANY (permisos) AND NOT ('dd:repositorio' = ANY (permisos));
