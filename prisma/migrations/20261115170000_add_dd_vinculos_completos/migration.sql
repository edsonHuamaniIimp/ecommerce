-- SIG declara que reviso y que estan todos los vinculos de la solicitud DD.
ALTER TABLE "debida_diligencia"
  ADD COLUMN "vinculos_completos" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "vinculos_completos_por" VARCHAR(200),
  ADD COLUMN "vinculos_completos_en" TIMESTAMP(3);
