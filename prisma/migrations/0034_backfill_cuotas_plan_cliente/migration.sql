-- RF-10: el plan de pagos definido por el cliente en el contrato (`solicitud.plan_cuotas`)
-- es la fuente de verdad de la facturacion. Backfill para facturaciones creadas antes:
-- alinea el modo de pago y crea las cuotas del plan cuando aun no existen.

-- Modo de pago segun la modalidad del plan (completo | cuotas).
UPDATE "facturacion" f
SET "modo_pago" = CASE WHEN s."plan_cuotas"->>'modalidad' = 'completo' THEN 'completo' ELSE 'cuotas' END,
    "updated_at" = now()
FROM "solicitud" s
WHERE s.id = f."solicitud_id"
  AND s."plan_cuotas" IS NOT NULL
  AND s."plan_cuotas"->'cuotas' IS NOT NULL
  AND jsonb_array_length(s."plan_cuotas"->'cuotas') > 0;

-- Cuotas del plan (solo si la facturacion no tiene ninguna cuota registrada).
INSERT INTO "facturacion_cuota" ("id", "facturacion_id", "numero", "monto", "fecha_vencimiento", "estado", "created_at")
SELECT
  gen_random_uuid()::text,
  f.id,
  (c->>'numero')::int,
  (c->>'monto')::numeric(12, 2),
  CASE
    WHEN NULLIF(c->>'fechaVencimiento', '') IS NULL THEN NULL
    ELSE (c->>'fechaVencimiento')::timestamp
  END,
  'pendiente',
  now()
FROM "facturacion" f
JOIN "solicitud" s ON s.id = f."solicitud_id"
CROSS JOIN LATERAL jsonb_array_elements(s."plan_cuotas"->'cuotas') AS c
WHERE s."plan_cuotas" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "facturacion_cuota" fc WHERE fc."facturacion_id" = f.id);
