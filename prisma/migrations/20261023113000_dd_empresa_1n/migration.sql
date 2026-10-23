-- Una empresa puede tener varias DD por evento (renovaciones e historial).
DROP INDEX IF EXISTS "debida_diligencia_empresa_id_evento_id_key";

CREATE INDEX "debida_diligencia_empresa_id_evento_id_created_at_idx"
  ON "debida_diligencia"("empresa_id", "evento_id", "created_at");

CREATE INDEX "debida_diligencia_empresa_id_fecha_vencimiento_idx"
  ON "debida_diligencia"("empresa_id", "fecha_vencimiento");
