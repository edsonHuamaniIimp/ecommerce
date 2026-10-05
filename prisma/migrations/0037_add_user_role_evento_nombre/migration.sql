-- Persiste el nombre visible del evento elegido en la presala (el mismo que viaja
-- en el JWT al seleccionar) para que el login lo reuse sin recalcularlo desde la BD.
ALTER TABLE "user_role" ADD COLUMN "evento_nombre" VARCHAR(200);
ALTER TABLE "user_role" ADD COLUMN "evento_padre_nombre" VARCHAR(200);
