-- Cuenta del Portal del Cliente vinculada a una empresa registrada por el backoffice,
-- y credencial temporal (cambio obligatorio en el primer ingreso).

-- AlterTable
ALTER TABLE "user_role" ADD COLUMN "empresa_id" TEXT;
ALTER TABLE "user_role" ADD COLUMN "debe_cambiar_password" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "user_role_empresa_id_idx" ON "user_role"("empresa_id");

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
