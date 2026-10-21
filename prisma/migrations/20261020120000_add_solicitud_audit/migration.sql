-- Auditoria de solicitudes y metadatos de request en el log central.
ALTER TABLE "solicitud"
  ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "created_ip" VARCHAR(45),
  ADD COLUMN IF NOT EXISTS "updated_ip" VARCHAR(45);

ALTER TABLE "audit_log"
  ADD COLUMN IF NOT EXISTS "ip" VARCHAR(45),
  ADD COLUMN IF NOT EXISTS "user_agent" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "metodo" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "ruta" VARCHAR(300);
