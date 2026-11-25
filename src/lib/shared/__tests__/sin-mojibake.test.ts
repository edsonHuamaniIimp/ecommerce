import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Guardia de codificación: el código fuente no debe contener texto UTF-8 leído como
 * Latin-1 ("separaciÃ³n", "â€”"), caracteres de reemplazo (U+FFFD) ni comentarios
 * cortados por escapes de PowerShell (`n convertido en salto de línea).
 */
const RAIZ = join(process.cwd(), "src");
const EXTENSIONES = /\.(ts|tsx|css|json|md)$/;
const MOJIBAKE = /Ã[\u0080-\u00BF¡-ÿ]|Â[·§°º ª]|â€|\uFFFD/;
/* Archivos que contienen secuencias rotas a propósito (tablas de reparación y sus tests). */
const PERMITIDOS = new Set([
  "lib/shared/utils/sgc.ts",
  "lib/shared/utils/__tests__/sgc.test.ts",
  "lib/shared/__tests__/sin-mojibake.test.ts",
]);

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return nombre === "node_modules" ? [] : archivos(ruta);
    return EXTENSIONES.test(nombre) ? [ruta] : [];
  });
}

describe("codificación del código fuente", () => {
  it("no contiene mojibake ni caracteres de reemplazo", () => {
    const hallazgos: string[] = [];
    for (const ruta of archivos(RAIZ)) {
      const rel = relative(RAIZ, ruta).split("\\").join("/");
      if (PERMITIDOS.has(rel)) continue;
      readFileSync(ruta, "utf8")
        .split(/\r?\n/)
        .forEach((linea, i) => {
          if (MOJIBAKE.test(linea)) hallazgos.push(`${rel}:${i + 1}: ${linea.trim().slice(0, 100)}`);
        });
    }
    expect(hallazgos).toEqual([]);
  });
});
