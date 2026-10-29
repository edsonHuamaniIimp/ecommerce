import { describe, expect, it } from "vitest";
import { empresaPerfilPendiente } from "../empresa-perfil";

const base = {
  tipoDocumento: "6",
  ruc: "20601234567",
  razonSocial: "Minera Demo S.A.C.",
  pais: "PE",
  inicioOperaciones: "2020-01-15",
  partidaElectronica: "11014857",
  representanteLegalNombre: "Juan Perez",
  representanteLegalTipoDocumento: "1",
  representanteLegalDni: "45871233",
  representanteCorreo: "juan@minera.pe",
  representanteCelular: "999888777",
  representanteDireccion: "Av. Los Ingenieros 245",
  primerAccesoCompletado: true,
};

describe("empresaPerfilPendiente", () => {
  it("perfil completo no queda pendiente", () => {
    expect(empresaPerfilPendiente(base)).toEqual({ pendiente: false, camposFaltantes: [] });
  });

  it("RUC exige partida electronica", () => {
    const r = empresaPerfilPendiente({ ...base, partidaElectronica: "" });
    expect(r.pendiente).toBe(true);
    expect(r.camposFaltantes).toContain("Partida electronica");
  });

  it("RUT no exige partida electronica", () => {
    const r = empresaPerfilPendiente({
      ...base,
      tipoDocumento: "0",
      ruc: "FR48305461063",
      partidaElectronica: null,
    });
    expect(r.pendiente).toBe(false);
  });

  it("exige inicio de operaciones y datos del representante", () => {
    const r = empresaPerfilPendiente({
      ...base,
      inicioOperaciones: null,
      representanteCorreo: "",
    });
    expect(r.camposFaltantes).toEqual(
      expect.arrayContaining(["Inicio de operaciones", "Correo del representante legal"]),
    );
  });

  it("flag de primer acceso pendiente marca el perfil", () => {
    expect(empresaPerfilPendiente({ ...base, primerAccesoCompletado: false }).pendiente).toBe(true);
  });
});
