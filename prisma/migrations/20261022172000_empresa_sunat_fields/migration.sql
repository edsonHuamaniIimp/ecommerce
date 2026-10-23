-- Datos obtenidos del padron SUNAT para el validador de empresa.
ALTER TABLE "empresa"
  ADD COLUMN "actividad_economica" VARCHAR(200),
  ADD COLUMN "estado_contribuyente" VARCHAR(80);
