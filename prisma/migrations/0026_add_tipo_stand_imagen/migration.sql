-- Imagen referencial por tipo de stand: una imagen por tipo, aplicada a todos los
-- stands de ese tipo (se administra en la bandeja de Stands y se muestra en el mapa).

-- CreateTable
CREATE TABLE "tipo_stand_imagen" (
    "id" TEXT NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "imagen_url" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipo_stand_imagen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipo_stand_imagen_tipo_key" ON "tipo_stand_imagen"("tipo");
