-- Las categorias de criterio incluyen codigos como
-- `criterio_central_riesgo_empresa` (31 caracteres), que superan el limite
-- anterior de 30 y provocaban error 500 al adjuntar la evidencia.
ALTER TABLE "dd_matriz_adjunto"
  ALTER COLUMN "categoria" TYPE VARCHAR(60);
