-- Historial de cambios de estado producidos por la sincronizacion de stands.
CREATE TABLE "gess_stand_estado_historial" (
    "id" TEXT NOT NULL,
    "evento_id" TEXT NOT NULL,
    "gess_stand_id" TEXT NOT NULL,
    "stand_code" VARCHAR(50) NOT NULL,
    "estado_anterior" VARCHAR(50),
    "estado_nuevo" VARCHAR(50),
    "origen" VARCHAR(30) NOT NULL,
    "sync_batch_id" VARCHAR(36),
    "actor_email" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gess_stand_estado_historial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gess_stand_estado_historial_evento_id_created_at_idx"
    ON "gess_stand_estado_historial"("evento_id", "created_at");

CREATE INDEX "gess_stand_estado_historial_gess_stand_id_created_at_idx"
    ON "gess_stand_estado_historial"("gess_stand_id", "created_at");

CREATE INDEX "gess_stand_estado_historial_sync_batch_id_idx"
    ON "gess_stand_estado_historial"("sync_batch_id");

ALTER TABLE "gess_stand_estado_historial"
    ADD CONSTRAINT "gess_stand_estado_historial_gess_stand_id_fkey"
    FOREIGN KEY ("gess_stand_id") REFERENCES "gess_stand"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
