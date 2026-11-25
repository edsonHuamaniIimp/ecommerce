-- Regla de evaluacion DD: habilita el asistente de IA en la observacion de los criterios
-- de la Matriz DD. Apagado por defecto: lo activa un administrador DD en Configuracion.
ALTER TABLE "dd_configuracion" ADD COLUMN IF NOT EXISTS "asistente_ia_habilitado" BOOLEAN NOT NULL DEFAULT false;
