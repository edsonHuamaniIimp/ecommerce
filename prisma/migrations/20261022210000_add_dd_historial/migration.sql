-- CreateTable
CREATE TABLE "debida_diligencia_historial" (
    "id" TEXT NOT NULL,
    "expediente_id" TEXT NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "area" VARCHAR(30),
    "estado" VARCHAR(20),
    "titulo" VARCHAR(200) NOT NULL,
    "detalle" VARCHAR(1500),
    "actor" VARCHAR(200) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debida_diligencia_historial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "debida_diligencia_historial_expediente_id_created_at_idx" ON "debida_diligencia_historial"("expediente_id", "created_at");

-- AddForeignKey
ALTER TABLE "debida_diligencia_historial" ADD CONSTRAINT "debida_diligencia_historial_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "debida_diligencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
