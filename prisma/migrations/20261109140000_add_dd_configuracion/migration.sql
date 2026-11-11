CREATE TABLE "dd_configuracion" (
    "id" VARCHAR(20) NOT NULL DEFAULT 'default',
    "plazo_dias_habiles" INTEGER NOT NULL DEFAULT 3,
    "estado_cierre_automatico" VARCHAR(30) NOT NULL DEFAULT 'sin_respuesta',
    "exigir_evidencia" BOOLEAN NOT NULL DEFAULT true,
    "permitir_na_sin_evidencia" BOOLEAN NOT NULL DEFAULT true,
    "revalidacion_declaracion" BOOLEAN NOT NULL DEFAULT true,
    "no_apto_bloquea_empresa" BOOLEAN NOT NULL DEFAULT true,
    "legal_solo_derivacion_sig" BOOLEAN NOT NULL DEFAULT true,
    "vigencia_meses" INTEGER NOT NULL DEFAULT 6,
    "permitir_reutilizacion_vinculo" BOOLEAN NOT NULL DEFAULT true,
    "manual_url" VARCHAR(500),
    "reglamento_url" VARCHAR(500),
    "plantilla_informe_url" VARCHAR(500),
    "link_listas_url" VARCHAR(500),
    "updated_by" VARCHAR(200),
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dd_configuracion_pkey" PRIMARY KEY ("id")
);
