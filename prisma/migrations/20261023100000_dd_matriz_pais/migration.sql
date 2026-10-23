-- Pais (ISO 3166-1 alpha-2) de cada vinculo de la Matriz de evaluacion DD.
-- Nullable: los vinculos sin dato se muestran con "?" y quedan como nacionales por defecto.
ALTER TABLE "dd_matriz_vinculo"
  ADD COLUMN "pais" VARCHAR(2),
  ADD COLUMN "pais_editado" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "dd_matriz_vinculo_pais_idx" ON "dd_matriz_vinculo"("pais");
