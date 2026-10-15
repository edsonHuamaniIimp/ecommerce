-- Datos de la ultima devolucion del SGC (`workflow.returned`, guia §8): permite
-- distinguir las devoluciones que exigen version nueva del principal (el tramite
-- vuelve a elaboracion y el cliente puede subsanar) de las validaciones internas
-- (`requiresDocumentChange=false`), que NO deben pedir correccion al cliente.
-- Tambien guarda el motivo (`data.reason`) y el destino/estrategia de la devolucion.

-- AlterTable
ALTER TABLE "sgc_expediente" ADD COLUMN "devolucion_requiere_cambio" BOOLEAN;
ALTER TABLE "sgc_expediente" ADD COLUMN "devolucion_motivo" VARCHAR(500);
ALTER TABLE "sgc_expediente" ADD COLUMN "devolucion_destino_step_id" VARCHAR(64);
ALTER TABLE "sgc_expediente" ADD COLUMN "devolucion_estrategia" VARCHAR(30);
