-- Imagen referencial por tipo de stand: alcance por evento con respaldo global
-- (evento_id null = global, se usa cuando el evento no tiene imagen propia).

-- DropIndex
DROP INDEX "tipo_stand_imagen_tipo_key";

-- AlterTable
ALTER TABLE "tipo_stand_imagen" ADD COLUMN "evento_id" VARCHAR(100);

-- CreateIndex
CREATE INDEX "tipo_stand_imagen_evento_id_tipo_idx" ON "tipo_stand_imagen"("evento_id", "tipo");
