import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as constantes from "@/lib/shared/constants";

/**
 * Los scripts que corren sueltos en los contenedores (sin build) no pueden importar TypeScript, asi que
 * declaran un espejo de las constantes que usan (`const DD_X = {...}`). Este test falla si el espejo
 * se desincroniza de src/lib/shared/constants.ts: nada de valores sueltos distintos a los del sistema.
 */
const SCRIPTS = [
  "scripts/dd-documentacion-recibida/backfill-documentacion-recibida.cjs",
  "scripts/e2e-dd-qa/ronda6.mjs",
  "scripts/e2e-dd-qa/local-observaciones-playwright.mjs",
  "scripts/e2e-dd-qa/ronda7.mjs",
];

const DECLARACION = /^const (DD_[A-Z0-9_]+) = (\{[\s\S]*?\}|"[^"\n]*");/gm;

function espejos(ruta: string): Array<{ nombre: string; valor: unknown }> {
  const fuente = readFileSync(join(process.cwd(), ruta), "utf8");
  return [...fuente.matchAll(DECLARACION)].map(([, nombre, literal]) => ({
    nombre: nombre!,
    valor: new Function(`return (${literal});`)() as unknown,
  }));
}

describe("espejo de constantes en scripts", () => {
  for (const ruta of SCRIPTS) {
    it(`${ruta} usa los mismos valores que constants.ts`, () => {
      const lista = espejos(ruta);
      expect(lista.length).toBeGreaterThan(0);
      const registro = constantes as unknown as Record<string, unknown>;
      for (const { nombre, valor } of lista) {
        const original = registro[nombre];
        expect(original, `${nombre} no existe en constants.ts`).toBeDefined();
        if (typeof valor === "string") {
          expect(valor, nombre).toBe(original);
          continue;
        }
        for (const [clave, dato] of Object.entries(valor as Record<string, unknown>)) {
          expect(dato, `${nombre}.${clave}`).toBe((original as Record<string, unknown>)[clave]);
        }
      }
    });
  }
});
