import { describe, expect, it } from "vitest";
import { TIPOS_SOLICITUD } from "@/lib/shared/constants";
import { permiteCorreosSolicitud } from "../correos-solicitud";

describe("permiteCorreosSolicitud", () => {
  it("bloquea correos para reserva_empresa", () => {
    expect(permiteCorreosSolicitud(TIPOS_SOLICITUD.RESERVA_EMPRESA)).toBe(false);
  });

  it("permite correos regulares y tipos desconocidos", () => {
    expect(permiteCorreosSolicitud(null)).toBe(true);
    expect(permiteCorreosSolicitud(undefined)).toBe(true);
    expect(permiteCorreosSolicitud("regular")).toBe(true);
    expect(permiteCorreosSolicitud("otro")).toBe(true);
  });
});
