-- Bloqueo temporal del wizard de reserva (no es una reserva).
ALTER TABLE "gess_stand"
  ADD COLUMN "hold_id" VARCHAR(64),
  ADD COLUMN "hold_user_id" VARCHAR(100),
  ADD COLUMN "hold_expires_at" TIMESTAMP(3);

CREATE INDEX "gess_stand_hold_id_idx" ON "gess_stand"("hold_id");
CREATE INDEX "gess_stand_hold_expires_at_idx" ON "gess_stand"("hold_expires_at");
