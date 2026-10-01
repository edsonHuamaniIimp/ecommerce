-- Comprobante fiscal (boleta/factura) que adjunta Facturacion al confirmar el pago de una
-- cuota; el cliente lo ve/descarga en el Portal (Mis pagos). Es distinto del voucher que
-- sube el cliente (columna "comprobante").

-- AlterTable
ALTER TABLE "facturacion_cuota" ADD COLUMN "comprobante_fiscal" VARCHAR(500);
ALTER TABLE "facturacion_cuota" ADD COLUMN "comprobante_fiscal_tipo" VARCHAR(10);
ALTER TABLE "facturacion_cuota" ADD COLUMN "comprobante_fiscal_numero" VARCHAR(30);
ALTER TABLE "facturacion_cuota" ADD COLUMN "comprobante_fiscal_at" TIMESTAMP(3);
ALTER TABLE "facturacion_cuota" ADD COLUMN "comprobante_fiscal_by" VARCHAR(100);
