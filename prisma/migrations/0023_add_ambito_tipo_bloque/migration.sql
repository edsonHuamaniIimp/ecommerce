-- Ambito (interno/externo) para los tipos de bloque del Laboratorio 3D
ALTER TABLE "plano_tipo_bloque" ADD COLUMN "ambito" VARCHAR(10) NOT NULL DEFAULT 'interno';
