-- AlterTable
ALTER TABLE "plano_tipo_bloque" ADD COLUMN "forma" VARCHAR(20) NOT NULL DEFAULT 'bloque';

-- AlterTable
ALTER TABLE "tipo_bloque_global" ADD COLUMN "forma" VARCHAR(20) NOT NULL DEFAULT 'bloque';
