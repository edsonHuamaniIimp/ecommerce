-- El historial de estados es inmutable: no se borra al eliminar un stand.
ALTER TABLE "gess_stand_estado_historial"
    DROP CONSTRAINT "gess_stand_estado_historial_gess_stand_id_fkey";

ALTER TABLE "gess_stand_estado_historial"
    ADD CONSTRAINT "gess_stand_estado_historial_gess_stand_id_fkey"
    FOREIGN KEY ("gess_stand_id") REFERENCES "gess_stand"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
