-- Datos de contacto y responsables adicionales de la empresa.
ALTER TABLE "empresa"
  ADD COLUMN "nombre_friso" VARCHAR(200),
  ADD COLUMN "facturar_a_nombre" VARCHAR(200),
  ADD COLUMN "responsable_extemin_nombre" VARCHAR(200),
  ADD COLUMN "responsable_extemin_telefono" VARCHAR(35),
  ADD COLUMN "responsable_extemin_dni" VARCHAR(15),
  ADD COLUMN "responsable_extemin_email" VARCHAR(200),
  ADD COLUMN "responsable_pagos_nombre" VARCHAR(200),
  ADD COLUMN "responsable_pagos_telefono" VARCHAR(35),
  ADD COLUMN "responsable_pagos_dni" VARCHAR(15),
  ADD COLUMN "responsable_pagos_email" VARCHAR(200);
