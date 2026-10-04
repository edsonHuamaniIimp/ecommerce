-- RF-08: imagen (PNG) del recorte del pabellon con el stand destacado; se genera
-- desde el portal y se adjunta al contrato.

-- AlterTable
ALTER TABLE "solicitud" ADD COLUMN "recorte_plano_url" VARCHAR(500);
