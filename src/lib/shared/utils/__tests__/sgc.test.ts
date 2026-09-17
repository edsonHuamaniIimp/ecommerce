import { describe, it, expect } from "vitest";
import {
  comparacionTiempoConstante,
  construirIdempotencyKey,
  hmacSha256Hex,
  mimeDesdeNombre,
  parsearFirmaSgc,
  sha256Hex,
  verificarFirmaSgc,
} from "../sgc";
import { SGC_IDEMPOTENCY_PREFIX, SGC_MIME_TYPE_DEFAULT } from "@/lib/shared/constants";

const SECRETO = "sgc_webhook_secret";

describe("construirIdempotencyKey", () => {
  it("deberia usar el prefijo y el id de la solicitud", () => {
    expect(construirIdempotencyKey("sol-123")).toBe(`${SGC_IDEMPOTENCY_PREFIX}/sol-123`);
  });

  it("deberia ser determinista para el mismo id", () => {
    expect(construirIdempotencyKey("sol-123")).toBe(construirIdempotencyKey("sol-123"));
  });

  it("deberia lanzar error cuando el id esta vacio", () => {
    expect(() => construirIdempotencyKey("   ")).toThrow();
  });
});

describe("sha256Hex", () => {
  it("deberia calcular el hash conocido de un arreglo vacio", async () => {
    expect(await sha256Hex(new Uint8Array())).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("deberia calcular el hash de 'abc' en hexadecimal minuscula", async () => {
    const bytes = new TextEncoder().encode("abc");
    expect(await sha256Hex(bytes)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("mimeDesdeNombre", () => {
  it("deberia mapear extensiones admitidas", () => {
    expect(mimeDesdeNombre("contrato.pdf")).toBe("application/pdf");
    expect(mimeDesdeNombre("anexo.PNG")).toBe("image/png");
    expect(mimeDesdeNombre("foto.jpeg")).toBe("image/jpeg");
  });

  it("deberia devolver el mime por defecto para extensiones desconocidas", () => {
    expect(mimeDesdeNombre("archivo.exe")).toBe(SGC_MIME_TYPE_DEFAULT);
  });
});

describe("hmacSha256Hex", () => {
  it("deberia calcular el HMAC conocido de un mensaje", async () => {
    const firma = await hmacSha256Hex("key", "The quick brown fox jumps over the lazy dog");
    expect(firma).toBe("f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
  });
});

describe("comparacionTiempoConstante", () => {
  it("deberia ser verdadero solo si ambos strings coinciden", () => {
    expect(comparacionTiempoConstante("abc", "abc")).toBe(true);
    expect(comparacionTiempoConstante("abc", "abd")).toBe(false);
    expect(comparacionTiempoConstante("abc", "ab")).toBe(false);
  });
});

describe("parsearFirmaSgc", () => {
  it("deberia extraer timestamp y firma", () => {
    expect(parsearFirmaSgc("t=1757894400,v1=abcdef")).toEqual({ timestamp: 1757894400, firma: "abcdef" });
  });

  it("deberia devolver null si falta alguna parte", () => {
    expect(parsearFirmaSgc("v1=abcdef")).toBeNull();
    expect(parsearFirmaSgc("t=1757894400")).toBeNull();
    expect(parsearFirmaSgc("")).toBeNull();
  });
});

describe("verificarFirmaSgc", () => {
  it("deberia aceptar una firma valida dentro de la ventana de tolerancia", async () => {
    const payload = '{"eventId":"e1"}';
    const firma = await hmacSha256Hex(SECRETO, `1000.${payload}`);
    const ok = await verificarFirmaSgc({ secret: SECRETO, header: `t=1000,v1=${firma}`, payload, ahoraSegundos: 1000 });
    expect(ok).toBe(true);
  });

  it("deberia rechazar una firma con secreto distinto", async () => {
    const payload = "{}";
    const firma = await hmacSha256Hex("otro", `1000.${payload}`);
    const ok = await verificarFirmaSgc({ secret: SECRETO, header: `t=1000,v1=${firma}`, payload, ahoraSegundos: 1000 });
    expect(ok).toBe(false);
  });

  it("deberia rechazar un timestamp fuera de la tolerancia", async () => {
    const payload = "{}";
    const firma = await hmacSha256Hex(SECRETO, `1000.${payload}`);
    const ok = await verificarFirmaSgc({ secret: SECRETO, header: `t=1000,v1=${firma}`, payload, ahoraSegundos: 1400 });
    expect(ok).toBe(false);
  });

  it("deberia rechazar si no hay header o secreto", async () => {
    expect(await verificarFirmaSgc({ secret: SECRETO, header: null, payload: "{}", ahoraSegundos: 1000 })).toBe(false);
    expect(await verificarFirmaSgc({ secret: "", header: "t=1000,v1=x", payload: "{}", ahoraSegundos: 1000 })).toBe(false);
  });
});
