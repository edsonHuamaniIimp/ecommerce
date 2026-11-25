import { describe, expect, it } from "vitest";
import { TIPOS_CONTRATO, TIPOS_SOLICITUD } from "@/lib/shared/constants";
import { esTipoContrato, resolverTipoContrato } from "../tipo-contrato";

describe("resolverTipoContrato", () => {
  it("prioriza el tipo persistido sobre el tipo de solicitud", () => {
    expect(resolverTipoContrato(TIPOS_CONTRATO.ESTANDAR, TIPOS_SOLICITUD.RESERVA_EMPRESA)).toBe(TIPOS_CONTRATO.ESTANDAR);
    expect(resolverTipoContrato(TIPOS_CONTRATO.OPERADOR_INTERNACIONAL, null)).toBe(TIPOS_CONTRATO.OPERADOR_INTERNACIONAL);
  });

  it("deduce del tipo de solicitud cuando no hay valor persistido (solicitudes anteriores)", () => {
    expect(resolverTipoContrato(null, TIPOS_SOLICITUD.RESERVA_EMPRESA)).toBe(TIPOS_CONTRATO.OPERADOR_INTERNACIONAL);
    expect(resolverTipoContrato(undefined, null)).toBe(TIPOS_CONTRATO.ESTANDAR);
  });

  it("ignora valores desconocidos", () => {
    expect(esTipoContrato("otro")).toBe(false);
    expect(resolverTipoContrato("otro", TIPOS_SOLICITUD.RESERVA_EMPRESA)).toBe(TIPOS_CONTRATO.OPERADOR_INTERNACIONAL);
  });
});
