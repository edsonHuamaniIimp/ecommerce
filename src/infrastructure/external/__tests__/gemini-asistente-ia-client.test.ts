import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiAsistenteIaClient } from "../gemini-asistente-ia-client";
import { OpenAiAsistenteIaClient } from "../openai-asistente-ia-client";
import { DD_ASISTENTE, DD_ASISTENTE_MENSAJES, DD_ASISTENTE_MIME } from "@/lib/shared/constants";

const SOLICITUD = {
  instrucciones: "Reglas del sistema",
  prompt: "Dame un resumen",
  archivos: [{ nombre: "oefa.pdf", mimeType: DD_ASISTENTE_MIME.PDF, bytes: new Uint8Array([1, 2, 3]) }],
  textos: [{ nombre: "otro.docx", texto: "Texto del Word" }],
  timeoutMs: 20_000,
};

const ok = (texto: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: texto }] } }] }),
});
const estado = (status: number) => ({ ok: false, status, json: async () => ({}) });

/** Modelo usado en cada llamada (de la URL). */
function modelosLlamados(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map(([url]) => decodeURIComponent(String(url)).split("/models/")[1]!.split(":")[0]!);
}

function conModelos(principal: string, respaldos: string) {
  vi.stubEnv("GEMINI_API_KEY", "clave-prueba");
  vi.stubEnv("GEMINI_ASISTENTE_MODEL", principal);
  vi.stubEnv("GEMINI_ASISTENTE_MODELOS_RESPALDO", respaldos);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GeminiAsistenteIaClient", () => {
  it("sin clave no esta disponible ni llama a la API", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GOOGLE_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const cliente = new GeminiAsistenteIaClient();
    expect(cliente.disponible()).toBe(false);
    expect(await cliente.generar(SOLICITUD)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envia el PDF en inlineData, el texto y el prompt; descarta las partes de razonamiento", async () => {
    conModelos("modelo-a", "");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "pensando", thought: true }, { text: " Resumen final " }] } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await new GeminiAsistenteIaClient().generar(SOLICITUD);
    expect(r).toEqual({ texto: "Resumen final", modelo: "Gemini modelo-a" });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.systemInstruction.parts[0].text).toBe("Reglas del sistema");
    const partes = body.contents[0].parts;
    expect(partes[0].inlineData).toEqual({ mimeType: DD_ASISTENTE_MIME.PDF, data: "AQID" });
    expect(partes[1].text).toBe("Texto del Word");
    expect(partes[2].text).toContain("Dame un resumen");
  });

  it("modelo saturado (503): responde el modelo de respaldo", async () => {
    conModelos("modelo-a", "modelo-b");
    const fetchMock = vi.fn().mockResolvedValueOnce(estado(503)).mockResolvedValueOnce(ok("Desde respaldo"));
    vi.stubGlobal("fetch", fetchMock);
    const r = await new GeminiAsistenteIaClient().generar(SOLICITUD);
    expect(r).toEqual({ texto: "Desde respaldo", modelo: "Gemini modelo-b" });
    expect(modelosLlamados(fetchMock)).toEqual(["modelo-a", "modelo-b"]);
  });

  it("modelo que no responde a tiempo: pasa al respaldo", async () => {
    conModelos("modelo-a", "modelo-b");
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("The operation was aborted due to timeout", "TimeoutError"))
      .mockResolvedValueOnce(ok("Desde respaldo"));
    vi.stubGlobal("fetch", fetchMock);
    expect((await new GeminiAsistenteIaClient().generar(SOLICITUD))?.texto).toBe("Desde respaldo");
  });

  it("todos los modelos saturados: error claro 503", async () => {
    conModelos("modelo-a", "modelo-b, modelo-c");
    const fetchMock = vi.fn().mockResolvedValue(estado(503));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new GeminiAsistenteIaClient().generar(SOLICITUD)).rejects.toMatchObject({
      status: 503,
      message: DD_ASISTENTE_MENSAJES.IA_SATURADA,
    });
    expect(modelosLlamados(fetchMock)).toEqual(["modelo-a", "modelo-b", "modelo-c"]);
  });

  it("modelo retirado (404) pasa al siguiente; si ninguno da texto ni estaba saturado: null", async () => {
    conModelos("modelo-a", "modelo-b");
    const fetchMock = vi.fn().mockResolvedValue(estado(404));
    vi.stubGlobal("fetch", fetchMock);
    expect(await new GeminiAsistenteIaClient().generar(SOLICITUD)).toBeNull();
    expect(modelosLlamados(fetchMock)).toEqual(["modelo-a", "modelo-b"]);
  });

  it("modelo colgado: tras el escalon lanza el respaldo en paralelo, usa su respuesta y cancela el colgado", async () => {
    vi.useFakeTimers();
    try {
      conModelos("modelo-a", "modelo-b");
      let senalColgado: AbortSignal | undefined;
      const fetchMock = vi.fn((url: string, init: RequestInit) => {
        if (url.includes("modelo-a")) {
          senalColgado = init.signal!;
          return new Promise(() => undefined);
        }
        return Promise.resolve(ok("Desde respaldo"));
      });
      vi.stubGlobal("fetch", fetchMock);
      const promesa = new GeminiAsistenteIaClient().generar(SOLICITUD);
      await vi.advanceTimersByTimeAsync(DD_ASISTENTE.ESCALON_RESPALDO_MS - 100);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(200);
      expect(await promesa).toEqual({ texto: "Desde respaldo", modelo: "Gemini modelo-b" });
      expect(senalColgado?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("todos colgados hasta el plazo: error claro 503", async () => {
    vi.useFakeTimers();
    try {
      conModelos("modelo-a", "modelo-b");
      const fetchMock = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_, rechazar) => init.signal!.addEventListener("abort", () => rechazar(new DOMException("abortado", "AbortError")))),
      );
      vi.stubGlobal("fetch", fetchMock);
      const promesa = new GeminiAsistenteIaClient().generar(SOLICITUD);
      const verificacion = expect(promesa).rejects.toMatchObject({ status: 503, message: DD_ASISTENTE_MENSAJES.IA_SATURADA });
      await vi.advanceTimersByTimeAsync(SOLICITUD.timeoutMs + 100);
      await verificacion;
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("OpenAiAsistenteIaClient", () => {
  it("envia el PDF como archivo y la imagen como image_url", async () => {
    vi.stubEnv("OPENAI_API_KEY", "clave-prueba");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "Respuesta" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await new OpenAiAsistenteIaClient().generar({
      ...SOLICITUD,
      archivos: [...SOLICITUD.archivos, { nombre: "captura.png", mimeType: DD_ASISTENTE_MIME.PNG, bytes: new Uint8Array([1]) }],
    });
    expect(r?.texto).toBe("Respuesta");
    expect(r?.modelo).toContain("OpenAI");
    const contenido = JSON.parse(fetchMock.mock.calls[0]![1].body as string).messages[1].content;
    expect(contenido[0]).toMatchObject({ type: "file", file: { filename: "oefa.pdf" } });
    expect(contenido[1].type).toBe("image_url");
    expect(contenido[1].image_url.url.startsWith(`data:${DD_ASISTENTE_MIME.PNG};base64,`)).toBe(true);
  });
});
