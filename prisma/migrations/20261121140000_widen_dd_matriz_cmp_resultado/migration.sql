-- "aceptado_con_observaciones" (26 caracteres) no cabia en VARCHAR(20): Legal observar fallaba.
ALTER TABLE "dd_matriz_vinculo" ALTER COLUMN "cmp_resultado" TYPE VARCHAR(40);
