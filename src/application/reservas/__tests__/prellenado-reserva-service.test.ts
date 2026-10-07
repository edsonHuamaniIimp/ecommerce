import { describe, expect, it, vi } from "vitest";
import { TIPOS_DOCUMENTO_EMPRESA, TIPOS_DOCUMENTO_PERSONA } from "@/lib/shared/constants";
import { PrellenadoReservaApplicationService } from "../prellenado-reserva-service";
import type { IUsuarioRepository, VinculacionUsuario } from "@/domain/ports/usuario-repository";
import type { IEmpresaClient } from "@/domain/ports/empresa-client";
import type { IPersonaClient } from "@/domain/ports/persona-client";

function fakeUsuarioRepo(vinculacion: VinculacionUsuario | null) {
  return {
    findVinculacionPorEmail: vi.fn(async () => vinculacion),
  } as unknown as IUsuarioRepository;
}

function fakePersonaClient(persona: Record<string, unknown> | null) {
  return {
    buscarPorDocumento: vi.fn(async () => persona),
  } as unknown as IPersonaClient;
}

function fakeEmpresaClient(empresa: Record<string, unknown> | null) {
  return {
    buscarPorDocumento: vi.fn(async () => empresa),
  } as unknown as IEmpresaClient;
}

describe("PrellenadoReservaApplicationService (solo datos del propio usuario)", () => {
  it("prellena persona cuando el documento es del usuario logueado (sie_code coincide)", async () => {
    const svc = new PrellenadoReservaApplicationService(
      fakeUsuarioRepo({ sieCode: "P0000099999", idEmpresa: null }),
      fakePersonaClient({
        sie_code: "P0000099999",
        nombre_completo: "EDSON JORDAN HUAMANI ÑAHUIN",
        direccion: "MOTUPE",
        correo: "edson_4555@hotmail.com",
        celular: "918874873",
      }),
      fakeEmpresaClient(null),
    );

    const r = await svc.prellenar("edson_4555@hotmail.com", TIPOS_DOCUMENTO_PERSONA.DNI, "48570568");

    expect(r).toEqual({
      contacto: "EDSON JORDAN HUAMANI ÑAHUIN",
      direccion: "MOTUPE",
      telefono: "918874873",
      correo: "edson_4555@hotmail.com",
    });
  });

  it("acepta las etiquetas del wizard (DNI/RUC) normalizandolas a codigo", async () => {
    const personas = fakePersonaClient({
      sie_code: "P0000099999",
      celular: "918874873",
      correo: "edson_4555@hotmail.com",
    });
    const svc = new PrellenadoReservaApplicationService(
      fakeUsuarioRepo({ sieCode: "P0000099999", idEmpresa: null }),
      personas,
      fakeEmpresaClient(null),
    );

    const r = await svc.prellenar("edson_4555@hotmail.com", "DNI", "48570568");

    expect(r).toEqual({ telefono: "918874873", correo: "edson_4555@hotmail.com" });
    expect(personas.buscarPorDocumento).toHaveBeenCalledWith("48570568", TIPOS_DOCUMENTO_PERSONA.DNI);
  });

  it("NO prellena si el documento no corresponde al usuario (privacidad)", async () => {
    const svc = new PrellenadoReservaApplicationService(
      fakeUsuarioRepo({ sieCode: "P0000000001", idEmpresa: null }),
      fakePersonaClient({ sie_code: "P0000099999" }),
      fakeEmpresaClient(null),
    );

    const r = await svc.prellenar("otro@empresa.com", TIPOS_DOCUMENTO_PERSONA.DNI, "48570568");

    expect(r).toEqual({});
  });

  it("prellena empresa cuando el RUC es de la empresa del usuario (id_empresa coincide)", async () => {
    const svc = new PrellenadoReservaApplicationService(
      fakeUsuarioRepo({ sieCode: null, idEmpresa: "E0000003804" }),
      fakePersonaClient(null),
      fakeEmpresaClient({
        sie_code: "E0000003804",
        direccion: "CAL. LOS CANARIOS 155",
        correo: "contacto@iimp.org.pe",
        telefono: "+51987654321",
      }),
    );

    const r = await svc.prellenar("usuario@iimp.org.pe", TIPOS_DOCUMENTO_EMPRESA.RUC, "20107972090");

    expect(r).toEqual({
      direccion: "CAL. LOS CANARIOS 155",
      telefono: "+51987654321",
      correo: "contacto@iimp.org.pe",
    });
  });

  it("sin vinculacion o sin sesion devuelve {}", async () => {
    const svc = new PrellenadoReservaApplicationService(
      fakeUsuarioRepo(null),
      fakePersonaClient(null),
      fakeEmpresaClient(null),
    );

    expect(await svc.prellenar(null, TIPOS_DOCUMENTO_PERSONA.DNI, "48570568")).toEqual({});
    expect(await svc.prellenar("x@empresa.com", TIPOS_DOCUMENTO_PERSONA.DNI, "48570568")).toEqual({});
  });

  it("si la fuente falla devuelve {} (best-effort)", async () => {
    const personas = fakePersonaClient(null);
    vi.mocked(personas.buscarPorDocumento).mockRejectedValueOnce(new Error("fuente caida"));
    const svc = new PrellenadoReservaApplicationService(
      fakeUsuarioRepo({ sieCode: "P1", idEmpresa: null }),
      personas,
      fakeEmpresaClient(null),
    );

    expect(await svc.prellenar("x@empresa.com", TIPOS_DOCUMENTO_PERSONA.DNI, "48570568")).toEqual({});
  });
});
