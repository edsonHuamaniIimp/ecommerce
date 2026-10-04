-- RF-10/11: snapshot del plan de cuotas configurado por el cliente al reservar
-- ({ modalidad, cuotas[] }). Es la fuente de verdad para regenerar el contrato.

-- AlterTable
ALTER TABLE "solicitud" ADD COLUMN "plan_cuotas" JSONB;
