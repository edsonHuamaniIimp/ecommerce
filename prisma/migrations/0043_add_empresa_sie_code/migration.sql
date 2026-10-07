-- servicio-persona es la fuente de las empresas: la ficha contractual local guarda
-- tambien el identificador (sie_code) de la empresa en la fuente.
ALTER TABLE "empresa" ADD COLUMN "sie_code" VARCHAR(20);

CREATE INDEX "empresa_sie_code_idx" ON "empresa"("sie_code");
