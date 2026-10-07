import { describe, expect, it } from "vitest";
import { construirSvgRecorte, viewBoxConMargen } from "../recorte-plano";
import type { PlanoItem } from "@/lib/shared/planos/registry";

function item(id: string, x: number, z: number, color = "#FFD700"): PlanoItem {
  return { id, dim: { w: 3, d: 3, h: 2.4, color }, type: "S", x, z, rotY: 0 };
}

const ITEMS = [item("EXT-01", 0, 0), item("EXT-02", 10, 0), item("EXT-03", 20, 5, "#32CD32")];

describe("viewBoxConMargen", () => {
  it("agrega el margen porcentual a los bounds", () => {
    const vb = viewBoxConMargen({ minX: 0, maxX: 100, minZ: 0, maxZ: 50 }, 0.1);
    expect(vb).toEqual({ x: -10, y: -5, w: 120, h: 60 });
  });

  it("garantiza un area minima cuando los bounds son degenerados", () => {
    const vb = viewBoxConMargen({ minX: 5, maxX: 5, minZ: 5, maxZ: 5 }, 0);
    expect(vb.w).toBeGreaterThanOrEqual(1);
    expect(vb.h).toBeGreaterThanOrEqual(1);
  });
});

describe("construirSvgRecorte (RF-08)", () => {
  it("resalta un stand (relleno ambar) y ademas lo senala con flecha y su codigo", () => {
    const { svg, encontrado } = construirSvgRecorte(ITEMS, ["EXT-02"]);
    expect(encontrado).toBe(true);
    expect(svg).toContain("TU STAND");
    expect(svg).toContain("EXT-02");
    expect(svg).toContain("#f59e0b"); // relleno resaltado del objetivo
    expect(svg).toContain("#b45309"); // flecha del objetivo
  });

  it("numera los stands cuando la reserva es multiple (1..n)", () => {
    const { svg, encontrado } = construirSvgRecorte(ITEMS, ["EXT-01", "EXT-03"]);
    expect(encontrado).toBe(true);
    expect(svg).not.toContain("TU STAND");
    expect(svg).toContain(">1</text>");
    expect(svg).toContain(">2</text>");
  });

  it("marca encontrado=false si el objetivo no esta en el plano", () => {
    const { encontrado } = construirSvgRecorte(ITEMS, ["NO-EXISTE"]);
    expect(encontrado).toBe(false);
  });

  it("incluye la leyenda de tipos con las etiquetas provistas", () => {
    const { svg } = construirSvgRecorte(ITEMS, ["EXT-01"], { etiquetas: { S: "Estandar" } });
    expect(svg).toContain("Estandar");
  });

  it("omite la leyenda cuando se pide", () => {
    const { svg } = construirSvgRecorte(ITEMS, ["EXT-01"], { sinLeyenda: true });
    expect(svg).not.toContain("Estandar");
  });

  it("escapa las etiquetas para no romper el XML", () => {
    const { svg } = construirSvgRecorte(ITEMS, ["EXT-01"], { etiquetas: { S: "<b>&" } });
    expect(svg).toContain("&lt;b&gt;&amp;");
  });

  it("usa el codigo comercial del objetivo cuando se provee (en vez del id del bloque)", () => {
    const { svg } = construirSvgRecorte([item("BLOQUE-774", 0, 0)], ["BLOQUE-774"], { codigos: { "BLOQUE-774": "774" } });
    expect(svg).toContain(">774</text>");
    expect(svg).not.toContain("BLOQUE-774");
  });
});
