import { describe, expect, it } from "vitest";
import { seccionPuntosUtils, type PuntoSeccion } from "../seccion-puntos";

describe("seccionPuntosUtils.esPoligono", () => {
  it("acepta 3 o mas puntos validos", () => {
    expect(seccionPuntosUtils.esPoligono([{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.1 }, { x: 0.15, y: 0.2 }])).toBe(true);
  });

  it("rechaza null, menos de 3 puntos o valores invalidos", () => {
    expect(seccionPuntosUtils.esPoligono(null)).toBe(false);
    expect(seccionPuntosUtils.esPoligono(undefined)).toBe(false);
    expect(seccionPuntosUtils.esPoligono([{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }])).toBe(false);
    expect(seccionPuntosUtils.esPoligono([{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }, { x: "a", y: 0.3 }])).toBe(false);
  });
});

describe("seccionPuntosUtils.bbox", () => {
  it("calcula el bounding box normalizado", () => {
    const puntos: PuntoSeccion[] = [{ x: 0.2, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.3, y: 0.4 }];
    const r = seccionPuntosUtils.bbox(puntos);
    expect(r.x).toBeCloseTo(0.2, 6);
    expect(r.y).toBeCloseTo(0.1, 6);
    expect(r.w).toBeCloseTo(0.3, 6);
    expect(r.h).toBeCloseTo(0.3, 6);
  });

  it("limita a 0-1 y garantiza tamaño minimo", () => {
    const r = seccionPuntosUtils.bbox([{ x: -0.5, y: -0.5 }, { x: 0.2, y: 0.2 }, { x: 0.2, y: 0.2 }]);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.w).toBeCloseTo(0.2, 6);
    expect(r.h).toBeCloseTo(0.2, 6);
  });
});

describe("seccionPuntosUtils.mover", () => {
  it("desplaza todos los puntos", () => {
    expect(seccionPuntosUtils.mover([{ x: 0.25, y: 0.5 }, { x: 0.5, y: 0.75 }, { x: 0.75, y: 0.25 }], 0.25, -0.25)).toEqual([
      { x: 0.5, y: 0.25 },
      { x: 0.75, y: 0.5 },
      { x: 1, y: 0 },
    ]);
  });
});

describe("seccionPuntosUtils.rotar", () => {
  it("rota 90 grados alrededor del centro", () => {
    const centro: PuntoSeccion = { x: 0.5, y: 0.5 };
    const r = seccionPuntosUtils.rotar([{ x: 0.6, y: 0.5 }, { x: 0.5, y: 0.6 }, { x: 0.4, y: 0.5 }], centro, 90);
    expect(r[0]!.x).toBeCloseTo(0.5, 6);
    expect(r[0]!.y).toBeCloseTo(0.6, 6);
    expect(r[1]!.x).toBeCloseTo(0.4, 6);
    expect(r[1]!.y).toBeCloseTo(0.5, 6);
  });
});

describe("seccionPuntosUtils.limitar", () => {
  it("recorta valores fuera de 0-1", () => {
    expect(seccionPuntosUtils.limitar([{ x: -1, y: 2 }, { x: 0.5, y: 0.5 }, { x: 3, y: -0.2 }])).toEqual([
      { x: 0, y: 1 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 0 },
    ]);
  });
});
