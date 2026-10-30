-- AlterTable
ALTER TABLE "empresa" ADD COLUMN "socios" VARCHAR(1000);

-- CreateTable
CREATE TABLE "empresa_representante_adicional" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "tipo_documento" VARCHAR(10) NOT NULL DEFAULT '1',
    "documento" VARCHAR(15) NOT NULL,
    "correo" VARCHAR(200),
    "celular" VARCHAR(35),
    "direccion" VARCHAR(100),
    "partida_electronica" VARCHAR(50),
    "orden" INTEGER NOT NULL DEFAULT 0,
    "flg_activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresa_representante_adicional_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "empresa_representante_adicional_empresa_id_flg_activo_idx" ON "empresa_representante_adicional"("empresa_id", "flg_activo");

-- AddForeignKey
ALTER TABLE "empresa_representante_adicional" ADD CONSTRAINT "empresa_representante_adicional_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
