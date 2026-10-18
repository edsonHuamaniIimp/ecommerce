-- AlterTable
ALTER TABLE "solicitud_documento" ADD COLUMN     "sha256" VARCHAR(64);

-- CreateIndex
CREATE INDEX "solicitud_documento_sha256_idx" ON "solicitud_documento"("sha256");
