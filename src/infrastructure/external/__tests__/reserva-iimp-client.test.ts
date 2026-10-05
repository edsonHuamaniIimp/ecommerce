import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReservaIimpClient } from "../reserva-iimp-client";
import { resetListstandTokenCache } from "../liststand-client";
import type { ReservaIimpInput } from "@/domain/ports/reserva-iimp-client";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 400) {
      super(message);
      this.name = "DomainError";
    }
  },
}));

const INPUT: ReservaIimpInput = {
  tipEvCod: 2,
  evenCod: 19,
  stands: ["01", "21"],
  tipoFacturacion: "01",
  tipDocFacturacion: "6",
  numDocFacturacion: "20100171814",
  razonSocial: "HIDROSTAL S.A.",
  dirFacturacion: "CAL. PORTADA DEL SOL NRO. 722",
  web: "https://www.hidrostal.com.pe",
  telefono: "51-1-3191000",
  friso: "HIDROSTAL",
  contactos: {
    contrato: { nombre: "Manuel Mendieta", cargo: "Representante Legal", tipoDocumento: "1", numDocumento: "10295079", email: "mmendieta@hidrostal.com.pe" },
    pagos: { nombre: "Manuel Mendieta", email: "facturacion@hidrostal.com.pe" },
  },
  cuotas: [
    { porcentaje: 40, fecha: "2026-12-01" },
    { porcentaje: 60, fecha: "2027-01-15" },
  ],
};

const RESPUESTA = {
  TipEvCod: 2,
  EvenCod: 19,
  Contrato: "0000000001",
  CuentaCorriente: 1,
  Cliente: { Tipo: "E", Codigo: "E0000001153", Nombre: "HIDROSTAL S.A.", TipDocumento: "6", NumDocumento: "20100171814" },
  Moneda: "USD",
  Stands: [{ Numero: "01", Tipo: "PREFERENCIAL 6MT2", Pabellon: "PABELLON 1", Area: "6.00", Precio: "9240.00" }],
  Cuotas: [
    {
      Cuota: 1,
      Porcentaje: "40",
      Fecha: "2026-12-01",
      BaseImponible: "3696.00",
      IGV: "665.28",
      Total: "4361.28",
      Documento: { TipoDocumento: "01", Serie: "FRS1", Numero: 1, FechaEmision: "2026-10-05", TipoCambio: "3.442", IGV: "665.28", Total: "4361.28" },
    },
    { Cuota: 2, Porcentaje: "60", Fecha: "2027-01-15", BaseImponible: "5544.00", IGV: "997.92", Total: "6541.92" },
  ],
  BaseImponible: "9240.00",
  IGV: "1663.20",
  Total: "10903.20",
  success: true,
  message: "Success",
};

function resp(ok: boolean, status: number, body: unknown): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe("ReservaIimpClient (API de reserva del IIMP)", () => {
  beforeEach(() => {
    resetListstandTokenCache();
    process.env.LISTSTAND_API_URL = "https://api.test/api";
    process.env.LISTSTAND_USUARIO = "usuario";
    process.env.LISTSTAND_CLAVE = "clave";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envía el payload en PascalCase y mapea la respuesta con el documento de la 1ra cuota", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(true, 200, { token: "t1", expiraEnSegundos: 1800 }))
      .mockResolvedValueOnce(resp(true, 201, RESPUESTA));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await new ReservaIimpClient().reservar(INPUT);

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/auth/login");
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("https://api.test/api/stands/reserva");
    const body = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      TipEvCod: 2,
      EvenCod: 19,
      Stands: ["01", "21"],
      TipoFacturacion: "01",
      TipDocFacturacion: "6",
      NumDocFacturacion: "20100171814",
      RazonSocial: "HIDROSTAL S.A.",
      Contactos: {
        Contrato: { Nombre: "Manuel Mendieta", Cargo: "Representante Legal", TipoDocumento: "1", NumDocumento: "10295079" },
        Pagos: { Nombre: "Manuel Mendieta", Email: "facturacion@hidrostal.com.pe" },
      },
      Cuotas: [
        { Porcentaje: 40, Fecha: "2026-12-01" },
        { Porcentaje: 60, Fecha: "2027-01-15" },
      ],
    });
    expect(resultado.contrato).toBe("0000000001");
    expect(resultado.cuentaCorriente).toBe(1);
    expect(resultado.cliente.codigo).toBe("E0000001153");
    expect(resultado.cuotas[0]?.documento).toMatchObject({ serie: "FRS1", numero: 1, fechaEmision: "2026-10-05", tipoCambio: "3.442" });
    expect(resultado.cuotas[1]?.documento).toBeNull();
    expect(resultado.total).toBe("10903.20");
  });

  it("boleta a persona: envia nombres/apellidos y omite RazonSocial", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(true, 200, { token: "t1", expiraEnSegundos: 1800 }))
      .mockResolvedValueOnce(resp(true, 201, RESPUESTA));
    vi.stubGlobal("fetch", fetchMock);

    await new ReservaIimpClient().reservar({
      tipEvCod: 2,
      evenCod: 19,
      stands: ["01"],
      tipoFacturacion: "03",
      tipDocFacturacion: "1",
      numDocFacturacion: "48570568",
      apellidoPaternoFact: "HUAMANI",
      apellidoMaternoFact: "ÑAHUIN",
      nombresFact: "EDSON JORDAN",
      dirFacturacion: "MOTUPE",
      contactos: {
        contrato: { nombre: "EDSON JORDAN HUAMANI", telefono: "918874873" },
        pagos: { nombre: "EDSON JORDAN HUAMANI", email: "edson@persona.pe" },
      },
      cuotas: [{ porcentaje: 100, fecha: "2026-12-01" }],
    });

    const body = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      TipoFacturacion: "03",
      TipDocFacturacion: "1",
      NumDocFacturacion: "48570568",
      ApellidoPaternoFact: "HUAMANI",
      ApellidoMaternoFact: "ÑAHUIN",
      NombresFact: "EDSON JORDAN",
    });
    expect(body.RazonSocial).toBeUndefined();
  });

  it("propaga el mensaje del IIMP en 400 (validación)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(true, 200, { token: "t1", expiraEnSegundos: 1800 }))
      .mockResolvedValueOnce(resp(false, 400, { codigo: "SOLICITUD_INVALIDA", mensaje: "Los porcentajes de las cuotas deben sumar 100 (suman 90)" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new ReservaIimpClient().reservar(INPUT)).rejects.toMatchObject({
      status: 400,
      message: "Los porcentajes de las cuotas deben sumar 100 (suman 90)",
    });
  });

  it("propaga el 409 (stand reservado o sin tipo de cambio) con el mensaje del IIMP", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(true, 200, { token: "t1", expiraEnSegundos: 1800 }))
      .mockResolvedValueOnce(resp(false, 409, { codigo: "CONFLICTO", mensaje: "Stands ya reservados: 01. No se reservo ninguno." }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new ReservaIimpClient().reservar(INPUT)).rejects.toMatchObject({
      status: 409,
      message: "Stands ya reservados: 01. No se reservo ninguno.",
    });
  });

  it("convierte 401 (sesión vencida) en 502 para reintentar el flujo", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(true, 200, { token: "t1", expiraEnSegundos: 1800 }))
      .mockResolvedValueOnce(resp(false, 401, {}));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new ReservaIimpClient().reservar(INPUT)).rejects.toMatchObject({ status: 502 });
  });

  it("en 500 incluye el identificador del IIMP para ubicarlo en sus logs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(true, 200, { token: "t1", expiraEnSegundos: 1800 }))
      .mockResolvedValueOnce(resp(false, 500, { codigo: "ERROR_INTERNO", identificador: "abc-123" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new ReservaIimpClient().reservar(INPUT)).rejects.toMatchObject({
      status: 502,
      message: "Error del API de reserva del IIMP (abc-123)",
    });
  });
});
