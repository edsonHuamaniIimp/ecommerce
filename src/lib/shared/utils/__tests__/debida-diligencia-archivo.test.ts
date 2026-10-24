import { describe, expect, it } from "vitest";
import { DD_DOCUMENTO_MAX_BYTES } from "@/lib/shared/constants";
import { ddArchivoUtils } from "@/lib/shared/utils/debida-diligencia-archivo";

const PDF = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const DOCX = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);

describe("ddArchivoUtils.validar", () => {
  it("acepta PDF, JPG y PNG con firma binaria correcta", () => {
    expect(ddArchivoUtils.validar({ nombre: "ficha.pdf", size: PDF.length, bytes: PDF })).toBeNull();
    expect(ddArchivoUtils.validar({ nombre: "poderes.jpg", size: JPG.length, bytes: JPG })).toBeNull();
    expect(ddArchivoUtils.validar({ nombre: "dni.png", size: PNG.length, bytes: PNG })).toBeNull();
  });

  it("acepta DOCX cuando el tipo de documento lo permite", () => {
    expect(
      ddArchivoUtils.validar(
        { nombre: "declaracion.docx", size: DOCX.length, bytes: DOCX },
        { permitirDocx: true },
      ),
    ).toBeNull();
  });

  it("solo acepta PDF cuando la declaracion de vigencia lo exige", () => {
    expect(
      ddArchivoUtils.validar(
        { nombre: "vigencia.pdf", size: PDF.length, bytes: PDF },
        { soloPdf: true },
      ),
    ).toBeNull();
    expect(
      ddArchivoUtils.validar(
        { nombre: "vigencia.jpg", size: JPG.length, bytes: JPG },
        { soloPdf: true },
      ),
    ).toContain("Formato no permitido");
    expect(
      ddArchivoUtils.validar(
        { nombre: "vigencia.docx", size: DOCX.length, bytes: DOCX },
        { soloPdf: true },
      ),
    ).toContain("Formato no permitido");
  });

  it("rechaza DOCX por defecto y extensiones no admitidas", () => {
    expect(
      ddArchivoUtils.validar({ nombre: "declaracion.docx", size: DOCX.length, bytes: DOCX }),
    ).toContain("Formato no permitido");
    expect(ddArchivoUtils.validar({ nombre: "documento.docx", size: PDF.length, bytes: PDF })).toContain(
      "Formato no permitido",
    );
  });

  it("rechaza archivos cuya extension no coincide con el contenido", () => {
    expect(ddArchivoUtils.validar({ nombre: "ficha.pdf", size: JPG.length, bytes: JPG })).toContain(
      "no coincide",
    );
  });

  it("rechaza contenido que no es PDF, JPG ni PNG", () => {
    const texto = new TextEncoder().encode("esto no es un documento");
    expect(ddArchivoUtils.validar({ nombre: "ficha.pdf", size: texto.length, bytes: texto })).toContain(
      "no es un PDF",
    );
  });

  it("rechaza archivos mayores a 10 MB", () => {
    expect(
      ddArchivoUtils.validar({
        nombre: "ficha.pdf",
        size: DD_DOCUMENTO_MAX_BYTES + 1,
        bytes: PDF,
      }),
    ).toContain("supera el maximo");
  });
});

describe("ddArchivoUtils.nombreDesdeUrl", () => {
  it("acepta solo URLs internas de /uploads", () => {
    expect(ddArchivoUtils.nombreDesdeUrl("/uploads/abc-123.pdf")).toBe("abc-123.pdf");
    expect(ddArchivoUtils.nombreDesdeUrl("https://externo.com/archivo.pdf")).toBeNull();
    expect(ddArchivoUtils.nombreDesdeUrl("/uploads/../secreto.pdf")).toBeNull();
  });
});
