-- Tipo de documento de los responsables (1 = DNI, 4 = Carne de extranjeria, 7 = Pasaporte).
ALTER TABLE "empresa"
  ADD COLUMN "representante_legal_tipo_documento" VARCHAR(10) NOT NULL DEFAULT '1',
  ADD COLUMN "responsable_extemin_tipo_documento" VARCHAR(10) NOT NULL DEFAULT '1',
  ADD COLUMN "responsable_pagos_tipo_documento" VARCHAR(10) NOT NULL DEFAULT '1';
