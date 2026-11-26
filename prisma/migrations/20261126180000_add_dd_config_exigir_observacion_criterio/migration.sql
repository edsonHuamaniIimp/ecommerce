-- Regla de evaluacion DD: exige la observacion de cada criterio con hallazgo (SI, o NO en las
-- preguntas en positivo como central de riesgo y bancarizado) al guardar la evaluacion SIG.
-- Encendida por defecto: conserva el comportamiento vigente hasta que un administrador la apague.
ALTER TABLE "dd_configuracion" ADD COLUMN IF NOT EXISTS "exigir_observacion_criterio" BOOLEAN NOT NULL DEFAULT true;
