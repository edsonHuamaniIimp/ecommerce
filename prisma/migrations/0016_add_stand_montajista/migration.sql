-- AlterTable
ALTER TABLE "gess_stand" ADD COLUMN     "montajista_id" VARCHAR(20),
ADD COLUMN     "montajista_nombre" VARCHAR(200),
ADD COLUMN     "montajista_asignada_en" TIMESTAMP(3),
ADD COLUMN     "montajista_asignada_por" VARCHAR(200);

-- CreateTable
CREATE TABLE "stand_montajista_historial" (
    "id" TEXT NOT NULL,
    "gess_stand_id" TEXT NOT NULL,
    "montajista_id" VARCHAR(20),
    "montajista_nombre" VARCHAR(200),
    "accion" VARCHAR(20) NOT NULL,
    "created_by" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stand_montajista_historial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stand_montajista_historial_gess_stand_id_idx" ON "stand_montajista_historial"("gess_stand_id");

-- AddForeignKey
ALTER TABLE "stand_montajista_historial" ADD CONSTRAINT "stand_montajista_historial_gess_stand_id_fkey" FOREIGN KEY ("gess_stand_id") REFERENCES "gess_stand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
