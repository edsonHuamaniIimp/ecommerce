-- La cuenta local del representante guarda el RUC de la empresa vinculada
-- (ademas de la FK/empresa SIE) para representar la cuenta sin cruces extra.
ALTER TABLE "user_role" ADD COLUMN "ruc" VARCHAR(11);
