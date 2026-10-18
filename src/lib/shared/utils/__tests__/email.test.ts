import { describe, expect, it } from "vitest";
import { documentoDesdeEmailProvisional, emailProvisionalPorDocumento, esEmailProvisional } from "../email";

describe("email provisional de empresa", () => {
  it("genera el correo provisional desde el documento", () => {
    expect(emailProvisionalPorDocumento("20100192064")).toBe("acceso-20100192064@acceso.iimp");
    expect(emailProvisionalPorDocumento("20-100192-064")).toBe("acceso-20100192064@acceso.iimp");
  });

  it("extrae el documento desde el correo provisional", () => {
    expect(documentoDesdeEmailProvisional("acceso-20100192064@acceso.iimp")).toBe("20100192064");
    expect(documentoDesdeEmailProvisional(" ACCESO-20100192064@ACCESO.IIMP ")).toBe("20100192064");
  });

  it("devuelve null para correos normales o invalidos", () => {
    expect(documentoDesdeEmailProvisional("lorena.ballon@molycop.pe")).toBeNull();
    expect(documentoDesdeEmailProvisional("")).toBeNull();
    expect(documentoDesdeEmailProvisional(null)).toBeNull();
  });

  it("reconoce solo el dominio provisional", () => {
    expect(esEmailProvisional("acceso-20100192064@acceso.iimp")).toBe(true);
    expect(esEmailProvisional("lorena.ballon@molycop.pe")).toBe(false);
  });
});