-- Snapshot de los datos comerciales/fiscales capturados en el paso 1 del wizard
-- de reserva; alimenta el payload de POST /stands/reserva del IIMP sin exigir
-- una empresa registrada en el modulo de Empresas.
ALTER TABLE "solicitud" ADD COLUMN "datos_facturacion" JSONB;
