-- Observaciones dirigidas a un representante o beneficiario del expediente.
ALTER TABLE "debida_diligencia_observacion"
  ADD COLUMN "vinculo_tipo" VARCHAR(20),
  ADD COLUMN "beneficiario_id" TEXT,
  ADD COLUMN "vinculo_nombre" VARCHAR(200);

ALTER TABLE "debida_diligencia_observacion"
  ADD CONSTRAINT "debida_diligencia_observacion_beneficiario_id_fkey"
  FOREIGN KEY ("beneficiario_id") REFERENCES "debida_diligencia_beneficiario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "debida_diligencia_observacion_beneficiario_id_idx"
  ON "debida_diligencia_observacion"("beneficiario_id");
