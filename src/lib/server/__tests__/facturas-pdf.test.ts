import { afterEach, describe, expect, it, vi } from "vitest";
import { nombreFacturaIimp, urlDocumentoSie, urlFacturaIimp } from "../facturas-pdf";

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

describe("urlDocumentoSie", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parsea el nombre RUC-TIPO-SERIE-NUMERO y aplica la plantilla", () => {
    vi.stubEnv("FACTURAS_PDF_URL_TEMPLATE", "https://cdn.example/vouchers/{ruc}-{tipo}-{serie}-{numero}.pdf");
    vi.stubEnv("FACTURAS_EMISOR_RUC", "20107972090");

    expect(urlDocumentoSie("20107972090-01-F009-3303.pdf")).toBe("https://cdn.example/vouchers/20107972090-01-F009-3303.pdf");
  });

  it("soporta plantillas con {documento}", () => {
    vi.stubEnv("FACTURAS_PDF_URL_TEMPLATE", "https://cdn.example/vouchers/{documento}");

    expect(urlDocumentoSie("20107972090-01-F009-3303.pdf")).toBe("https://cdn.example/vouchers/20107972090-01-F009-3303.pdf");
  });

  it("acepta nombres fuera del patron si la plantilla usa {documento}", () => {
    vi.stubEnv("FACTURAS_PDF_URL_TEMPLATE", "https://cdn.example/vouchers/{documento}");

    expect(urlDocumentoSie("factura-especial.pdf")).toBe("https://cdn.example/vouchers/factura-especial.pdf");
  });

  it("rechaza nombres con traversal o extension distinta", () => {
    vi.stubEnv("FACTURAS_PDF_URL_TEMPLATE", "https://cdn.example/vouchers/{documento}");

    expect(urlDocumentoSie("../secreto.pdf")).toBeNull();
    expect(urlDocumentoSie("factura.docx")).toBeNull();
  });

  it("devuelve null sin plantilla o si el nombre no se puede parsear", () => {
    expect(urlDocumentoSie("20107972090-01-F009-3303.pdf")).toBeNull();

    vi.stubEnv("FACTURAS_PDF_URL_TEMPLATE", "https://cdn.example/vouchers/{ruc}-{tipo}-{serie}-{numero}.pdf");
    vi.stubEnv("FACTURAS_EMISOR_RUC", "20107972090");
    expect(urlDocumentoSie("documento-sin-patron.pdf")).toBeNull();
  });
});
