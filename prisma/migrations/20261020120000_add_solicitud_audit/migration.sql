-- Auditoria de solicitudes y metadatos de request en el log central.
ALTER TABLE "solicitud"
  ADD COLUMN "created_by" VARCHAR(200),
  ADD COLUMN "updated_by" VARCHAR(200),
  ADD COLUMN "created_ip" VARCHAR(45),
  ADD COLUMN "updated_ip" VARCHAR(45);

ALTER TABLE "audit_log"
  ADD COLUMN "ip" VARCHAR(45),
  ADD COLUMN "user_agent" VARCHAR(500),
  ADD COLUMN "metodo" VARCHAR(10),
  ADD COLUMN "ruta" VARCHAR(300);
