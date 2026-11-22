import { describe, expect, it } from "vitest";
import { ddEvidenciaDetalles, etiquetaCategoriaAdjunto, formatearTamano } from "../dd-evidencia-detalles";

describe("dd-evidencia-detalles", () => {
  it("formatea tamaños", () => {
    expect(formatearTamano(500)).toBe("1 KB");
    expect(formatearTamano(2 * 1024 * 1024)).toBe("2.0 MB");
  });

  it("usa el nombre del criterio para categorias criterio_*", () => {
    expect(etiquetaCategoriaAdjunto("criterio_sanciones_europa")).toBe("Criterio: Sanciones europeas");
    expect(etiquetaCategoriaAdjunto("criterio_inexistente")).toBe("criterio_inexistente");
  });

  it("arma los detalles de un adjunto con quien y cuando", () => {
    const detalles = ddEvidenciaDetalles.deAdjunto({
      categoria: "criterio_sanciones_europa",
      nombre: "Evidencia.pdf",
      mimeType: "application/pdf",
      tamano: 3 * 1024 * 1024,
      creadoPor: "sig@iimp.org.pe",
      createdAt: "2026-11-21T14:00:00.000Z",
    });
    const mapa = Object.fromEntries(detalles.map((d) => [d.etiqueta, d.valor]));
    expect(mapa["Subido por"]).toBe("sig@iimp.org.pe");
    expect(mapa["Formato"]).toBe("PDF");
    expect(mapa["Tamaño"]).toBe("3.0 MB");
    expect(mapa["Fecha de carga"]).not.toBe("—");
  });

  it("muestra guion cuando faltan datos", () => {
    const mapa = Object.fromEntries(
      ddEvidenciaDetalles.deAdjunto({ categoria: "x", nombre: "sin-extension" }).map((d) => [d.etiqueta, d.valor]),
    );
    expect(mapa["Subido por"]).toBe("—");
    expect(mapa["Fecha de carga"]).toBe("—");
  });
});
