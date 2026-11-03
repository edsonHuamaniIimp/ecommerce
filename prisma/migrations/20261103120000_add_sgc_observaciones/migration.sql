-- Campo OPCIONAL: observaciones por documento de la ultima devolucion del SGC.
-- Aditivo y nullable: compatible con la integracion previa (no envia el campo).
ALTER TABLE "sgc_expediente" ADD COLUMN "observaciones" JSONB;
