-- Baja logica de stands comerciales: no se eliminan filas ni relaciones.
ALTER TABLE "gess_stand"
  ADD COLUMN "flg_activo" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "gess_stand_evento_id_flg_activo_idx"
  ON "gess_stand" ("evento_id", "flg_activo");
