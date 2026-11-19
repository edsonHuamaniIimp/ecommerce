-- Amplia el documento de la pre-reserva para admitir RUT/no domiciliados.
ALTER TABLE "gess_stand" ALTER COLUMN "pre_reserva_ruc" TYPE VARCHAR(20);
