-- Link del informe de Logistica que se entrega a Legal al derivar el expediente.
ALTER TABLE "debida_diligencia"
  ADD COLUMN "informe_logistica_url" VARCHAR(500);
