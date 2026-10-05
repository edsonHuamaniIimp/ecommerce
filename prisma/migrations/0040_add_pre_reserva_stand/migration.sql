-- Pre-reserva de stands: bloqueo con empresa (sin solicitud ni contrato).
-- En UI el estado `pre_reservado` se comporta como `reservado`.
ALTER TABLE "gess_stand" ADD COLUMN "pre_reserva_razon_social" VARCHAR(200);
ALTER TABLE "gess_stand" ADD COLUMN "pre_reserva_ruc" VARCHAR(11);
ALTER TABLE "gess_stand" ADD COLUMN "pre_reserva_sie" VARCHAR(20);
ALTER TABLE "gess_stand" ADD COLUMN "pre_reserva_nota" VARCHAR(300);
ALTER TABLE "gess_stand" ADD COLUMN "pre_reserva_por" VARCHAR(200);
ALTER TABLE "gess_stand" ADD COLUMN "pre_reserva_at" TIMESTAMP(3);
