import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const normalizar = (c: string) => c.trim().toUpperCase();

function firma(t: { label: string; nombre: string; w: number; d: number; h: number; color: string; ambito: string }) {
  return [t.label, t.nombre, t.w, t.d, t.h, t.color, t.ambito].join("|");
}

async function main() {
  const [tipos, globales, bloques] = await Promise.all([
    prisma.planoTipoBloque.findMany(),
    prisma.tipoBloqueGlobal.findMany({ orderBy: { codigo: "asc" } }),
    prisma.planoBloque.count(),
  ]);

  const porCodigo = new Map<string, typeof tipos>();
  for (const t of tipos) {
    const key = normalizar(t.codigo);
    const lista = porCodigo.get(key) ?? [];
    lista.push(t);
    porCodigo.set(key, lista);
  }

  const conflictos = [...porCodigo.entries()].filter(([, lista]) => new Set(lista.map(firma)).size > 1);
  const casing = [...porCodigo.entries()].flatMap(([key, lista]) =>
    lista.filter((t) => normalizar(t.codigo) !== t.codigo).map((t) => `${t.codigo} (normalizado: ${key})`),
  );
  const bloquesConCasing = await prisma.$queryRaw<Array<{ tipo: string; n: bigint }>>`
    SELECT "tipoCodigo" AS tipo, COUNT(*)::bigint AS n
    FROM "plano_bloque"
    WHERE UPPER(BTRIM("tipoCodigo")) <> "tipoCodigo"
    GROUP BY 1
  `;

  console.log(`Tipos por mapa: ${tipos.length}`);
  console.log(`Codigos unicos: ${porCodigo.size}`);
  console.log(`Catalogo global: ${globales.length}`);
  console.log(`Bloques (no deben cambiar): ${bloques}`);
  console.log(`Conflictos de medidas/color/ambito: ${conflictos.length}`);
  console.log(`Codigos de tipo con casing/espacios raros: ${casing.length}${casing.length > 0 ? ` -> ${casing.join(", ")}` : ""}`);
  console.log(`Bloques con tipoCodigo sin normalizar: ${bloquesConCasing.length}${bloquesConCasing.length > 0 ? ` -> ${bloquesConCasing.map((b) => `${b.tipo} (${b.n})`).join(", ")}` : ""}`);

  for (const [codigo, lista] of conflictos) {
    console.log(`\n[${codigo}] ${lista.length} variantes:`);
    for (const t of lista) {
      console.log(
        `  plano=${t.planoId} label=${t.label} nombre=${t.nombre} ${t.w}x${t.d}x${t.h} color=${t.color} ambito=${t.ambito} activo=${t.flgActivo}`,
      );
    }
    const elegido = globales.find((g) => g.codigo === codigo);
    if (elegido) {
      console.log(
        `  -> catalogo: label=${elegido.label} nombre=${elegido.nombre} ${elegido.w}x${elegido.d}x${elegido.h} color=${elegido.color} ambito=${elegido.ambito} activo=${elegido.flgActivo}`,
      );
    }
  }

  await prisma.$disconnect();
  await pool.end();
}

void main();
