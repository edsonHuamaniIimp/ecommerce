-- AlterTable
ALTER TABLE "user_role" ADD COLUMN     "reactivar_en" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "user_role_flg_activo_reactivar_en_idx" ON "user_role"("flg_activo", "reactivar_en");
