-- Servicio-persona es la fuente de las personas: aca solo se guarda el identificador
-- (sie_code) de la persona en la fuente, junto al correo y la empresa del acceso local.
ALTER TABLE "user_role" ADD COLUMN "sie_code" VARCHAR(20);

CREATE INDEX "user_role_sie_code_idx" ON "user_role"("sie_code");
