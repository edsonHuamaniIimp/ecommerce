-- Borrado logico para tipos de bloque y decoraciones del Laboratorio 3D
-- (plano_bloque ya cuenta con flg_activo).
ALTER TABLE "plano_tipo_bloque" ADD COLUMN "flg_activo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "plano_furniture" ADD COLUMN "flg_activo" BOOLEAN NOT NULL DEFAULT true;
