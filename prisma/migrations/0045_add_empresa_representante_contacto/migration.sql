-- El correo/celular del representante legal se guardan en la ficha (se usan para
-- crear su cuenta del Portal y para sincronizar con servicio-persona).
ALTER TABLE "empresa" ADD COLUMN "representante_correo" VARCHAR(200);
ALTER TABLE "empresa" ADD COLUMN "representante_celular" VARCHAR(35);
