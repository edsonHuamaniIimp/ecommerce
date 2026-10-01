-- Idioma preferido del usuario (es por defecto / en). Se usa para elegir las
-- plantillas de correo y documentos en su idioma.

-- AlterTable
ALTER TABLE "user_role" ADD COLUMN "idioma" VARCHAR(5) NOT NULL DEFAULT 'es';
