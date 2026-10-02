-- Requisito del anexo que cubre cada documento (clave de ANEXOS_REQUERIDOS:
-- ficha-ruc | vigencia-poder | dni-representante). Null = otro anexo sin requisito.

-- AlterTable
ALTER TABLE "solicitud_documento" ADD COLUMN "requisito" VARCHAR(30);
