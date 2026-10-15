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
  numeroSolicitud: "CTRS-0f8a1b2c3d4e5f60718293040a",
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
  archivos: [
    { tipo: "OC", link: "https://web.iimp.org/archivos/oc-4501.pdf", nombre: "OC 4501" },
    { tipo: "HES", cuota: 1, link: "https://web.iimp.org/archivos/hes-c1.pdf" },
  ],
};

const RESPUESTA = {
  NumeroSolicitud: "CTRS-0f8a1b2c3d4e5f60718293040a",
  TipEvCod: 2,
  EvenCod: 19,
  Contrato: "0000000001",
  CuentaCorriente: 1,
  Cliente: { Tipo: "E", Codigo: "E0000001153", Nombre: "HIDROSTAL S.A.", TipDocumento: "6", NumDocumento: "20100171814" },
  Moneda: "USD",
  Stands: [{ Numero: "01", Tipo: "PREFERENCIAL 6MT2", Pabellon: "PABELLON 1", Area: "6.00", Precio: "9240.00" }],
  Cuotas: [
    { Cuota: 1, Porcentaje: "40", Fecha: "2026-12-01", BaseImponible: "3696.00", IGV: "665.28", Total: "4361.28" },
    { Cuota: 2, Porcentaje: "60", Fecha: "2027-01-15", BaseImponible: "5544.00", IGV: "997.92", Total: "6541.92" },
  ],
  BaseImponible: "9240.00",
  IGV: "1663.20",
  Total: "10903.20",
  Archivos: [
    { Item: 1, Tipo: "OC", Link: "https://web.iimp.org/archivos/oc-4501.pdf", Nombre: "OC 4501", Fecha: "2026-10-13T18:50:00" },
    { Item: 2, Tipo: "HES", Cuota: 1, Link: "https://web.iimp.org/archivos/hes-c1.pdf", Fecha: "2026-10-13T18:50:00" },
  ],
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

  it("envía el payload en PascalCase y mapea la respuesta v2 (sin comprobante, con archivos)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(true, 200, { token: "t1", expiraEnSegundos: 1800 }))
      .mockResolvedValueOnce(resp(true, 201, RESPUESTA));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await new ReservaIimpClient().reservar(INPUT);

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/auth/login");
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("https://api.test/api/stands/reserva");
    const body = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body)) as Record<string, unknown>;
    /* Igualdad estricta: al IIMP solo viajan los campos de la guia (ninguno extra). */
    expect(body).toEqual({
      NumeroSolicitud: "CTRS-0f8a1b2c3d4e5f60718293040a",
      TipEvCod: 2,
      EvenCod: 19,
      Stands: ["01", "21"],
      TipoFacturacion: "01",
      TipDocFacturacion: "6",
      NumDocFacturacion: "20100171814",
      RazonSocial: "HIDROSTAL S.A.",
      DirFacturacion: "CAL. PORTADA DEL SOL NRO. 722",
      Web: "https://www.hidrostal.com.pe",
      Telefono: "51-1-3191000",
      Friso: "HIDROSTAL",
      Contactos: {
        Contrato: { Nombre: "Manuel Mendieta", Cargo: "Representante Legal", TipoDocumento: "1", NumDocumento: "10295079", Email: "mmendieta@hidrostal.com.pe" },
        Pagos: { Nombre: "Manuel Mendieta", Email: "facturacion@hidrostal.com.pe" },
      },
      Cuotas: [
        { Porcentaje: 40, Fecha: "2026-12-01" },
        { Porcentaje: 60, Fecha: "2027-01-15" },
      ],
      Archivos: [
        { Tipo: "OC", Link: "https://web.iimp.org/archivos/oc-4501.pdf", Nombre: "OC 4501" },
        { Tipo: "HES", Cuota: 1, Link: "https://web.iimp.org/archivos/hes-c1.pdf" },
      ],
    });
    expect(resultado.numeroSolicitud).toBe("CTRS-0f8a1b2c3d4e5f60718293040a");
    expect(resultado.contrato).toBe("0000000001");
    expect(resultado.cuentaCorriente).toBe(1);
    expect(resultado.cliente.codigo).toBe("E0000001153");
    /* v2: la reserva ya no emite comprobantes; el campo documento queda nulo. */
    expect(resultado.cuotas[0]?.documento).toBeNull();
    expect(resultado.cuotas[1]?.documento).toBeNull();
    expect(resultado.archivos).toHaveLength(2);
    expect(resultado.archivos[0]).toMatchObject({ item: 1, tipo: "OC", link: "https://web.iimp.org/archivos/oc-4501.pdf", nombre: "OC 4501" });
    expect(resultado.archivos[1]).toMatchObject({ item: 2, tipo: "HES", cuota: 1 });
    expect(resultado.total).toBe("10903.20");
  });

  it("boleta a persona: envia nombres/apellidos y omite RazonSocial", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(true, 200, { token: "t1", expiraEnSegundos: 1800 }))
      .mockResolvedValueOnce(resp(true, 201, RESPUESTA));
    vi.stubGlobal("fetch", fetchMock);

    await new ReservaIimpClient().reservar({
      numeroSolicitud: "CTRS-boleta-48570568",
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

  it("agrega archivos a la cuenta corriente y devuelve la lista completa", async () => {
    const lista = {
      Archivos: [
        { Item: 1, Tipo: "OC", Link: "https://web.iimp.org/archivos/oc-4501.pdf", Nombre: "OC 4501", Fecha: "2026-10-13T18:40:05" },
        { Item: 2, Tipo: "DETRACCION", Cuota: 1, Link: "https://web.iimp.org/archivos/det-1.pdf", Fecha: "2026-10-13T18:40:05" },
      ],
      success: true,
      message: "Success",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(true, 200, { token: "t1", expiraEnSegundos: 1800 }))
      .mockResolvedValueOnce(resp(true, 201, lista));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await new ReservaIimpClient().agregarArchivos({
      tipEvCod: 2,
      evenCod: 19,
      cuentaCorriente: 7,
      archivos: [{ tipo: "DETRACCION", cuota: 1, link: "https://web.iimp.org/archivos/det-1.pdf" }],
    });

    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("https://api.test/api/stands/archivos");
    const body = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body)) as Record<string, unknown>;
    expect(body).toEqual({
      TipEvCod: 2,
      EvenCod: 19,
      CuentaCorriente: 7,
      Archivos: [{ Tipo: "DETRACCION", Cuota: 1, Link: "https://web.iimp.org/archivos/det-1.pdf" }],
    });
    expect(resultado).toHaveLength(2);
    expect(resultado[1]).toMatchObject({ item: 2, tipo: "DETRACCION", cuota: 1 });
  });

  it("lista los archivos registrados en la cuenta corriente", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(true, 200, { token: "t1", expiraEnSegundos: 1800 }))
      .mockResolvedValueOnce(resp(true, 200, { Archivos: [{ Item: 1, Tipo: "HES", Cuota: 1, Link: "https://web.iimp.org/archivos/hes-1.pdf", Fecha: "2026-10-13T18:40:05" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await new ReservaIimpClient().listarArchivos({ tipEvCod: 2, evenCod: 19, cuentaCorriente: 7 });

    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("https://api.test/api/stands/archivos/lista");
    const body = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body)) as Record<string, unknown>;
    expect(body).toEqual({ TipEvCod: 2, EvenCod: 19, CuentaCorriente: 7 });
    expect(resultado[0]).toMatchObject({ item: 1, tipo: "HES", cuota: 1, nombre: null });
  });

  it("archivos con NumeroSolicitud (v3): el body usa NumeroSolicitud en lugar del trio clasico", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(true, 200, { token: "t1", expiraEnSegundos: 1800 }))
      .mockResolvedValueOnce(resp(true, 201, { NumeroSolicitud: "CTRS-s1", Archivos: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await new ReservaIimpClient().agregarArchivos({
      numeroSolicitud: "CTRS-s1",
      archivos: [{ tipo: "OC", link: "https://web.iimp.org/archivos/oc-1.pdf" }],
    });

    const body = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body)) as Record<string, unknown>;
    expect(body).toEqual({
      NumeroSolicitud: "CTRS-s1",
      Archivos: [{ Tipo: "OC", Link: "https://web.iimp.org/archivos/oc-1.pdf" }],
    });
  });

  it("elimina un archivo por su item y devuelve la lista completa", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(true, 200, { token: "t1", expiraEnSegundos: 1800 }))
      .mockResolvedValueOnce(resp(true, 200, { Archivos: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await new ReservaIimpClient().eliminarArchivo({ tipEvCod: 2, evenCod: 19, cuentaCorriente: 7, item: 3 });

    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("https://api.test/api/stands/archivos/eliminar");
    const body = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body)) as Record<string, unknown>;
    expect(body).toEqual({ TipEvCod: 2, EvenCod: 19, CuentaCorriente: 7, Item: 3 });
    expect(resultado).toEqual([]);
  });

  it("archivos: propaga el mensaje del IIMP en 400 y el 404 de cuenta inexistente", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(true, 200, { token: "t1", expiraEnSegundos: 1800 }))
      .mockResolvedValueOnce(resp(false, 400, { codigo: "SOLICITUD_INVALIDA", mensaje: "Archivos[2]: la cuenta corriente no tiene la cuota 3 (tiene 2)" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      new ReservaIimpClient().agregarArchivos({ tipEvCod: 2, evenCod: 19, cuentaCorriente: 7, archivos: [{ tipo: "DETRACCION", cuota: 3, link: "https://x/d.pdf" }] }),
    ).rejects.toMatchObject({ status: 400, message: "Archivos[2]: la cuenta corriente no tiene la cuota 3 (tiene 2)" });

    const fetchMock2 = vi
      .fn()
      .mockResolvedValueOnce(resp(true, 200, { token: "t1", expiraEnSegundos: 1800 }))
      .mockResolvedValueOnce(resp(false, 404, { codigo: "NO_ENCONTRADO", mensaje: "La cuenta corriente no existe" }));
    resetListstandTokenCache();
    vi.stubGlobal("fetch", fetchMock2);
    await expect(new ReservaIimpClient().listarArchivos({ tipEvCod: 2, evenCod: 19, cuentaCorriente: 99 })).rejects.toMatchObject({
      status: 404,
      message: "La cuenta corriente no existe",
    });
  });
});
