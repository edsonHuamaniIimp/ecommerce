-- Preferencia de correo para notificaciones (distinto del correo de acceso).
-- El correo seleccionado no se usa hasta completar la verificacion por codigo.

ALTER TABLE "user_role" ADD COLUMN "notification_email" VARCHAR(200);
ALTER TABLE "user_role" ADD COLUMN "notification_email_verified_at" TIMESTAMP(3);
ALTER TABLE "user_role" ADD COLUMN "notification_email_pending" VARCHAR(200);
ALTER TABLE "user_role" ADD COLUMN "notification_email_code" VARCHAR(10);
ALTER TABLE "user_role" ADD COLUMN "notification_email_code_expires" TIMESTAMP(3);

CREATE INDEX "user_role_notification_email_idx" ON "user_role"("notification_email");
