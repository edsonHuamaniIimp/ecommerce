-- Datos generales de la empresa editables en la Matriz DD (actividad, motivo y evento/proyecto)
-- y marca de identidad corregida a mano en filas automaticas.
ALTER TABLE "dd_matriz_vinculo"
  ADD COLUMN "actividad_economica" VARCHAR(200),
  ADD COLUMN "motivo" VARCHAR(250),
  ADD COLUMN "evento_proyecto" VARCHAR(120),
  ADD COLUMN "identidad_editada" BOOLEAN NOT NULL DEFAULT false;
