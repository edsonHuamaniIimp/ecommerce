import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  read: vi.fn(),
  clasificar: vi.fn(),
  empresaId: vi.fn(),
  m2m: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/server/storage", () => ({ getStorage: () => ({ read: mocks.read }) }));
vi.mock("@/lib/server/integracion-m2m", () => ({ validarIntegracionM2M: mocks.m2m }));
vi.mock("@/infrastructure/persistence/dd-archivo-acceso-repository", () => ({
  clasificarArchivoDd: mocks.clasificar,
  empresaIdDeUsuario: mocks.empresaId,
}));

import { GET } from "../[...slug]/route";
import { PERMISSIONS } from "@/lib/shared/constants";

const pedir = (clave = "abc.pdf") =>
  GET(new Request(`http://localhost/uploads/${clave}`), { params: Promise.resolve({ slug: clave.split("/") }) });

beforeEach(() => {
  mocks.getSession.mockReset().mockResolvedValue(null);
  mocks.read.mockReset().mockResolvedValue({ bytes: Buffer.from("%PDF"), contentType: "application/pdf" });
  mocks.clasificar.mockReset().mockResolvedValue({ tipo: "ninguno", empresaIds: [] });
  mocks.empresaId.mockReset().mockResolvedValue(null);
  mocks.m2m.mockReset().mockReturnValue(false);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /uploads/* con la proteccion apagada (estado actual de produccion)", () => {
  it("sirve cualquier archivo como siempre, sin consultar la base de datos", async () => {
    mocks.clasificar.mockResolvedValue({ tipo: "documento", empresaIds: ["e1"] });
    const r = await pedir();
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("public, max-age=86400");
    expect(mocks.clasificar).not.toHaveBeenCalled();
  });

  it("agrega nosniff a todas las respuestas", async () => {
    expect((await pedir()).headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

describe("GET /uploads/* con UPLOADS_PROTEGIDOS=true", () => {
  beforeEach(() => {
    vi.stubEnv("UPLOADS_PROTEGIDOS", "true");
  });

  it("los archivos publicos (logos, planos) siguen abiertos y cacheables", async () => {
    const r = await pedir("logo.png");
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("public, max-age=86400");
  });

  it("un documento de DD sin sesion da 401 y no se lee del almacenamiento", async () => {
    mocks.clasificar.mockResolvedValue({ tipo: "documento", empresaIds: ["e1"] });
    const r = await pedir();
    expect(r.status).toBe(401);
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("el personal de DD descarga el documento con cabeceras privadas", async () => {
    mocks.clasificar.mockResolvedValue({ tipo: "documento", empresaIds: ["e1"] });
    mocks.getSession.mockResolvedValue({ email: "sig@iimp.org.pe", roles: [], permissions: [PERMISSIONS.DD_REVISION] });
    const r = await pedir();
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(r.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("el cliente baja el documento de su empresa pero no el de otra (403)", async () => {
    mocks.clasificar.mockResolvedValue({ tipo: "documento", empresaIds: ["e1"] });
    mocks.getSession.mockResolvedValue({ email: "cli@empresa.pe", roles: [], permissions: [PERMISSIONS.DD_FORMULARIO] });
    mocks.empresaId.mockResolvedValue("e1");
    expect((await pedir()).status).toBe(200);
    mocks.empresaId.mockResolvedValue("e2");
    expect((await pedir()).status).toBe(403);
  });

  it("la integracion M2M descarga documentos de DD con su clave", async () => {
    mocks.clasificar.mockResolvedValue({ tipo: "documento", empresaIds: ["e1"] });
    mocks.m2m.mockReturnValue(true);
    expect((await pedir()).status).toBe(200);
  });

  it("si falla la consulta de acceso se deniega (503) en lugar de filtrar el archivo", async () => {
    mocks.clasificar.mockRejectedValue(new Error("db caida"));
    const r = await pedir();
    expect(r.status).toBe(503);
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
