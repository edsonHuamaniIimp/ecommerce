-- Configuracion personalizada de cuotas por empresa (Modalidad 4).
-- NULL = la empresa usa el cronograma estandar (1/2/3 cuotas).
ALTER TABLE "empresa" ADD COLUMN "config_cuotas" JSONB;
