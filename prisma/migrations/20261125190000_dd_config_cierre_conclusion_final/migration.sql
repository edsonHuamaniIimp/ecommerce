-- Cierre automatico DD: la opcion pasa a usar la conclusion final de la matriz.
-- Solo datos (sin cambio de esquema). Idempotente.
UPDATE "dd_configuracion" SET "estado_cierre_automatico" = 'no_apto' WHERE "estado_cierre_automatico" = 'rechazada';
UPDATE "dd_configuracion" SET "estado_cierre_automatico" = 'documentacion_observada' WHERE "estado_cierre_automatico" = 'observada';
