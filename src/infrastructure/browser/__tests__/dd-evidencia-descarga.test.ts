import { afterEach, describe, expect, it, vi } from "vitest";
import { CHROMIUM_ARGS_BASE, CHROMIUM_ENV, descargarFuente } from "../dd-evidencia-captura";
import { DomainError } from "@/domain/errors/domain-error";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("descargarFuente", () => {
  it("envia cabeceras de navegador y un limite de tiempo (el portal de Australia ignora peticiones sin User-Agent)", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    await descargarFuente("https://ejemplo.test/lista.xlsx");
    const [url, opciones] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ejemplo.test/lista.xlsx");
    expect((opciones.headers as Record<string, string>)["user-agent"]).toMatch(/Mozilla\/5\.0/);
    expect(opciones.signal).toBeInstanceOf(AbortSignal);
  });

  it("si la fuente no responde a tiempo lanza un error claro (504) en vez de colgarse", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new DOMException("timeout", "TimeoutError");
    }));
    const error = await descargarFuente("https://ejemplo.test/lista.xlsx").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).message).toMatch(/no respondió a tiempo/);
    expect((error as DomainError).status).toBe(504);
  });

  it("si no hay conexion lo informa distinto al agotamiento de tiempo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));
    const error = await descargarFuente("https://ejemplo.test/lista.xlsx").catch((e: unknown) => e);
    expect((error as DomainError).message).toMatch(/No se pudo conectar/);
  });
});

describe("arranque de Chromium en contenedores", () => {
  it("usa un HOME escribible y carpeta de volcados (el usuario de la app tiene HOME=/nonexistent)", () => {
    expect(CHROMIUM_ENV.HOME).toBeTruthy();
    expect(CHROMIUM_ENV.HOME).not.toBe("/nonexistent");
    expect(CHROMIUM_ARGS_BASE).toEqual(expect.arrayContaining(["--no-sandbox", "--disable-dev-shm-usage", "--crash-dumps-dir=/tmp"]));
  });
});
