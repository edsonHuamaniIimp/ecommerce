-- Bitacora auditable de rondas de subsanacion (rechazo -> motivo -> correccion -> reenvio).
CREATE TABLE "sgc_subsanacion" (
    "id" TEXT NOT NULL,
    "sgc_expediente_id" TEXT NOT NULL,
    "ronda" INTEGER NOT NULL,
    "motivo" VARCHAR(500) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'declarado',
    "declarado_por" VARCHAR(200) NOT NULL,
    "declarado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reenviado_por" VARCHAR(200),
    "reenviado_at" TIMESTAMP(3),
    "document_id" VARCHAR(64),
    "version_id" VARCHAR(64),
    CONSTRAINT "sgc_subsanacion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sgc_subsanacion_sgc_expediente_id_idx" ON "sgc_subsanacion"("sgc_expediente_id");
ALTER TABLE "sgc_subsanacion" ADD CONSTRAINT "sgc_subsanacion_sgc_expediente_id_fkey" FOREIGN KEY ("sgc_expediente_id") REFERENCES "sgc_expediente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;