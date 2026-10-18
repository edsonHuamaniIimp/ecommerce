UPDATE "debida_diligencia"
SET "estado" = 'en_revision',
    "fecha_aprobacion" = NULL,
    "fecha_vencimiento" = NULL
WHERE "estado" = 'aprobada'
  AND "decision_legal" = 'aprobar'
  AND (
    "fecha_legal" IS NULL
    OR "fecha_aprobacion" IS NULL
    OR "fecha_aprobacion" <= "fecha_legal"
  );