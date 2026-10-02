-- CreateTable
CREATE TABLE "tipo_bloque_global" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "label" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "w" REAL NOT NULL,
    "d" REAL NOT NULL,
    "h" REAL NOT NULL,
    "color" VARCHAR(10) NOT NULL,
    "ambito" VARCHAR(10) NOT NULL DEFAULT 'interno',
    "flg_activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipo_bloque_global_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipo_bloque_global_codigo_key" ON "tipo_bloque_global"("codigo");

-- Backfill idempotente: un registro por codigo normalizado (UPPER/TRIM).
-- Gana la variante activa con mas bloques asignados; empates se resuelven por id (determinista).
INSERT INTO "tipo_bloque_global" (
    "id", "codigo", "label", "nombre", "w", "d", "h", "color", "ambito", "flg_activo", "created_at", "updated_at"
)
SELECT
    gen_random_uuid()::text,
    t."codigo",
    t."label",
    t."nombre",
    t."w",
    t."d",
    t."h",
    t."color",
    t."ambito",
    t."flg_activo",
    now(),
    now()
FROM (
    SELECT DISTINCT ON (UPPER(BTRIM(ptb."codigo")))
        UPPER(BTRIM(ptb."codigo")) AS "codigo",
        ptb."label",
        ptb."nombre",
        ptb."w",
        ptb."d",
        ptb."h",
        ptb."color",
        ptb."ambito",
        ptb."flg_activo",
        COUNT(pb."id") AS "usos"
    FROM "plano_tipo_bloque" ptb
    LEFT JOIN "plano_bloque" pb ON pb."tipo_id" = ptb."id"
    GROUP BY ptb."id", ptb."codigo", ptb."label", ptb."nombre", ptb."w", ptb."d", ptb."h", ptb."color", ptb."ambito", ptb."flg_activo"
    ORDER BY UPPER(BTRIM(ptb."codigo")), ptb."flg_activo" DESC, "usos" DESC, ptb."id"
) t
ON CONFLICT ("codigo") DO NOTHING;