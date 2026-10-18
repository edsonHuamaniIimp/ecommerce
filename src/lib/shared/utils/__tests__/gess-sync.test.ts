import { describe, expect, it } from "vitest";
import { ESTADOS_STAND } from "@/lib/shared/constants";
import { calcularPrevisualizacionSync, medidasEsperadasDesdeApi } from "../gess-sync";

describe("medidasEsperadasDesdeApi", () => {
  it("usa precio + moneda del API", () => {
    expect(medidasEsperadasDesdeApi({ tipo: "PREFERENCIAL", precio: "9240.00", moneda: "USD" })).toBe("9240.00 USD");
  });

  it("cae al catalogo por tipo cuando el API no informa precio", () => {
    expect(medidasEsperadasDesdeApi({ tipo: "PREFERENCIAL 6MT2", precio: "", moneda: "USD" })).toBe("3000.00 US$");
  });

  it("devuelve null sin precio ni tipo", () => {
    expect(medidasEsperadasDesdeApi({})).toBeNull();
  });
});

describe("calcularPrevisualizacionSync", () => {
  it("detecta cambios de precio, tipo y empresa", () => {
    const preview = calcularPrevisualizacionSync(
      [{ standApiId: "A1", standCode: "101", tipoStand: "ESTANDAR", medidas: "1000.00 USD", empresa: "VIEJA", estado: ESTADOS_STAND.DISPONIBLE }],
      [{ id: "A1", tipo: "PREFERENCIAL", precio: "2000.00", moneda: "USD", empresa: "NUEVA" }],
    );

    expect(preview.precios).toEqual([{ standCode: "101", antes: "1000.00 USD", despues: "2000.00 USD" }]);
    expect(preview.tipos).toEqual([{ standCode: "101", antes: "ESTANDAR", despues: "PREFERENCIAL" }]);
    expect(preview.empresas).toEqual([{ standCode: "101", antes: "VIEJA", despues: "NUEVA" }]);
    expect(preview.sinCambios).toBe(0);
    expect(preview.vinculados).toBe(0);
  });

  it("no cuenta la empresa de una pre-reserva local", () => {
    const preview = calcularPrevisualizacionSync(
      [{ standApiId: "A1", standCode: "101", medidas: "1000.00 USD", empresa: "LOCAL", estado: ESTADOS_STAND.PRE_RESERVADO }],
      [{ id: "A1", precio: "1000.00", moneda: "USD", empresa: "API" }],
    );

    expect(preview.empresas).toEqual([]);
    expect(preview.precios).toEqual([]);
    expect(preview.sinCambios).toBe(1);
  });

  it("cuenta nuevos del API y filas solo locales sin borrar nada", () => {
    const preview = calcularPrevisualizacionSync(
      [{ standApiId: "A1", standCode: "101", medidas: "1000.00 USD", bloqueId: "BLOQUE-101" }],
      [
        { id: "A1", precio: "1000.00", moneda: "USD" },
        { id: "A2", precio: "2000.00", moneda: "USD" },
      ],
    );

    expect(preview.vinculados).toBe(1);
    expect(preview.nuevosApi).toBe(1);
    expect(preview.soloBd).toBe(0);
    expect(preview.sinCambios).toBe(1);
  });

  it("reporta filas de BD que ya no estan en el API", () => {
    const preview = calcularPrevisualizacionSync(
      [{ standApiId: "OLD", standCode: "BLOQUE-01", medidas: "2000.00 US$" }],
      [{ id: "A1", precio: "1000.00", moneda: "USD" }],
    );

    expect(preview.soloBd).toBe(1);
    expect(preview.nuevosApi).toBe(1);
  });
});
