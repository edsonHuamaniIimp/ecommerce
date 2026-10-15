import { describe, expect, it, vi } from "vitest";
import { normalizarLinkArchivoIImp, validarArchivoIImp } from "../validar-archivo-iimp";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 400) {
      super(message);
      this.name = "DomainError";
    }
  },
}));

const BASE = "https://ecommerce.sistemasiimp.org.pe";

describe("normalizarLinkArchivoIImp", () => {
  it("convierte un link relativo /uploads en URL absoluta con la base", () => {
    expect(normalizarLinkArchivoIImp("/uploads/oc-1.pdf", BASE)).toBe(`${BASE}/uploads/oc-1.pdf`);
  });

  it("deja intacto un link http(s) absoluto", () => {
    expect(normalizarLinkArchivoIImp("https://web.iimp.org/archivos/oc.pdf", BASE)).toBe("https://web.iimp.org/archivos/oc.pdf");
  });

  it("un link relativo normalizado ya pasa la validacion del IIMP", () => {
    const normalizado = normalizarLinkArchivoIImp("/uploads/oc-1.pdf", BASE);
    expect(() => validarArchivoIImp({ tipo: "OC", link: normalizado }, 2)).not.toThrow();
  });
});

describe("validarArchivoIImp", () => {
  it("sigue rechazando un link relativo sin normalizar", () => {
    expect(() => validarArchivoIImp({ tipo: "OC", link: "/uploads/oc-1.pdf" }, 2)).toThrow();
  });

  it("acepta PAGO_TOTAL sin cuota (total de la cuenta)", () => {
    expect(() => validarArchivoIImp({ tipo: "PAGO_TOTAL", link: "https://x/pago-total.pdf" }, 2)).not.toThrow();
  });

  it("acepta PAGO_TOTAL con cuota y la acota al rango de la cuenta", () => {
    expect(() => validarArchivoIImp({ tipo: "PAGO_TOTAL", cuota: 2, link: "https://x/pago-total.pdf" }, 2)).not.toThrow();
    expect(() => validarArchivoIImp({ tipo: "PAGO_TOTAL", cuota: 3, link: "https://x/pago-total.pdf" }, 2)).toThrow();
  });

  it("acepta VALORIZACION_COTIZACION sin cuota o con cuota", () => {
    expect(() => validarArchivoIImp({ tipo: "VALORIZACION_COTIZACION", link: "https://x/valorizacion.pdf" }, 2)).not.toThrow();
    expect(() => validarArchivoIImp({ tipo: "VALORIZACION_COTIZACION", cuota: 2, link: "https://x/valorizacion.pdf" }, 2)).not.toThrow();
  });
});
