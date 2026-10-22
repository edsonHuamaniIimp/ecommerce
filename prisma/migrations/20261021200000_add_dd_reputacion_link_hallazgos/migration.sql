-- Link de sustento obligatorio cuando Comunicaciones registra hallazgos.
ALTER TABLE "debida_diligencia_reputacion"
  ADD COLUMN "link_hallazgos" VARCHAR(500);
