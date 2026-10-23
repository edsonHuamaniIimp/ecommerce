-- CreateTable
CREATE TABLE "dd_matriz_vinculo" (
    "id" TEXT NOT NULL,
    "expediente_id" TEXT NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "ref_key" VARCHAR(60) NOT NULL,
    "origen" VARCHAR(15) NOT NULL DEFAULT 'automatico',
    "nombre" VARCHAR(250) NOT NULL,
    "tipo_documento" VARCHAR(30),
    "documento" VARCHAR(30),
    "nacionalidad" VARCHAR(80),
    "cargo" VARCHAR(120),
    "ambito" VARCHAR(15) NOT NULL DEFAULT 'nacional',
    "ambito_editado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_inicio_actividades" DATE,
    "estado_contribuyente" VARCHAR(80),
    "direccion_legal" VARCHAR(400),
    "historial_iimp" VARCHAR(5),
    "beneficio_mutuo" VARCHAR(5),
    "listas" JSONB NOT NULL DEFAULT '{}',
    "sig_fecha" TIMESTAMP(3),
    "sig_responsable" VARCHAR(200),
    "sig_resultado" VARCHAR(20),
    "sig_observaciones" VARCHAR(2000),
    "sig_conclusion" VARCHAR(40),
    "rep_fecha" TIMESTAMP(3),
    "rep_responsable" VARCHAR(200),
    "rep_resultado" VARCHAR(20),
    "rep_observaciones" VARCHAR(2000),
    "rep_conclusion" VARCHAR(40),
    "cmp_fecha" TIMESTAMP(3),
    "cmp_responsable" VARCHAR(200),
    "cmp_resultado" VARCHAR(20),
    "cmp_observaciones" VARCHAR(2000),
    "cmp_conclusion" VARCHAR(40),
    "resultado_final" VARCHAR(30),
    "final_fecha" TIMESTAMP(3),
    "final_por" VARCHAR(200),
    "creado_por" VARCHAR(200) NOT NULL,
    "actualizado_por" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dd_matriz_vinculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dd_matriz_adjunto" (
    "id" TEXT NOT NULL,
    "vinculo_id" TEXT NOT NULL,
    "categoria" VARCHAR(30) NOT NULL,
    "nombre" VARCHAR(250) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "tamano" INTEGER NOT NULL,
    "creado_por" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dd_matriz_adjunto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dd_matriz_vinculo_expediente_id_idx" ON "dd_matriz_vinculo"("expediente_id");

-- CreateIndex
CREATE INDEX "dd_matriz_vinculo_resultado_final_idx" ON "dd_matriz_vinculo"("resultado_final");

-- CreateIndex
CREATE INDEX "dd_matriz_vinculo_sig_conclusion_idx" ON "dd_matriz_vinculo"("sig_conclusion");

-- CreateIndex
CREATE INDEX "dd_matriz_vinculo_expediente_id_ambito_idx" ON "dd_matriz_vinculo"("expediente_id", "ambito");

-- CreateIndex
CREATE UNIQUE INDEX "dd_matriz_vinculo_expediente_id_tipo_ref_key_key" ON "dd_matriz_vinculo"("expediente_id", "tipo", "ref_key");

-- CreateIndex
CREATE INDEX "dd_matriz_adjunto_vinculo_id_categoria_idx" ON "dd_matriz_adjunto"("vinculo_id", "categoria");

-- AddForeignKey
ALTER TABLE "dd_matriz_vinculo" ADD CONSTRAINT "dd_matriz_vinculo_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "debida_diligencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dd_matriz_adjunto" ADD CONSTRAINT "dd_matriz_adjunto_vinculo_id_fkey" FOREIGN KEY ("vinculo_id") REFERENCES "dd_matriz_vinculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Permiso propio de la Matriz de evaluacion DD: se concede a los roles que ya tienen la
-- Bandeja DD (dd:revision), sin duplicar ni alterar roles personalizados.
UPDATE "role"
SET permisos = array_append(permisos, 'dd:matriz')
WHERE 'dd:revision' = ANY (permisos) AND NOT ('dd:matriz' = ANY (permisos));
