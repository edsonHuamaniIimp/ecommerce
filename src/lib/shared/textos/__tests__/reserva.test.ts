import { describe, expect, it } from "vitest";
import { textosReserva } from "../reserva";

describe("textosReserva (toast/modal de reserva)", () => {
  it("devuelve espanol por defecto o con idioma no soportado", () => {
    expect(textosReserva(null).toastTitulo).toBe("Reserva enviada correctamente");
    expect(textosReserva("pt").modalBoton).toBe("Entendido");
  });

  it("devuelve ingles cuando el idioma es en", () => {
    const textos = textosReserva("en");
    expect(textos.toastTitulo).toBe("Request submitted successfully");
    expect(textos.toastDescripcion).toContain("Under review");
    expect(textos.pasos).toHaveLength(5);
    expect(textos.pasos[0]?.title).toBe("Request created");
    expect(textos.monitoreo.resaltado).toBe("My requests");
  });
});
