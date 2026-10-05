-- Integracion de reserva/facturacion con el IIMP (servicio-eventos /stands/reserva):
-- la solicitud guarda el contrato, cuenta corriente y cliente del IIMP; cada cuota puede
-- llevar el documento fiscal emitido (la 1ra se emite al reservar; las demas en su fecha).
ALTER TABLE "solicitud" ADD COLUMN "iimp_contrato" VARCHAR(20);
ALTER TABLE "solicitud" ADD COLUMN "iimp_cuenta_corriente" VARCHAR(20);
ALTER TABLE "solicitud" ADD COLUMN "iimp_cliente_codigo" VARCHAR(20);
ALTER TABLE "solicitud" ADD COLUMN "iimp_reserva" JSONB;
ALTER TABLE "solicitud" ADD COLUMN "iimp_reserva_at" TIMESTAMP(3);

ALTER TABLE "facturacion_cuota" ADD COLUMN "iimp_documento" JSONB;
ALTER TABLE "facturacion_cuota" ADD COLUMN "iimp_emitida_at" TIMESTAMP(3);
