-- Alertas localizadas (campana): plantilla + datos para renderizar titulo/mensaje
-- es/en segun el idioma del destinatario. `titulo`/`mensaje` quedan como respaldo
-- para filas legacy o claves desconocidas.

-- AlterTable
ALTER TABLE "alerta" ADD COLUMN "clave" VARCHAR(60);
ALTER TABLE "alerta" ADD COLUMN "datos" JSONB;
