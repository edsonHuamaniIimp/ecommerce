-- Firma digital del usuario (imagen PNG/JPG en /uploads/*) para firmar contratos
-- desde el portal sin subir un contrato firmado manualmente (RF-12).

-- AlterTable
ALTER TABLE "user_role" ADD COLUMN "firma_url" VARCHAR(500);
