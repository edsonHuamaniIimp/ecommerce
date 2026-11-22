-- Alertas con contexto de empresa y evento (campana por empresa/evento, sin duplicados).
ALTER TABLE "alerta" ADD COLUMN IF NOT EXISTS "empresa_id" TEXT;
ALTER TABLE "alerta" ADD COLUMN IF NOT EXISTS "evento_id" VARCHAR(100);

CREATE INDEX IF NOT EXISTS "alerta_empresa_id_leida_idx" ON "alerta"("empresa_id", "leida");
CREATE INDEX IF NOT EXISTS "alerta_evento_id_idx" ON "alerta"("evento_id");

-- Backfill: solicitud referenciada en la URL de la alerta (?solicitud=<uuid> o ?id=<uuid>).
UPDATE "alerta" a
SET "solicitud_id" = s."id"
FROM "solicitud" s
WHERE a."solicitud_id" IS NULL
  AND a."url" ~ '(solicitud|id)=[0-9a-f-]{36}'
  AND s."id" = substring(a."url" from '(?:solicitud|id)=([0-9a-f-]{36})');

-- Backfill: evento de la solicitud (stand principal o, en multi-stand, el primero de solicitud_stand).
UPDATE "alerta" a
SET "evento_id" = COALESCE(
  (SELECT g."evento_id" FROM "solicitud" s JOIN "gess_stand" g ON g."id" = s."gess_stand_id" WHERE s."id" = a."solicitud_id"),
  (SELECT g."evento_id" FROM "solicitud_stand" ss JOIN "gess_stand" g ON g."id" = ss."gess_stand_id" WHERE ss."solicitud_id" = a."solicitud_id" LIMIT 1)
)
WHERE a."solicitud_id" IS NOT NULL AND a."evento_id" IS NULL;

-- Backfill: empresa del destinatario cuando es cuenta de cliente.
UPDATE "alerta" a
SET "empresa_id" = u."empresa_id"
FROM (SELECT DISTINCT ON ("user_id") "user_id", "empresa_id" FROM "user_role" WHERE "empresa_id" IS NOT NULL) u
WHERE a."user_id" = u."user_id" AND a."empresa_id" IS NULL;
