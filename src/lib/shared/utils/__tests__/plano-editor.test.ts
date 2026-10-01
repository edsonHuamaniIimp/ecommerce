import { describe, expect, it } from "vitest";
import { planoEditorUtils } from "../plano-editor";

describe("planoEditorUtils grados/radianes", () => {
  it("convierte en ambos sentidos", () => {
    expect(planoEditorUtils.aGrados(Math.PI)).toBeCloseTo(180);
    expect(planoEditorUtils.aRadianes(180)).toBeCloseTo(Math.PI);
  });

  it("normaliza a [0, 360)", () => {
    expect(planoEditorUtils.normalizarGrados(-90)).toBe(270);
    expect(planoEditorUtils.normalizarGrados(450)).toBe(90);
  });
});

describe("planoEditorUtils.snapGrados", () => {
  it("redondea al multiplo mas cercano", () => {
    expect(planoEditorUtils.snapGrados(7, 5)).toBe(5);
    expect(planoEditorUtils.snapGrados(8, 5)).toBe(10);
    expect(planoEditorUtils.snapGrados(88, 15)).toBe(90);
  });

  it("no rompe con paso invalido", () => {
    expect(planoEditorUtils.snapGrados(7, 0)).toBe(7);
  });
});

describe("planoEditorUtils.alinear", () => {
  const candidatos = [
    { id: "b:A", x: 5, z: 3 },
    { id: "f:PLAZA-01", x: 0, z: 0 },
  ];

  it("alinea al candidato mas cercano dentro del umbral", () => {
    const r = planoEditorUtils.alinear(4.8, 7.5, candidatos, 0.35);
    expect(r).toEqual({ x: 5, z: 7.5, guiaX: 5, guiaZ: null });
  });

  it("elige el candidato mas cercano entre varios", () => {
    const r = planoEditorUtils.alinear(0.2, 2.9, candidatos, 0.35);
    expect(r).toEqual({ x: 0, z: 3, guiaX: 0, guiaZ: 3 });
  });

  it("no ajusta nada si esta fuera del umbral", () => {
    const r = planoEditorUtils.alinear(4.5, 7.5, candidatos, 0.35);
    expect(r).toEqual({ x: 4.5, z: 7.5, guiaX: null, guiaZ: null });
  });

  it("sin candidatos mantiene la posicion", () => {
    const r = planoEditorUtils.alinear(1.25, -2.5, [], 0.35);
    expect(r).toEqual({ x: 1.25, z: -2.5, guiaX: null, guiaZ: null });
  });
});
