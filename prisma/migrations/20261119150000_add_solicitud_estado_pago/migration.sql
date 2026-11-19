-- Estado de pago independiente del estado de flujo/revision.
ALTER TABLE "solicitud" ADD COLUMN "estado_pago" VARCHAR(20);

-- Compatibilidad con registros historicos: los estados de pago previos se
-- conservan en estadoPago; el estado de flujo queda calculado por revisiones.
UPDATE "solicitud"
SET "estado_pago" = CASE
  WHEN "estado" = 'pendiente_pago' THEN 'pendiente_pago'
  WHEN "estado" = 'pagado' THEN 'pagado'
  ELSE NULL
END;

CREATE INDEX "solicitud_estado_pago_idx" ON "solicitud"("estado_pago");
