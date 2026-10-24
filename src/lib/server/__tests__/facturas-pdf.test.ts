import { afterEach, describe, expect, it, vi } from "vitest";
import { nombreFacturaIimp, urlFacturaIimp } from "../facturas-pdf";

const documento = {
  tipoDocumento: "01",
  serie: "FRS1",
  numero: 4,
  fechaEmision: "2026-10-06",
  tipoCambio: "3.435",
  igv: "1339.20",
  total: "8779.20",
};

describe("urlFacturaIimp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("construye la URL con la plantilla configurada", () => {
    vi.stubEnv("FACTURAS_PDF_URL_TEMPLATE", "https://cdn.example/pdf/{ruc}-{tipo}-{serie}-{numero}.pdf");
    vi.stubEnv("FACTURAS_EMISOR_RUC", "20107972090");

    expect(urlFacturaIimp(documento)).toBe("https://cdn.example/pdf/20107972090-01-FRS1-4.pdf");
    expect(nombreFacturaIimp(documento)).toBe("FRS1-4.pdf");
  });

  it("devuelve null si no hay plantilla", () => {
    expect(urlFacturaIimp(documento)).toBeNull();
  });

  it("devuelve null si la plantilla requiere RUC y no esta configurado", () => {
    vi.stubEnv("FACTURAS_PDF_URL_TEMPLATE", "https://cdn.example/pdf/{ruc}-{tipo}-{serie}-{numero}.pdf");
    expect(urlFacturaIimp(documento)).toBeNull();
  });

  it("rechaza protocolos que no sean HTTP/HTTPS", () => {
    vi.stubEnv("FACTURAS_PDF_URL_TEMPLATE", "file:///tmp/{serie}-{numero}.pdf");
    expect(urlFacturaIimp(documento)).toBeNull();
  });
});
