import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListstandClient, resetListstandTokenCache } from "../liststand-client";

const RESPUESTA = {
  TipEvCod: 2,
  EvenCod: 19,
  Evento: "PERUMIN 38",
  Pabellones: [
    {
      Codigo: 1,
      Nombre: "PABELLÓN 1",
      Tipos: [
        {
          Codigo: 1,
          Nombre: "ESQUINERO 16MT2",
          Stands: [{ Numero: "04", Orden: 4, Area: "16.00", Precio: "15000.00", Moneda: "USD", Estado: "LIBRE" }],
        },
      ],
    },
    {
      Codigo: 0,
      Nombre: "SIN PABELLON",
      Tipos: [
        {
          Codigo: 8,
          Nombre: "MAQUINARIA 100 MT2",
          Stands: [{ Numero: "M-01", Orden: null, Area: "100.00", Precio: "58200.00", Moneda: "USD", Estado: "RESERVADO" }],
        },
      ],
    },
  ],
  success: true,
};

function resp(ok: boolean, status: number, body: unknown): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe("ListstandClient (API real de stands)", () => {
  beforeEach(() => {
    resetListstandTokenCache();
    process.env.LISTSTAND_API_URL = "https://api.test/api";
    process.env.LISTSTAND_USUARIO = "usuario";
    process.env.LISTSTAND_CLAVE = "clave";
  });

  it("hace login y aplana pabellones/tipos/stands con precio y estado", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(true, 200, { token: "t1", expiraEnSegundos: 1800 }))
      .mockResolvedValueOnce(resp(true, 200, RESPUESTA));
    vi.stubGlobal("fetch", fetchMock);

    const client = new ListstandClient();
    const filas = await client.fetchStands(2, 19);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/auth/login");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/stands/liststand");
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({
      stand: "04",
      pabellon: "PABELLÓN 1",
      tipo: "ESQUINERO 16MT2",
      area: "16.00",
      precio: "15000.00",
      estado: "LIBRE",
      moneda: "USD",
    });
    expect(filas[1]).toMatchObject({ stand: "M-01", estado: "RESERVADO" });
    vi.unstubAllGlobals();
  });

  it("reutiliza el token vigente en llamadas siguientes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(true, 200, { token: "t1", expiraEnSegundos: 1800 }))
      .mockResolvedValueOnce(resp(true, 200, RESPUESTA))
      .mockResolvedValueOnce(resp(true, 200, RESPUESTA));
    vi.stubGlobal("fetch", fetchMock);

    const client = new ListstandClient();
    await client.fetchStands(2, 19);
    await client.fetchStands(2, 19);

    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 login + 2 listados
    vi.unstubAllGlobals();
  });

  it("re-loguea una vez cuando el token esta vencido (401)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(true, 200, { token: "t1", expiraEnSegundos: 1800 }))
      .mockResolvedValueOnce(resp(false, 401, { codigo: "NO_AUTORIZADO", mensaje: "Token vencido" }))
      .mockResolvedValueOnce(resp(true, 200, { token: "t2", expiraEnSegundos: 1800 }))
      .mockResolvedValueOnce(resp(true, 200, RESPUESTA));
    vi.stubGlobal("fetch", fetchMock);

    const client = new ListstandClient();
    const filas = await client.fetchStands(2, 19);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(filas).toHaveLength(2);
    const ultimaCabecera = (fetchMock.mock.calls[3]?.[1] as RequestInit | undefined)?.headers as Record<string, string>;
    expect(ultimaCabecera?.Authorization).toBe("Bearer t2");
    vi.unstubAllGlobals();
  });

  it("falla claro si faltan credenciales", async () => {
    process.env.LISTSTAND_USUARIO = "";
    const client = new ListstandClient();
    await expect(client.fetchStands(2, 19)).rejects.toThrow(/LISTSTAND_USUARIO/);
  });
});
