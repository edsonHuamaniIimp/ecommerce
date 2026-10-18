ALTER TABLE "debida_diligencia"
ADD COLUMN "fecha_derivacion_legal" TIMESTAMP(3),
ADD COLUMN "derivado_legal_por" VARCHAR(200),
ADD COLUMN "fecha_legal" TIMESTAMP(3),
ADD COLUMN "legal_revisor" VARCHAR(200),
ADD COLUMN "decision_legal" VARCHAR(20),
ADD COLUMN "motivo_legal" VARCHAR(2000),
ADD COLUMN "informe_legal_nombre" VARCHAR(250),
ADD COLUMN "informe_legal_url" VARCHAR(500);