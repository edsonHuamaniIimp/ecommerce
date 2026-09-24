-- CreateTable
CREATE TABLE "registro_pendiente" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "password" VARCHAR(100) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "apellidos" VARCHAR(200) NOT NULL,
    "razon_social" VARCHAR(200) NOT NULL,
    "telefono" VARCHAR(20),
    "ruc" VARCHAR(11),
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registro_pendiente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registro_pendiente_email_key" ON "registro_pendiente"("email");
