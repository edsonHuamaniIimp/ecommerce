-- Ultimo evento seleccionado por el usuario (se reusa al iniciar sesion).
ALTER TABLE "user_role" ADD COLUMN "evento_id" VARCHAR(50);