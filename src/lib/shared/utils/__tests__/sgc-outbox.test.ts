import { describe, it, expect } from "vitest";
import { calcularBackoffMs } from "../sgc-outbox";

describe("calcularBackoffMs", () => {
  it("deberia crecer exponencialmente desde la base", () => {
    expect(calcularBackoffMs(0, 1000)).toBe(1000);
    expect(calcularBackoffMs(1, 1000)).toBe(2000);
    expect(calcularBackoffMs(2, 1000)).toBe(4000);
    expect(calcularBackoffMs(3, 1000)).toBe(8000);
  });

  it("deberia tener un tope de una hora", () => {
    expect(calcularBackoffMs(20, 1000)).toBe(60 * 60 * 1000);
  });

  it("deberia tratar intentos negativos como 0", () => {
    expect(calcularBackoffMs(-5, 1000)).toBe(1000);
  });
});
