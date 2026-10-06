import { describe, expect, it } from "vitest";
import { construirSvgMacro } from "../macro-plano-svg";
import { PlanoSeccionEntity } from "@/domain/models/plano-entities";

type Seccion = Parameters<typeof construirSvgMacro>[2][number];

function seccion(overrides: Partial<Seccion> = {}): Seccion {
  return { nombre: "Pabellon D", x: 0.1, y: 0.2, w: 0.05, h: 0.04, ...overrides } as PlanoSeccionEntity;
}

describe("construirSvgMacro", () => {
  it("dibuja el rectangulo de la seccion con su nombre (coordenadas normalizadas)", () => {
    const svg = construirSvgMacro(2000, 1000, [seccion()]);
    expect(svg).toContain('width="2000" height="1000"');
    expect(svg).toContain('<rect x="200" y="200" width="100" height="40"');
    expect(svg).toContain(">Pabellon D</text>");
    expect(svg).toContain("#f59e0b");
  });

  it("usa el poligono real cuando la seccion trae puntos (seccion libre)", () => {
    const svg = construirSvgMacro(1000, 500, [
      seccion({ nombre: "Libre", puntos: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.1 }, { x: 0.15, y: 0.3 }] }),
    ]);
    expect(svg).toContain('<polygon points="100,50 200,50 150,150"');
    expect(svg).not.toContain("<rect");
  });

  it("escapa el nombre de la seccion para no romper el XML", () => {
    const svg = construirSvgMacro(800, 600, [seccion({ nombre: "<b>&" })]);
    expect(svg).toContain("&lt;b&gt;&amp;");
  });
});
