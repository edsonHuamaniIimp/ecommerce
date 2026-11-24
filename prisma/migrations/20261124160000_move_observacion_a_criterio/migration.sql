-- La observacion pasa de la evidencia (dd_matriz_adjunto) al criterio / lista restrictiva del vinculo.
ALTER TABLE "dd_matriz_vinculo" ADD COLUMN "listas_observaciones" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "dd_matriz_adjunto" DROP COLUMN IF EXISTS "observacion";
