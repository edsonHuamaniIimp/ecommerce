-- Modo de la subsanación declarada por el admin cuando el SGC devuelve el trámite:
-- `nuevo_contrato` (el admin subirá una versión corregida; el cliente espera) o
-- `mismo_contrato` (el cliente vuelve a firmar el contrato vigente).

-- AlterTable
ALTER TABLE "sgc_expediente" ADD COLUMN "subsanacion_modo" VARCHAR(20);

-- AlterTable
ALTER TABLE "sgc_subsanacion" ADD COLUMN "modo" VARCHAR(20);
