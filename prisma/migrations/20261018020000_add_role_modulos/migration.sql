ALTER TABLE "role" ADD COLUMN "modulos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "role"
SET "modulos" = ARRAY[
  'sistema',
  'dashboard',
  'stands',
  'auspicios',
  'laboratorio',
  'facturacion',
  'solicitudes',
  'reservas',
  'eventos',
  'admin',
  'empresas',
  'debida_diligencia'
]::TEXT[]
WHERE cardinality("modulos") = 0;